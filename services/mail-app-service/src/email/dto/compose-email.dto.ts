import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

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

  // true kalau body sudah HTML mentah (mis. template transaksional dengan logo/tombol) —
  // false (default) memperlakukan body sebagai plain text, newline dikonversi jadi <br/>.
  @IsOptional()
  @IsBoolean()
  isHtml?: boolean;

  // Diisi untuk reply/forward (FR-06) — mewarisi threadId dari email induk.
  @IsOptional()
  @IsString()
  parentEmailId?: string;
}
