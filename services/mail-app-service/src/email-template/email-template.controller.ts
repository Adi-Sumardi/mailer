import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Put,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { EmailTemplateService, MAX_LOGO_SIZE_BYTES } from './email-template.service';
import { UpsertEmailTemplateDto } from './dto/upsert-email-template.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt-payload.interface';

// Branding kustom (logo, warna, judul/subjudul) untuk footer email terkirim dari satu mailbox.
// Hanya PEMILIK mailbox (mailboxId di JWT sendiri) yang boleh baca/ubah — tidak ada konsep
// "tenant" di service ini, jadi tidak ada override admin lintas-mailbox (lihat README).
@UseGuards(JwtAuthGuard)
@Controller('mailboxes/:mailboxId/template')
export class EmailTemplateController {
  constructor(private readonly templateService: EmailTemplateService) {}

  private assertOwnership(user: JwtPayload, mailboxId: string) {
    if (user.mailboxId !== mailboxId) {
      throw new ForbiddenException('Anda hanya bisa mengubah template milik mailbox sendiri');
    }
  }

  // @Res() dipakai sengaja di sini — kalau belum ada template, service ini return null, dan
  // default Nest MEMPERLAKUKAN return null/undefined SAMA (kirim body KOSONG, bukan literal
  // JSON "null"). res.json(null) di client akan crash parsing JSON kosong. res.json() manual
  // di sini memastikan body selalu JSON valid ("null" atau object) apa pun hasilnya.
  @Get()
  async get(@CurrentUser() user: JwtPayload, @Param('mailboxId') mailboxId: string, @Res() res: Response) {
    this.assertOwnership(user, mailboxId);
    const template = await this.templateService.get(mailboxId);
    res.json(template);
  }

  @Put()
  upsert(
    @CurrentUser() user: JwtPayload,
    @Param('mailboxId') mailboxId: string,
    @Body() dto: UpsertEmailTemplateDto,
  ) {
    this.assertOwnership(user, mailboxId);
    return this.templateService.upsert(mailboxId, dto);
  }

  @Post('logo')
  @UseInterceptors(FileInterceptor('logo', { storage: memoryStorage(), limits: { fileSize: MAX_LOGO_SIZE_BYTES } }))
  uploadLogo(
    @CurrentUser() user: JwtPayload,
    @Param('mailboxId') mailboxId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    this.assertOwnership(user, mailboxId);
    if (!file) {
      throw new ForbiddenException('File logo tidak ditemukan di request');
    }
    return this.templateService.saveLogo(mailboxId, file);
  }

  @Delete('logo')
  deleteLogo(@CurrentUser() user: JwtPayload, @Param('mailboxId') mailboxId: string) {
    this.assertOwnership(user, mailboxId);
    return this.templateService.deleteLogo(mailboxId);
  }

  @Get('logo')
  async getLogo(
    @CurrentUser() user: JwtPayload,
    @Param('mailboxId') mailboxId: string,
    @Res() res: Response,
  ) {
    this.assertOwnership(user, mailboxId);
    const { filePath, mimeType } = await this.templateService.getLogoFile(mailboxId);
    res.setHeader('Content-Type', mimeType);
    res.sendFile(filePath);
  }
}
