import { IsEmail, IsEnum, IsString, MinLength, ValidateIf } from 'class-validator';

export type Role = 'super_admin' | 'tenant_admin' | 'end_user';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsEnum(['super_admin', 'tenant_admin', 'end_user'])
  role: Role;

  // Wajib untuk tenant_admin & end_user (BR-08: isolasi data antar tenant), diabaikan untuk super_admin.
  @ValidateIf((dto: RegisterDto) => dto.role !== 'super_admin')
  @IsString()
  tenantId?: string;
}
