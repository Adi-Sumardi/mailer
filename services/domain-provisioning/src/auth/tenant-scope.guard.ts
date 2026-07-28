import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { JwtPayload } from './jwt-payload.interface';

// Membatasi Tenant Admin agar hanya bisa mengakses domain milik tenant-nya sendiri.
// Super Admin bebas akses semua tenant. Dipasang setelah JwtAuthGuard + RolesGuard.
@Injectable()
export class TenantScopeGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user: JwtPayload = request.user;

    if (user.role === 'super_admin') {
      return true;
    }

    const requestedTenantId = await this.resolveRequestedTenantId(request);
    if (!requestedTenantId) {
      // Tidak ada tenant yang bisa diverifikasi dari request (mis. list tanpa filter) — tolak by default.
      throw new ForbiddenException('tenantId wajib disertakan untuk role tenant_admin');
    }

    if (requestedTenantId !== user.tenantId) {
      throw new ForbiddenException('Tidak boleh mengakses resource tenant lain');
    }
    return true;
  }

  private async resolveRequestedTenantId(request: {
    body?: { tenantId?: string };
    query?: { tenantId?: string };
    params?: { id?: string };
  }): Promise<string | null> {
    if (request.body?.tenantId) {
      return request.body.tenantId;
    }
    if (request.query?.tenantId) {
      return request.query.tenantId;
    }
    if (request.params?.id) {
      const domain = await this.prisma.domain.findUnique({
        where: { id: request.params.id },
        select: { tenantId: true },
      });
      return domain?.tenantId ?? null;
    }
    return null;
  }
}
