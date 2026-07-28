import { IsBoolean, IsOptional } from 'class-validator';
import { PartialType } from '@nestjs/mapped-types';
import { CreateAutomationRuleDto } from './create-automation-rule.dto';

export class UpdateAutomationRuleDto extends PartialType(CreateAutomationRuleDto) {
  // FR-21: aktif/nonaktifkan tanpa hapus
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
