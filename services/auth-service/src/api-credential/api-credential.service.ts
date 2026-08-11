import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes, createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateApiCredentialDto } from './dto/create-api-credential.dto';
import { ValidateApiCredentialDto } from './dto/validate-api-credential.dto';

// FR-25 (paket berlangganan) belum benar-benar dibangun sebagai sistem billing — ini
// placeholder kuota harian. Sandbox SELALU dibatasi kecil & gratis ("gratis tapi dibatesin
// kirim emailnya"). Production pakai limit default sampai nanti benar-benar ditarik dari
// paket tenant sungguhan (lihat README untuk detail & TODO).
const SANDBOX_DAILY_EMAIL_LIMIT = 50;
const PRODUCTION_DEFAULT_DAILY_EMAIL_LIMIT = 5000;

@Injectable()
export class ApiCredentialService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, dto: CreateApiCredentialDto) {
    const environment = dto.environment ?? 'sandbox';
    const memberId = `mbr_${randomBytes(8).toString('hex')}`;
    const secret = randomBytes(24).toString('hex');
    const secretHash = this.hashSecret(secret);
    const dailyEmailLimit =
      environment === 'sandbox' ? SANDBOX_DAILY_EMAIL_LIMIT : PRODUCTION_DEFAULT_DAILY_EMAIL_LIMIT;
    const mailboxId = await this.resolveMailboxId(tenantId, dto.mailboxId);

    const credential = await this.prisma.apiCredential.create({
      data: { tenantId, name: dto.name, environment, memberId, secretHash, dailyEmailLimit, mailboxId },
    });

    // Secret mentah HANYA muncul di response ini, sekali — setelahnya cuma hash yang disimpan.
    return { ...this.toPublic(credential), secret };
  }

  // Kalau mailboxId tidak diisi eksplisit, pakai mailbox user pertama di tenant yang
  // sudah terprovisi (FR-07) sebagai identitas pengirim default credential ini.
  private async resolveMailboxId(tenantId: string, explicitMailboxId?: string): Promise<string> {
    if (explicitMailboxId) {
      const owner = await this.prisma.user.findFirst({
        where: { tenantId, mailboxId: explicitMailboxId },
      });
      if (!owner) {
        throw new BadRequestException('mailboxId tidak ditemukan atau bukan milik tenant ini');
      }
      return explicitMailboxId;
    }

    const firstUser = await this.prisma.user.findFirst({
      where: { tenantId, mailboxId: { not: null } },
      orderBy: { createdAt: 'asc' },
    });
    if (!firstUser?.mailboxId) {
      throw new BadRequestException(
        'Belum ada mailbox terprovisi di tenant ini — pastikan minimal satu user sudah punya mailbox sebelum membuat API credential',
      );
    }
    return firstUser.mailboxId;
  }

  async findAll(tenantId: string | null) {
    const credentials = await this.prisma.apiCredential.findMany({
      // tenantId null = super_admin → list semua credential tanpa filter
      where: tenantId ? { tenantId } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    return credentials.map((c) => this.toPublic(c));
  }

  async revoke(tenantId: string | null, id: string) {
    const credential = await this.prisma.apiCredential.findUnique({ where: { id } });
    // tenantId null = super_admin → skip validasi kepemilikan tenant
    if (!credential || (tenantId && credential.tenantId !== tenantId)) {
      throw new NotFoundException(`API credential ${id} tidak ditemukan`);
    }
    if (credential.revokedAt) {
      throw new ForbiddenException('Credential sudah di-revoke sebelumnya');
    }
    const updated = await this.prisma.apiCredential.update({
      where: { id },
      data: { revokedAt: new Date() },
    });
    return this.toPublic(updated);
  }

  // Dipanggil oleh mail-app-service (POST /emails/api-send) sebelum mengizinkan pengiriman
  // email lewat API eksternal (bukan lewat UI/JWT user biasa) — memverifikasi memberId+secret,
  // mengecek & mengonsumsi kuota harian, dan mengembalikan mailboxId pengirim.
  async validateAndConsumeQuota(dto: ValidateApiCredentialDto) {
    const credential = await this.prisma.apiCredential.findUnique({
      where: { memberId: dto.memberId },
    });

    if (!credential || credential.secretHash !== this.hashSecret(dto.secret)) {
      return { valid: false as const, reason: 'Member ID atau secret tidak valid' };
    }
    if (credential.revokedAt) {
      return { valid: false as const, reason: 'Credential sudah di-revoke' };
    }

    const resetNeeded = !this.isSameUtcDay(credential.quotaResetAt, new Date());
    const emailsSentToday = resetNeeded ? 0 : credential.emailsSentToday;

    if (emailsSentToday >= credential.dailyEmailLimit) {
      return {
        valid: false as const,
        reason: `Kuota harian (${credential.dailyEmailLimit}) untuk environment '${credential.environment}' sudah habis`,
      };
    }

    const startOfUtcDay = new Date();
    startOfUtcDay.setUTCHours(0, 0, 0, 0);

    const updated = await this.prisma.apiCredential.update({
      where: { id: credential.id },
      data: {
        emailsSentToday: emailsSentToday + 1,
        // Simpan awal hari UTC (bukan `now`) agar data audit kuota konsisten dan terbaca.
        quotaResetAt: resetNeeded ? startOfUtcDay : credential.quotaResetAt,
      },
    });

    return {
      valid: true as const,
      tenantId: credential.tenantId,
      mailboxId: credential.mailboxId,
      environment: credential.environment,
      remainingQuota: updated.dailyEmailLimit - updated.emailsSentToday,
    };
  }

  private isSameUtcDay(a: Date, b: Date): boolean {
    return a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
  }

  private hashSecret(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
  }

  private toPublic(credential: {
    id: string;
    tenantId: string;
    name: string;
    environment: string;
    memberId: string;
    mailboxId: string;
    dailyEmailLimit: number;
    emailsSentToday: number;
    createdAt: Date;
    revokedAt: Date | null;
  }) {
    const {
      id,
      tenantId,
      name,
      environment,
      memberId,
      mailboxId,
      dailyEmailLimit,
      emailsSentToday,
      createdAt,
      revokedAt,
    } = credential;
    return { id, tenantId, name, environment, memberId, mailboxId, dailyEmailLimit, emailsSentToday, createdAt, revokedAt };
  }
}
