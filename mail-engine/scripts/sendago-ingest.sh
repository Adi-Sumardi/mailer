#!/bin/sh
# Menerima satu email masuk dari Postfix (transport "sendago-ingest", lihat
# config/user-patches.sh) dan meneruskannya ke mail-app-service untuk disimpan ke
# Inbox penerima di Postgres.
#
# stdin : pesan mentah (RFC822)
# $1    : alamat penerima
#
# Exit code MENENTUKAN nasib email (sysexits.h, lihat pipe(8)) — dipilih supaya email
# tidak pernah hilang diam-diam:
#   0  sukses
#   67 EX_NOUSER   -> bounce permanen (alamat memang tidak ada di sistem ini)
#   75 EX_TEMPFAIL -> Postfix menahan & mencoba lagi (service down / error tak terduga)
set -u

RECIPIENT="${1:-}"
[ -n "$RECIPIENT" ] || exit 67

# Konfigurasi dibaca dari file, BUKAN environment: proses pipe dijalankan master Postfix yang
# tidak mewarisi environment container (lihat penjelasan di config/user-patches.sh, yang
# menulis file ini saat startup).
INGEST_ENV_FILE='/etc/sendago-ingest.env'
# shellcheck disable=SC1090
[ -r "$INGEST_ENV_FILE" ] && . "$INGEST_ENV_FILE"

INGEST_URL="${SENDAGO_INGEST_URL:-http://host.docker.internal:18002/emails/ingest}"
API_KEY="${SENDAGO_INTERNAL_API_KEY:-}"

if [ -z "$API_KEY" ]; then
  echo "sendago-ingest: SENDAGO_INTERNAL_API_KEY tidak diset — email ditahan" >&2
  exit 75
fi

PAYLOAD_FILE=$(mktemp) || exit 75
RESPONSE_FILE=$(mktemp) || { rm -f "$PAYLOAD_FILE"; exit 75; }
# shellcheck disable=SC2064
trap "rm -f '$PAYLOAD_FILE' '$RESPONSE_FILE'" EXIT

# Pesan mentah bisa berukuran MB (lampiran) — dirakit lewat file, bukan variabel shell,
# supaya tidak menabrak batas ukuran argumen/memori shell.
{
  printf '{"recipient":"%s","rawBase64":"' "$RECIPIENT"
  base64 -w0
  printf '"}'
} > "$PAYLOAD_FILE"

HTTP_CODE=$(curl -sS --max-time 120 -o "$RESPONSE_FILE" -w '%{http_code}' \
  -X POST "$INGEST_URL" \
  -H 'Content-Type: application/json' \
  -H "X-Internal-Api-Key: $API_KEY" \
  --data-binary "@$PAYLOAD_FILE" 2>>"$RESPONSE_FILE") || {
  echo "sendago-ingest: gagal menghubungi $INGEST_URL: $(cat "$RESPONSE_FILE")" >&2
  exit 75
}

case "$HTTP_CODE" in
  2*)
    exit 0
    ;;
  404)
    # Mailbox-nya memang tidak ada — bounce permanen supaya pengirim tahu, bukan ditahan
    # berhari-hari lalu hilang.
    echo "sendago-ingest: mailbox $RECIPIENT tidak ditemukan: $(cat "$RESPONSE_FILE")" >&2
    exit 67
    ;;
  *)
    # Termasuk 4xx lain (mis. payload ditolak validasi) — sengaja di-defer, bukan bounce,
    # supaya bug di sisi kami bisa diperbaiki dan email tetap terkirim saat dicoba ulang.
    echo "sendago-ingest: HTTP $HTTP_CODE dari ingest: $(cat "$RESPONSE_FILE")" >&2
    exit 75
    ;;
esac
