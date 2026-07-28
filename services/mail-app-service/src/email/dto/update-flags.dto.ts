import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateFlagsDto {
  @IsOptional()
  @IsBoolean()
  isRead?: boolean;

  @IsOptional()
  @IsBoolean()
  isImportant?: boolean;

  @IsOptional()
  @IsBoolean()
  isSpam?: boolean;
}
