import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ComposeEmailDto {
  @IsEmail()
  toAddr: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(998) // batas panjang subjek header email standar (RFC 5322 soft limit)
  subject: string;

  @IsString()
  @IsNotEmpty()
  body: string;

  // Diisi untuk reply/forward (FR-06) — mewarisi threadId dari email induk.
  @IsOptional()
  @IsString()
  parentEmailId?: string;
}
