import { Body, Controller, Delete, ForbiddenException, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiCredentialService } from './api-credential.service';
import { CreateApiCredentialDto } from './dto/create-api-credential.dto';
import { ValidateApiCredentialDto } from './dto/validate-api-credential.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt-payload.interface';

@Controller('auth/api-credentials')
export class ApiCredentialController {
  constructor(private readonly apiCredentialService: ApiCredentialService) {}

  // Dipanggil service lain (mis. mail-app-service, nantinya) sebelum mengizinkan aksi
  // terautentikasi member_id+secret — BUKAN via JWT, jadi TIDAK dipasangi JwtAuthGuard.
  @Post('validate')
  validate(@Body() dto: ValidateApiCredentialDto) {
    return this.apiCredentialService.validateAndConsumeQuota(dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('tenant_admin', 'super_admin')
  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateApiCredentialDto) {
    // super_admin tidak terikat tenant — harus sertakan tenantId di body untuk aksi ini
    const tenantId = user.tenantId ?? (dto as any).tenantId;
    if (!tenantId) {
      throw new ForbiddenException('Sertakan tenantId di body untuk aksi super_admin');
    }
    return this.apiCredentialService.create(tenantId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('tenant_admin', 'super_admin')
  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    // super_admin: list semua credential (tenantId = null → findAll tanpa filter tenant)
    return this.apiCredentialService.findAll(user.tenantId ?? null);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('tenant_admin', 'super_admin')
  @Delete(':id')
  revoke(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    // super_admin: bypass validasi kepemilikan tenant
    return this.apiCredentialService.revoke(user.tenantId ?? null, id);
  }
}
