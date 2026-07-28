# calendar-task-service

Terkait: FR-12 s/d FR-18 (kalender & tugas)

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

Semua endpoint butuh header `Authorization: Bearer <JWT>` (`JWT_SECRET` harus sama persis dengan `services/auth-service`). Berbeda dari `domain-provisioning` (per-tenant) dan `mail-app-service` (per-mailbox), service ini scoping akses **per-user** (`sub` di JWT payload) — sesuai ERD, `CALENDAR_EVENT` dan `TASK` dimiliki langsung oleh `USER`, bukan oleh tenant/mailbox.

## Endpoint

### Calendar Event (FR-12, FR-13, FR-14, FR-15)
| Method | Path | Keterangan |
|---|---|---|
| POST | `/calendar-events` | Buat acara (FR-12) |
| GET | `/calendar-events?dateFrom=&dateTo=` | List acara, filter rentang tanggal (dasar untuk tampilan harian/mingguan/bulanan — FR-15) |
| GET | `/calendar-events/:id` | Detail acara |
| PATCH | `/calendar-events/:id` | Edit acara |
| DELETE | `/calendar-events/:id` | Hapus acara |

### Task (FR-16, FR-17, FR-18)
| Method | Path | Keterangan |
|---|---|---|
| POST | `/tasks` | Buat tugas (judul, deadline, prioritas — FR-16) |
| POST | `/tasks/from-email` | Convert email jadi tugas (FR-18) — `{ emailId, title }` |
| GET | `/tasks?status=` | List tugas, filter opsional by status |
| GET | `/tasks/:id` | Detail tugas |
| PATCH | `/tasks/:id` | Update tugas, termasuk status (todo/in_progress/done — FR-17) |
| DELETE | `/tasks/:id` | Hapus tugas |

## Catatan Implementasi
- **FR-13 (recurring event):** `recurrenceRule` disimpan mentah dalam format RRULE (RFC 5545, mis. `FREQ=WEEKLY;BYDAY=MO`) — **tidak ada expansion** jadi occurrence individual di service ini. Client/UI bertanggung jawab menginterpretasi RRULE untuk render kalender berulang.
- **FR-14 (reminder):** field `reminderMinutesBefore` cuma disimpan, **belum ada pengiriman notifikasi sungguhan** — perlu integrasi dengan Notification Service (lihat `docs/architecture_diagram.png`) yang belum dibangun.
- **FR-15 (tampilan harian/mingguan/bulanan):** backend hanya menyediakan filter rentang tanggal (`dateFrom`/`dateTo`) yang efisien — pengelompokan jadi "hari/minggu/bulan" adalah tanggung jawab client.
- **FR-18 (convert email → task):** `linkedEmailId` menyimpan id email dari `mail-app-service` **tanpa validasi silang** (tidak ada FK lintas database/microservice) — kalau `emailId` salah ketik, tidak ada error di titik pembuatan tugas.
- Isolasi per-user: mencoba akses event/task milik user lain mengembalikan 404 (bukan 403), konsisten dengan pola di `mail-app-service`.

## Testing

```bash
npm test              # unit test murni (belum ada — semua logic terhubung ke Prisma)
npm run test:e2e       # integration test end-to-end lewat HTTP, butuh PostgreSQL nyata
```

`test:e2e` (10 test) menembak HTTP endpoint sungguhan terhadap database PostgreSQL nyata: CRUD calendar event, recurrence rule tersimpan apa adanya, filter tanggal, CRUD task, update status, convert email→task, filter by status, dan isolasi antar-user. Contoh setup:

```bash
docker run -d --name sendagomail-ct-test-pg \
  -e POSTGRES_USER=sendagomail -e POSTGRES_PASSWORD=sendagomail \
  -e POSTGRES_DB=sendagomail_calendar_task_test -p 55432:5432 postgres:16-alpine

DATABASE_URL="postgresql://sendagomail:sendagomail@localhost:55432/sendagomail_calendar_task_test?schema=public" \
  npx prisma migrate deploy

DATABASE_URL="postgresql://sendagomail:sendagomail@localhost:55432/sendagomail_calendar_task_test?schema=public" \
  npm run test:e2e
```

## TODO
- [x] Scaffold project (NestJS + Prisma)
- [x] Implementasi endpoint FR-12 s/d FR-18
- [x] Test integrasi end-to-end dengan database PostgreSQL nyata (10 test)
- [ ] Expansion RRULE jadi occurrence individual (FR-13) — saat ini cuma disimpan mentah
- [ ] Integrasi Notification Service untuk pengiriman reminder sungguhan (FR-14)
- [ ] Validasi silang `linkedEmailId` ke `mail-app-service` (FR-18)
- [ ] Integrasi dengan API Gateway
