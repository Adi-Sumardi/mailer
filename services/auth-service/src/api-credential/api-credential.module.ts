import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { ApiCredentialController } from './api-credential.controller';
import { ApiCredentialService } from './api-credential.service';

@Module({
  imports: [AuthModule],
  controllers: [ApiCredentialController],
  providers: [ApiCredentialService],
})
export class ApiCredentialModule {}
