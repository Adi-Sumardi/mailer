import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';

@Injectable()
export class TenantService {
  constructor(private readonly prisma: PrismaService) {}

  // FR-01: Super Admin membuat tenant
  create(dto: CreateTenantDto) {
    return this.prisma.tenant.create({
      data: { tenantName: dto.tenantName },
    });
  }

  findAll() {
    return this.prisma.tenant.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async findOneOrThrow(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${id} tidak ditemukan`);
    }
    return tenant;
  }

  async existsById(id: string): Promise<boolean> {
    const tenant = await this.prisma.tenant.findUnique({ where: { id }, select: { id: true } });
    return Boolean(tenant);
  }

  // FR-01: Super Admin menonaktifkan tenant (soft — tetap ada untuk audit trail)
  async deactivate(id: string) {
    await this.findOneOrThrow(id);
    return this.prisma.tenant.update({
      where: { id },
      data: { billingStatus: 'suspended', deactivatedAt: new Date() },
    });
  }

  reactivate(id: string) {
    return this.prisma.tenant.update({
      where: { id },
      data: { billingStatus: 'active', deactivatedAt: null },
    });
  }

  async updatePlan(id: string, planType: string) {
    await this.findOneOrThrow(id);
    return this.prisma.tenant.update({
      where: { id },
      data: { planType },
    });
  }

  // FR-01: Super Admin menghapus tenant — ditolak kalau masih ada domain terdaftar,
  // supaya tidak diam-diam menghapus mailbox/data domain yang masih aktif.
  async remove(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: { domains: true },
    });
    if (!tenant) {
      throw new NotFoundException(`Tenant ${id} tidak ditemukan`);
    }
    if (tenant.domains.length > 0) {
      throw new ConflictException(
        'Tenant masih memiliki domain terdaftar — hapus/lepas domain terlebih dahulu',
      );
    }
    return this.prisma.tenant.delete({ where: { id } });
  }
}
