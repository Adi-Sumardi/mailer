# Mail Engine

Backend pengiriman/penerimaan email untuk SendagoMail, berbasis [docker-mailserver](https://docker-mailserver.github.io/docker-mailserver/latest/).

## Setup Cepat

```bash
cp .env.example .env
# edit .env — isi MAIL_HOSTNAME dan MAIL_DOMAIN

docker compose up -d

# generate akun email pertama (contoh)
docker exec -it sendagomail-mailserver setup email add admin@domainanda.com

# generate DKIM key
docker exec -it sendagomail-mailserver setup config dkim

# lihat DNS record yang perlu ditambahkan (SPF/DKIM/DMARC)
docker exec -it sendagomail-mailserver setup config dkim keysize 2048
cat config/opendkim/keys/domainanda.com/mail.txt
```

## Checklist Sebelum Production

- [ ] Cek reputasi IP server di [mxtoolbox.com](https://mxtoolbox.com) — pastikan tidak masuk blacklist
- [ ] Pastikan port 25 outbound tidak diblokir provider (lihat rekomendasi provider di `docs/BRD_SendagoMail.docx`)
- [ ] Setting PTR (reverse DNS) sesuai hostname mail server di provider VPS
- [ ] Tambahkan DNS record: MX, SPF, DKIM (dari output di atas), DMARC
- [ ] Test skor spam kirim ke [mail-tester.com](https://www.mail-tester.com)
- [ ] Kalau port 25 diblokir provider → setting SMTP relay pihak ketiga di config Postfix (lihat FR terkait `domain-provisioning` service)

## Integrasi dengan Services Lain

Service `domain-provisioning` (lihat `services/domain-provisioning/`) akan otomatis memicu perintah-perintah setup di atas via API/CLI wrapper — tahap manual ini cuma untuk development awal.
