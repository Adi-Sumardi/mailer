import { IsEnum, IsHexColor, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertEmailTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  subtitle?: string;

  @IsOptional()
  @IsEnum(['left', 'center', 'right'])
  logoPosition?: 'left' | 'center' | 'right';

  @IsOptional()
  @IsHexColor()
  primaryColor?: string;

  @IsOptional()
  @IsHexColor()
  accentColor?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  footerText?: string;
}
