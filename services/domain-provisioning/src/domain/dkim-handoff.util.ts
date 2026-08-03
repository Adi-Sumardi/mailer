import { mkdir, writeFile, readFile } from 'fs/promises';
import { join, resolve } from 'path';

// Menulis private key DKIM ke direktori yang dibaca mail-engine (docker-mailserver, layout OpenDKIM:
// keys/<domain>/<selector>.private), DAN mendaftarkannya ke KeyTable/SigningTable OpenDKIM — dua file
// itu (satu level di atas keysDir) yang benar-benar dibaca Rspamd/OpenDKIM di docker-mailserver untuk
// tahu domain mana yang harus di-sign, bukan cuma keberadaan file key-nya. Lihat .gitignore root
// (**/config/opendkim/keys/) yang sudah mengasumsikan struktur ini. Bukan integrasi Rspamd langsung —
// sekadar filesystem hand-off; mail-engine perlu proses reload/restart terpisah agar key baru terbaca
// (di luar scope service ini).
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

  const opendkimDir = resolve(keysDir, '..');
  await upsertTableEntry(
    join(opendkimDir, 'KeyTable'),
    `${selector}._domainkey.${domainName} `,
    `${selector}._domainkey.${domainName} ${domainName}:${selector}:/etc/opendkim/keys/${domainName}/${selector}.private`,
  );
  await upsertTableEntry(
    join(opendkimDir, 'SigningTable'),
    `*@${domainName} `,
    `*@${domainName} ${selector}._domainkey.${domainName}`,
  );

  return privateKeyPath;
}

// Ganti baris yang sudah ada untuk domain ini (kalau ada, mis. re-provisioning selector baru),
// atau tambahkan baris baru di akhir file — supaya idempotent kalau handoff dijalankan ulang.
async function upsertTableEntry(filePath: string, matchPrefix: string, line: string): Promise<void> {
  let existing = '';
  try {
    existing = await readFile(filePath, 'utf8');
  } catch {
    existing = '';
  }

  const remainingLines = existing
    .split('\n')
    .filter((l) => l.trim().length > 0 && !l.startsWith(matchPrefix));
  remainingLines.push(line);

  await writeFile(filePath, remainingLines.join('\n') + '\n');
}
