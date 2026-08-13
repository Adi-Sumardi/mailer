import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { EmailService } from './email.service';
import { IngestEmailDto } from './dto/ingest-email.dto';
import { InternalApiKeyGuard } from '../auth/internal-api-key.guard';

// Titik masuk email dari dunia luar. Dipanggil oleh mail-engine (Postfix pipe transport,
// lihat mail-engine/config/postfix-master.cf), BUKAN oleh browser — karena itu diproteksi
// INTERNAL_API_KEY dan sengaja tidak diekspos lewat API Gateway publik (gateway memblokir
// prefix /internal, dan /emails/ingest tidak masuk route table gateway).
@UseGuards(InternalApiKeyGuard)
@Controller('emails/ingest')
export class IngestEmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post()
  @HttpCode(201)
  ingest(@Body() dto: IngestEmailDto) {
    return this.emailService.ingestInbound(dto.recipient, Buffer.from(dto.rawBase64, 'base64'));
  }
}
