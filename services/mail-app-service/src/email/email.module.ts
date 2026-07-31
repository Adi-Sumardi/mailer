import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MailboxModule } from '../mailbox/mailbox.module';
import { EmailController } from './email.controller';
import { ApiSendEmailController } from './api-send-email.controller';
import { EmailService } from './email.service';
import { AuthServiceClientService } from '../auth-service-client/auth-service-client.service';

@Module({
  imports: [AuthModule, MailboxModule],
  controllers: [EmailController, ApiSendEmailController],
  providers: [EmailService, AuthServiceClientService],
  exports: [EmailService],
})
export class EmailModule {}
