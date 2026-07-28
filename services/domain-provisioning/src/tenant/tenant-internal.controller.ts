import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { InternalApiKeyGuard } from '../auth/internal-api-key.guard';

// Endpoint service-to-service (mis. dipanggil auth-service untuk validasi tenantId saat
// registrasi) — sengaja terpisah dari TenantController supaya tidak ikut ter-guard RBAC
// super_admin (pemanggilnya bukan user login, tapi service lain).
@UseGuards(InternalApiKeyGuard)
@Controller('internal/tenants')
export class TenantInternalController {
  constructor(private readonly tenantService: TenantService) {}

  @Get(':id/exists')
  async exists(@Param('id') id: string) {
    return { exists: await this.tenantService.existsById(id) };
  }
}
