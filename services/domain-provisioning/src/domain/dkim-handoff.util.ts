import { mkdir, writeFile } from 'fs/promises';
import { join, resolve } from 'path';

// Menulis private key DKIM ke direktori yang dibaca mail-engine (docker-mailserver, layout OpenDKIM:
// keys/<domain>/<selector>.private). Lihat .gitignore root (**/config/opendkim/keys/) yang sudah
// mengasumsikan struktur ini. Bukan integrasi Rspamd langsung — sekadar filesystem hand-off; mail-engine
// perlu proses reload/restart terpisah agar key baru terbaca (di luar scope service ini).
export async function writeDkimKeyToMailEngine(params: {
  keysDir: string;
  domainName: string;
  selector: string;
  privateKeyPem: string;
  publicKeyRecord: string;
}): Promise<string> {
  const { keysDir, domainName, selector, privateKeyPem, publicKeyRecord } = params;

  const domainDir = resolve(keysDir, domainName);
  await mkdir(domainDir, { recursive: true });

  const privateKeyPath = join(domainDir, `${selector}.private`);
  await writeFile(privateKeyPath, privateKeyPem, { mode: 0o600 });

  // File .txt ini mengikuti konvensi docker-mailserver: rekomendasi DNS record siap-baca manusia,
  // walau nilai otoritatifnya tetap dari endpoint GET /domains/:id/dns-records.
  const txtPath = join(domainDir, `${selector}.txt`);
  const txtContent = `${selector}._domainkey.${domainName}. IN TXT "${publicKeyRecord}"\n`;
  await writeFile(txtPath, txtContent);

  return privateKeyPath;
}
