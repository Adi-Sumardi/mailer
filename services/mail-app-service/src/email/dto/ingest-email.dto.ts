import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

// Payload dari skrip sendago-ingest di mail-engine (Postfix pipe). Pesan mentah dikirim
// base64 supaya aman lewat JSON apa pun encoding/binary-nya.
export class IngestEmailDto {
  @IsEmail()
  recipient: string;

  @IsString()
  @IsNotEmpty()
  rawBase64: string;
}
