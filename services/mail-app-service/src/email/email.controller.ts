import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { EmailService, MAX_ATTACHMENT_SIZE_BYTES } from './email.service';
import { ComposeEmailDto } from './dto/compose-email.dto';
import { UpdateFlagsDto } from './dto/update-flags.dto';
import { SearchEmailDto } from './dto/search-email.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt-payload.interface';

@UseGuards(JwtAuthGuard)
@Controller('emails')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  // FR-06: compose baru, atau reply/forward kalau body menyertakan parentEmailId.
  @Post()
  compose(@CurrentUser() user: JwtPayload, @Body() dto: ComposeEmailDto) {
    return this.emailService.compose(user.mailboxId, dto);
  }

  // FR-11a: batalkan pengiriman selama masih memenuhi syarat (lihat EmailService.cancel).
  @Post(':id/cancel')
  cancel(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.emailService.cancel(user.mailboxId, id);
  }

  @Get('folder/:folderId')
  findAllInFolder(@CurrentUser() user: JwtPayload, @Param('folderId') folderId: string) {
    return this.emailService.findAllInFolder(user.mailboxId, folderId);
  }

  // FR-08
  @Get('search')
  search(@CurrentUser() user: JwtPayload, @Query() query: SearchEmailDto) {
    return this.emailService.search(user.mailboxId, query);
  }

  @Get(':id')
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.emailService.findOwnedOrThrow(user.mailboxId, id);
  }

  // FR-10
  @Patch(':id/flags')
  updateFlags(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateFlagsDto,
  ) {
    return this.emailService.updateFlags(user.mailboxId, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.emailService.remove(user.mailboxId, id);
  }

  // FR-09: upload file SUNGGUHAN (multipart), bukan metadata — field form: "file".
  @Post(':id/attachments')
  @UseInterceptors(
    FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_ATTACHMENT_SIZE_BYTES } }),
  )
  addAttachment(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('File lampiran tidak ditemukan di request (field: "file")');
    }
    return this.emailService.addAttachment(user.mailboxId, id, file);
  }

  @Get(':id/attachments')
  listAttachments(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.emailService.listAttachments(user.mailboxId, id);
  }

  // FR-09 (sisi download): unduh file lampiran asli.
  @Get(':id/attachments/:attachmentId/download')
  async downloadAttachment(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Res() res: Response,
  ) {
    const { filePath, filename } = await this.emailService.getAttachmentFile(
      user.mailboxId,
      id,
      attachmentId,
    );
    res.download(filePath, filename);
  }
}
