import { IsNotEmpty, IsString } from 'class-validator';

// FR-20: payload email masuk yang dikirim mail-app-service (webhook — belum diimplementasikan
// di sana, lihat README) untuk dievaluasi terhadap seluruh automation rule aktif milik user.
export class ExecuteRulesDto {
  @IsString()
  @IsNotEmpty()
  fromAddr: string;

  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  body: string;
}
