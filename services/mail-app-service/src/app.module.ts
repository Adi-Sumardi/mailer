import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { MailboxModule } from './mailbox/mailbox.module';
import { FolderModule } from './folder/folder.module';
import { EmailModule } from './email/email.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    MailboxModule,
    FolderModule,
    EmailModule,
  ],
})
export class AppModule {}
