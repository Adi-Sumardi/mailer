import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type ValidateApiCredentialResult =
  | { valid: true; tenantId: string; mailboxId: string; environment: string; remainingQuota: number }
  | { valid: false; reason: string };

// Panggilan service-to-service lewat HTTP polos ke POST /auth/api-credentials/validate —
// endpoint itu sengaja publik (tidak dipasangi INTERNAL_API_KEY) karena memberId+secret
// di body ITU SENDIRI adalah mekanisme otentikasinya.
@Injectable()
export class AuthServiceClientService {
  private readonly logger = new Logger(AuthServiceClientService.name);

  constructor(private readonly config: ConfigService) {}

  async validateApiCredential(memberId: string, secret: string): Promise<ValidateApiCredentialResult> {
    const baseUrl = this.config.get<string>('AUTH_SERVICE_URL');
    if (!baseUrl) {
      this.logger.warn('AUTH_SERVICE_URL tidak diset — tolak semua pengiriman via API credential');
      return { valid: false, reason: 'Layanan validasi credential sedang tidak tersedia' };
    }

    try {
      const res = await fetch(`${baseUrl}/auth/api-credentials/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId, secret }),
      });
      if (!res.ok) {
        return { valid: false, reason: `Validasi credential gagal (HTTP ${res.status})` };
      }
      return (await res.json()) as ValidateApiCredentialResult;
    } catch (err) {
      this.logger.warn(`Gagal menghubungi auth-service untuk validasi credential: ${(err as Error).message}`);
      return { valid: false, reason: 'Layanan validasi credential sedang tidak tersedia' };
    }
  }
}
