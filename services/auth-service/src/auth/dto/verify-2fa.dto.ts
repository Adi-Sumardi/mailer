import { IsNotEmpty, IsString, Length } from 'class-validator';

export class Verify2FaDto {
  @IsString()
  @IsNotEmpty()
  @Length(6, 6, { message: 'Kode 2FA harus 6 digit' })
  code!: string;
}
