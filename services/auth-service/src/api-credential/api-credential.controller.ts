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
  @Roles('tenant_admin')
  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateApiCredentialDto) {
    if (!user.tenantId) {
      throw new ForbiddenException('User tidak terikat tenant manapun');
    }
    return this.apiCredentialService.create(user.tenantId, dto);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('tenant_admin')
  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    if (!user.tenantId) {
      throw new ForbiddenException('User tidak terikat tenant manapun');
    }
    return this.apiCredentialService.findAll(user.tenantId);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('tenant_admin')
  @Delete(':id')
  revoke(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    if (!user.tenantId) {
      throw new ForbiddenException('User tidak terikat tenant manapun');
    }
    return this.apiCredentialService.revoke(user.tenantId, id);
  }
}
