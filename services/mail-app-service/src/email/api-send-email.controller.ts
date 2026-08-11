import { Body, Controller, HttpCode, Post, UnauthorizedException } from '@nestjs/common';
import { EmailService } from './email.service';
import { AuthServiceClientService } from '../auth-service-client/auth-service-client.service';
import { ApiSendEmailDto } from './dto/api-send-email.dto';

// Jalur kirim email untuk aplikasi pihak ketiga lewat member_id+secret (bukan JWT user
// biasa) — lihat auth-service ApiCredentialService. TIDAK dipasangi JwtAuthGuard karena
// otentikasinya lewat body (memberId+secret), divalidasi ke auth-service per request.
@Controller('emails/api-send')
export class ApiSendEmailController {
  constructor(
    private readonly emailService: EmailService,
    private readonly authServiceClient: AuthServiceClientService,
  ) {}

  @Post()
  @HttpCode(201)
  async send(@Body() dto: ApiSendEmailDto) {
    const result = await this.authServiceClient.validateApiCredential(dto.memberId, dto.secret);
    if (!result.valid) {
      throw new UnauthorizedException(result.reason);
    }

    const email = await this.emailService.compose(result.mailboxId, {
      toAddr: dto.toAddr,
      subject: dto.subject,
      body: dto.body,
      isHtml: dto.isHtml,
    });

    // Email transaksional dari aplikasi pihak ketiga dikirim seketika — tidak perlu
    // menunggu scheduler 5 detik atau recall window (recall tidak relevan untuk API-send).
    await this.emailService.forceDispatch(email.id);

    return { ...email, environment: result.environment, remainingQuota: result.remainingQuota };
  }
}
