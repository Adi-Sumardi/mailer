#!/bin/bash
# Backup harian semua database Postgres SendagoMail (pg_dump per-db, gzip, retensi 14 hari).
# Deploy: copy ke /usr/local/bin/backup-postgres.sh di server, lalu jadwalkan lewat cron:
#   30 2 * * * /usr/local/bin/backup-postgres.sh >> /home/mailer/backups/backup-postgres.log 2>&1
set -euo pipefail

BACKUP_DIR=/home/mailer/backups/postgres
CONTAINER=infra-postgres-1
DB_USER=sendagomail
RETENTION_DAYS=14
DATABASES=(auth domain_provisioning mail_app calendar_task automation)
STAMP=$(date +%Y%m%d-%H%M%S)

mkdir -p "$BACKUP_DIR"

for db in "${DATABASES[@]}"; do
  docker exec "$CONTAINER" pg_dump -U "$DB_USER" "$db" | gzip > "$BACKUP_DIR/${db}_${STAMP}.sql.gz"
done

find "$BACKUP_DIR" -name '*.sql.gz' -mtime +$RETENTION_DAYS -delete

echo "[$(date -Iseconds)] Backup selesai: ${#DATABASES[@]} database, stamp=$STAMP"
