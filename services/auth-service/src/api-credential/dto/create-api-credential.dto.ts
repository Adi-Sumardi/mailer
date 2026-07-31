import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export type CredentialEnvironment = 'sandbox' | 'production';

export class CreateApiCredentialDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsEnum(['sandbox', 'production'])
  environment?: CredentialEnvironment;

  @IsOptional()
  @IsString()
  tenantId?: string;

  // Mailbox pengirim (mailboxId dari mail-app-service). Kalau tidak diisi, di-resolve
  // otomatis ke mailbox user pertama yang sudah terprovisi di tenant ini.
  @IsOptional()
  @IsString()
  mailboxId?: string;
}
