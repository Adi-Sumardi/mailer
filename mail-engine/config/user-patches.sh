#!/bin/bash
# Dijalankan docker-mailserver sebagai root di akhir startup — escape hatch resmi untuk
# kustomisasi yang tidak tercakup file override bawaan.

# 1. Daftarkan transport "sendago-ingest": mem-pipe email masuk untuk domain tenant ke skrip
#    yang meneruskannya ke mail-app-service (lihat postfix-main.cf untuk alasan & rutenya).
#
#    HARUS lewat `postconf -M` di sini, BUKAN lewat config/postfix-master.cf — file itu
#    diproses docker-mailserver dengan `postconf -P` yang cuma bisa mengubah parameter service
#    yang SUDAH ada, tidak bisa mendaftarkan service baru.
postconf -M 'sendago-ingest/unix=sendago-ingest unix - n n - - pipe flags=DRhu user=docker argv=/usr/local/bin/sendago-ingest.sh ${recipient}'

# 2. Turunkan konfigurasi ingest dari environment container ke file yang dibaca skrip.
#
#    Skrip TIDAK bisa mengandalkan environment variable: proses pipe dijalankan oleh master
#    Postfix, dan `export_environment` hanya meneruskan variabel yang dimiliki master itu
#    sendiri — supervisord (yang menjalankan master) tidak meneruskan env container ke sana,
#    jadi skrip selalu melihat nilai kosong dan semua email masuk ter-defer.
#
#    File ditulis DI DALAM container (bukan ke bind mount) supaya API key tidak ikut tersimpan
#    di filesystem host, dan di-regenerate tiap startup. Mode 640 root:docker — hanya bisa
#    dibaca user yang menjalankan pipe.
INGEST_ENV_FILE='/etc/sendago-ingest.env'
umask 027
cat > "${INGEST_ENV_FILE}" <<EOF
SENDAGO_INGEST_URL='${SENDAGO_INGEST_URL:-http://host.docker.internal:18002/emails/ingest}'
SENDAGO_INTERNAL_API_KEY='${SENDAGO_INTERNAL_API_KEY:-}'
EOF
chown root:docker "${INGEST_ENV_FILE}"
chmod 640 "${INGEST_ENV_FILE}"

if [[ -z ${SENDAGO_INTERNAL_API_KEY:-} ]]; then
  echo "user-patches: PERINGATAN — SENDAGO_INTERNAL_API_KEY kosong di environment container;" \
       "email masuk untuk domain tenant akan ter-defer. Isi di mail-engine/.env." >&2
fi
