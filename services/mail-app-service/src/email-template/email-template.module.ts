import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MailboxModule } from '../mailbox/mailbox.module';
import { EmailTemplateController } from './email-template.controller';
import { EmailTemplateService } from './email-template.service';

@Module({
  imports: [AuthModule, MailboxModule],
  controllers: [EmailTemplateController],
  providers: [EmailTemplateService],
  exports: [EmailTemplateService],
})
export class EmailTemplateModule {}
