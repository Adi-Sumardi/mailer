import { IsNotEmpty, IsString } from 'class-validator';

export class ValidateApiCredentialDto {
  @IsString()
  @IsNotEmpty()
  memberId: string;

  @IsString()
  @IsNotEmpty()
  secret: string;
}
