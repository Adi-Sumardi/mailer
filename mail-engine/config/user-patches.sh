#!/bin/bash
# Dijalankan docker-mailserver sebagai root di akhir startup — escape hatch resmi untuk
# kustomisasi yang tidak tercakup file override bawaan.
#
# Mendaftarkan transport "sendago-ingest": mem-pipe email masuk untuk domain tenant ke skrip
# yang meneruskannya ke mail-app-service (lihat postfix-main.cf untuk alasan & rutenya).
#
# HARUS lewat `postconf -M` di sini, BUKAN lewat config/postfix-master.cf — file itu diproses
# docker-mailserver dengan `postconf -P` yang cuma bisa mengubah parameter service yang SUDAH
# ada, tidak bisa mendaftarkan service baru.
postconf -M 'sendago-ingest/unix=sendago-ingest unix - n n - - pipe flags=DRhu user=docker argv=/usr/local/bin/sendago-ingest.sh ${recipient}'
