import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { writeDkimKeyToMailEngine } from './dkim-handoff.util';

describe('dkim-handoff.util', () => {
  let root: string;
  let keysDir: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'dkim-handoff-test-'));
    keysDir = join(root, 'opendkim', 'keys');
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('menulis private/public key ke keys/<domain>/<selector> dan mendaftarkan ke KeyTable+SigningTable', async () => {
    await writeDkimKeyToMailEngine({
      keysDir,
      domainName: 'simonas.id',
      selector: 'sendago',
      privateKeyPem: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n',
      publicKeyRecord: 'v=DKIM1; k=rsa; p=abc',
    });

    const privateKey = await readFile(join(keysDir, 'simonas.id', 'sendago.private'), 'utf8');
    expect(privateKey).toContain('BEGIN PRIVATE KEY');

    const keyTable = await readFile(join(root, 'opendkim', 'KeyTable'), 'utf8');
    expect(keyTable).toContain(
      'sendago._domainkey.simonas.id simonas.id:sendago:/etc/opendkim/keys/simonas.id/sendago.private',
    );

    const signingTable = await readFile(join(root, 'opendkim', 'SigningTable'), 'utf8');
    expect(signingTable).toContain('*@simonas.id sendago._domainkey.simonas.id');
  });

  it('idempotent — menjalankan ulang untuk domain yang sama tidak menduplikasi baris', async () => {
    const params = {
      keysDir,
      domainName: 'simonas.id',
      selector: 'sendago',
      privateKeyPem: 'key-1',
      publicKeyRecord: 'v=DKIM1; k=rsa; p=abc',
    };
    await writeDkimKeyToMailEngine(params);
    await writeDkimKeyToMailEngine(params);

    const keyTable = await readFile(join(root, 'opendkim', 'KeyTable'), 'utf8');
    const matches = keyTable.split('\n').filter((l) => l.includes('simonas.id'));
    expect(matches).toHaveLength(1);
  });

  it('menambahkan domain kedua tanpa menghapus entri domain pertama', async () => {
    await writeDkimKeyToMailEngine({
      keysDir,
      domainName: 'simonas.id',
      selector: 'sendago',
      privateKeyPem: 'key-1',
      publicKeyRecord: 'v=DKIM1; k=rsa; p=abc',
    });
    await writeDkimKeyToMailEngine({
      keysDir,
      domainName: 'lain.id',
      selector: 'sendago',
      privateKeyPem: 'key-2',
      publicKeyRecord: 'v=DKIM1; k=rsa; p=def',
    });

    const keyTable = await readFile(join(root, 'opendkim', 'KeyTable'), 'utf8');
    expect(keyTable).toContain('simonas.id');
    expect(keyTable).toContain('lain.id');
  });
});
