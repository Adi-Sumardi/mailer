# web (Custom UI)

UI kustom untuk end user — webmail, kalender, tugas. **Tidak pakai template Roundcube/SOGo generik** (sesuai batasan desain di SRS bagian 2.4) — dibangun dari nol dengan design token dari `design/kinetic_transmission/DESIGN.md` (lihat `docs/UIUX_Design_Spec_SendagoMail.md`).

## Stack
React 19 + TypeScript + Vite + React Router. CSS polos dengan custom properties (design token) — sengaja tidak pakai UI kit besar (MUI/Chakra dll.) di fase awal ini.

## Menjalankan Secara Lokal

```bash
cp .env.example .env      # sesuaikan VITE_API_GATEWAY_URL
npm install
npm run dev
```

Semua panggilan API lewat **`api-gateway`** (`services/api-gateway`), bukan langsung ke tiap backend service — pastikan gateway + service yang relevan (`auth-service`, `mail-app-service`, `calendar-task-service`, `automation-engine`) sudah jalan.

## Halaman yang Sudah Ada

| Route | Fitur |
|---|---|
| `/login`, `/register` | Autentikasi (FR terkait BR-08) |
| `/inbox` | Compose, reply, folder, flag baca, hapus, **Recall/Unsend** (FR-06 s/d FR-11a) |
| `/calendar` | CRUD acara kalender (FR-12, FR-15) |
| `/tasks` | Kanban tugas per status + prioritas (FR-16, FR-17) |
| `/automation-rules` | CRUD aturan filter/forward/auto-reply/hapus, aktif/nonaktifkan (FR-19, FR-21) |

## Autentikasi & Session

- `src/context/AuthContext.tsx` menyimpan `accessToken`/`refreshToken` di `localStorage` dan expose `login`/`register`/`logout`.
- `src/lib/apiClient.ts` adalah wrapper `fetch` yang otomatis menyertakan `Authorization: Bearer` dan **auto-refresh token sekali** kalau dapat 401 (retry request asli setelah refresh berhasil) — kalau refresh juga gagal, token dibersihkan dan `ProtectedRoute` akan redirect ke `/login`.
- Registrasi UI saat ini **selalu sebagai `end_user`** dengan `tenantId` yang harus sudah diberikan Tenant Admin — belum ada layar terpisah untuk onboarding `super_admin`/`tenant_admin` (itu operasi admin, bukan self-service).

## Fitur Recall/Unsend (FR-11a) di UI

Setelah compose berhasil dan `sendStatus` dari response adalah `queued` (penerima eksternal), `RecallBanner` muncul dengan countdown visual + tombol "Batalkan Pengiriman" — sesuai `docs/UIUX_Design_Spec_SendagoMail.md §4.1`. Untuk penerima internal, email langsung masuk Inbox penerima tapi tetap bisa ditarik lewat aksi lain (server-side governed by `isRead`, tidak butuh banner/countdown di UI — recall internal dilakukan lewat request `cancel` yang sama).

## Catatan Implementasi & Keterbatasan
- **Belum ada halaman Thread/Conversation view** (FR-11) — reply membuat email baru dengan `parentEmailId`, tapi UI belum mengelompokkan jadi tampilan percakapan.
- **Belum ada UI untuk Multi-Akun** (FR-22, FR-23) dan **Admin Dashboard** (FR-24 s/d FR-26, `apps/admin-dashboard` — masih kosong, project terpisah).
- **Belum ada dark mode** — placeholder di design system, belum diimplementasikan.
- Kalender masih list sederhana (bukan grid bulanan/mingguan visual) — filter tanggal backend sudah siap (FR-15), tinggal UI grid-nya.
- Halaman attachment (upload/download, FR-09) belum ada di UI — backend baru terima metadata, belum ada integrasi object storage untuk diupload dari sini.

## Verifikasi yang Sudah Dilakukan

- `npm run build` — sukses, tidak ada TypeScript error.
- Dev server (`npm run dev`) diverifikasi menyajikan HTML dan mentransformasi seluruh modul (`App.tsx`, tiap route) tanpa error lewat `curl` terhadap Vite dev server.
- **Smoke test full-stack**: kelima backend service + `api-gateway` dijalankan bersamaan sungguhan (bukan mock), lalu diuji lewat `curl` end-to-end melalui gateway — register (dengan auto-provisioning mailbox lintas service), login, compose internal, **Recall/Unsend internal (email benar-benar hilang dari Inbox penerima setelah recall)**, kalender, tugas, automation rule, dan blokir endpoint `/internal/*`. Semua berhasil.
- **Belum ada verifikasi visual di browser sungguhan** (klik-klik interaktif) — lingkungan development ini tidak punya browser headless. Build, transform module, dan seluruh rantai API sudah diverifikasi nyata; yang belum divalidasi adalah tampilan visual/UX di layar sungguhan.

## TODO
- [x] Setup project (React + Vite + TypeScript)
- [x] Implementasi halaman inti: login, register, inbox (compose/reply/flag/delete/recall), kalender, tugas, automation rules
- [x] Integrasi dengan API Gateway (bukan langsung ke tiap service)
- [x] Auto-refresh token saat access token kedaluwarsa
- [x] Verifikasi build + smoke test full-stack lewat HTTP nyata
- [ ] Verifikasi visual di browser sungguhan (belum ada browser headless di environment ini)
- [ ] Thread/Conversation view (FR-11)
- [ ] UI Multi-Akun (FR-22, FR-23)
- [ ] Tampilan kalender grid bulanan/mingguan (saat ini list sederhana)
- [ ] Upload/download attachment sungguhan (FR-09)
- [ ] Dark mode
