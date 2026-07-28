import { IsISO8601, IsOptional, IsString } from 'class-validator';

// FR-08: search berdasarkan pengirim, subjek, isi, dan tanggal.
export class SearchEmailDto {
  @IsOptional()
  @IsString()
  folderId?: string;

  @IsOptional()
  @IsString()
  from?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  q?: string; // dicari di subject + body

  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @IsOptional()
  @IsISO8601()
  dateTo?: string;
}
