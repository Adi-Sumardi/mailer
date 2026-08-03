import { IsBoolean, IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ApiSendEmailDto {
  @IsString()
  @IsNotEmpty()
  memberId: string;

  @IsString()
  @IsNotEmpty()
  secret: string;

  @IsEmail()
  toAddr: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(998)
  subject: string;

  @IsString()
  @IsNotEmpty()
  body: string;

  // true kalau body sudah HTML mentah (template transaksional dengan logo/tombol/dsb) —
  // false (default) memperlakukan body sebagai plain text, newline dikonversi jadi <br/>.
  @IsOptional()
  @IsBoolean()
  isHtml?: boolean;
}
