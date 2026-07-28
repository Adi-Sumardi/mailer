import { IsInt, IsNotEmpty, IsPositive, IsString } from 'class-validator';

// Upload file sesungguhnya (ke S3/MinIO) di luar scope service ini — diasumsikan client
// sudah upload lewat presigned URL dan mengirim metadata hasilnya ke sini.
export class AddAttachmentDto {
  @IsString()
  @IsNotEmpty()
  filename: string;

  @IsInt()
  @IsPositive()
  sizeKb: number;

  @IsString()
  @IsNotEmpty()
  storagePath: string;
}
