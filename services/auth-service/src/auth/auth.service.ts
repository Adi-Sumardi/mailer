import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, randomUUID, createHash } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { authenticator } from 'otplib';
import * as qrcode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { MailAppClientService } from '../mail-app-client/mail-app-client.service';
import { DomainProvisioningClientService } from '../domain-provisioning-client/domain-provisioning-client.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { Login2FaDto } from './dto/login-2fa.dto';
import { Verify2FaDto } from './dto/verify-2fa.dto';
import { JwtPayload } from './jwt-payload.interface';

const PASSWORD_HASH_ROUNDS = 10;
const REFRESH_TOKEN_BYTES = 32;
const DEFAULT_REFRESH_TOKEN_DAYS = 30;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly mailAppClient: MailAppClientService,
    private readonly domainProvisioningClient: DomainProvisioningClientService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException(`Email ${dto.email} sudah terdaftar`);
    }

    // BR-08: validasi silang tenantId ke domain-provisioning. Fail-CLOSED kalau tenant
    // terkonfirmasi tidak ada (exists === false); fail-OPEN kalau service tidak terjangkau
    // (exists === null) — auth-service tidak boleh berhenti total hanya karena satu
    // dependency down, tapi tidak boleh membiarkan tenantId yang jelas-jelas salah lolos.
    if (dto.role !== 'super_admin' && dto.tenantId) {
      const exists = await this.domainProvisioningClient.tenantExists(dto.tenantId);
      if (exists === false) {
        throw new BadRequestException(`Tenant ${dto.tenantId} tidak ditemukan`);
      }
      if (exists === null) {
        this.logger.warn(
          `Tidak bisa memverifikasi tenantId ${dto.tenantId} (domain-provisioning tidak terjangkau) — lanjut fail-open`,
        );
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, PASSWORD_HASH_ROUNDS);

    // Generate id di awal supaya bisa dipakai sebagai userId saat provisioning mailbox
    // (mail-app-service butuh userId sebelum User row ini benar-benar dibuat).
    const userId = randomUUID();

    // FR-07: end_user baru otomatis diprovisikan mailbox lewat mail-app-service.
    // Kegagalan panggilan ini tidak menggagalkan registrasi (lihat MailAppClientService).
    const mailboxId = await this.mailAppClient.provisionMailbox(userId, dto.email);

    const user = await this.prisma.user.create({
      data: {
        id: userId,
        email: dto.email,
        passwordHash,
        role: dto.role,
        tenantId: dto.role === 'super_admin' ? null : dto.tenantId,
        mailboxId,
      },
    });

    return {
      user: this.toPublicUser(user),
      accessToken: this.issueAccessToken(user),
      refreshToken: await this.issueRefreshToken(user.id),
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      throw new UnauthorizedException('Email atau password salah');
    }

    const passwordMatches = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordMatches) {
      throw new UnauthorizedException('Email atau password salah');
    }

    user.mailboxId = await this.ensureMailbox(user);

    if (user.isTwoFactorEnabled) {
      const mfaToken = this.jwtService.sign(
        { sub: user.id, isMfaPending: true },
        { expiresIn: '5m' },
      );
      return {
        require2FA: true,
        mfaToken,
      };
    }

    return {
      user: this.toPublicUser(user),
      accessToken: this.issueAccessToken(user),
      refreshToken: await this.issueRefreshToken(user.id),
    };
  }

  async login2FA(dto: Login2FaDto) {
    let payload: { sub: string; isMfaPending?: boolean };
    try {
      payload = this.jwtService.verify(dto.mfaToken);
    } catch {
      throw new UnauthorizedException('Sesi 2FA telah kedaluwarsa, silakan login ulang');
    }

    if (!payload.isMfaPending || !payload.sub) {
      throw new UnauthorizedException('Token 2FA tidak valid');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isTwoFactorEnabled || !user.twoFactorSecret) {
      throw new UnauthorizedException('Google 2FA tidak diaktifkan pada akun ini');
    }

    const isValid = authenticator.verify({ token: dto.code, secret: user.twoFactorSecret });
    if (!isValid) {
      throw new UnauthorizedException('Kode 2FA salah atau kedaluwarsa');
    }

    user.mailboxId = await this.ensureMailbox(user);

    return {
      user: this.toPublicUser(user),
      accessToken: this.issueAccessToken(user),
      refreshToken: await this.issueRefreshToken(user.id),
    };
  }

  async generate2FA(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User ${userId} tidak ditemukan`);
    }

    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(user.email, 'SendagoMail', secret);
    const qrCodeUrl = await qrcode.toDataURL(otpauthUrl);

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret },
    });

    return { secret, otpauthUrl, qrCodeUrl };
  }

  async enable2FA(userId: string, dto: Verify2FaDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.twoFactorSecret) {
      throw new BadRequestException('Kunci 2FA belum dibuat. Silakan generate QR Code terlebih dahulu.');
    }

    const isValid = authenticator.verify({ token: dto.code, secret: user.twoFactorSecret });
    if (!isValid) {
      throw new BadRequestException('Kode 2FA salah atau kedaluwarsa');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { isTwoFactorEnabled: true },
    });

    return { success: true, message: 'Google 2FA berhasil diaktifkan' };
  }

  async disable2FA(userId: string, dto: Verify2FaDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isTwoFactorEnabled || !user.twoFactorSecret) {
      throw new BadRequestException('Google 2FA belum aktif pada akun ini');
    }

    const isValid = authenticator.verify({ token: dto.code, secret: user.twoFactorSecret });
    if (!isValid) {
      throw new BadRequestException('Kode 2FA salah atau kedaluwarsa');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { isTwoFactorEnabled: false, twoFactorSecret: null },
    });

    return { success: true, message: 'Google 2FA berhasil dinonaktifkan' };
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token tidak valid atau kedaluwarsa');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    stored.user.mailboxId = await this.ensureMailbox(stored.user);

    return {
      user: this.toPublicUser(stored.user),
      accessToken: this.issueAccessToken(stored.user),
      refreshToken: await this.issueRefreshToken(stored.user.id),
    };
  }

  async logout(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  async findByIdOrThrow(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User ${id} tidak ditemukan`);
    }
    user.mailboxId = await this.ensureMailbox(user);
    const publicUser = this.toPublicUser(user);
    const accessToken = this.issueAccessToken(user);
    return { ...publicUser, accessToken };
  }

  private async ensureMailbox(user: { id: string; email: string; mailboxId: string | null }): Promise<string | null> {
    if (user.mailboxId) return user.mailboxId;
    try {
      const mailboxId = await this.mailAppClient.provisionMailbox(user.id, user.email);
      if (mailboxId) {
        await this.prisma.user.update({
          where: { id: user.id },
          data: { mailboxId },
        });
      }
      return mailboxId;
    } catch (err) {
      this.logger.warn(`Gagal provision mailbox untuk ${user.email}: ${(err as Error).message}`);
      return null;
    }
  }

  private issueAccessToken(user: {
    id: string;
    role: string;
    tenantId: string | null;
    mailboxId: string | null;
  }) {
    const payload: JwtPayload = {
      sub: user.id,
      role: user.role as JwtPayload['role'],
      tenantId: user.tenantId,
      mailboxId: user.mailboxId,
    };
    return this.jwtService.sign(payload);
  }

  private async issueRefreshToken(userId: string): Promise<string> {
    const token = randomBytes(REFRESH_TOKEN_BYTES).toString('hex');
    const days = Number(this.config.get<string>('REFRESH_TOKEN_DAYS', String(DEFAULT_REFRESH_TOKEN_DAYS)));
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: { userId, tokenHash: this.hashToken(token), expiresAt },
    });

    return token;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private toPublicUser(user: {
    id: string;
    email: string;
    role: string;
    tenantId: string | null;
    mailboxId: string | null;
    isTwoFactorEnabled?: boolean;
    createdAt: Date;
  }) {
    const { id, email, role, tenantId, mailboxId, isTwoFactorEnabled = false, createdAt } = user;
    return { id, email, role, tenantId, mailboxId, isTwoFactorEnabled, createdAt };
  }
}

