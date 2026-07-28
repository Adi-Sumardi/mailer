import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { MailboxService } from '../mailbox/mailbox.service';
import { ComposeEmailDto } from './dto/compose-email.dto';
import { UpdateFlagsDto } from './dto/update-flags.dto';
import { SearchEmailDto } from './dto/search-email.dto';
import { AddAttachmentDto } from './dto/add-attachment.dto';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailboxService: MailboxService,
    private readonly config: ConfigService,
  ) {}

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

  // Dipanggil oleh scheduler (belum ada — TODO integrasi cron/queue) untuk benar-benar
  // menyerahkan email eksternal ke mail-engine begitu jendela delayed-send berakhir.
  async dispatchDueEmails() {
    const due = await this.prisma.email.findMany({
      where: { sendStatus: 'queued', recallDeadlineAt: { lte: new Date() } },
    });

    for (const email of due) {
      // TODO: serahkan ke outbound relay mail-engine (SMTP) di sini.
      this.logger.log(`Dispatching email ${email.id} to ${email.toAddr} (stub — belum terhubung ke mail-engine)`);
    }

    if (due.length === 0) {
      return { dispatched: 0 };
    }

    await this.prisma.email.updateMany({
      where: { id: { in: due.map((e) => e.id) } },
      data: { sendStatus: 'sent', sentAt: new Date() },
    });
    return { dispatched: due.length };
  }

  async findAllInFolder(mailboxId: string, folderId: string) {
    return this.prisma.email.findMany({
      where: { mailboxId, folderId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // FR-08
  async search(mailboxId: string, filters: SearchEmailDto) {
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
