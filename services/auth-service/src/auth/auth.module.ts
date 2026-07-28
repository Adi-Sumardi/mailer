import { Module } from '@nestjs/common';
import { JwtModule, JwtModuleOptions } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailAppClientModule } from '../mail-app-client/mail-app-client.module';
import { DomainProvisioningClientModule } from '../domain-provisioning-client/domain-provisioning-client.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Module({
  imports: [
    MailAppClientModule,
    DomainProvisioningClientModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService): JwtModuleOptions => ({
        secret: config.get<string>('JWT_SECRET'),
        // `expiresIn` bertipe `StringValue` (union literal dari paket `ms`) di versi @nestjs/jwt
        // ini — nilai dari env var pada dasarnya bertipe string bebas, jadi perlu cast eksplisit.
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '1h') } as JwtModuleOptions['signOptions'],
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
  exports: [AuthService],
})
export class AuthModule {}
