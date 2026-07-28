import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MailboxModule } from '../mailbox/mailbox.module';
import { EmailController } from './email.controller';
import { EmailService } from './email.service';

@Module({
  imports: [AuthModule, MailboxModule],
  controllers: [EmailController],
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
