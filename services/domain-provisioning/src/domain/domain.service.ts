import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDomainDto } from './dto/create-domain.dto';
import {
  buildDmarcRecord,
  buildMxRecord,
  buildSpfRecord,
  generateDkimKeyPair,
  verifyDomainTxtRecord,
} from './dns-record.util';
import { regenerateDkimSigningConfig, writeDkimKeyFile } from './dkim-handoff.util';

@Injectable()
export class DomainService {
  private readonly logger = new Logger(DomainService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  // FR-02: Tenant Admin menambahkan domain baru. Sistem generate token verifikasi TXT
  // dan langsung siapkan rekomendasi DNS (FR-03) supaya user tidak perlu tunggu verifikasi
  // selesai dulu baru dapat rekomendasi MX/SPF/DKIM/DMARC.
  async create(dto: CreateDomainDto) {
    const existing = await this.prisma.domain.findUnique({
      where: { domainName: dto.domainName },
    });
    if (existing) {
      throw new ConflictException(`Domain ${dto.domainName} sudah terdaftar`);
    }

    const verificationToken = randomBytes(16).toString('hex');
    const dkim = generateDkimKeyPair();

    const domain = await this.prisma.domain.create({
      data: {
        tenantId: dto.tenantId,
        domainName: dto.domainName,
        verificationStatus: 'pending',
        verificationToken,
        mxRecord: buildMxRecord(
          this.config.get<string>('MAIL_ENGINE_MX_HOST', 'mail.example.com'),
          Number(this.config.get<string>('MAIL_ENGINE_MX_PRIORITY', '10')),
        ),
        spfRecord: buildSpfRecord(
          this.config.get<string>('OUTBOUND_RELAY_HOST'),
          this.config.get<string>('OUTBOUND_RELAY_IP'),
        ),
        dmarcRecord: buildDmarcRecord(dto.domainName),
        dkimSelector: dkim.selector,
        dkimPublicKey: dkim.publicKeyRecord,
        dkimPrivateKey: dkim.privateKeyPem,
      },
    });

    // Hand-off private key + config signing ke direktori mail-engine (dibaca Rspamd, live-reload
    // otomatis lewat changedetector bawaan docker-mailserver — lihat dkim-handoff.util.ts).
    // Kegagalan filesystem (mis. dev tanpa mail-engine ter-clone di sebelahnya) tidak boleh
    // menggagalkan pembuatan domain di DB — hand-off bisa diulang manual lewat operasi terpisah nanti.
    try {
      const dkimDir = this.config.get<string>('DKIM_KEYS_DIR', '../../mail-engine/config/rspamd/dkim');
      const overrideDir = this.config.get<string>(
        'DKIM_OVERRIDE_DIR',
        '../../mail-engine/config/rspamd/override.d',
      );
      await writeDkimKeyFile({
        dkimDir,
        domainName: dto.domainName,
        selector: dkim.selector,
        privateKeyPem: dkim.privateKeyPem,
      });

      // Regenerate config signing dari SEMUA domain yang sudah punya DKIM key (bukan cuma yang
      // baru dibuat) — supaya file override tetap konsisten kalau sebelumnya sempat gagal ditulis.
      // Digabung dengan DKIM_STATIC_DOMAINS (domain operator platform, mis. domain super_admin,
      // yang key-nya digenerate manual lewat CLI docker-mailserver, bukan lewat aplikasi ini —
      // jadi tidak pernah ada row-nya di tabel `domain`). Tanpa ini, domain statis itu akan
      // KE-DROP diam-diam dari dkim_signing.conf setiap kali ada tenant domain lain ditambahkan,
      // karena regenerate di bawah ini penuh (bukan patch) — persis kelas bug yang sedang
      // diperbaiki di sini, jangan sampai terulang untuk domain operator sendiri.
      const allDomains = await this.prisma.domain.findMany({
        where: { dkimPrivateKey: { not: null } },
        select: { domainName: true, dkimSelector: true },
      });
      await regenerateDkimSigningConfig({
        overrideDir,
        domains: [
          ...allDomains
            .filter((d): d is { domainName: string; dkimSelector: string } => d.dkimSelector !== null)
            .map((d) => ({ domainName: d.domainName, selector: d.dkimSelector })),
          ...this.parseStaticDkimDomains(),
        ],
      });
    } catch (err) {
      this.logger.warn(
        `Gagal menulis DKIM key ke mail-engine untuk domain ${dto.domainName}: ${(err as Error).message}`,
      );
    }

    return domain;
  }

  // Format: "domain1:selector1,domain2:selector2" — domain operator platform yang DKIM-nya
  // digenerate manual di luar aplikasi ini (lihat komentar di create()). Key filenya sendiri
  // harus sudah ada di DKIM_KEYS_DIR dengan nama rsa-2048-<selector>-<domain>.private.txt,
  // service ini tidak menggenerate key untuk domain statis, cuma mendaftarkannya supaya tidak
  // ke-drop dari dkim_signing.conf.
  private parseStaticDkimDomains(): { domainName: string; selector: string }[] {
    const raw = this.config.get<string>('DKIM_STATIC_DOMAINS', '');
    return raw
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean)
      .map((entry) => {
        const [domainName, selector] = entry.split(':').map((s) => s.trim());
        return { domainName, selector: selector ?? 'mail' };
      })
      .filter((d) => d.domainName);
  }

  findAllByTenant(tenantId: string) {
    return this.prisma.domain.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneOrThrow(id: string) {
    const domain = await this.prisma.domain.findUnique({ where: { id } });
    if (!domain) {
      throw new NotFoundException(`Domain ${id} tidak ditemukan`);
    }
    return domain;
  }

  // Kartu instruksi TXT record yang harus dipasang user sebelum verifikasi (bagian dari FR-02/FR-03 UI flow)
  async getVerificationInstructions(id: string) {
    const domain = await this.findOneOrThrow(id);
    const prefix = this.config.get<string>('DOMAIN_VERIFICATION_TXT_PREFIX', 'sendagomail-verify');
    return {
      recordType: 'TXT',
      host: domain.domainName,
      value: `${prefix}=${domain.verificationToken}`,
    };
  }

  // FR-02 & FR-04: cek TXT record ke DNS publik, update status pending/verified/failed real-time.
  async verify(id: string) {
    const domain = await this.findOneOrThrow(id);
    const prefix = this.config.get<string>('DOMAIN_VERIFICATION_TXT_PREFIX', 'sendagomail-verify');

    const isVerified = await verifyDomainTxtRecord(
      domain.domainName,
      prefix,
      domain.verificationToken,
    );

    return this.prisma.domain.update({
      where: { id },
      data: {
        verificationStatus: isVerified ? 'verified' : 'failed',
        verifiedAt: isVerified ? new Date() : null,
      },
    });
  }

  // FR-04: status verifikasi domain, dipoll dari frontend
  async getStatus(id: string) {
    const domain = await this.findOneOrThrow(id);
    return { id: domain.id, verificationStatus: domain.verificationStatus };
  }

  // Rekomendasi DNS record siap-copy untuk ditampilkan di UI (FR-03), tanpa expose private key DKIM
  async getDnsRecords(id: string) {
    const domain = await this.findOneOrThrow(id);
    return {
      mx: domain.mxRecord,
      spf: domain.spfRecord,
      dmarc: domain.dmarcRecord,
      dkim: domain.dkimPublicKey
        ? {
            host: `${domain.dkimSelector}._domainkey.${domain.domainName}`,
            value: domain.dkimPublicKey,
          }
        : null,
    };
  }

  async remove(id: string) {
    await this.findOneOrThrow(id);
    return this.prisma.domain.delete({ where: { id } });
  }
}
