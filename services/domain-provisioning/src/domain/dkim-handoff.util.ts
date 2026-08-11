import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

// Menulis private key DKIM ke direktori yang dibaca mail-engine (docker-mailserver, DKIM signing
// lewat modul Rspamd `dkim_signing` — BUKAN OpenDKIM klasik). Dulu pakai OpenDKIM klasik
// (KeyTable/SigningTable), tapi image docker-mailserver yang dipakai di sini tidak live-reload
// config OpenDKIM — domain baru cuma ke-pickup saat container mailserver di-restart penuh
// (`docker compose down && up`), yang menyebabkan tenant baru (mis. yapinet.id) gagal DKIM sign
// diam-diam sampai ada yang sadar & restart manual. Rspamd sebaliknya sudah punya changedetector
// bawaan yang otomatis restart proses rspamd begitu file di RSPAMD_DMS_DKIM_D / override.d
// berubah (lihat check-for-changes.sh di image docker-mailserver) — jadi domain baru langsung
// aktif tanpa campur tangan manual maupun akses infra apa pun dari service ini.
export async function writeDkimKeyFile(params: {
  dkimDir: string; // .../rspamd/dkim (bind-mount ke /tmp/docker-mailserver/rspamd/dkim di container)
  domainName: string;
  selector: string;
  privateKeyPem: string;
}): Promise<string> {
  const { dkimDir, domainName, selector, privateKeyPem } = params;

  await mkdir(dkimDir, { recursive: true });
  const privateKeyPath = join(dkimDir, dkimKeyFileName(domainName, selector));
  await writeFile(privateKeyPath, privateKeyPem, { mode: 0o600 });
  return privateKeyPath;
}

export function dkimKeyFileName(domainName: string, selector: string): string {
  return `rsa-2048-${selector}-${domainName}.private.txt`;
}

// Path yang benar-benar dibaca proses rspamd DI DALAM container mailserver — bukan path host,
// dan bukan path domain-provisioning sendiri. /tmp/docker-mailserver di container itu adalah
// bind-mount yang sama dengan dkimDir/overrideDir service ini, jadi rspamd baca file yang sama
// persis yang baru saja ditulis di atas, tanpa proses copy/sync tambahan apa pun.
const MAILSERVER_CONTAINER_DKIM_DIR = '/tmp/docker-mailserver/rspamd/dkim';

export interface DkimDomainEntry {
  domainName: string;
  selector: string;
}

// Regenerate PENUH dkim_signing.conf dari daftar domain yang diberikan (bukan patch teks
// parsial) — supaya idempotent & tidak rapuh terhadap isi file lama yang mungkin sudah diedit
// manual atau korup. Pemanggil (DomainService) bertanggung jawab menyediakan daftar LENGKAP
// domain yang harus di-sign (query semua domain dari DB), bukan cuma domain yang baru dibuat.
export async function regenerateDkimSigningConfig(params: {
  overrideDir: string; // .../rspamd/override.d (bind-mount ke /tmp/docker-mailserver/rspamd/override.d)
  domains: DkimDomainEntry[];
}): Promise<string> {
  const { overrideDir, domains } = params;
  await mkdir(overrideDir, { recursive: true });

  const domainBlocks = domains
    .map(
      ({ domainName, selector }) => `    ${domainName} {
        path = "${MAILSERVER_CONTAINER_DKIM_DIR}/${dkimKeyFileName(domainName, selector)}";
        selector = "${selector}";
    }`,
    )
    .join('\n');

  const conf = `# File ini di-generate otomatis oleh domain-provisioning (regenerateDkimSigningConfig) —
# JANGAN edit manual, perubahan akan tertimpa saat domain berikutnya ditambahkan.
# Dokumentasi: https://rspamd.com/doc/modules/dkim_signing.html

enabled = true;

sign_authenticated = true;
sign_local = false;
try_fallback = false;

use_domain = "header";
use_redis = false;
use_esld = true;
allow_username_mismatch = true;

check_pubkey = true;

domain {
${domainBlocks}
}
`;

  const confPath = join(overrideDir, 'dkim_signing.conf');
  await writeFile(confPath, conf);
  return confPath;
}
