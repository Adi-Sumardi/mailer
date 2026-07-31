import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { AuthModule } from '../auth/auth.module';
import { MailAppClientModule } from '../mail-app-client/mail-app-client.module';
import { DomainProvisioningClientModule } from '../domain-provisioning-client/domain-provisioning-client.module';

@Module({
  imports: [AuthModule, MailAppClientModule, DomainProvisioningClientModule],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
