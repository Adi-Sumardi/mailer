# Mail Engine

Backend pengiriman/penerimaan email untuk SendagoMail, berbasis [docker-mailserver](https://docker-mailserver.github.io/docker-mailserver/latest/).

## Setup Cepat

```bash
cp .env.example .env
# edit .env — isi MAIL_HOSTNAME dan MAIL_DOMAIN

docker compose up -d

# generate akun email pertama (contoh)
docker exec -it sendagomail-mailserver setup email add admin@domainanda.com
```

> **DKIM untuk domain tenant** (bukan domain admin/base di atas) di-generate & di-handoff otomatis
> oleh `services/domain-provisioning` saat tenant menambahkan domain lewat aplikasi — lewat modul
> Rspamd `dkim_signing` (`config/rspamd/dkim/` + `config/rspamd/override.d/dkim_signing.conf`),
> **bukan** `setup config dkim` (yang men-generate OpenDKIM klasik, dipakai terpisah kalau memang
> perlu key manual untuk domain admin/base). Rspamd punya live-reload otomatis lewat
> changedetector bawaan docker-mailserver — domain baru langsung aktif tanpa restart container.
> Kalau menambah domain admin manual via CLI di atas, tetap perlu `docker compose restart mailserver`
> setelahnya kalau memakai jalur OpenDKIM klasik.

## Checklist Sebelum Production

- [ ] Cek reputasi IP server di [mxtoolbox.com](https://mxtoolbox.com) — pastikan tidak masuk blacklist
- [ ] Pastikan port 25 outbound tidak diblokir provider (lihat rekomendasi provider di `docs/BRD_SendagoMail.docx`)
- [ ] Setting PTR (reverse DNS) sesuai hostname mail server di provider VPS
- [ ] Tambahkan DNS record: MX, SPF, DKIM (dari output di atas), DMARC
- [ ] Test skor spam kirim ke [mail-tester.com](https://www.mail-tester.com)
- [ ] Kalau port 25 diblokir provider → setting SMTP relay pihak ketiga di config Postfix (lihat FR terkait `domain-provisioning` service)

## Integrasi dengan Services Lain

Service `domain-provisioning` (lihat `services/domain-provisioning/`) akan otomatis memicu perintah-perintah setup di atas via API/CLI wrapper — tahap manual ini cuma untuk development awal.
