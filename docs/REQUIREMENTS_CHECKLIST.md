# Requirements Checklist — SendagoMail

Sumber: `SRS_SendagoMail.docx` v1.0. Centang `[x]` kalau sudah selesai diimplementasi. ID di sini bisa dipakai sebagai nama branch/commit, contoh: `feature/FR-11a-recall-email`.

## 3.1 Manajemen Tenant & Domain
- [x] FR-01 — Super Admin dapat membuat/menonaktifkan/menghapus tenant (`services/domain-provisioning`, guard JWT/RBAC terpasang)
- [x] FR-02 — Tenant Admin menambahkan & verifikasi domain (TXT record) (`services/domain-provisioning`)
- [x] FR-03 — Auto-generate rekomendasi DNS record (MX, SPF, DKIM, DMARC) (`services/domain-provisioning`)
- [x] FR-04 — Status verifikasi domain real-time (pending/verified/failed) (`services/domain-provisioning`)
- [x] FR-05 — Mendukung multi-domain per tenant (skalabel) (`services/domain-provisioning`)

## 3.2 Mailbox & Messaging
- [x] FR-06 — Compose, reply, forward, delete email (`services/mail-app-service`)
- [x] FR-07 — Organisasi folder (Inbox/Sent/Draft/Trash/Custom) (`services/mail-app-service`)
- [x] FR-08 — Search email (pengirim, subjek, isi, tanggal) (`services/mail-app-service`)
- [x] FR-09 — Upload/download attachment dengan batas ukuran (`services/mail-app-service` — file fisik disimpan ke `ATTACHMENTS_DIR` (named volume), upload multipart dari webmail + base64 lewat `POST /emails/api-send` untuk integrasi aplikasi (mis. invoice PDF), download lewat `GET /emails/:id/attachments/:attachmentId/download`. Object storage S3/MinIO belum dipakai — tidak diperlukan untuk skala saat ini)
- [x] FR-10 — Tandai dibaca/belum, penting, spam (`services/mail-app-service`)
- [~] FR-11 — Thread/conversation view (`services/mail-app-service` — `threadId` sudah ada di skema & terisi otomatis lewat reply/forward, tapi belum ada endpoint khusus untuk fetch 1 thread sekaligus)
- [x] FR-11a — Tarik kembali email (Recall/Unsend) (`services/mail-app-service`)
  - [x] FR-11a.1 — Internal-to-internal: hapus dari mailbox penerima sebelum dibaca
  - [x] FR-11a.2 — Ke eksternal: delayed-send window (default 10-30 detik) + tombol batalkan

## 3.3 Kalender
- [x] FR-12 — CRUD acara kalender (`services/calendar-task-service`)
- [~] FR-13 — Recurring event dengan aturan kustom (`services/calendar-task-service` — RRULE disimpan mentah, belum ada expansion occurrence)
- [~] FR-14 — Notifikasi/pengingat sebelum acara (`services/calendar-task-service` — field tersimpan, belum ada pengiriman notifikasi sungguhan/Notification Service)
- [x] FR-15 — Tampilan harian/mingguan/bulanan (`services/calendar-task-service` — filter rentang tanggal; pengelompokan view di client)

## 3.4 Manajemen Tugas
- [x] FR-16 — Buat tugas (judul, deadline, prioritas) (`services/calendar-task-service`)
- [x] FR-17 — Update status tugas (`services/calendar-task-service`)
- [~] FR-18 — Convert email jadi tugas (`services/calendar-task-service` — belum ada validasi silang `emailId` ke `mail-app-service`)

## 3.5 Automation Rules
- [x] FR-19 — Buat aturan kondisi + aksi (filter/forward/auto-reply/hapus) (`services/automation-engine`)
- [~] FR-20 — Eksekusi real-time saat email masuk (`services/automation-engine` — logic pencocokan sudah jalan & teruji, tapi belum ada webhook otomatis dari `mail-app-service` dan aksi belum benar-benar dieksekusi, lihat README)
- [x] FR-21 — Aktif/nonaktifkan aturan tanpa hapus (`services/automation-engine`)

## 3.6 Multi-Akun
- [ ] FR-22 — Hubungkan akun email eksternal via IMAP
- [ ] FR-23 — Unified inbox dari semua akun

## 3.7 Admin & Billing
- [ ] FR-24 — Dashboard monitoring deliverability & bounce rate
- [ ] FR-25 — Paket berlangganan (free/paid) dengan kuota
- [ ] FR-26 — Audit log seluruh aktivitas penting

## Non-Fungsional (lihat SRS bagian 5)
- [ ] Performa: waktu muat inbox < 2 detik (95th percentile)
- [ ] Skalabilitas: 50 domain aktif & 500 mailbox (fase awal)
- [~] Keamanan: TLS in-transit + encryption at rest, isolasi data tenant (`services/auth-service` menerbitkan JWT dgn role+tenantId+mailboxId, dikonsumsi `domain-provisioning`/`mail-app-service` untuk scoping akses — TLS & encryption at rest belum disetup di level infra)
- [ ] Ketersediaan: uptime 99.5%
- [ ] Auditabilitas: audit log immutable

---
**Prioritas Wajib (Must Have):** FR-01 s/d FR-10, FR-11a, FR-12, FR-15, FR-16, FR-17, FR-19, FR-20, FR-26
**Diinginkan (Should/Could Have):** FR-11, FR-13, FR-14, FR-18, FR-21 s/d FR-25
