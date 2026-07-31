import { IsEmail, IsEnum, IsString, MinLength, ValidateIf } from 'class-validator';

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  password: string;

  @IsEnum(['super_admin', 'tenant_admin', 'end_user'])
  role: 'super_admin' | 'tenant_admin' | 'end_user';

  @ValidateIf((dto: CreateUserDto) => dto.role !== 'super_admin')
  @IsString()
  tenantId?: string;
}
