# Infra

Docker Compose stack untuk deploy seluruh backend + frontend SendagoMail (belum termasuk `mail-engine` — itu punya compose sendiri di `mail-engine/`). Deployment saat ini: server lokal (bare-metal Ubuntu 24.04, shared dengan aplikasi lain), diekspos via Cloudflare Tunnel — **bukan** VPS cloud provider (Terraform/Ansible untuk itu masih rencana masa depan, lihat catatan lama di bawah).

## Status Deployment Saat Ini

Live di **`https://sendagomail.adilabs.id`** — server shared (juga menjalankan aplikasi lain bernama PDFPro). Stack SendagoMail sepenuhnya terisolasi dari aplikasi lain di server itu:

- Semua port container SendagoMail di rentang `18000-18090`, tidak bentrok dengan aplikasi lain
- Docker network sendiri (`sendagomail-network`)
- Volume Postgres sendiri (`infra_pgdata`) — bukan database yang dipakai aplikasi lain
- Cloudflare Tunnel **terpisah** (nama tunnel `sendagomail`, systemd service `sendagomail-tunnel.service`, config file `~/.cloudflared/sendagomail-config.yml`) — sama sekali tidak menyentuh tunnel/config/systemd service aplikasi lain di server tersebut

## Arsitektur Deployment

```
Internet → Cloudflare Tunnel (sendagomail.adilabs.id)
             │
             ├─ path /auth,/tenants,/domains,/mailboxes,/folders,/emails,
             │        /calendar-events,/tasks,/automation-rules,/health
             │        → localhost:18080 (api-gateway container)
             │              ├→ auth-service (18000)
             │              ├→ domain-provisioning (18001)
             │              ├→ mail-app-service (18002)
             │              ├→ calendar-task-service (18003)
             │              └→ automation-engine (18004)
             │
             └─ path lainnya → localhost:18090 (web container — nginx serving static React build)

Semua backend service → postgres (1 instance, 5 database terpisah: auth, domain_provisioning,
                          mail_app, calendar_task, automation)
```

Satu hostname (`sendagomail.adilabs.id`) untuk frontend & API sekaligus — routing berdasarkan path lewat aturan `ingress` di config Cloudflare Tunnel, bukan dua subdomain terpisah. Ini juga berarti frontend production di-build dengan `VITE_API_GATEWAY_URL=""` (kosong) supaya `fetch` memakai path relatif/same-origin, konsisten dengan routing path-based ini.

## File

| File | Isi |
|---|---|
| `docker-compose.yml` | Definisi 7 service: postgres, auth-service, domain-provisioning, mail-app-service, calendar-task-service, automation-engine, api-gateway, web |
| `init-databases.sql` | Dijalankan otomatis oleh image Postgres saat volume masih kosong — membuat 5 database |
| `.env.example` | Template variabel wajib (`POSTGRES_PASSWORD`, `JWT_SECRET`, `INTERNAL_API_KEY`) |
| `.env` | **Tidak di-commit** (lihat `.gitignore` root) — berisi secret sungguhan, dibuat manual dari `.env.example` |

Tiap service NestJS (`services/*`) punya `Dockerfile` sendiri (single-stage, termasuk devDependencies supaya `prisma` CLI tersedia untuk migrasi saat container start) dan `.dockerignore`. `apps/web/Dockerfile` multi-stage: build Vite lalu serve lewat `nginx:alpine`.

## Cara Deploy Ulang / Update

```bash
# Dari mesin lokal — sync source code terbaru ke server (ganti host sesuai server)
rsync -az --delete \
  --exclude 'node_modules' --exclude 'dist' --exclude '.git' --exclude '*.log' \
  --exclude 'mail-engine/data' --exclude 'test/.tmp-dkim-keys' \
  services apps infra \
  user@server:/home/user/sendagomail/

# Di server
cd /home/user/sendagomail/infra
cp .env.example .env   # isi sekali di awal — JANGAN pernah commit file ini
docker compose build
docker compose up -d
docker compose logs -f   # pastikan migrasi Prisma jalan sukses di tiap service
```

Setiap service menjalankan `prisma migrate deploy` otomatis saat container start (lihat `CMD` di `Dockerfile` masing-masing) — jadi migrasi baru otomatis diterapkan setiap kali container di-restart/redeploy dengan image baru, tidak perlu langkah manual terpisah.

## Setup Cloudflare Tunnel (sekali saja, sudah dilakukan)

```bash
# Tunnel terpisah dari tunnel aplikasi lain yang sudah ada di server (jangan pernah reuse punya aplikasi lain)
cloudflared tunnel create sendagomail

# Config terpisah — JANGAN timpa ~/.cloudflared/config.yml kalau server sudah punya tunnel lain di situ
cat > ~/.cloudflared/sendagomail-config.yml << 'EOF'
tunnel: <tunnel-id-dari-command-create-di-atas>
credentials-file: /home/<user>/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: sendagomail.adilabs.id
    path: ^/(auth|tenants|domains|mailboxes|folders|emails|calendar-events|tasks|automation-rules|health)($|/.*)
    service: http://localhost:18080
  - hostname: sendagomail.adilabs.id
    service: http://localhost:18090
  - service: http_status:404
EOF

cloudflared tunnel --config ~/.cloudflared/sendagomail-config.yml route dns sendagomail sendagomail.adilabs.id

# systemd service TERPISAH dari punya aplikasi lain
sudo tee /etc/systemd/system/sendagomail-tunnel.service << 'EOF'
[Unit]
Description=SendagoMail Cloudflare Tunnel
After=network.target

[Service]
User=<user>
ExecStart=/usr/bin/cloudflared tunnel --config /home/<user>/.cloudflared/sendagomail-config.yml run sendagomail
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now sendagomail-tunnel.service
```

## Backup Otomatis Postgres

`scripts/backup-postgres.sh` — `pg_dump` per-database (auth, domain_provisioning, mail_app,
calendar_task, automation), di-gzip, disimpan di `/home/mailer/backups/postgres/` di host
(BUKAN di dalam volume Docker — kalau volume `infra_pgdata` hilang, backup ini tetap aman).
Retensi 14 hari (file lebih lama otomatis dihapus).

Setup sekali di server:

```bash
sudo cp infra/scripts/backup-postgres.sh /usr/local/bin/backup-postgres.sh
sudo chmod +x /usr/local/bin/backup-postgres.sh
mkdir -p /home/mailer/backups/postgres
(crontab -l 2>/dev/null; echo '30 2 * * * /usr/local/bin/backup-postgres.sh >> /home/mailer/backups/backup-postgres.log 2>&1') | crontab -
```

Restore satu database dari backup:

```bash
zcat /home/mailer/backups/postgres/auth_20260731-212321.sql.gz | docker exec -i infra-postgres-1 psql -U sendagomail -d auth
```

**Belum ada offsite backup** — file backup masih di disk yang sama dengan server produksi (kalau
seluruh VPS hilang, backup ikut hilang). Untuk produksi sungguhan, sinkronkan
`/home/mailer/backups/postgres/` ke storage terpisah (S3/rclone/dsb).

## Catatan & Keterbatasan
- **Image Docker belum dioptimasi ukurannya** — tiap service NestJS pakai single-stage build (termasuk devDependencies) supaya `prisma migrate deploy` bisa jalan di runtime. Bisa dikecilkan dengan multi-stage + salin `prisma` CLI secara selektif kalau ukuran image jadi masalah.
- **TLS/HTTPS** ditangani penuh oleh Cloudflare Tunnel (tidak ada certbot/Let's Encrypt manual dibutuhkan) — tapi ini juga berarti traffic HTTP di dalam server (container ke container, dan gateway ke cloudflared) tidak terenkripsi; cukup aman untuk localhost-only tapi dicatat sebagai batasan.
- **Rate limiting di `api-gateway` bersifat in-memory** — reset kalau container restart, dan tidak akurat kalau nanti di-scale ke banyak instance gateway.
- Belum ada CI/CD — deploy masih manual via `rsync` + `docker compose build && up -d` seperti dijelaskan di atas.
- Provisioning VPS cloud (Terraform/Ansible, lihat BRD rekomendasi Hetzner/Contabo/RackNerd) masih rencana masa depan kalau nanti pindah dari server lokal ini — belum dikerjakan.
