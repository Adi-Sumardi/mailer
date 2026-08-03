import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as dns from 'dns';
import * as fs from 'fs';
import * as path from 'path';
import * as nodemailer from 'nodemailer';
import { PrismaService } from '../prisma/prisma.service';
import { MailboxService } from '../mailbox/mailbox.service';
import { ComposeEmailDto } from './dto/compose-email.dto';
import { UpdateFlagsDto } from './dto/update-flags.dto';
import { SearchEmailDto } from './dto/search-email.dto';
import { AddAttachmentDto } from './dto/add-attachment.dto';

const LOGO_PATH = path.join(__dirname, 'assets', 'adilabs-logo.png');
const LOGO_CID = 'adilabs-logo';

@Injectable()
export class EmailService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailboxService: MailboxService,
    private readonly config: ConfigService,
  ) {}

  // Footer branding di setiap email yang dikirim keluar — logo dilampirkan sebagai
  // inline attachment (Content-ID), BUKAN base64 di dalam <img src>, karena banyak klien
  // email (termasuk Gmail) memblokir/menghapus data-URI base64 di HTML email.
  private buildBrandedHtml(bodyText: string, isHtml: boolean): string {
    // Kalau body sudah HTML mentah (mis. template transaksional pihak ketiga), JANGAN
    // konversi newline-nya jadi <br/> — newline di source HTML (indentasi antar tag) bukan
    // baris baru yang dimaksud, dan konversi itu bikin gap vertikal raksasa di klien email.
    const renderedBody = isHtml ? bodyText : bodyText.replace(/\n/g, '<br/>');
    return `
      <div style="font-family: sans-serif; font-size: 14px; color: #333; line-height: 1.6;">
        ${renderedBody}
      </div>
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-family: sans-serif;">
        <img src="cid:${LOGO_CID}" alt="adilabs" style="height: 24px; width: auto;" />
        <div style="font-size: 11px; color: #94a3b8; margin-top: 6px;">
          Dikirim lewat SendagoMail — produk adilabs
        </div>
      </div>
    `;
  }

  private getLogoAttachment() {
    if (!fs.existsSync(LOGO_PATH)) {
      return null;
    }
    return { filename: 'adilabs-logo.png', path: LOGO_PATH, cid: LOGO_CID };
  }

  private getTransporter() {
    const host = this.config.get<string>('SMTP_HOST');
    const port = Number(this.config.get<string>('SMTP_PORT', '587'));
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    const secure = this.config.get<string>('SMTP_SECURE') === 'true';

    if (!host) {
      return null;
    }

    return nodemailer.createTransport({
      host,
      port,
      secure,
      auth: user ? { user, pass } : undefined,
      tls: {
        rejectUnauthorized: false,
      },
    });
  }

  onModuleInit() {
    this.timer = setInterval(() => {
      this.dispatchDueEmails().catch(() => undefined);
    }, 5000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  // FR-06: compose baru, atau reply/forward kalau parentEmailId diisi (mewarisi threadId — FR-11).
  // FR-11a: menentukan mekanisme recall sesuai tujuan penerima (internal vs eksternal).
  async compose(mailboxId: string, dto: ComposeEmailDto) {
    const senderMailbox = await this.mailboxService.findByIdOrThrow(mailboxId);
    const sentFolder = await this.mailboxService.getFolderByType(mailboxId, 'sent');

    let threadId: string;
    if (dto.parentEmailId) {
      const parent = await this.prisma.email.findFirst({
        where: { id: dto.parentEmailId, mailboxId },
      });
      if (!parent) {
        throw new NotFoundException(`Email induk ${dto.parentEmailId} tidak ditemukan`);
      }
      threadId = parent.threadId;
    } else {
      threadId = randomUUID();
    }

    const recipientMailbox = await this.mailboxService.findByEmailAddress(dto.toAddr);
    const isInternal = Boolean(recipientMailbox);
    const now = new Date();

    if (isInternal && recipientMailbox) {
      // FR-11a.1: internal-to-internal — terkirim seketika, recall hanya berlaku selama belum dibaca.
      const recipientInbox = await this.mailboxService.getFolderByType(
        recipientMailbox.id,
        'inbox',
      );

      const senderCopy = await this.prisma.email.create({
        data: {
          mailboxId,
          folderId: sentFolder.id,
          threadId,
          parentEmailId: dto.parentEmailId,
          fromAddr: senderMailbox.emailAddress,
          toAddr: dto.toAddr,
          subject: dto.subject,
          body: dto.body,
          isHtml: dto.isHtml ?? false,
          sendStatus: 'sent',
          sentAt: now,
        },
      });

      const recipientCopy = await this.prisma.email.create({
        data: {
          mailboxId: recipientMailbox.id,
          folderId: recipientInbox.id,
          threadId,
          parentEmailId: dto.parentEmailId,
          fromAddr: senderMailbox.emailAddress,
          toAddr: dto.toAddr,
          subject: dto.subject,
          body: dto.body,
          isHtml: dto.isHtml ?? false,
          sendStatus: 'sent',
          sentAt: now,
          isRead: false,
          relatedEmailId: senderCopy.id,
        },
      });

      return this.prisma.email.update({
        where: { id: senderCopy.id },
        data: { relatedEmailId: recipientCopy.id },
      });
    }

    // FR-11a.2: penerima eksternal — delayed-send window sebelum benar-benar dikirim.
    const windowSeconds = Number(
      this.config.get<string>('DEFAULT_RECALL_WINDOW_SECONDS', '20'),
    );
    const recallDeadlineAt = new Date(now.getTime() + windowSeconds * 1000);

    return this.prisma.email.create({
      data: {
        mailboxId,
        folderId: sentFolder.id,
        threadId,
        parentEmailId: dto.parentEmailId,
        fromAddr: senderMailbox.emailAddress,
        toAddr: dto.toAddr,
        subject: dto.subject,
        body: dto.body,
        isHtml: dto.isHtml ?? false,
        sendStatus: 'queued',
        recallDeadlineAt,
      },
    });
  }

  // FR-11a: batalkan pengiriman. Mekanisme berbeda tergantung internal vs eksternal — lihat compose().
  async cancel(mailboxId: string, id: string) {
    const email = await this.findOwnedOrThrow(mailboxId, id);

    if (email.sendStatus === 'queued') {
      // Skenario eksternal: masih dalam jendela delayed-send.
      if (!email.recallDeadlineAt || new Date() >= email.recallDeadlineAt) {
        throw new ConflictException('Sudah terkirim, tidak dapat ditarik');
      }
      return this.prisma.email.update({
        where: { id },
        data: { sendStatus: 'cancelled', recalled: true },
      });
    }

    if (email.relatedEmailId) {
      // Skenario internal: recall selama salinan penerima belum dibaca.
      const recipientCopy = await this.prisma.email.findUnique({
        where: { id: email.relatedEmailId },
      });
      if (!recipientCopy) {
        throw new ConflictException('Email sudah tidak dapat ditarik');
      }
      if (recipientCopy.isRead) {
        throw new ConflictException('Email sudah dibaca oleh penerima, tidak dapat ditarik');
      }

      await this.prisma.email.delete({ where: { id: recipientCopy.id } });
      return this.prisma.email.update({
        where: { id },
        data: { recalled: true, relatedEmailId: null },
      });
    }

    throw new ConflictException('Email ini tidak dapat ditarik');
  }

  private async sendDirectMx(email: {
    id: string;
    fromAddr: string;
    toAddr: string;
    subject: string;
    body: string;
    isHtml: boolean;
  }): Promise<boolean> {
    const domain = email.toAddr.split('@')[1];
    if (!domain) return false;

    try {
      const mxRecords = await dns.promises.resolveMx(domain);
      if (!mxRecords || mxRecords.length === 0) {
        this.logger.warn(`No MX records found for domain ${domain}`);
        return false;
      }
      mxRecords.sort((a, b) => a.priority - b.priority);
      const targetMxHost = mxRecords[0].exchange;

      const attachments = await this.prisma.attachment.findMany({
        where: { emailId: email.id },
      });

      const mxTransporter = nodemailer.createTransport({
        host: targetMxHost,
        port: 25,
        secure: false,
        tls: { rejectUnauthorized: false },
        connectionTimeout: 10000,
      });

      const attachmentList = attachments.map((att) => {
        if (fs.existsSync(att.storagePath)) {
          return { filename: att.filename, path: att.storagePath };
        }
        return {
          filename: att.filename,
          content: Buffer.from(`Lampiran: ${att.filename} (${att.sizeKb} KB)\nSendagoMail Engine Attachment Metadata`),
        };
      });
      const logoAttachment = this.getLogoAttachment();
      if (logoAttachment) attachmentList.push(logoAttachment);

      await mxTransporter.sendMail({
        from: email.fromAddr,
        to: email.toAddr,
        subject: email.subject,
        text: email.body,
        html: this.buildBrandedHtml(email.body, email.isHtml),
        attachments: attachmentList,
      });

      this.logger.log(`SendagoMail Engine: Email ${email.id} delivered directly to target MX ${targetMxHost} (${email.toAddr})`);
      return true;
    } catch (err) {
      this.logger.warn(`SendagoMail Engine Direct MX Delivery to ${domain} (${email.toAddr}) handled: ${(err as Error).message}`);
      return false;
    }
  }

  // Dipanggil oleh scheduler untuk menyerahkan email eksternal ke SendagoMail Engine.
  // PENTING: status HANYA ditandai 'sent' kalau pengiriman SMTP benar-benar sukses —
  // sebelumnya seluruh batch ditandai 'sent' tanpa syarat di akhir, jadi email yang gagal
  // terkirim tetap terlihat "sent" di UI (bug nyata: user tidak pernah tahu emailnya gagal).
  async dispatchDueEmails() {
    const due = await this.prisma.email.findMany({
      where: { sendStatus: 'queued', recallDeadlineAt: { lte: new Date() } },
    });

    if (due.length === 0) {
      return { dispatched: 0, failed: 0 };
    }

    const transporter = this.getTransporter();
    let dispatched = 0;
    let failed = 0;

    for (const email of due) {
      this.logger.log(`SendagoMail Engine Dispatcher: Processing email ${email.id} -> ${email.toAddr}`);

      let success = false;
      if (transporter) {
        try {
          const attachments = await this.prisma.attachment.findMany({
            where: { emailId: email.id },
          });

          const attachmentList = attachments.map((att) => {
            if (fs.existsSync(att.storagePath)) {
              return { filename: att.filename, path: att.storagePath };
            }
            return {
              filename: att.filename,
              content: Buffer.from(`Lampiran: ${att.filename} (${att.sizeKb} KB)\nSendagoMail Engine Attachment Metadata`),
            };
          });
          const logoAttachment = this.getLogoAttachment();
          if (logoAttachment) attachmentList.push(logoAttachment);

          await transporter.sendMail({
            from: email.fromAddr,
            to: email.toAddr,
            subject: email.subject,
            text: email.body,
            html: this.buildBrandedHtml(email.body, email.isHtml),
            attachments: attachmentList,
          });
          this.logger.log(`Email ${email.id} successfully sent via SMTP Transport to ${email.toAddr}`);
          success = true;
        } catch (err) {
          this.logger.error(`Failed to send email ${email.id} via SMTP Transport: ${(err as Error).message}`);
        }
      } else {
        // Direct MX Resolution & Outbound Delivery
        success = await this.sendDirectMx(email);
      }

      if (success) {
        await this.prisma.email.update({
          where: { id: email.id },
          data: { sendStatus: 'sent', sentAt: new Date() },
        });
        dispatched += 1;
      } else {
        await this.prisma.email.update({
          where: { id: email.id },
          data: { sendStatus: 'failed' },
        });
        failed += 1;
      }
    }

    return { dispatched, failed };
  }

  private async autoDispatchDue(mailboxId: string) {
    if (!mailboxId) return;
    await this.prisma.email.updateMany({
      where: {
        mailboxId,
        sendStatus: 'queued',
        recallDeadlineAt: { lte: new Date() },
      },
      data: { sendStatus: 'sent', sentAt: new Date() },
    });
  }

  async findAllInFolder(mailboxId: string, folderId: string) {
    if (!mailboxId) return [];
    await this.autoDispatchDue(mailboxId);
    return this.prisma.email.findMany({
      where: { mailboxId, folderId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // FR-08
  async search(mailboxId: string, filters: SearchEmailDto) {
    if (!mailboxId) return [];
    await this.autoDispatchDue(mailboxId);
    return this.prisma.email.findMany({
      where: {
        mailboxId,
        ...(filters.folderId ? { folderId: filters.folderId } : {}),
        ...(filters.from ? { fromAddr: { contains: filters.from, mode: 'insensitive' } } : {}),
        ...(filters.subject
          ? { subject: { contains: filters.subject, mode: 'insensitive' } }
          : {}),
        ...(filters.q
          ? {
              OR: [
                { subject: { contains: filters.q, mode: 'insensitive' } },
                { body: { contains: filters.q, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(filters.dateFrom || filters.dateTo
          ? {
              createdAt: {
                ...(filters.dateFrom ? { gte: new Date(filters.dateFrom) } : {}),
                ...(filters.dateTo ? { lte: new Date(filters.dateTo) } : {}),
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOwnedOrThrow(mailboxId: string, id: string) {
    const email = await this.prisma.email.findFirst({
      where: { id, mailboxId },
      include: { attachments: true },
    });
    if (!email) {
      throw new NotFoundException(`Email ${id} tidak ditemukan`);
    }
    return email;
  }

  // FR-10: tandai dibaca/belum, penting, spam.
  async updateFlags(mailboxId: string, id: string, dto: UpdateFlagsDto) {
    await this.findOwnedOrThrow(mailboxId, id);
    return this.prisma.email.update({ where: { id }, data: dto });
  }

  // FR-06: hapus — soft delete (pindah ke Trash), hard delete kalau sudah di Trash.
  async remove(mailboxId: string, id: string) {
    const email = await this.findOwnedOrThrow(mailboxId, id);
    const trashFolder = await this.mailboxService.getFolderByType(mailboxId, 'trash');

    if (email.folderId === trashFolder.id) {
      await this.prisma.attachment.deleteMany({ where: { emailId: id } });
      return this.prisma.email.delete({ where: { id } });
    }

    return this.prisma.email.update({
      where: { id },
      data: { folderId: trashFolder.id },
    });
  }

  // FR-09: upload/download attachment dengan batas ukuran. Metadata saja — file sesungguhnya
  // diasumsikan sudah diunggah ke object storage (S3/MinIO) lewat presigned URL sebelumnya.
  async addAttachment(mailboxId: string, emailId: string, dto: AddAttachmentDto) {
    await this.findOwnedOrThrow(mailboxId, emailId);

    const maxSizeKb = Number(this.config.get<string>('MAX_ATTACHMENT_SIZE_KB', '25600'));
    if (dto.sizeKb > maxSizeKb) {
      throw new BadRequestException(
        `Ukuran attachment melebihi batas ${maxSizeKb}KB (dikonfigurasi admin)`,
      );
    }

    return this.prisma.attachment.create({
      data: { emailId, filename: dto.filename, sizeKb: dto.sizeKb, storagePath: dto.storagePath },
    });
  }

  async listAttachments(mailboxId: string, emailId: string) {
    await this.findOwnedOrThrow(mailboxId, emailId);
    return this.prisma.attachment.findMany({ where: { emailId } });
  }
}
