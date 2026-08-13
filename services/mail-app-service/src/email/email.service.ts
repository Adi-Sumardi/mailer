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
import { simpleParser } from 'mailparser';
import { PrismaService } from '../prisma/prisma.service';
import { MailboxService } from '../mailbox/mailbox.service';
import { EmailTemplateService } from '../email-template/email-template.service';
import { ComposeEmailDto } from './dto/compose-email.dto';
import { UpdateFlagsDto } from './dto/update-flags.dto';
import { SearchEmailDto } from './dto/search-email.dto';

const LOGO_PATH = path.join(__dirname, 'assets', 'adilabs-logo.png');
const LOGO_CID = 'adilabs-logo';

// Batas hard untuk multer interceptor (harus konstanta — dievaluasi saat decorator dibaca,
// sebelum ConfigService tersedia). Batas per-tenant yang sesungguhnya tetap divalidasi ulang
// di addAttachment() lewat MAX_ATTACHMENT_SIZE_KB, jadi angka ini cuma pagar terluar.
export const MAX_ATTACHMENT_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB

// Nama file di disk dibuat sendiri (uuid + ekstensi asli), TIDAK memakai nama dari user —
// mencegah path traversal (../) dan tabrakan nama antar email.
function safeStoredFilename(originalName: string): string {
  const ext = path.extname(originalName).slice(0, 20).replace(/[^a-zA-Z0-9.]/g, '');
  return `${randomUUID()}${ext}`;
}

interface TemplateForRender {
  title: string | null;
  subtitle: string | null;
  logoPosition: 'left' | 'center' | 'right';
  primaryColor: string;
  accentColor: string;
  footerText: string | null;
  logoAbsolutePath: string | null;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

@Injectable()
export class EmailService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EmailService.name);
  private timer: NodeJS.Timeout | null = null;
  // Lock mencegah dispatchDueEmails() dieksekusi ganda secara bersamaan (duplicate send).
  private isDispatching = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailboxService: MailboxService,
    private readonly emailTemplateService: EmailTemplateService,
    private readonly config: ConfigService,
  ) {}

  // Footer branding di setiap email yang dikirim keluar — logo dilampirkan sebagai
  // inline attachment (Content-ID), BUKAN base64 di dalam <img src>, karena banyak klien
  // email (termasuk Gmail) memblokir/menghapus data-URI base64 di HTML email. Kalau mailbox
  // pengirim punya EmailTemplate kustom (lihat email-template module), pakai itu — kalau
  // tidak, fallback ke branding default SendagoMail/adilabs (perilaku lama, tidak berubah).
  private buildBrandedHtml(bodyText: string, isHtml: boolean, template: TemplateForRender | null): string {
    // Kalau body sudah HTML mentah (mis. template transaksional pihak ketiga), JANGAN
    // konversi newline-nya jadi <br/> — newline di source HTML (indentasi antar tag) bukan
    // baris baru yang dimaksud, dan konversi itu bikin gap vertikal raksasa di klien email.
    const renderedBody = isHtml ? bodyText : bodyText.replace(/\n/g, '<br/>');
    const align = template?.logoPosition ?? 'left';
    const primaryColor = template?.primaryColor ?? '#e11d48';
    const accentColor = template?.accentColor ?? '#e2e8f0';
    const footerText = template?.footerText ?? 'Dikirim lewat SendagoMail — produk adilabs';

    // text-align (BUKAN flexbox) sengaja dipakai untuk posisi logo — banyak email client
    // (terutama Outlook desktop) tidak mendukung flexbox, tapi text-align+inline-img universal.
    const headerBlock =
      template?.title || template?.subtitle
        ? `<div style="text-align: ${align}; margin-bottom: 16px; font-family: sans-serif;">
            ${template?.title ? `<div style="font-size: 18px; font-weight: 700; color: ${primaryColor};">${escapeHtml(template.title)}</div>` : ''}
            ${template?.subtitle ? `<div style="font-size: 13px; color: #666; margin-top: 2px;">${escapeHtml(template.subtitle)}</div>` : ''}
          </div>`
        : '';

    return `
      ${headerBlock}
      <div style="font-family: sans-serif; font-size: 14px; color: #333; line-height: 1.6;">
        ${renderedBody}
      </div>
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid ${accentColor}; font-family: sans-serif; text-align: ${align};">
        <img src="cid:${LOGO_CID}" alt="logo" style="height: 28px; width: auto;" />
        <div style="font-size: 11px; color: #94a3b8; margin-top: 6px;">
          ${escapeHtml(footerText)}
        </div>
      </div>
    `;
  }

  // FR-11a.2: batas waktu delayed-send. Dipakai saat compose DAN saat lampiran ditambahkan
  // (lihat storeAttachment) supaya hitungan mundur mulai ulang setelah upload selesai.
  private buildRecallDeadline(from: Date = new Date()): Date {
    const windowSeconds = Number(this.config.get<string>('DEFAULT_RECALL_WINDOW_SECONDS', '20'));
    return new Date(from.getTime() + windowSeconds * 1000);
  }

  private attachmentsDir(): string {
    return this.config.get<string>('ATTACHMENTS_DIR', path.join(process.cwd(), 'attachments'));
  }

  // storagePath disimpan RELATIF terhadap ATTACHMENTS_DIR (mis. "<emailId>/<uuid>.pdf") supaya
  // data tetap valid kalau path mount container berubah. Hasil resolve diverifikasi masih di
  // dalam direktori attachment — menolak nilai lama/berbahaya yang mengandung "../".
  private resolveAttachmentPath(storagePath: string): string | null {
    const dir = path.resolve(this.attachmentsDir());
    const resolved = path.resolve(dir, storagePath);
    if (resolved !== dir && !resolved.startsWith(dir + path.sep)) {
      this.logger.warn(`storagePath di luar direktori attachment ditolak: ${storagePath}`);
      return null;
    }
    return resolved;
  }

  // Menyusun daftar lampiran untuk nodemailer dari file SUNGGUHAN di disk.
  //
  // Kalau file-nya tidak ada, ini SENGAJA melempar error supaya pengiriman gagal terang-terangan
  // (email ditandai 'failed' oleh pemanggil). Sebelumnya di sini ada fallback yang melampirkan
  // Buffer berisi teks "Lampiran: <nama> (<n> KB)" menggantikan file asli — akibatnya penerima
  // menerima file bernama mis. invoice.pdf yang isinya teks biasa (PDF rusak), sementara
  // pengirim melihat status "terkirim". Diam-diam mengirim dokumen palsu jauh lebih berbahaya
  // daripada gagal, terutama untuk invoice — jadi fallback itu dihapus.
  private async buildAttachmentList(emailId: string, template: TemplateForRender | null) {
    const attachments = await this.prisma.attachment.findMany({ where: { emailId } });

    const attachmentList: { filename: string; path: string; cid?: string }[] = attachments.map((att) => {
      const resolved = this.resolveAttachmentPath(att.storagePath);
      if (!resolved || !fs.existsSync(resolved)) {
        throw new Error(
          `File lampiran '${att.filename}' tidak ditemukan di penyimpanan (${att.storagePath}) — pengiriman dibatalkan agar tidak mengirim lampiran kosong/rusak`,
        );
      }
      return { filename: att.filename, path: resolved };
    });

    const logoAttachment = this.getLogoAttachment(template);
    if (logoAttachment) attachmentList.push(logoAttachment);
    return attachmentList;
  }

  private getLogoAttachment(template: TemplateForRender | null) {
    if (template?.logoAbsolutePath && fs.existsSync(template.logoAbsolutePath)) {
      return { filename: path.basename(template.logoAbsolutePath), path: template.logoAbsolutePath, cid: LOGO_CID };
    }
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
    const recallDeadlineAt = this.buildRecallDeadline(now);

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
    mailboxId: string;
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

      const template = await this.emailTemplateService.getForRender(email.mailboxId);
      const attachmentList = await this.buildAttachmentList(email.id, template);

      const mxTransporter = nodemailer.createTransport({
        host: targetMxHost,
        port: 25,
        secure: false,
        tls: { rejectUnauthorized: false },
        connectionTimeout: 10000,
      });

      await mxTransporter.sendMail({
        from: email.fromAddr,
        to: email.toAddr,
        subject: email.subject,
        text: email.body,
        html: this.buildBrandedHtml(email.body, email.isHtml, template),
        attachments: attachmentList,
      });

      this.logger.log(`SendagoMail Engine: Email ${email.id} delivered directly to target MX ${targetMxHost} (${email.toAddr})`);
      return true;
    } catch (err) {
      this.logger.warn(`SendagoMail Engine Direct MX Delivery to ${domain} (${email.toAddr}) handled: ${(err as Error).message}`);
      return false;
    }
  }

  // Logika inti pengiriman satu email eksternal — dipakai bersama oleh dispatchDueEmails()
  // dan forceDispatch() agar tidak ada duplikasi kode.
  private async dispatchSingleEmail(email: {
    id: string;
    mailboxId: string;
    fromAddr: string;
    toAddr: string;
    subject: string;
    body: string;
    isHtml: boolean;
  }): Promise<boolean> {
    const transporter = this.getTransporter();
    if (transporter) {
      try {
        const template = await this.emailTemplateService.getForRender(email.mailboxId);
        const attachmentList = await this.buildAttachmentList(email.id, template);

        await transporter.sendMail({
          from: email.fromAddr,
          to: email.toAddr,
          subject: email.subject,
          text: email.body,
          html: this.buildBrandedHtml(email.body, email.isHtml, template),
          attachments: attachmentList,
        });
        this.logger.log(`Email ${email.id} successfully sent via SMTP Transport to ${email.toAddr}`);
        return true;
      } catch (err) {
        this.logger.error(`Failed to send email ${email.id} via SMTP Transport: ${(err as Error).message}`);
        return false;
      }
    } else {
      // Direct MX Resolution & Outbound Delivery
      return this.sendDirectMx(email);
    }
  }

  // Dipanggil oleh scheduler untuk menyerahkan email eksternal ke SendagoMail Engine.
  // PENTING: status HANYA ditandai 'sent' kalau pengiriman SMTP benar-benar sukses.
  // Lock isDispatching mencegah eksekusi ganda yang bisa menyebabkan duplicate send.
  async dispatchDueEmails() {
    if (this.isDispatching) {
      return { dispatched: 0, failed: 0 };
    }
    this.isDispatching = true;
    try {
      const due = await this.prisma.email.findMany({
        where: { sendStatus: 'queued', recallDeadlineAt: { lte: new Date() } },
      });

      if (due.length === 0) {
        return { dispatched: 0, failed: 0 };
      }

      let dispatched = 0;
      let failed = 0;

      for (const email of due) {
        this.logger.log(`SendagoMail Engine Dispatcher: Processing email ${email.id} -> ${email.toAddr}`);
        const success = await this.dispatchSingleEmail(email);

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
    } finally {
      this.isDispatching = false;
    }
  }

  // Kirim langsung satu email tertentu tanpa menunggu scheduler — dipakai oleh endpoint
  // POST /emails/api-send agar email transaksional dari aplikasi pihak ketiga terkirim
  // seketika tanpa bergantung pada recall window atau siklus 5 detik scheduler.
  async forceDispatch(emailId: string): Promise<void> {
    const email = await this.prisma.email.findUnique({ where: { id: emailId } });
    if (!email || email.sendStatus !== 'queued') return;

    this.logger.log(`SendagoMail Engine ForceDispatch: Sending email ${email.id} -> ${email.toAddr}`);
    const success = await this.dispatchSingleEmail(email);

    await this.prisma.email.update({
      where: { id: email.id },
      data: success
        ? { sendStatus: 'sent', sentAt: new Date() }
        : { sendStatus: 'failed' },
    });
  }

  async findAllInFolder(mailboxId: string, folderId: string) {
    if (!mailboxId) return [];
    // autoDispatchDue() dihapus — hanya menandai 'sent' tanpa benar-benar mengirim email
    // (bug: status palsu, scheduler tidak menemukan email untuk dikirim).
    // Pengiriman nyata ditangani eksklusif oleh scheduler dispatchDueEmails().
    return this.prisma.email.findMany({
      where: { mailboxId, folderId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // FR-08
  async search(mailboxId: string, filters: SearchEmailDto) {
    if (!mailboxId) return [];
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
      // Hapus file fisiknya juga, jangan cuma row-nya — kalau tidak, file lampiran menumpuk
      // selamanya di disk tanpa ada yang mereferensikan (orphan).
      const dir = this.resolveAttachmentPath(id);
      if (dir) {
        await fs.promises.rm(dir, { recursive: true, force: true }).catch(() => undefined);
      }
      await this.prisma.attachment.deleteMany({ where: { emailId: id } });
      return this.prisma.email.delete({ where: { id } });
    }

    return this.prisma.email.update({
      where: { id },
      data: { folderId: trashFolder.id },
    });
  }

  // FR-09: upload attachment dengan batas ukuran — file SUNGGUHAN ditulis ke disk
  // (ATTACHMENTS_DIR, di-bind-mount seperti TEMPLATE_LOGOS_DIR), bukan sekadar metadata.
  async addAttachment(mailboxId: string, emailId: string, file: { originalname: string; size: number; buffer: Buffer }) {
    await this.findOwnedOrThrow(mailboxId, emailId);
    return this.storeAttachment(emailId, file.originalname, file.buffer, file.size);
  }

  // Jalur lampiran untuk email transaksional lewat POST /emails/api-send (mis. invoice PDF
  // dari backend aplikasi pihak ketiga) — konten dikirim sebagai base64 di body JSON, karena
  // integrator API umumnya lebih mudah mengirim JSON daripada multipart.
  async addApiAttachments(
    emailId: string,
    attachments: { filename: string; contentBase64: string }[],
  ) {
    for (const att of attachments) {
      let buffer: Buffer;
      try {
        buffer = Buffer.from(att.contentBase64, 'base64');
      } catch {
        throw new BadRequestException(`Lampiran '${att.filename}': contentBase64 bukan base64 yang valid`);
      }
      // Buffer.from() dengan input sampah TIDAK melempar error, dia menghasilkan buffer kosong/
      // terpotong diam-diam — jadi panjang nol diperlakukan sebagai input tidak valid di sini.
      if (buffer.length === 0) {
        throw new BadRequestException(`Lampiran '${att.filename}': contentBase64 kosong atau bukan base64 yang valid`);
      }
      await this.storeAttachment(emailId, att.filename, buffer, buffer.length);
    }
  }

  private async storeAttachment(emailId: string, originalName: string, buffer: Buffer, sizeBytes: number) {
    const maxSizeKb = Number(this.config.get<string>('MAX_ATTACHMENT_SIZE_KB', '25600'));
    const sizeKb = Math.max(1, Math.ceil(sizeBytes / 1024));
    if (sizeKb > maxSizeKb) {
      throw new BadRequestException(
        `Ukuran attachment melebihi batas ${maxSizeKb}KB (dikonfigurasi admin)`,
      );
    }

    const relativePath = path.join(emailId, safeStoredFilename(originalName));
    const absolutePath = path.join(this.attachmentsDir(), relativePath);
    await fs.promises.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.promises.writeFile(absolutePath, buffer);

    const attachment = await this.prisma.attachment.create({
      data: { emailId, filename: originalName, sizeKb, storagePath: relativePath },
    });

    // Compose (UI) membuat email langsung berstatus 'queued' dengan jendela recall pendek
    // (DEFAULT_RECALL_WINDOW_SECONDS, 5 detik di production), lalu client meng-upload lampiran
    // SESUDAHNYA. Untuk file besar, upload bisa lebih lama dari jendela itu — scheduler keburu
    // mengirim emailnya tanpa lampiran. Menyetel ulang deadline tiap kali lampiran masuk
    // membuat hitungan mundur baru mulai setelah upload terakhir selesai.
    await this.prisma.email.updateMany({
      where: { id: emailId, sendStatus: 'queued' },
      data: { recallDeadlineAt: this.buildRecallDeadline() },
    });

    return attachment;
  }

  // Inbound dari dunia luar: Postfix mem-pipe email masuk untuk domain tenant ke skrip
  // sendago-ingest, yang meneruskannya ke sini (lihat mail-engine/config/postfix-master.cf).
  // Email disimpan ke Postgres — SATU sumber kebenaran, sama seperti email internal — bukan
  // ke maildir, supaya langsung muncul di webmail tanpa perlu sinkronisasi IMAP terpisah.
  //
  // Melempar NotFoundException kalau alamat penerima tidak dikenal; skrip pemanggil
  // menerjemahkannya jadi exit code bounce permanen, BUKAN menerima lalu membuangnya diam-diam.
  async ingestInbound(recipient: string, raw: Buffer) {
    const mailbox = await this.mailboxService.findByEmailAddress(recipient.toLowerCase());
    if (!mailbox) {
      throw new NotFoundException(`Tidak ada mailbox untuk alamat ${recipient}`);
    }

    const inbox = await this.mailboxService.getFolderByType(mailbox.id, 'inbox');
    const parsed = await simpleParser(raw);

    const fromAddr = parsed.from?.value?.[0]?.address ?? 'unknown@unknown';
    const html = typeof parsed.html === 'string' ? parsed.html : null;
    const receivedAt = parsed.date ?? new Date();

    const email = await this.prisma.email.create({
      data: {
        mailboxId: mailbox.id,
        folderId: inbox.id,
        // Email masuk memulai thread-nya sendiri; korelasi thread lintas-sistem lewat
        // header In-Reply-To/References belum diimplementasikan (lihat README).
        threadId: randomUUID(),
        fromAddr,
        toAddr: recipient,
        subject: parsed.subject ?? '(tanpa subjek)',
        body: html ?? parsed.text ?? '',
        isHtml: Boolean(html),
        sendStatus: 'sent',
        sentAt: receivedAt,
        isRead: false,
      },
    });

    // Lampiran email masuk disimpan ke disk seperti lampiran keluar, supaya bisa diunduh
    // lewat endpoint download yang sama.
    for (const att of parsed.attachments ?? []) {
      if (!att.content) continue;
      await this.storeAttachment(
        email.id,
        att.filename ?? 'lampiran',
        att.content,
        att.content.length,
      ).catch((err) =>
        this.logger.warn(`Gagal menyimpan lampiran email masuk ${email.id}: ${(err as Error).message}`),
      );
    }

    this.logger.log(`Email masuk diterima untuk ${recipient} (dari ${fromAddr}) -> ${email.id}`);
    return { id: email.id, mailboxId: mailbox.id };
  }

  async listAttachments(mailboxId: string, emailId: string) {
    await this.findOwnedOrThrow(mailboxId, emailId);
    return this.prisma.attachment.findMany({ where: { emailId } });
  }

  // FR-09 (sisi download): kirim file asli ke pemilik mailbox. Kepemilikan email divalidasi
  // dulu supaya lampiran mailbox lain tidak bisa diambil hanya dengan menebak attachmentId.
  async getAttachmentFile(mailboxId: string, emailId: string, attachmentId: string) {
    await this.findOwnedOrThrow(mailboxId, emailId);
    const attachment = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, emailId },
    });
    if (!attachment) {
      throw new NotFoundException(`Lampiran ${attachmentId} tidak ditemukan`);
    }
    const resolved = this.resolveAttachmentPath(attachment.storagePath);
    if (!resolved || !fs.existsSync(resolved)) {
      throw new NotFoundException(`File lampiran '${attachment.filename}' tidak ada di penyimpanan`);
    }
    return { filePath: resolved, filename: attachment.filename };
  }
}
