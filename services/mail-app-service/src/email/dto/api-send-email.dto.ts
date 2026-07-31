import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

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
}
