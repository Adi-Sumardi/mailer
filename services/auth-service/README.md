# auth-service

Terkait: BR-08 (isolasi data antar tenant), penerbit JWT untuk seluruh service lain

Lihat `docs/SRS_SendagoMail.docx` untuk detail requirement lengkap dan `docs/REQUIREMENTS_CHECKLIST.md` untuk tracking progress.

## Stack
NestJS + Prisma + PostgreSQL + bcryptjs.

## Menjalankan Secara Lokal

```bash
cp .env.example .env      # sesuaikan DATABASE_URL, JWT_SECRET, INTERNAL_API_KEY, MAIL_APP_SERVICE_URL, DOMAIN_PROVISIONING_SERVICE_URL
npm install
npx prisma migrate dev    # buat schema di database (migration sudah ada di prisma/migrations/)
npm run start:dev
```

**PENTING:** `JWT_SECRET` dan `INTERNAL_API_KEY` di sini **harus identik** dengan nilai yang sama di `domain-provisioning` dan `mail-app-service` — service ini satu-satunya penerbit token, tapi ketiganya masih verifikasi pakai shared-secret manual (belum ada JWKS/public-key/mTLS).

## Endpoint

| Method | Path | Keterangan |
|---|---|---|
| POST | `/auth/register` | Registrasi user baru (super_admin/tenant_admin/end_user). `tenantId` wajib untuk tenant_admin & end_user (BR-08), divalidasi silang ke `domain-provisioning`. Untuk `end_user`, otomatis memanggil `mail-app-service` untuk provisioning mailbox (FR-07). Mengembalikan `accessToken` + `refreshToken`. |
| POST | `/auth/login` | Login, mengembalikan `accessToken` + `refreshToken` baru |
| POST | `/auth/refresh` | Tukar `refreshToken` valid dengan `accessToken` + `refreshToken` baru (rotasi — token lama langsung revoked) |
| POST | `/auth/logout` | Revoke `refreshToken` (sesi tidak bisa diperpanjang lagi lewat token itu) |
| GET | `/auth/me` | Profil user dari token yang sedang login (butuh `Authorization: Bearer`) |

### API Credential — integrasi aplikasi eksternal (member_id/secret)
| Method | Path | Keterangan |
|---|---|---|
| POST | `/auth/api-credentials` | **Khusus `tenant_admin`.** Buat credential baru (`{name, environment: 'sandbox'\|'production'}`). Mengembalikan `memberId` + `secret` mentah **sekali saja** — setelah ini cuma hash yang disimpan. |
| GET | `/auth/api-credentials` | List credential milik tenant sendiri (tanpa secret) |
| DELETE | `/auth/api-credentials/:id` | Revoke credential |
| POST | `/auth/api-credentials/validate` | **Publik, bukan JWT** — otentikasi pakai `{memberId, secret}` di body. Mengecek validitas + mengonsumsi kuota harian, mengembalikan `{valid, remainingQuota}` atau `{valid: false, reason}`. |

**Sandbox vs Production:** sandbox selalu gratis tapi dibatasi **50 email/hari** (hardcoded). Production pakai limit default **5000/hari** — ini **placeholder**, belum benar-benar terhubung ke paket berlangganan tenant (FR-25 belum jadi sistem billing sungguhan, `Tenant.planType` di `domain-provisioning` baru string `free`/dst tanpa definisi paket formal). Kuota reset otomatis per hari (UTC).

## Kontrak Token (dikonsumsi service lain)

```json
{ "sub": "<user-id>", "role": "super_admin | tenant_admin | end_user", "tenantId": "<id atau null>", "mailboxId": "<id atau null>" }
```

Ini superset dari kontrak yang dipakai `domain-provisioning` (`{sub, role, tenantId}`) dan `mail-app-service` (`{sub, mailboxId}`) — satu `accessToken` berlaku untuk kedua service tanpa perlu re-login. Field yang tidak dipakai suatu service cukup diabaikan di sana.

`refreshToken` **bukan** JWT — string random 32-byte, disimpan hash (SHA-256) di tabel `refresh_token`, dirotasi setiap dipakai (`POST /auth/refresh`): token lama langsung di-revoke begitu dipakai sekali, jadi replay token lama akan gagal.

## Panggilan Service-to-Service

| Ke | Dipakai untuk | Mekanisme |
|---|---|---|
| `mail-app-service` `POST /mailboxes` | Provisioning mailbox saat `end_user` register (FR-07) | HTTP + header `X-Internal-Api-Key`. **Fail-open**: kegagalan (service down/timeout) tidak menggagalkan registrasi — `mailboxId` jadi `null`, perlu diprovisikan ulang manual. |
| `domain-provisioning` `GET /internal/tenants/:id/exists` | Validasi silang `tenantId` saat register `tenant_admin`/`end_user` (BR-08) | HTTP + header `X-Internal-Api-Key`. **Fail-closed** kalau tenant terkonfirmasi tidak ada (400 Bad Request); **fail-open** kalau service tidak terjangkau (registrasi tetap lanjut, di-log sebagai warning). |

Keduanya masih HTTP polos antar-container/localhost, **bukan** lewat API Gateway atau message queue — cukup untuk pengembangan lokal, perlu di-harden (mTLS/service mesh) sebelum production.

## Catatan Implementasi
- Password di-hash dengan **bcryptjs** (10 rounds) — dipilih di atas `bcrypt` native supaya tidak butuh native build toolchain saat instalasi.
- Validasi `tenantId` sengaja **fail-closed** untuk kasus "terkonfirmasi tidak ada" tapi **fail-open** untuk kasus "tidak bisa dicek" — beda dari provisioning mailbox yang selalu fail-open. Alasan: tenantId yang jelas-jelas salah adalah bug data yang harus dicegah sejak awal, sedangkan dependency yang down bukan alasan untuk memblokir seluruh registrasi.

## Testing

```bash
npm test              # unit test murni (belum ada — semua logic terhubung ke Prisma/HTTP client)
npm run test:e2e       # integration test end-to-end lewat HTTP, butuh PostgreSQL nyata
```

`test:e2e` (31 test) menembak HTTP endpoint sungguhan terhadap database PostgreSQL nyata: register per role, validasi `tenantId` wajib + validasi silang (mocked true/false) ke `domain-provisioning`, email duplikat, provisioning mailbox (mocked & graceful-degradation saat `mail-app-service` unreachable), login (isi payload JWT), `GET /auth/me`, refresh token (rotasi, replay lama ditolak), logout (revoke), dan **API credential** (create per environment, limit sandbox vs production, validate+consume kuota, reset harian, revoke, isolasi antar tenant). Contoh setup:

```bash
docker run -d --name sendagomail-auth-test-pg \
  -e POSTGRES_USER=sendagomail -e POSTGRES_PASSWORD=sendagomail \
  -e POSTGRES_DB=sendagomail_auth_test -p 55432:5432 postgres:16-alpine

DATABASE_URL="postgresql://sendagomail:sendagomail@localhost:55432/sendagomail_auth_test?schema=public" \
  npx prisma migrate deploy

DATABASE_URL="postgresql://sendagomail:sendagomail@localhost:55432/sendagomail_auth_test?schema=public" \
  npm run test:e2e
```

## TODO
- [x] Scaffold project (NestJS + Prisma + bcryptjs)
- [x] Register (super_admin/tenant_admin/end_user) + login + `/auth/me`
- [x] Penerbitan JWT dengan kontrak superset yang dikonsumsi `domain-provisioning` & `mail-app-service`
- [x] Provisioning mailbox otomatis untuk end_user (panggil `mail-app-service`, diproteksi internal API key, graceful degradation)
- [x] Refresh token dengan rotasi + logout (revoke)
- [x] Validasi silang `tenantId` ke `domain-provisioning` (diproteksi internal API key, fail-closed/fail-open sesuai skenario)
- [x] Test integrasi end-to-end dengan database PostgreSQL nyata (31 test)
- [x] API Credential (member_id/secret) dengan environment sandbox/production + kuota harian
- [ ] Ganti panggilan HTTP polos ke service lain dengan lewat API Gateway atau message queue
- [ ] Ganti shared-secret `JWT_SECRET`/`INTERNAL_API_KEY` manual dengan JWKS/mTLS begitu ada API Gateway/service mesh
- [ ] Integrasi dengan API Gateway
- [ ] Wiring nyata: `mail-app-service` memanggil `POST /auth/api-credentials/validate` sebelum mengizinkan kirim email lewat API eksternal (endpoint sudah jalan & teruji, belum ada pemanggil sungguhan)
- [ ] Kuota production benar-benar ditarik dari paket berlangganan tenant begitu FR-25 (billing) dibangun — saat ini hardcoded 5000/hari
