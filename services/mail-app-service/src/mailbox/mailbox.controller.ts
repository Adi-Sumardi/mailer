import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { MailboxService } from './mailbox.service';
import { CreateMailboxDto } from './dto/create-mailbox.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InternalApiKeyGuard } from '../auth/internal-api-key.guard';

@Controller('mailboxes')
export class MailboxController {
  constructor(private readonly mailboxService: MailboxService) {}

  // Endpoint service-to-service — dipanggil auth-service saat onboarding end_user baru.
  // Belum ada JWT mailboxId di titik ini (mailbox belum dibuat), jadi diproteksi internal API key.
  @UseGuards(InternalApiKeyGuard)
  @Post()
  create(@Body() dto: CreateMailboxDto) {
    return this.mailboxService.create(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.mailboxService.findByIdOrThrow(id);
  }
}
