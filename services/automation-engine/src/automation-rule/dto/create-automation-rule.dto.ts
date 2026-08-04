import { IsEnum, IsNotEmpty, IsOptional, IsString, ValidateIf } from 'class-validator';

export type ConditionField = 'sender' | 'subject' | 'body';
export type ConditionOperator = 'contains' | 'equals';
export type ActionType = 'move_folder' | 'forward' | 'auto_reply' | 'delete' | 'ai_agent';
export type AiProvider = 'openai' | 'anthropic';

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

  @IsEnum(['move_folder', 'forward', 'auto_reply', 'delete', 'ai_agent'])
  actionType: ActionType;

  // Diperlukan untuk move_folder (nama folder tujuan), forward (alamat tujuan),
  // auto_reply (isi balasan). Diabaikan untuk delete/ai_agent.
  @IsOptional()
  @IsString()
  actionValue?: string;

  // Wajib diisi kalau actionType = ai_agent — lihat AutomationRuleService untuk enkripsi.
  @ValidateIf((dto: CreateAutomationRuleDto) => dto.actionType === 'ai_agent')
  @IsEnum(['openai', 'anthropic'])
  aiProvider?: AiProvider;

  @ValidateIf((dto: CreateAutomationRuleDto) => dto.actionType === 'ai_agent')
  @IsString()
  @IsNotEmpty()
  aiModel?: string;

  @ValidateIf((dto: CreateAutomationRuleDto) => dto.actionType === 'ai_agent')
  @IsString()
  @IsNotEmpty()
  aiApiKey?: string;
}
