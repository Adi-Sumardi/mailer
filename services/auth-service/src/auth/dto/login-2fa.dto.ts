import { IsNotEmpty, IsString, Length } from 'class-validator';

export class Login2FaDto {
  @IsString()
  @IsNotEmpty()
  mfaToken!: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'Kode 2FA harus 6 digit' })
  code!: string;
}
