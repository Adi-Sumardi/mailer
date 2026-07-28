import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
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

    const credential = await this.prisma.apiCredential.create({
      data: { tenantId, name: dto.name, environment, memberId, secretHash, dailyEmailLimit },
    });

    // Secret mentah HANYA muncul di response ini, sekali — setelahnya cuma hash yang disimpan.
    return { ...this.toPublic(credential), secret };
  }

  async findAll(tenantId: string) {
    const credentials = await this.prisma.apiCredential.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
    return credentials.map((c) => this.toPublic(c));
  }

  async revoke(tenantId: string, id: string) {
    const credential = await this.prisma.apiCredential.findUnique({ where: { id } });
    if (!credential || credential.tenantId !== tenantId) {
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

  // Dipanggil (nantinya) oleh mail-app-service sebelum mengizinkan pengiriman email lewat
  // API eksternal (bukan lewat UI/JWT user biasa) — memverifikasi memberId+secret, mengecek
  // & mengonsumsi kuota harian. Belum ada pemanggil sungguhan dari mail-app-service saat ini
  // (lihat README) — endpoint ini sudah fungsional & teruji, tinggal di-wire.
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

    const updated = await this.prisma.apiCredential.update({
      where: { id: credential.id },
      data: {
        emailsSentToday: emailsSentToday + 1,
        quotaResetAt: resetNeeded ? new Date() : credential.quotaResetAt,
      },
    });

    return {
      valid: true as const,
      tenantId: credential.tenantId,
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
    name: string;
    environment: string;
    memberId: string;
    dailyEmailLimit: number;
    emailsSentToday: number;
    createdAt: Date;
    revokedAt: Date | null;
  }) {
    const { id, name, environment, memberId, dailyEmailLimit, emailsSentToday, createdAt, revokedAt } =
      credential;
    return { id, name, environment, memberId, dailyEmailLimit, emailsSentToday, createdAt, revokedAt };
  }
}
