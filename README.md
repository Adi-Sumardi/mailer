# SendagoMail

Platform email multi-tenant berbasis domain sendiri — self-hosted, UI custom, tanpa ketergantungan biaya langganan bulanan pihak ketiga.

## 📄 Dokumen Acuan

Semua keputusan desain & fitur di project ini mengacu ke dokumen berikut (ada di folder `docs/`):

| Dokumen | Isi |
|---|---|
| `docs/BRD_SendagoMail.docx` | Business Requirements — tujuan bisnis, scope, stakeholder |
| `docs/SRS_SendagoMail.docx` | Software Requirements — functional & non-functional requirements (FR-xx) |
| `docs/PRD_SendagoMail.md` | Product Requirements — ringkasan fitur, prioritas, roadmap, DoD |
| `docs/UIUX_Design_Spec_SendagoMail.md` | Wireframe & flow UI/UX tiap modul |
| `docs/architecture_diagram.png` | Arsitektur sistem tingkat tinggi |
| `docs/erd_diagram.png` | Entity Relationship Diagram (skema data) |
| `docs/REQUIREMENTS_CHECKLIST.md` | Checklist semua FR/BR dalam format markdown (bisa diimport ke GitHub Issues) |

## 🏗️ Struktur Project

```
sendagomail/
├── docs/                        # SRS, BRD, diagram acuan
├── apps/
│   ├── web/                     # Custom UI — webmail, kalender, tugas (end user)
│   └── admin-dashboard/         # Panel Tenant Admin & Super Admin
├── services/
│   ├── api-gateway/              # Satu pintu masuk HTTP ke seluruh service (reverse proxy)
│   ├── auth-service/            # Autentikasi & isolasi tenant (FR terkait BR-08)
│   ├── mail-app-service/        # Compose/inbox/folder/search/recall (FR-06 s/d FR-11a)
│   ├── calendar-task-service/   # Kalender & tugas (FR-12 s/d FR-18)
│   ├── automation-engine/       # Automation rules (FR-19 s/d FR-21)
│   └── domain-provisioning/     # Verifikasi domain, SPF/DKIM/DMARC (FR-01 s/d FR-05)
├── mail-engine/                 # Postfix + Dovecot + Rspamd + ClamAV (docker-compose)
└── infra/                       # IaC untuk provisioning VPS (Terraform/Ansible — nanti)
```

## 🚀 Cara Mulai di VSCode

1. Extract/clone folder ini, lalu buka di VSCode:
   ```bash
   code sendagomail/
   ```
2. Baca dulu `docs/SRS_SendagoMail.docx` dan `docs/REQUIREMENTS_CHECKLIST.md` supaya tau requirement mana yang mau dikerjain duluan.
3. Mulai dari mail engine (fondasi paling dasar), jalankan:
   ```bash
   cd mail-engine
   cp .env.example .env   # isi domain & kredensial
   docker compose up -d
   ```
4. Lanjut ke service lain sesuai prioritas di checklist (rekomendasi urutan: `domain-provisioning` → `mail-app-service` → `auth-service` → sisanya).

### Rekomendasi: pakai Claude Code
Kalau mau ngebut, buka folder ini dengan **Claude Code extension di VSCode** — dia bisa baca isi `docs/` sebagai konteks dan bantu generate boilerplate tiap service sesuai requirement ID yang lo minta. Contoh prompt:
> "Baca docs/SRS_SendagoMail.docx, lalu scaffold service auth-service sesuai requirement isolasi tenant di BR-08."

## 🔧 Prasyarat

- Docker & Docker Compose
- Node.js 20+ (untuk services & apps)
- VPS yang mendukung port 25 outbound (lihat catatan provider di BRD) — untuk deployment produksi

## 📌 Status

Fase saat ini: **Perencanaan → Setup awal repo & mail engine**
