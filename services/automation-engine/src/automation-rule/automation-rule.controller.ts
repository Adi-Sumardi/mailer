import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AutomationRuleService } from './automation-rule.service';
import { CreateAutomationRuleDto } from './dto/create-automation-rule.dto';
import { UpdateAutomationRuleDto } from './dto/update-automation-rule.dto';
import { ExecuteRulesDto } from './dto/execute-rules.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtPayload } from '../auth/jwt-payload.interface';

@UseGuards(JwtAuthGuard)
@Controller('automation-rules')
export class AutomationRuleController {
  constructor(private readonly automationRuleService: AutomationRuleService) {}

  @Post()
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateAutomationRuleDto) {
    return this.automationRuleService.create(user.sub, dto);
  }

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.automationRuleService.findAll(user.sub);
  }

  @Get(':id')
  findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.automationRuleService.findOneOrThrow(user.sub, id);
  }

  // FR-21: field isActive di body untuk aktif/nonaktifkan tanpa hapus
  @Patch(':id')
  update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateAutomationRuleDto,
  ) {
    return this.automationRuleService.update(user.sub, id, dto);
  }

  @Delete(':id')
  remove(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.automationRuleService.remove(user.sub, id);
  }

  // FR-20: dipanggil (nantinya) oleh mail-app-service saat email baru masuk ke Inbox.
  // Belum ada wiring otomatis — lihat README untuk kenapa.
  @Post('execute')
  execute(@CurrentUser() user: JwtPayload, @Body() dto: ExecuteRulesDto) {
    return this.automationRuleService.executeForEmail(user.sub, dto);
  }
}
