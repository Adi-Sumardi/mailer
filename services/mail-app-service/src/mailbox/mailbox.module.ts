import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { InternalApiKeyGuard } from '../auth/internal-api-key.guard';
import { MailboxController } from './mailbox.controller';
import { MailboxService } from './mailbox.service';

@Module({
  imports: [AuthModule],
  controllers: [MailboxController],
  providers: [MailboxService, InternalApiKeyGuard],
  exports: [MailboxService],
})
export class MailboxModule {}
