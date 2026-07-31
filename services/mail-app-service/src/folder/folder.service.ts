import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFolderDto } from './dto/create-folder.dto';

@Injectable()
export class FolderService {
  constructor(private readonly prisma: PrismaService) {}

  // FR-07: folder custom tambahan milik user (Inbox/Sent/Draft/Trash sudah dibuat otomatis
  // saat mailbox diprovisikan — lihat MailboxService).
  async create(mailboxId: string, dto: CreateFolderDto) {
    const existing = await this.prisma.folder.findFirst({
      where: { mailboxId, folderName: dto.folderName },
    });
    if (existing) {
      throw new ConflictException(`Folder '${dto.folderName}' sudah ada`);
    }

    return this.prisma.folder.create({
      data: { mailboxId, folderName: dto.folderName, folderType: 'custom' },
    });
  }

  findAll(mailboxId: string) {
    if (!mailboxId) return [];
    return this.prisma.folder.findMany({
      where: { mailboxId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findOneOrThrow(mailboxId: string, id: string) {
    const folder = await this.prisma.folder.findFirst({ where: { id, mailboxId } });
    if (!folder) {
      throw new NotFoundException(`Folder ${id} tidak ditemukan`);
    }
    return folder;
  }

  // Folder default (Inbox/Sent/Draft) tidak boleh dihapus — hanya folder custom.
  async remove(mailboxId: string, id: string) {
    const folder = await this.findOneOrThrow(mailboxId, id);
    if (folder.folderType !== 'custom') {
      throw new BadRequestException('Folder default tidak dapat dihapus');
    }
    return this.prisma.folder.delete({ where: { id } });
  }
}
