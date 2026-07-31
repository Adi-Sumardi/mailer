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
}
