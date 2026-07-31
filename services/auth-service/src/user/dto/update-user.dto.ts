import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsEnum(['super_admin', 'tenant_admin', 'end_user'])
  role?: 'super_admin' | 'tenant_admin' | 'end_user';

  @IsOptional()
  @IsString()
  tenantId?: string;
}
