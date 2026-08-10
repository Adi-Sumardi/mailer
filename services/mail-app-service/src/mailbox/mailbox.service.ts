import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
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
  //
  // Idempotent by userId: endpoint ini dipanggil oleh auth-service (lihat
  // MailAppClientService.provisionMailbox) yang fail-open dan retry di setiap login lewat
  // ensureMailbox(). Kalau panggilan pertama sukses tapi response-nya gagal sampai balik ke
  // auth-service (network blip dsb), retry berikutnya HARUS mengembalikan mailbox yang sama,
  // bukan 409 — sebelumnya retry gagal permanen karena provisionMailbox() cuma log-and-null
  // saat non-2xx, dan tidak ada cara mengambil mailboxId yang sudah terlanjur dibuat. Itu
  // penyebab bug "Belum ada mailbox terprovisi" walau mailbox-nya sebenarnya sudah ada.
  //
  // emailAddress dipakai untuk deteksi konflik data asli (dua userId beda rebutan email sama).
  async create(dto: CreateMailboxDto) {
    const existingByUser = await this.prisma.mailbox.findUnique({
      where: { userId: dto.userId },
      include: { folders: true },
    });
    if (existingByUser) {
      return existingByUser;
    }

    const existingByEmail = await this.prisma.mailbox.findUnique({ where: { emailAddress: dto.emailAddress } });
    if (existingByEmail) {
      throw new ConflictException('Mailbox untuk email ini sudah dipakai user lain');
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
    if (!id) {
      throw new BadRequestException('User belum memiliki mailbox. Silakan login ulang.');
    }
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
