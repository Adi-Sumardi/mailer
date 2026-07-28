# automation-engine

Terkait: FR-19 s/d FR-21 (automation rules)

Lihat `docs/SRS_SendagoMail.docx` untuk detail requirement lengkap dan `docs/REQUIREMENTS_CHECKLIST.md` untuk tracking progress.

## Stack
NestJS + Prisma + PostgreSQL.

## Menjalankan Secara Lokal

```bash
cp .env.example .env      # sesuaikan DATABASE_URL, JWT_SECRET
npm install
npx prisma migrate dev    # buat schema di database (migration awal sudah ada di prisma/migrations/)
npm run start:dev
```

## Autentikasi

Semua endpoint butuh header `Authorization: Bearer <JWT>` (`JWT_SECRET` harus sama persis dengan `services/auth-service`). Scoping akses **per-user** (`sub` di JWT payload), sama seperti `calendar-task-service`.

## Endpoint

| Method | Path | Keterangan |
|---|---|---|
| POST | `/automation-rules` | Buat aturan kondisi + aksi (FR-19) |
| GET | `/automation-rules` | List aturan milik user |
| GET | `/automation-rules/:id` | Detail aturan |
| PATCH | `/automation-rules/:id` | Edit aturan, termasuk `isActive` untuk aktif/nonaktifkan tanpa hapus (FR-21) |
| DELETE | `/automation-rules/:id` | Hapus aturan |
| POST | `/automation-rules/execute` | Evaluasi satu email masuk terhadap semua aturan **aktif** milik user (FR-20) — lihat catatan |

### Bentuk Aturan (FR-19)

```json
{
  "name": "Pindahkan email vendor",
  "conditionField": "sender",       // sender | subject | body
  "conditionOperator": "contains",  // contains | equals (default: contains)
  "conditionValue": "@vendor.com",
  "actionType": "move_folder",      // move_folder | forward | auto_reply | delete
  "actionValue": "Vendor"           // nama folder / alamat forward / isi auto-reply (diabaikan utk delete)
}
```

## FR-20 — Eksekusi Real-time: Apa yang Sungguhan Jalan vs. Belum

`POST /automation-rules/execute` menerima payload email (`fromAddr`, `subject`, `body`), mengevaluasi seluruh aturan **aktif** milik user, dan mengembalikan daftar aturan yang cocok beserta aksi yang **seharusnya** dijalankan.

**Yang BELUM ada (dan ini penting dipahami sebelum dianggap "FR-20 selesai"):**
- **Tidak ada wiring otomatis dari `mail-app-service`.** Endpoint ini pasif — harus dipanggil dari luar (mis. webhook dari `mail-app-service` setiap ada email baru masuk Inbox). Belum ada message bus/event (Redis pub-sub, dsb.) yang menghubungkan keduanya.
- **Aksi tidak benar-benar dieksekusi.** Response cuma memberi tahu "aturan X cocok, harusnya lakukan Y" — automation-engine **tidak** memanggil `mail-app-service` untuk benar-benar memindah folder/forward/hapus email, dan tidak mengirim email untuk auto-reply. Itu semua perlu integrasi tambahan (HTTP client ke `mail-app-service` seperti pola `MailAppClientService` di `auth-service`, atau lewat message queue).

Kondisi kecocokan sendiri (`matchesCondition` di `src/automation-rule/rule-evaluator.util.ts`) adalah **pure function** yang sudah diuji lewat unit test murni (bukan e2e) — logic pencocokan-nya solid, yang belum solid adalah integrasi lintas service di sekitarnya.

## Testing

```bash
npm test              # unit test murni — logic pencocokan kondisi (rule-evaluator.util.spec.ts)
npm run test:e2e       # integration test end-to-end lewat HTTP, butuh PostgreSQL nyata
```

`npm test` (5 test) menguji `matchesCondition` langsung tanpa DB/HTTP — operator `contains`/`equals`, case-insensitive, per field (sender/subject/body).

`npm run test:e2e` (6 test) menembak HTTP endpoint sungguhan terhadap database PostgreSQL nyata: CRUD aturan, aktif/nonaktifkan (FR-21), eksekusi mencocokkan aturan aktif & mengabaikan nonaktif (FR-20), eksekusi tidak mencocokkan email yang tidak sesuai, dan isolasi antar-user. Contoh setup:

```bash
docker run -d --name sendagomail-ae-test-pg \
  -e POSTGRES_USER=sendagomail -e POSTGRES_PASSWORD=sendagomail \
  -e POSTGRES_DB=sendagomail_automation_test -p 55432:5432 postgres:16-alpine

DATABASE_URL="postgresql://sendagomail:sendagomail@localhost:55432/sendagomail_automation_test?schema=public" \
  npx prisma migrate deploy

DATABASE_URL="postgresql://sendagomail:sendagomail@localhost:55432/sendagomail_automation_test?schema=public" \
  npm run test:e2e
```

## TODO
- [x] Scaffold project (NestJS + Prisma)
- [x] Implementasi endpoint FR-19, FR-21 (CRUD aturan, aktif/nonaktif)
- [x] Logic pencocokan kondisi (FR-20 — evaluasi), diuji unit test murni
- [x] Test integrasi end-to-end dengan database PostgreSQL nyata (6 test)
- [ ] Webhook/event dari `mail-app-service` saat email baru masuk (FR-20 — trigger otomatis, saat ini harus dipanggil manual)
- [ ] Eksekusi aksi sungguhan (panggil `mail-app-service` untuk move_folder/forward/delete, kirim email untuk auto_reply)
- [ ] Dukungan multi-kondisi per aturan (AND/OR) — saat ini satu kondisi per aturan
- [ ] Integrasi dengan API Gateway
