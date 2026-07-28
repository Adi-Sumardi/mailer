# mail-app-service

Terkait: FR-06 s/d FR-11a (compose, inbox, folder, search, attachment, flag, thread, recall/unsend)

Lihat `docs/SRS_SendagoMail.docx` untuk detail requirement lengkap dan `docs/REQUIREMENTS_CHECKLIST.md` untuk tracking progress.

## Stack
NestJS + Prisma + PostgreSQL.

## Menjalankan Secara Lokal

```bash
cp .env.example .env      # sesuaikan DATABASE_URL, JWT_SECRET, DEFAULT_RECALL_WINDOW_SECONDS
npm install
npx prisma migrate dev    # buat schema di database (migration awal sudah ada di prisma/migrations/)
npm run start:dev
```

## Autentikasi

Semua endpoint (kecuali `POST /mailboxes` — lihat catatan di bawah) butuh header `Authorization: Bearer <JWT>`. Kontrak payload (lihat `src/auth/jwt-payload.interface.ts`):

```json
{ "sub": "<user-id>", "mailboxId": "<mailbox-id>" }
```

Berbeda dari `domain-provisioning` (yang scoping per-tenant), service ini scoping akses **per-mailbox** — semua query otomatis difilter `mailboxId` dari token, tidak ada resource lain yang bisa diakses lintas mailbox (percobaan akses mengembalikan 404, bukan 403, supaya tidak membocorkan keberadaan resource).

## Endpoint

### Mailbox
| Method | Path | Keterangan |
|---|---|---|
| POST | `/mailboxes` | Provisioning mailbox baru + folder default Inbox/Sent/Draft/Trash (FR-07). **Internal-only**, diproteksi `X-Internal-Api-Key` (bukan JWT) — lihat catatan. |
| GET | `/mailboxes/:id` | Detail mailbox |

### Folder (FR-07)
| Method | Path | Keterangan |
|---|---|---|
| POST | `/folders` | Buat folder custom |
| GET | `/folders` | List semua folder milik mailbox |
| GET | `/folders/:id` | Detail folder |
| DELETE | `/folders/:id` | Hapus folder custom (folder default ditolak) |

### Email (FR-06 s/d FR-11a)
| Method | Path | Keterangan |
|---|---|---|
| POST | `/emails` | Compose baru, atau reply/forward jika `parentEmailId` diisi (FR-06, FR-11 thread) |
| POST | `/emails/:id/cancel` | **Recall/Unsend** (FR-11a) — lihat penjelasan mekanisme di bawah |
| GET | `/emails/folder/:folderId` | List email dalam satu folder |
| GET | `/emails/search` | Search berdasar `from`, `subject`, `q` (subjek+isi), `dateFrom`, `dateTo`, `folderId` (FR-08) |
| GET | `/emails/:id` | Detail email |
| PATCH | `/emails/:id/flags` | Update `isRead` / `isImportant` / `isSpam` (FR-10) |
| DELETE | `/emails/:id` | Soft delete (pindah ke Trash), hard delete kalau sudah di Trash |
| POST | `/emails/:id/attachments` | Tambah metadata attachment (FR-09) |
| GET | `/emails/:id/attachments` | List attachment |

## Mekanisme Recall/Unsend (FR-11a) — fitur differensiator

| Skenario | Implementasi |
|---|---|
| **Internal → Internal** | Saat compose, sistem cek apakah `toAddr` cocok dengan mailbox lokal. Kalau ya: email langsung dibuat di Inbox penerima (`sendStatus: 'sent'`), tapi **tetap bisa ditarik selama penerima belum membaca** — `POST /emails/:id/cancel` menghapus salinan di Inbox penerima kalau `isRead` masih `false`. Kalau sudah dibaca → 409 Conflict. |
| **Internal → Eksternal** | Kalau `toAddr` tidak ditemukan di mailbox lokal: email dibuat dengan `sendStatus: 'queued'` dan `recallDeadlineAt` = sekarang + `DEFAULT_RECALL_WINDOW_SECONDS` (default 20 detik, rentang wajar 5-60 sesuai SRS). Selama sebelum deadline, `cancel` berhasil (→ `sendStatus: 'cancelled'`). Setelah deadline lewat → 409 Conflict ("sudah terkirim, tidak dapat ditarik"). |

`EmailService.dispatchDueEmails()` men-scan email `queued` yang sudah lewat `recallDeadlineAt` dan menandainya `sent` — **ini masih stub**, belum benar-benar menyerahkan email ke `mail-engine` (Postfix) lewat SMTP. Perlu scheduler (cron/queue, mis. via Redis + BullMQ sesuai arsitektur di `docs/architecture_diagram.png`) yang memanggil method ini secara berkala di production.

## Catatan Implementasi
- `POST /mailboxes` diproteksi `InternalApiKeyGuard` (header `X-Internal-Api-Key`, **harus sama persis** dengan `INTERNAL_API_KEY` di `services/auth-service`) — bukan JWT karena mailbox belum ada di titik itu. `services/auth-service` memanggil endpoint ini otomatis saat registrasi `end_user`. Ini masih shared-secret sederhana, bukan mTLS/service mesh — cukup untuk pengembangan lokal.
- Upload file attachment sesungguhnya (ke S3/MinIO) di luar scope service ini — endpoint attachment cuma terima metadata, mengasumsikan client sudah upload lewat presigned URL sebelumnya.
- Reply/forward pakai endpoint compose yang sama dengan `parentEmailId` diisi — server tidak otomatis menambahkan prefix "Re:"/"Fwd:" ke subjek, itu tanggung jawab client/UI.
- Guard JWT sudah terpasang. `services/auth-service` sekarang benar-benar menerbitkan token yang cocok dengan kontrak ini (`{sub, mailboxId}` — subset dari payload yang diterbitkan di sana) — tinggal pastikan `JWT_SECRET` di kedua service sama.

## Testing

```bash
npm test              # unit test murni (belum ada — semua logic saat ini terhubung ke Prisma, lihat catatan)
npm run test:e2e       # integration test end-to-end lewat HTTP, butuh PostgreSQL nyata
```

`test:e2e` (14 test) menembak HTTP endpoint sungguhan terhadap database PostgreSQL nyata (bukan mock): provisioning folder default, compose internal & eksternal, **recall internal berhasil/gagal (before/after dibaca)**, **recall eksternal berhasil/gagal (dalam/lewat window)**, search, flags, soft/hard delete, isolasi antar-mailbox, dan internal API key guard di `POST /mailboxes`. Contoh setup:

```bash
docker run -d --name sendagomail-mail-test-pg \
  -e POSTGRES_USER=sendagomail -e POSTGRES_PASSWORD=sendagomail \
  -e POSTGRES_DB=sendagomail_mail_app_test -p 55432:5432 postgres:16-alpine

DATABASE_URL="postgresql://sendagomail:sendagomail@localhost:55432/sendagomail_mail_app_test?schema=public" \
  npx prisma migrate deploy

DATABASE_URL="postgresql://sendagomail:sendagomail@localhost:55432/sendagomail_mail_app_test?schema=public" \
  npm run test:e2e
```

## TODO
- [x] Scaffold project (NestJS + Prisma)
- [x] Implementasi endpoint FR-06 s/d FR-11a
- [x] Logika Recall/Unsend internal & eksternal (FR-11a.1, FR-11a.2)
- [x] Test integrasi end-to-end dengan database PostgreSQL nyata (14 test)
- [x] Otentikasi service-to-service untuk `POST /mailboxes` (internal API key)
- [ ] Unit test murni untuk logic yang bisa diisolasi dari Prisma
- [ ] Scheduler nyata (cron/queue) untuk `dispatchDueEmails()` — saat ini harus dipanggil manual
- [ ] Integrasi SMTP sungguhan ke mail-engine (Postfix) saat dispatch
- [ ] Integrasi object storage (S3/MinIO) untuk upload attachment sungguhan
- [ ] Integrasi dengan API Gateway
- [ ] Thread/Conversation view API tambahan (FR-11) — saat ini threadId sudah ada di skema tapi belum ada endpoint khusus "GET /emails/thread/:threadId"
