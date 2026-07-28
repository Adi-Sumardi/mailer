# domain-provisioning

Terkait: FR-01 s/d FR-05 (manajemen tenant, verifikasi domain, SPF/DKIM/DMARC)

Lihat `docs/SRS_SendagoMail.docx` untuk detail requirement lengkap dan `docs/REQUIREMENTS_CHECKLIST.md` untuk tracking progress.

## Stack
NestJS + Prisma + PostgreSQL.

## Menjalankan Secara Lokal

```bash
cp .env.example .env      # sesuaikan DATABASE_URL, JWT_SECRET, MAIL_ENGINE_MX_HOST, DKIM_KEYS_DIR
npm install
npx prisma migrate dev    # buat schema di database (migration awal sudah ada di prisma/migrations/)
npm run start:dev
```

## Autentikasi & Otorisasi

Semua endpoint butuh header `Authorization: Bearer <JWT>`. Kontrak payload JWT (lihat `src/auth/jwt-payload.interface.ts`):

```json
{ "sub": "<user-id>", "role": "super_admin | tenant_admin | end_user", "tenantId": "<tenant-id atau null untuk super_admin>" }
```

Token diverifikasi pakai `JWT_SECRET` yang **harus sama persis** dengan `JWT_SECRET` di `services/auth-service` (penerbit token yang sesungguhnya, lihat README di sana) — masih shared-secret manual, idealnya diganti verifikasi berbasis public key (JWKS) antar service begitu ada API Gateway.

- `/tenants/*` — khusus role `super_admin` (`RolesGuard`)
- `/domains/*` — role `tenant_admin` (dibatasi hanya tenant miliknya sendiri lewat `TenantScopeGuard`) atau `super_admin` (bebas akses semua tenant)

## Endpoint

### Tenant (FR-01) — Super Admin only
| Method | Path | Keterangan |
|---|---|---|
| POST | `/tenants` | Membuat tenant baru |
| GET | `/tenants` | List semua tenant |
| GET | `/tenants/:id` | Detail tenant |
| PATCH | `/tenants/:id/deactivate` | Nonaktifkan tenant (soft) |
| PATCH | `/tenants/:id/reactivate` | Aktifkan kembali |
| DELETE | `/tenants/:id` | Hapus tenant — ditolak jika masih ada domain terdaftar |

### Domain (FR-02 s/d FR-05) — Tenant Admin (scoped) / Super Admin
| Method | Path | Keterangan |
|---|---|---|
| POST | `/domains` | Tambah domain baru — otomatis generate token verifikasi TXT + rekomendasi MX/SPF/DKIM/DMARC (FR-03) + hand-off DKIM key ke mail-engine |
| GET | `/domains?tenantId=...` | List domain milik satu tenant (FR-05: multi-domain per tenant) |
| GET | `/domains/:id` | Detail domain |
| GET | `/domains/:id/verification-instructions` | Nilai TXT record yang harus dipasang user |
| POST | `/domains/:id/verify` | Cek TXT record ke DNS publik, update status pending/verified/failed (FR-02, FR-04) |
| GET | `/domains/:id/status` | Status verifikasi terkini (untuk polling real-time) |
| GET | `/domains/:id/dns-records` | Rekomendasi MX/SPF/DKIM/DMARC siap-copy (private key DKIM tidak diekspos) |
| DELETE | `/domains/:id` | Hapus domain |

### Internal (service-to-service) — diproteksi `X-Internal-Api-Key`, bukan JWT
| Method | Path | Keterangan |
|---|---|---|
| GET | `/internal/tenants/:id/exists` | Dipakai `auth-service` untuk validasi silang `tenantId` saat registrasi (BR-08) |

## Catatan Implementasi
- DKIM keypair (RSA 2048-bit) digenerate otomatis saat domain dibuat. Private key ditulis ke `DKIM_KEYS_DIR/<domain>/<selector>.private` mengikuti layout OpenDKIM yang dipakai docker-mailserver (lihat `.gitignore` root: `**/config/opendkim/keys/`) — **asumsi path ini perlu diverifikasi ulang** begitu `mail-engine` benar-benar disetup, karena docker-mailserver bisa memakai lokasi berbeda tergantung versi & konfigurasi Rspamd/OpenDKIM yang dipakai. Kegagalan menulis file tidak menggagalkan pembuatan domain (di-log sebagai warning saja).
- Verifikasi TXT record memakai `dns.resolveTxt` bawaan Node — murni cek DNS publik, tidak butuh integrasi provider tertentu (Cloudflare API dsb. baru diperlukan kalau mau auto-provisioning DNS, bukan sekadar verifikasi).
- Guard JWT/RBAC (`JwtAuthGuard`, `RolesGuard`, `TenantScopeGuard` di `src/auth/`) sudah terpasang di semua endpoint. `services/auth-service` sekarang benar-benar menerbitkan token yang cocok dengan kontrak ini (`{sub, role, tenantId}` — subset dari payload yang diterbitkan di sana) — tinggal pastikan `JWT_SECRET` di kedua service sama.
- `GET /internal/tenants/:id/exists` sengaja dipisah dari `TenantController` (bukan `RolesGuard` super_admin) karena pemanggilnya (`auth-service`) bukan user login — diproteksi `InternalApiKeyGuard` (`X-Internal-Api-Key`), harus sama persis dengan `INTERNAL_API_KEY` di `auth-service`.

## Testing

```bash
npm test              # unit test murni (util DNS record — tidak butuh database)
npm run test:e2e       # integration test end-to-end lewat HTTP, butuh PostgreSQL nyata
```

`test:e2e` (18 test) menjalankan seluruh flow lewat supertest (bukan mock) terhadap database PostgreSQL sungguhan: auth guard (401/403), tenant CRUD, domain CRUD, tenant-scoping cross-tenant, flow verifikasi TXT record (DNS di-mock lewat `jest.mock('dns')` karena test tidak memiliki domain nyata untuk di-resolve), dan endpoint internal `GET /internal/tenants/:id/exists` (internal API key guard). Sebelum menjalankan, siapkan database test dan set `DATABASE_URL` ke sana, contoh:

```bash
docker run -d --name sendagomail-test-pg \
  -e POSTGRES_USER=sendagomail -e POSTGRES_PASSWORD=sendagomail \
  -e POSTGRES_DB=sendagomail_domain_provisioning_test -p 55432:5432 postgres:16-alpine

DATABASE_URL="postgresql://sendagomail:sendagomail@localhost:55432/sendagomail_domain_provisioning_test?schema=public" \
  npx prisma migrate deploy

DATABASE_URL="postgresql://sendagomail:sendagomail@localhost:55432/sendagomail_domain_provisioning_test?schema=public" \
  npm run test:e2e
```

## TODO
- [x] Scaffold project (NestJS + Prisma)
- [x] Implementasi endpoint FR-01 s/d FR-05
- [x] Unit test untuk util generator DNS record
- [x] Guard otorisasi JWT/RBAC (Super Admin / Tenant Admin, tenant-scoped)
- [x] Hand-off DKIM private key ke direktori mail-engine (filesystem-level; path masih perlu diverifikasi ulang terhadap setup mail-engine sungguhan)
- [x] Test integrasi end-to-end dengan database PostgreSQL nyata (18 test, lihat `test/`)
- [x] Endpoint internal untuk validasi silang tenantId dari `auth-service` (`GET /internal/tenants/:id/exists`, diproteksi internal API key)
- [ ] Integrasi dengan API Gateway
- [ ] Ganti verifikasi JWT_SECRET manual dengan mekanisme resmi (JWKS/public key) — `auth-service` sudah ada, ini tinggal upgrade transportnya
- [ ] Verifikasi ulang path & mekanisme reload DKIM key terhadap konfigurasi mail-engine yang sesungguhnya (Rspamd vs OpenDKIM)
