import { Module } from '@nestjs/common';
import { MailAppClientService } from './mail-app-client.service';

@Module({
  providers: [MailAppClientService],
  exports: [MailAppClientService],
})
export class MailAppClientModule {}
