import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { FolderService } from './folder.service';
import { CreateFolderDto } from './dto/create-folder.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt-payload.interface';

@UseGuards(JwtAuthGuard)
@Controller('folders')
export class FolderController {
  constructor(private readonly folderService: FolderService) {}

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateFolderDto) {
    return this.folderService.create(user.mailboxId, dto);
  }

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.folderService.findAll(user.mailboxId);
  }

  @Get(':id')
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.folderService.findOneOrThrow(user.mailboxId, id);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.folderService.remove(user.mailboxId, id);
  }
}
