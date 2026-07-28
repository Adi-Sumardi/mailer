import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { FolderType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMailboxDto } from './dto/create-mailbox.dto';

const DEFAULT_FOLDERS: { name: string; type: FolderType }[] = [
  { name: 'Inbox', type: 'inbox' },
  { name: 'Sent', type: 'sent' },
  { name: 'Draft', type: 'draft' },
  { name: 'Trash', type: 'trash' },
];

@Injectable()
export class MailboxService {
  constructor(private readonly prisma: PrismaService) {}

  // FR-07: setiap mailbox baru otomatis punya folder Inbox/Sent/Draft/Trash.
  async create(dto: CreateMailboxDto) {
    const existing = await this.prisma.mailbox.findFirst({
      where: { OR: [{ userId: dto.userId }, { emailAddress: dto.emailAddress }] },
    });
    if (existing) {
      throw new ConflictException('Mailbox untuk user/email ini sudah ada');
    }

    return this.prisma.mailbox.create({
      data: {
        userId: dto.userId,
        emailAddress: dto.emailAddress,
        quotaMb: dto.quotaMb ?? 1024,
        folders: {
          create: DEFAULT_FOLDERS.map((f) => ({ folderName: f.name, folderType: f.type })),
        },
      },
      include: { folders: true },
    });
  }

  async findByIdOrThrow(id: string) {
    const mailbox = await this.prisma.mailbox.findUnique({ where: { id } });
    if (!mailbox) {
      throw new NotFoundException(`Mailbox ${id} tidak ditemukan`);
    }
    return mailbox;
  }

  findByEmailAddress(emailAddress: string) {
    return this.prisma.mailbox.findUnique({ where: { emailAddress } });
  }

  async getFolderByType(mailboxId: string, type: FolderType) {
    const folder = await this.prisma.folder.findFirst({
      where: { mailboxId, folderType: type },
    });
    if (!folder) {
      throw new NotFoundException(`Folder default '${type}' tidak ditemukan untuk mailbox ini`);
    }
    return folder;
  }
}
