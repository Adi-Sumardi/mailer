import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { MailboxService } from '../mailbox/mailbox.service';
import { UpsertEmailTemplateDto } from './dto/upsert-email-template.dto';

const ALLOWED_MIME_TO_EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};
export const MAX_LOGO_SIZE_BYTES = 2 * 1024 * 1024; // 2 MB

@Injectable()
export class EmailTemplateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailboxService: MailboxService,
    private readonly config: ConfigService,
  ) {}

  private logosDir(): string {
    return this.config.get<string>('TEMPLATE_LOGOS_DIR', path.join(process.cwd(), 'template-logos'));
  }

  async get(mailboxId: string) {
    await this.mailboxService.findByIdOrThrow(mailboxId);
    return this.prisma.emailTemplate.findUnique({ where: { mailboxId } });
  }

  async upsert(mailboxId: string, dto: UpsertEmailTemplateDto) {
    await this.mailboxService.findByIdOrThrow(mailboxId);
    return this.prisma.emailTemplate.upsert({
      where: { mailboxId },
      create: { mailboxId, ...dto },
      update: dto,
    });
  }

  async saveLogo(mailboxId: string, file: { mimetype: string; size: number; buffer: Buffer }) {
    await this.mailboxService.findByIdOrThrow(mailboxId);

    const ext = ALLOWED_MIME_TO_EXT[file.mimetype];
    if (!ext) {
      throw new BadRequestException(
        `Tipe file tidak didukung (${file.mimetype}) — gunakan PNG, JPEG, WEBP, atau SVG`,
      );
    }
    if (file.size > MAX_LOGO_SIZE_BYTES) {
      throw new BadRequestException(`Ukuran file melebihi batas ${MAX_LOGO_SIZE_BYTES / 1024 / 1024}MB`);
    }

    const dir = this.logosDir();
    await fs.promises.mkdir(dir, { recursive: true });

    const existing = await this.prisma.emailTemplate.findUnique({ where: { mailboxId } });
    if (existing?.logoFilename) {
      await fs.promises.rm(path.join(dir, existing.logoFilename), { force: true });
    }

    const filename = `${mailboxId}.${ext}`;
    await fs.promises.writeFile(path.join(dir, filename), file.buffer);

    return this.prisma.emailTemplate.upsert({
      where: { mailboxId },
      create: { mailboxId, logoFilename: filename },
      update: { logoFilename: filename },
    });
  }

  async deleteLogo(mailboxId: string) {
    const existing = await this.prisma.emailTemplate.findUnique({ where: { mailboxId } });
    if (!existing?.logoFilename) {
      throw new NotFoundException('Belum ada logo untuk mailbox ini');
    }
    await fs.promises.rm(path.join(this.logosDir(), existing.logoFilename), { force: true });
    return this.prisma.emailTemplate.update({ where: { mailboxId }, data: { logoFilename: null } });
  }

  // Untuk GET .../template/logo (preview) — mengembalikan path file + content-type.
  async getLogoFile(mailboxId: string): Promise<{ filePath: string; mimeType: string }> {
    const template = await this.prisma.emailTemplate.findUnique({ where: { mailboxId } });
    if (!template?.logoFilename) {
      throw new NotFoundException('Belum ada logo untuk mailbox ini');
    }
    const ext = template.logoFilename.split('.').pop() ?? '';
    const mimeType = Object.entries(ALLOWED_MIME_TO_EXT).find(([, e]) => e === ext)?.[0] ?? 'application/octet-stream';
    return { filePath: path.join(this.logosDir(), template.logoFilename), mimeType };
  }

  // Dipakai internal oleh EmailService saat compose/dispatch — beda dari getLogoFile() yang
  // untuk HTTP response, ini mengembalikan absolute path siap dilampirkan sebagai CID attachment.
  async getForRender(mailboxId: string) {
    const template = await this.prisma.emailTemplate.findUnique({ where: { mailboxId } });
    if (!template) return null;
    const logoAbsolutePath = template.logoFilename ? path.join(this.logosDir(), template.logoFilename) : null;
    return { ...template, logoAbsolutePath };
  }
}
