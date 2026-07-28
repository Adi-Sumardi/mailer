import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Panggilan service-to-service sementara lewat HTTP polos, diproteksi INTERNAL_API_KEY yang
// dibagi dengan mail-app-service. TODO: ganti dengan mekanisme resmi (mTLS/message queue)
// begitu API Gateway/service mesh ada.
@Injectable()
export class MailAppClientService {
  private readonly logger = new Logger(MailAppClientService.name);

  constructor(private readonly config: ConfigService) {}

  // FR-07: provisioning mailbox + folder default saat end_user baru mendaftar.
  // Kegagalan TIDAK melempar error ke pemanggil — registrasi user tetap harus berhasil
  // walau mail-app-service sedang down; mailboxId akan null dan perlu diprovisikan ulang.
  async provisionMailbox(userId: string, emailAddress: string): Promise<string | null> {
    const baseUrl = this.config.get<string>('MAIL_APP_SERVICE_URL');
    const internalApiKey = this.config.get<string>('INTERNAL_API_KEY');
    if (!baseUrl) {
      this.logger.warn('MAIL_APP_SERVICE_URL tidak diset — lewati provisioning mailbox');
      return null;
    }

    try {
      const res = await fetch(`${baseUrl}/mailboxes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Api-Key': internalApiKey ?? '',
        },
        body: JSON.stringify({ userId, emailAddress }),
      });
      if (!res.ok) {
        this.logger.warn(`Provisioning mailbox gagal (HTTP ${res.status}) untuk ${emailAddress}`);
        return null;
      }
      const body = (await res.json()) as { id: string };
      return body.id;
    } catch (err) {
      this.logger.warn(`Provisioning mailbox gagal untuk ${emailAddress}: ${(err as Error).message}`);
      return null;
    }
  }
}
