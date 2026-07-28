import { IsNotEmpty, IsString } from 'class-validator';

// FR-18: convert email jadi tugas. emailId adalah id di mail-app-service — tidak divalidasi
// silang ke sana (lihat catatan di README), murni disimpan sebagai referensi.
export class CreateTaskFromEmailDto {
  @IsString()
  @IsNotEmpty()
  emailId: string;

  @IsString()
  @IsNotEmpty()
  title: string;
}
