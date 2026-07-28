import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { EmailService } from './email.service';
import { ComposeEmailDto } from './dto/compose-email.dto';
import { UpdateFlagsDto } from './dto/update-flags.dto';
import { SearchEmailDto } from './dto/search-email.dto';
import { AddAttachmentDto } from './dto/add-attachment.dto';
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

  // FR-09
  @Post(':id/attachments')
  addAttachment(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: AddAttachmentDto,
  ) {
    return this.emailService.addAttachment(user.mailboxId, id, dto);
  }

  @Get(':id/attachments')
  listAttachments(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.emailService.listAttachments(user.mailboxId, id);
  }
}
