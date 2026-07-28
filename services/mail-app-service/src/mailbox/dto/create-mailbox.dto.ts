import { IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, Min } from 'class-validator';

export class CreateMailboxDto {
  @IsString()
  @IsNotEmpty()
  userId: string;

  @IsEmail()
  emailAddress: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  quotaMb?: number;
}
