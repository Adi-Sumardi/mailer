import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Panggilan service-to-service sementara lewat HTTP polos, diproteksi INTERNAL_API_KEY yang
// dibagi dengan domain-provisioning. TODO: ganti dengan mekanisme resmi (mTLS/service mesh)
// begitu API Gateway/service mesh ada.
@Injectable()
export class DomainProvisioningClientService {
  private readonly logger = new Logger(DomainProvisioningClientService.name);

  constructor(private readonly config: ConfigService) {}

  // Validasi silang tenantId ke domain-provisioning saat registrasi (BR-08).
  // Return true/false kalau berhasil dicek, null kalau service tidak terjangkau (fail-open —
  // lihat AuthService.register: registrasi tetap jalan, hanya di-log sebagai warning).
  async tenantExists(tenantId: string): Promise<boolean | null> {
    const baseUrl = this.config.get<string>('DOMAIN_PROVISIONING_SERVICE_URL');
    const internalApiKey = this.config.get<string>('INTERNAL_API_KEY');
    if (!baseUrl) {
      this.logger.warn('DOMAIN_PROVISIONING_SERVICE_URL tidak diset — lewati validasi tenantId');
      return null;
    }

    try {
      const res = await fetch(`${baseUrl}/internal/tenants/${tenantId}/exists`, {
        headers: { 'X-Internal-Api-Key': internalApiKey ?? '' },
      });
      if (!res.ok) {
        this.logger.warn(`Cek tenantId ${tenantId} gagal (HTTP ${res.status})`);
        return null;
      }
      const body = (await res.json()) as { exists: boolean };
      return body.exists;
    } catch (err) {
      this.logger.warn(`Cek tenantId ${tenantId} gagal: ${(err as Error).message}`);
      return null;
    }
  }
}
