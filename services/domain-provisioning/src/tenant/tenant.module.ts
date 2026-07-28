import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InternalApiKeyGuard } from '../auth/internal-api-key.guard';
import { TenantController } from './tenant.controller';
import { TenantInternalController } from './tenant-internal.controller';
import { TenantService } from './tenant.service';

@Module({
  imports: [AuthModule],
  controllers: [TenantController, TenantInternalController],
  providers: [TenantService, InternalApiKeyGuard],
  exports: [TenantService],
})
export class TenantModule {}
