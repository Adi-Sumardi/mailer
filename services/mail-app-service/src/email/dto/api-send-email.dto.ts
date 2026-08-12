import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

// Satu lampiran untuk email transaksional lewat API (mis. invoice PDF). Konten dikirim
// base64 di body JSON — integrator API umumnya lebih mudah mengirim JSON daripada multipart.
export class ApiSendAttachmentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  filename: string;

  @IsString()
  @IsNotEmpty()
  contentBase64: string;
}

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

  // Batas 10 lampiran per email; ukuran total tetap dibatasi MAX_ATTACHMENT_SIZE_KB per file
  // (divalidasi di EmailService.storeAttachment).
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => ApiSendAttachmentDto)
  attachments?: ApiSendAttachmentDto[];
}
