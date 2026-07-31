import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { MailAppClientService } from '../mail-app-client/mail-app-client.service';
import { DomainProvisioningClientService } from '../domain-provisioning-client/domain-provisioning-client.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

const PASSWORD_HASH_ROUNDS = 10;

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailAppClient: MailAppClientService,
    private readonly domainProvisioningClient: DomainProvisioningClientService,
  ) {}

  async findAll(userRole: string, userTenantId: string | null, filterTenantId?: string) {
    let whereClause: any = {};

    if (userRole === 'tenant_admin') {
      whereClause.tenantId = userTenantId;
    } else if (userRole === 'super_admin' && filterTenantId) {
      whereClause.tenantId = filterTenantId;
    }

    const users = await this.prisma.user.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
    });

    return users.map((u) => this.toPublicUser(u));
  }

  async findOneOrThrow(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User dengan ID ${id} tidak ditemukan`);
    }
    return this.toPublicUser(user);
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException(`Email ${dto.email} sudah terdaftar`);
    }

    if (dto.role !== 'super_admin' && dto.tenantId) {
      const exists = await this.domainProvisioningClient.tenantExists(dto.tenantId);
      if (exists === false) {
        throw new BadRequestException(`Tenant ${dto.tenantId} tidak ditemukan`);
      }
    }

    const passwordHash = await bcrypt.hash(dto.password, PASSWORD_HASH_ROUNDS);
    const userId = randomUUID();
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

    return this.toPublicUser(user);
  }

  async update(
    id: string,
    dto: UpdateUserDto,
    currentUserRole: string,
    currentUserTenantId: string | null,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User dengan ID ${id} tidak ditemukan`);
    }

    if (currentUserRole === 'tenant_admin' && user.tenantId !== currentUserTenantId) {
      throw new ForbiddenException('Tidak memiliki akses mengubah user dari tenant lain');
    }

    if (dto.email && dto.email !== user.email) {
      const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (existing) {
        throw new ConflictException(`Email ${dto.email} sudah digunakan user lain`);
      }
    }

    const dataToUpdate: any = {};

    if (dto.email) {
      dataToUpdate.email = dto.email;
    }

    if (dto.password) {
      dataToUpdate.passwordHash = await bcrypt.hash(dto.password, PASSWORD_HASH_ROUNDS);
    }

    if (dto.role) {
      dataToUpdate.role = dto.role;
      if (dto.role === 'super_admin') {
        dataToUpdate.tenantId = null;
      }
    }

    if (dto.tenantId !== undefined && (dto.role ?? user.role) !== 'super_admin') {
      dataToUpdate.tenantId = dto.tenantId;
    }

    const updatedUser = await this.prisma.user.update({
      where: { id },
      data: dataToUpdate,
    });

    return this.toPublicUser(updatedUser);
  }

  async remove(id: string, currentUserRole: string, currentUserTenantId: string | null) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User dengan ID ${id} tidak ditemukan`);
    }

    if (currentUserRole === 'tenant_admin' && user.tenantId !== currentUserTenantId) {
      throw new ForbiddenException('Tidak memiliki akses menghapus user dari tenant lain');
    }

    await this.prisma.refreshToken.deleteMany({ where: { userId: id } });
    await this.prisma.user.delete({ where: { id } });

    return { success: true, message: `User ${user.email} berhasil dihapus` };
  }

  private toPublicUser(user: {
    id: string;
    email: string;
    role: string;
    tenantId: string | null;
    mailboxId: string | null;
    createdAt: Date;
  }) {
    const { id, email, role, tenantId, mailboxId, createdAt } = user;
    return { id, email, role, tenantId, mailboxId, createdAt };
  }
}
