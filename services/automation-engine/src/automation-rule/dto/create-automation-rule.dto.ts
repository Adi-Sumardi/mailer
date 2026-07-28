import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export type ConditionField = 'sender' | 'subject' | 'body';
export type ConditionOperator = 'contains' | 'equals';
export type ActionType = 'move_folder' | 'forward' | 'auto_reply' | 'delete';

export class CreateAutomationRuleDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum(['sender', 'subject', 'body'])
  conditionField: ConditionField;

  @IsOptional()
  @IsEnum(['contains', 'equals'])
  conditionOperator?: ConditionOperator;

  @IsString()
  @IsNotEmpty()
  conditionValue: string;

  @IsEnum(['move_folder', 'forward', 'auto_reply', 'delete'])
  actionType: ActionType;

  // Diperlukan untuk move_folder (nama folder tujuan), forward (alamat tujuan),
  // auto_reply (isi balasan). Diabaikan untuk delete.
  @IsOptional()
  @IsString()
  actionValue?: string;
}
