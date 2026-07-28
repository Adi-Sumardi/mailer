import { Body, Controller, Delete, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { DomainService } from './domain.service';
import { CreateDomainDto } from './dto/create-domain.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { TenantScopeGuard } from '../auth/tenant-scope.guard';
import { Roles } from '../auth/roles.decorator';

// FR-02 s/d FR-05: Tenant Admin (scoped ke tenant sendiri) atau Super Admin (semua tenant).
@UseGuards(JwtAuthGuard, RolesGuard, TenantScopeGuard)
@Roles('tenant_admin', 'super_admin')
@Controller('domains')
export class DomainController {
  constructor(private readonly domainService: DomainService) {}

  @Post()
  create(@Body() dto: CreateDomainDto) {
    return this.domainService.create(dto);
  }

  @Get()
  findAllByTenant(@Query('tenantId') tenantId: string) {
    return this.domainService.findAllByTenant(tenantId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.domainService.findOneOrThrow(id);
  }

  @Get(':id/verification-instructions')
  getVerificationInstructions(@Param('id') id: string) {
    return this.domainService.getVerificationInstructions(id);
  }

  @Post(':id/verify')
  verify(@Param('id') id: string) {
    return this.domainService.verify(id);
  }

  @Get(':id/status')
  getStatus(@Param('id') id: string) {
    return this.domainService.getStatus(id);
  }

  @Get(':id/dns-records')
  getDnsRecords(@Param('id') id: string) {
    return this.domainService.getDnsRecords(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.domainService.remove(id);
  }
}
