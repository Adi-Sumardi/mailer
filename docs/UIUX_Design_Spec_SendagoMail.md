# UI/UX DESIGN SPECIFICATION
## SendagoMail — Platform Email Multi-Tenant Berbasis Domain Sendiri

**Versi:** 1.0
**Tanggal:** 28 Juli 2026
**Status:** Draft
**Disusun berdasarkan:** `PRD_SendagoMail.md`, `SRS_SendagoMail.docx` §2.4 & §4.1, `BRD_SendagoMail.docx` BO-04, `design/kinetic_transmission/DESIGN.md` + 7 mockup HTML di `design/`

> Dokumen ini mengisi referensi "UI/UX Design Specification (terpisah)" yang disebut di SRS §4.1 dan §9.2, sekaligus di README `apps/web/`.
>
> **Catatan sumber aset visual:** Folder `design/` berisi 7 mockup HTML + screenshot dan 1 design system bernama **"Kinetic Transmission"**, awalnya dibuat dengan branding **"RedMail"** — sebuah produk *transactional SMTP delivery API* untuk developer (mirip SendGrid/Mailgun), bukan webmail end-user. Layar yang ada: Dashboard Overview, Login, Register, 2FA, SMTP Configuration, API Management, Delivery Logs.
>
> Keputusan: **design token visual (warna, tipografi, spacing, shape, elevation) diadopsi apa adanya** sebagai dasar sistem desain SendagoMail (lihat §2). **Konten, copy, dan susunan layar harus dirombak total** mengikuti fitur SendagoMail (Inbox, Compose, Kalender, Tugas, Automation Rule, dst) — bukan didikte oleh use case RedMail. Lihat §4 untuk peta reuse vs. layar baru yang masih harus didesain.

---

## 1. Prinsip Desain

Mengacu ke batasan wajib BO-04 & SRS §2.4: **UI harus 100% custom, dilarang meniru tampilan bawaan Roundcube/SOGo/webmail generik.**

1. **Bukan template webmail generik** — layout, ikonografi, dan interaksi harus punya identitas sendiri, bukan copy dari Gmail/Outlook/Roundcube.
2. **Usable tanpa training** (NFR Usability) — navigasi harus jelas untuk user non-teknis.
3. **Cepat dirasakan** — selaras NFR performa (inbox < 2 detik), UI harus optimistic-update & skeleton loading, bukan full-page reload.
4. **Responsif desktop & tablet** (SRS §4.1) — mobile native di luar scope fase 1, tapi web harus tetap dipakai di layar tablet.
5. **Konsisten lintas modul** — Mail, Calendar, Task, Automation, Admin memakai satu design system yang sama (bukan 4 UI berbeda gaya).
6. **Multi-tenant branding-ready** — struktur komponen harus mendukung theming per-tenant di masa depan (logo, warna brand), meski belum wajib di fase 1.

---

## 2. Design System — "Kinetic Transmission" (diadopsi dari `design/kinetic_transmission/DESIGN.md`)

Token di bawah **sudah final secara visual** (diambil langsung dari sistem desain yang ada), bukan lagi placeholder. Sistem ini WAJIB diimplementasikan sebagai shared package (design tokens + component library), bukan hardcode di tiap halaman.

> Reinterpretasi brand personality: dari "Reliability, Velocity, Precision" (RedMail — untuk DevOps) menjadi **"Reliability, Kejelasan, Produktivitas"** untuk SendagoMail — nuansa "high-trust, effortless" tetap relevan untuk produk email/produktivitas, tapi tone teknis (istilah "node", "relay", "infrastructure") harus diganti bahasa yang familiar untuk end-user non-teknis.

### 2.1 Warna
| Token | Hex | Pemakaian |
|---|---|---|
| `primary` | `#b80035` / accent `#E11D48` | CTA utama, nav aktif, indikator penting (mis. tombol "Batalkan Pengiriman" di banner Recall) |
| `secondary` | `#545f73` | Heading & sidebar, kontras tegas |
| `background` / `surface` | `#f8f9ff` | Kanvas utama aplikasi |
| `surface-container-lowest` | `#ffffff` | Kartu/panel konten |
| `on-surface` | `#0b1c30` | Teks utama |
| `outline` / `outline-variant` | `#906f70` / `#e5bdbe` | Border default |
| `error` / `error-container` | `#ba1a1a` / `#ffdad6` | Status gagal (mis. domain verifikasi failed, email bounce) |
| Success (implisit dari mockup) | hijau (`DELIVERED`, `ONLINE` chip) | Status terverifikasi/terkirim/aktif |

### 2.2 Tipografi
- **UI utama:** Inter — skala `headline-xl` (40px/700) s/d `body-sm` (14px/400), plus `label-caps` (12px, uppercase, letter-spacing 0.05em) untuk label section/sidebar.
- **Data teknis:** JetBrains Mono (`code-sm`, 13px) — dipakai untuk TXT/MX/SPF/DKIM record, Message-ID, bukan untuk API key lagi (SendagoMail tidak expose API key ke end-user di fase 1).

### 2.3 Shape, Spacing, Elevation
- Radius standar **8px** (input, button, card kecil), **16px** untuk card besar/modal, **pill (9999px)** untuk search bar & badge status.
- Grid 12-kolom, sidebar fixed 240px, gutter 24px desktop / 16px mobile.
- Stack rhythm: 8px (label↔input), 16px (dalam card), 24px (antar card), 48px (antar section).
- Elevation pakai **tonal layer + outline 1px**, bukan shadow berat — Level 2 (dropdown/popover) baru pakai shadow halus, Level 3 (modal) shadow lebih kuat.

### 2.4 Komponen Inti (tersedia sebagai referensi kode di `design/*/code.html`)
Button (Primary/Secondary/Ghost), Input (termasuk varian monospace untuk kode DNS), Modal, Toast, Table dengan zebra-on-hover, Status Chip/Badge (Delivered/Pending/Failed pattern — reuse untuk status domain & email), Card, Sidebar Nav dengan active state warna primary, Stat Tile (dipakai di Dashboard Overview — reuse untuk Admin Dashboard KPI).

### 2.5 Dark Mode
Belum ada di mockup existing — perlu didesain menyusul sebagai fase 2 styling, ikuti pola tonal layer yang sama.

---

## 3. Peta Modul & Navigasi

Tiga aplikasi terpisah secara akses (sesuai `apps/`), berbagi 1 design system:

```
apps/web (End User)          apps/admin-dashboard (Tenant Admin / Super Admin)
├── Mail                     ├── Tenant Management (Super Admin only)
├── Calendar                 ├── Domain Management
├── Tasks                    ├── User Management
├── Automation Rules         ├── Billing & Subscription
├── Linked Accounts          ├── Deliverability Monitoring
└── Settings                 └── Audit Log
```

**Navigasi utama (End User — `apps/web`):** Sidebar kiri persisten berisi ikon+label untuk Mail, Calendar, Tasks, Automation, Linked Accounts, Settings. Badge unread count di ikon Mail.

**Navigasi Admin Dashboard:** Sidebar berbeda konteks tergantung role — Tenant Admin tidak melihat menu "Tenant Management" (khusus Super Admin).

---

## 4. Pemetaan Reuse Layar Existing vs. Layar Baru

7 mockup di `design/` dipetakan ke kebutuhan SendagoMail sebagai berikut:

| Mockup Existing (`design/*`) | Status untuk SendagoMail | Tindakan |
|---|---|---|
| `login_redmail_refined` | **Reuse dengan rebrand** | Ganti logo/nama RedMail→SendagoMail, copy "High-Velocity Email Infrastructure" → tagline SendagoMail (mis. "Email Domain Sendiri, Kontrol Penuh"), hilangkan badge "REST API" (tidak relevan end-user), pertahankan struktur split-panel + tombol Google/GitHub SSO |
| `register_redmail` | **Reuse dengan rebrand** | Ganti copy developer-centric ("Deploy your first node", "10,000+ developers") → onboarding tenant/end-user biasa. Struktur form (Nama, Email, Password, consent checkbox) tetap relevan |
| `two_factor_authentication_redmail` | **Reuse langsung** | Generik, tidak ada copy spesifik RedMail selain branding kecil — pakai apa adanya untuk 2FA login (mendukung NFR Keamanan) |
| `dashboard_overview` | **Reuse struktur, ganti konten** | Layout (stat tiles + chart + activity table) cocok untuk **Admin/Tenant Dashboard**, tapi metrik diganti dari "Total Emails Sent/Bounce Rate" (SMTP API metrics) → domain aktif, mailbox terpakai, kuota storage, deliverability ringkas (FR-24) |
| `smtp_configuration` | **Reuse struktur, ganti konten** | Layout card "Server Credentials" + sidebar tips cocok direpurpose jadi **Add Domain Wizard / DNS Record Card** (§4.2) — ganti field SMTP Host/Port/Password jadi TXT/MX/SPF/DKIM/DMARC record dengan tombol copy |
| `delivery_logs` | **Reuse struktur, ganti konten** | Table + filter + pagination pattern cocok untuk **Audit Log Viewer** (FR-26) dan **Deliverability Dashboard** (FR-24) — ganti kolom Recipient/Subject/Status jadi User/Aksi/Timestamp untuk audit log |
| `api_management` | **Tidak dipakai (fase 1)** | SendagoMail fase 1 tidak expose API key ke end-user (di luar scope PRD). Simpan sebagai referensi kalau nanti ada REST API publik untuk integrasi pihak ketiga |

### Layar yang BELUM ada mockup-nya sama sekali — prioritas desain berikutnya
Ini fitur inti SendagoMail (Mail, Calendar, Task, Automation) yang justru **paling penting** dan sepenuhnya absen dari aset `design/` saat ini:
- [ ] **Inbox / Folder View** (FR-06 s/d FR-10) — layar paling sering dipakai user, prioritas #1
- [ ] **Compose** modal/drawer
- [ ] **Thread/Conversation View** (FR-11)
- [ ] **Recall/Unsend Banner** (FR-11a) — fitur differensiator, belum ada preseden visual sama sekali
- [ ] **Calendar View** (harian/mingguan/bulanan) + Event Detail Modal
- [ ] **Task Board/List** (Kanban)
- [ ] **Automation Rule Builder** (visual IF/THEN)
- [ ] **Linked Accounts / Unified Inbox** (FR-22, FR-23)
- [ ] **Tenant Management** (Super Admin — CRUD tenant, di luar scope semua mockup existing)

Rekomendasi urutan desain lanjutan: Inbox & Compose dulu (dependency untuk hampir semua demo/testing fitur lain), baru Recall banner, baru Calendar/Task, terakhir Automation Rule Builder.

---

## 5. Screen Inventory & Flow Utama (Detail per Modul)

### 5.1 Modul Mail (FR-06 s/d FR-11a) — prioritas tertinggi

| Layar | Elemen Kunci |
|---|---|
| **Inbox / Folder View** | List email 1 kolom (bukan 3-pane ala Outlook — differensiasi visual), preview pane di kanan saat email dipilih. Search bar persisten di atas. Filter cepat: Unread, Flagged, Has Attachment. |
| **Compose** | Modal/drawer (bukan full page) agar user tetap bisa lihat inbox saat menulis. Field: To/Cc/Bcc (collapsible), Subject, Body (rich text), Attachment drop-zone. |
| **Thread/Conversation View** | Email dalam 1 subjek dikelompokkan, collapse email lama, expand yang terbaru (FR-11 — should have). |
| **Recall/Unsend Banner** *(fitur differensiator, FR-11a)* | Setelah tombol "Kirim" ditekan: toast/banner sticky di bawah layar bertuliskan **"Email dikirim ke [alamat]. Batalkan?"** dengan countdown visual (progress bar 5–60 detik sesuai config tenant) dan tombol **"Batalkan Pengiriman"**. Setelah window habis, banner hilang otomatis dan status berubah jadi "Terkirim". Untuk penerima internal: begitu email dibuka penerima, tombol batal otomatis disable + tooltip "Sudah dibaca, tidak bisa ditarik". |
| **Attachment Preview** | Preview inline untuk gambar/PDF, badge ukuran file, indikator kalau melebihi limit tenant. |
| **Empty States** | Ilustrasi + copy ramah untuk folder kosong, hasil search kosong. |

**Flow Compose → Send → Recall:**
```
[Compose] → tekan Kirim → [Optimistic UI: email pindah ke Sent, banner Recall muncul]
   → user klik "Batalkan" dalam window → [Undo, email kembali ke draft]
   → window habis / user tidak klik → [Banner hilang, status final "Terkirim"]
```

### 5.2 Modul Domain & Tenant (FR-01 s/d FR-05) — Admin Dashboard

| Layar | Elemen Kunci |
|---|---|
| **Domain List** | Table: nama domain, status badge (Pending/Verified/Failed — warna kuning/hijau/merah), tanggal ditambahkan, aksi (Verify Ulang, Hapus). |
| **Add Domain Wizard** | Step 1: input nama domain. Step 2: sistem tampilkan TXT record yang harus ditambahkan (dengan tombol copy-to-clipboard). Step 3: tombol "Cek Verifikasi" + auto-poll status. Step 4: setelah verified, tampilkan rekomendasi MX/SPF/DKIM/DMARC record siap-copy. |
| **DNS Record Card** | Setiap record (MX/SPF/DKIM/DMARC) ditampilkan sebagai card terpisah dengan status "sudah terpasang / belum terdeteksi" — bukan blok teks panjang yang membingungkan user non-teknis (selaras NFR Usability). |

### 5.3 Modul Kalender (FR-12 s/d FR-15)

| Layar | Elemen Kunci |
|---|---|
| **Calendar View** | Toggle Harian/Mingguan/Bulanan di header. Klik slot kosong → quick-create event popover (bukan pindah halaman). |
| **Event Detail Modal** | Judul, waktu mulai/selesai, lokasi, recurring rule picker (should-have FR-13), reminder setting (FR-14). |

### 5.4 Modul Tugas (FR-16 s/d FR-18)

| Layar | Elemen Kunci |
|---|---|
| **Task Board/List** | Toggle antara List view dan Kanban (Belum/Proses/Selesai) — kanban cocok untuk visualisasi status FR-17. |
| **Convert Email → Task** | Dari Inbox, klik kanan / tombol pada email → "Jadikan Tugas" → modal pre-filled judul dari subjek email, link balik ke email asal (FR-18, should-have). |

### 5.5 Modul Automation Rules (FR-19 s/d FR-21)

| Layar | Elemen Kunci |
|---|---|
| **Rule List** | Table nama aturan, kondisi ringkas, status aktif (toggle switch — FR-21), aksi edit/hapus. |
| **Rule Builder** | Builder visual bentuk "IF [kondisi] THEN [aksi]" — dropdown kondisi (pengirim/subjek/keyword mengandung...) + dropdown aksi (pindah folder/forward/auto-reply/hapus). Hindari textarea/kode mentah agar non-teknis bisa pakai. |

### 5.6 Modul Multi-Akun (FR-22, FR-23)

| Layar | Elemen Kunci |
|---|---|
| **Linked Accounts** | List akun eksternal ter-link, status sync, tombol "Hubungkan Akun Baru" (form host IMAP/user/pass atau OAuth kalau provider mendukung). |
| **Unified Inbox** | Toggle/filter di Inbox utama untuk menampilkan "Semua Akun" vs per-akun, dengan indikator kecil sumber akun di tiap email row. |

### 5.7 Modul Admin & Billing (FR-24 s/d FR-26)

| Layar | Elemen Kunci |
|---|---|
| **Deliverability Dashboard** | Chart bounce rate & delivery success per domain (Super Admin), alert visual kalau ada domain bermasalah. |
| **Subscription/Billing** | Tabel paket (Free/Paid), indikator kuota terpakai vs limit (storage, jumlah user), tombol upgrade. |
| **Audit Log Viewer** | Table filterable by user/aksi/tanggal, read-only, tidak ada tombol edit/hapus (selaras NFR Auditabilitas — immutable). |

---

## 6. Interaksi & Microcopy Khusus

- **Bahasa produk:** Bahasa Indonesia sebagai default (selaras dokumen lain), dengan struktur i18n-ready untuk ekspansi bahasa lain nanti.
- **Konfirmasi aksi destruktif:** Hapus domain, hapus tenant, hapus automation rule → wajib modal konfirmasi eksplisit (bukan langsung eksekusi).
- **Status real-time:** Status verifikasi domain (FR-04) dan status automation rule harus update tanpa refresh manual (polling atau websocket).
- **Toast notification pattern:** Dipakai konsisten untuk semua aksi sukses/gagal (kirim email, simpan rule, tambah domain) — bukan alert/browser native.

---

## 7. Responsive & Aksesibilitas

| Breakpoint | Perilaku |
|---|---|
| Desktop (≥1280px) | Sidebar penuh + preview pane |
| Tablet (768–1279px) | Sidebar collapsible jadi icon-only, preview pane jadi overlay |
| Mobile (<768px) | Di luar scope wajib fase 1 (BRD §5.2), tapi layout dasar tidak boleh rusak total — minimal readable |

**Aksesibilitas minimum:** kontras warna WCAG AA, semua aksi bisa dijangkau keyboard (terutama Compose & Rule Builder), alt-text untuk ikon-only button.

---

## 8. Yang Masih Perlu Diputuskan Tim Desain

- [ ] Palet warna & typeface final (brand identity SendagoMail — nama produk sendiri juga masih placeholder, lihat README utama)
- [ ] Mockup visual high-fidelity (Figma) — dokumen ini baru level wireframe/flow tekstual
- [ ] Logo & favicon
- [ ] Pola dark mode detail per komponen
- [ ] Keputusan: rich text editor library untuk Compose (mis. Tiptap/Slate) dan kalender library (mis. FullCalendar vs custom)

---

## 9. Dokumen Terkait
- `PRD_SendagoMail.md` — Product Requirements
- `BRD_SendagoMail.docx`, `SRS_SendagoMail.docx` — requirement sumber
- `architecture_diagram.png`, `erd_diagram.png` — referensi teknis
