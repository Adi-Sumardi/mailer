# PRODUCT REQUIREMENTS DOCUMENT (PRD)
## SendagoMail — Platform Email Multi-Tenant Berbasis Domain Sendiri

**Versi:** 1.0
**Tanggal:** 28 Juli 2026
**Status:** Draft
**Disusun berdasarkan:** `BRD_SendagoMail.docx` v1.0, `SRS_SendagoMail.docx` v1.0, `architecture_diagram.png`, `erd_diagram.png`

---

## 1. Ringkasan Produk

SendagoMail adalah platform email self-hosted multi-tenant yang memungkinkan individu, tim, dan organisasi mengelola email profesional dengan domain sendiri (`nama@domainanda.com`) tanpa biaya langganan bulanan pihak ketiga (Google Workspace, Microsoft 365). Dibangun di atas mail engine open-source (Postfix, Dovecot, Rspamd, ClamAV) dengan UI kustom sepenuhnya (bukan template Roundcube/SOGo), dilengkapi kalender, manajemen tugas, multi-akun, dan aturan otomatisasi — menjadikannya workspace produktivitas terpadu.

### 1.1 Masalah yang Diselesaikan
- Biaya langganan email profesional pihak ketiga bersifat berulang & naik seiring pertumbuhan user/domain.
- Ketergantungan pihak ketiga membatasi kontrol data & privasi.
- Solusi self-hosted yang ada (mailcow, Mailu) memakai UI generik yang tidak bisa dibrand.
- Belum ada solusi self-hosted yang menyatukan email + kalender + tugas + otomatisasi dalam satu platform dengan UI custom penuh.

### 1.2 Target Pengguna
| Persona | Kebutuhan Utama |
|---|---|
| **Super Admin** (pemilik platform) | Kelola seluruh tenant, monitoring sistem, billing |
| **Tenant Admin** (pemilik domain/organisasi) | Kelola domain, user, kuota, pengaturan tenant |
| **End User** | Kirim/terima email, kalender, tugas, automation, produktivitas harian |

### 1.3 Tujuan Bisnis & Metrik Sukses (KPI)
| ID | Tujuan | KPI |
|---|---|---|
| BO-01 | Layanan email mandiri berbasis domain sendiri | Deliverability > 95% (tidak masuk spam) |
| BO-02 | Kurangi ketergantungan biaya pihak ketiga | Hemat biaya ≥ 60% vs Google Workspace dalam 12 bulan |
| BO-03 | Dukung banyak domain & tenant | ≥ 50 domain aktif di fase awal |
| BO-04 | UI sepenuhnya custom & branded | Tidak memakai template webmail generik |
| BO-05 | Jadi productivity suite terpadu | Adopsi fitur kalender/tugas ≥ 40% user aktif |

---

## 2. Lingkup Produk

### 2.1 Dalam Lingkup (Fase 1)
- Manajemen tenant, domain, dan pengguna (arsitektur multi-tenant)
- Fitur inti webmail: compose, inbox, folder, filter, search, attachment
- Kalender pribadi & manajemen tugas
- Multi-akun (hubungkan akun email eksternal via IMAP)
- Aturan otomatisasi untuk pemrosesan email masuk
- Verifikasi domain otomatis & provisioning DNS (SPF, DKIM, DMARC)
- Panel admin untuk tenant & super-admin
- UI/UX kustom (bukan template pihak ketiga)
- Modul billing/subscription dasar

### 2.2 Luar Lingkup (Fase 1)
- Aplikasi mobile native (iOS/Android)
- Video conference / chat real-time
- Migrasi otomatis data dari Google Workspace/Microsoft 365
- Dukungan protokol Exchange ActiveSync

### 2.3 Batasan Desain
- UI harus 100% custom — dilarang pakai tampilan bawaan Roundcube/SOGo/webmail generik
- Isolasi data antar tenant harus ketat di level arsitektur
- Harus berjalan di atas mail engine open-source teruji (Postfix/Dovecot)
- Backend harus portable — deploy-able di VPS/cloud manapun yang mendukung Docker

---

## 3. Fitur Produk (berdasarkan prioritas)

### 3.1 Must Have (Wajib — Fase 1 & 2)

| Fitur | Deskripsi | Referensi |
|---|---|---|
| Manajemen Tenant | Super Admin buat/nonaktifkan/hapus tenant | FR-01 |
| Tambah & Verifikasi Domain | Verifikasi kepemilikan via TXT record | FR-02 |
| Auto-generate DNS Record | Rekomendasi MX/SPF/DKIM/DMARC otomatis | FR-03 |
| Status Verifikasi Real-time | pending/verified/failed | FR-04 |
| Multi-domain per Tenant | Skalabel, 1 s/d N domain | FR-05 |
| Compose/Reply/Forward/Delete | Fungsi inti messaging | FR-06 |
| Organisasi Folder | Inbox/Sent/Draft/Trash/Custom | FR-07 |
| Search Email | Berdasar pengirim/subjek/isi/tanggal | FR-08 |
| Attachment | Upload/download dengan batas ukuran | FR-09 |
| Flag Email | Baca/belum, penting, spam | FR-10 |
| **Recall/Unsend Email** | Lihat detail di §3.3 | FR-11a |
| Kalender — CRUD Event | Buat/edit/hapus acara | FR-12 |
| Kalender — Tampilan | Harian/mingguan/bulanan | FR-15 |
| Tugas — CRUD | Judul, deadline, prioritas | FR-16 |
| Tugas — Update Status | Belum/proses/selesai | FR-17 |
| Automation Rule — Buat Aturan | Kondisi (pengirim/subjek/keyword) + aksi (pindah folder/forward/auto-reply/hapus) | FR-19 |
| Automation Rule — Eksekusi Real-time | Jalan otomatis saat email masuk | FR-20 |
| Audit Log | Catat semua aktivitas penting, immutable | FR-26 |

### 3.2 Should/Could Have (Fase 3 & 4)

| Fitur | Deskripsi | Referensi |
|---|---|---|
| Thread/Conversation View | Tampilan percakapan email | FR-11 |
| Recurring Event | Acara berulang dengan aturan kustom | FR-13 |
| Reminder Kalender | Notifikasi sebelum acara | FR-14 |
| Convert Email → Tugas | Kaitkan tugas dengan email tertentu | FR-18 |
| Enable/Disable Rule | Nonaktifkan aturan tanpa hapus | FR-21 |
| Koneksi Akun Eksternal | IMAP ke Gmail/Outlook, dsb. | FR-22 |
| Unified Inbox | Gabung semua akun dalam 1 tampilan | FR-23 |
| Dashboard Deliverability | Monitor bounce rate & kesehatan kirim | FR-24 |
| Paket Berlangganan | Free/paid dengan kuota | FR-25 |

### 3.3 Fitur Unggulan (Differentiator): Recall/Unsend Email

Ini fitur paling membedakan SendagoMail dari webmail lain — mengatasi keterbatasan SMTP yang tidak native mendukung penarikan pesan.

| Skenario | Mekanisme | Batasan |
|---|---|---|
| **Internal → Internal** (penerima 1 platform) | Email dihapus langsung dari mailbox/antrian penerima sebelum dibuka | Hanya berhasil jika belum dibaca |
| **Internal → Eksternal** (Gmail/Outlook, dst.) | Delayed-send: email ditahan di antrian internal (default 10–30 detik, configurable 5–60 detik oleh Tenant Admin) + tombol "Batalkan Pengiriman" | Setelah jendela lewat & email keluar server, tidak bisa ditarik — sistem hanya tampilkan status "sudah terkirim" |

Kolom skema pendukung (lihat ERD): `EMAIL.status`, `EMAIL.send_status`, `EMAIL.recall_deadline_at`.

---

## 4. Arsitektur & Stack Teknis (ringkasan untuk tim produk)

```
Client Layer      → Custom Web UI, Admin/Tenant Dashboard, (Mobile/API — future)
Edge/Gateway      → API Gateway + Load Balancer + WAF/Rate Limiter (TLS termination)
Application Layer → Auth & Tenant Isolation, Mail App Service, Calendar & Task Service,
                     Automation Rule Engine, Domain & DNS Provisioning,
                     Background Worker, Notification, Billing & Subscription,
                     Audit & Logging, Monitoring
Mail Engine Layer → Postfix (SMTP MTA), Dovecot (IMAP/POP3), Rspamd (anti-spam/DKIM),
                     ClamAV (antivirus), Outbound Relay
Data Layer        → PostgreSQL, Object Storage (S3/MinIO), Redis, Backup & DR
External          → DNS Provider API (Cloudflare), SMTP Relay (SES/Mailgun/Postmark),
                     Payment Gateway, Recipient Mail Servers
```

**Entitas data utama** (lihat `erd_diagram.png`): TENANT, DOMAIN, USER, MAILBOX, FOLDER, EMAIL, ATTACHMENT, CONTACT, SUBSCRIPTION, CALENDAR_EVENT, TASK, AUTOMATION_RULE, LINKED_ACCOUNT, AUDIT_LOG.

**Kelas user (RBAC):** Super Admin, Tenant Admin, End User (JWT-based auth).

---

## 5. Kebutuhan Non-Fungsional

| Kategori | Target |
|---|---|
| Performa | Waktu muat inbox < 2 detik (95th percentile) |
| Skalabilitas | Minimal 50 domain aktif & 500 mailbox (fase awal), horizontal scalable |
| Keamanan | TLS in-transit + encryption at rest, isolasi data ketat antar tenant |
| Ketersediaan | Uptime target 99.5% di luar maintenance terjadwal |
| Usability | Dapat dipakai tanpa training oleh user non-teknis |
| Portabilitas | Deploy di VPS/cloud manapun yang mendukung Docker |
| Auditabilitas | Semua aksi admin tercatat di audit log immutable |
| Kepatuhan | Minimalisasi data, hak hapus data pengguna (right-to-erasure) |

---

## 6. Use Case Utama

**UC-01 — Tenant Admin Menambahkan Domain Baru**
Input domain → sistem generate TXT record verifikasi → Tenant Admin tambahkan ke DNS provider → verifikasi otomatis → sistem generate rekomendasi MX/SPF/DKIM/DMARC → domain aktif. *(Alt: jika gagal 24 jam, kirim reminder)*

**UC-02 — Pengguna Mengirim Email**
Isi penerima/subjek/isi/lampiran → tekan kirim → diteruskan ke Postfix → relay dengan DKIM signing → status terkirim ditampilkan.

**UC-03 — Pengguna Membuat Automation Rule**
Buka menu Automation Rules → tentukan kondisi (mis. pengirim mengandung `@vendor.com`) → tentukan aksi (mis. pindah ke folder "Vendor") → simpan → sistem eksekusi otomatis di setiap email masuk yang cocok.

---

## 7. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| Email masuk folder spam | Tinggi | SMTP relay bereputasi baik, SPF/DKIM/DMARC ketat, warm-up IP bertahap |
| Port 25 diblokir provider VPS | Sedang | Pilih provider yang support port 25 (Hetzner/Contabo/RackNerd) atau pakai relay |
| Kebocoran data antar-tenant | Tinggi | Isolasi ketat di level DB & storage, audit log berkala |
| Downtime mail server | Sedang | Redundansi server, monitoring 24/7, backup otomatis |

---

## 8. Roadmap & Milestone

| Fase | Cakupan | Estimasi | Status Repo Saat Ini |
|---|---|---|---|
| **Fase 1** | Setup mail engine + core webmail (compose, inbox, folder) | 6–8 minggu | `mail-engine/` sudah ada docker-compose; service lain baru scaffold README |
| **Fase 2** | Multi-tenant management, domain provisioning otomatis, UI kustom | 6–8 minggu | Belum dimulai |
| **Fase 3** | Kalender, tugas, automation rules, multi-akun | 6–8 minggu | Belum dimulai |
| **Fase 4** | Billing, admin dashboard, hardening keamanan, beta testing | 4–6 minggu | Belum dimulai |

### 8.1 Urutan Implementasi yang Disarankan
1. `mail-engine` (fondasi — sudah ada compose file, tinggal isi `.env` & jalankan)
2. `domain-provisioning` (FR-01 s/d FR-05)
3. `mail-app-service` (FR-06 s/d FR-11a)
4. `auth-service` (isolasi tenant, BR-08)
5. `calendar-task-service`, `automation-engine` (sisanya sesuai checklist)

---

## 9. Kriteria Rilis (Definition of Done — Fase 1)

- [ ] Mail engine berjalan & dapat kirim/terima email test dengan deliverability terverifikasi (tidak masuk spam pada uji ke Gmail/Outlook)
- [ ] End user dapat compose, reply, forward, delete, organisir folder, dan search email lewat UI custom (bukan template generik)
- [ ] Recall/Unsend berfungsi untuk skenario internal & delayed-send eksternal
- [ ] Verifikasi domain (TXT record) & auto-generate DNS record berjalan end-to-end
- [ ] Isolasi data antar tenant terverifikasi (tidak ada data leak lintas tenant di pengujian)
- [ ] Audit log mencatat aktivitas login, perubahan setting, dan penghapusan data

---

## 10. Dokumen Terkait
- `BRD_SendagoMail.docx` — Business Requirements
- `SRS_SendagoMail.docx` — Software Requirements (FR-01 s/d FR-26, NFR)
- `REQUIREMENTS_CHECKLIST.md` — Checklist tracking implementasi
- `architecture_diagram.png` — Arsitektur sistem
- `erd_diagram.png` — Skema data
- `UIUX_Design_Spec_SendagoMail.md` — Wireframe & flow UI/UX (v1.0 draft, belum ada mockup visual high-fidelity)
