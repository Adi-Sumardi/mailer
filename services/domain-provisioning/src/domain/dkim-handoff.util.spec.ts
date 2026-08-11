import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { regenerateDkimSigningConfig, writeDkimKeyFile } from './dkim-handoff.util';

describe('dkim-handoff.util', () => {
  let root: string;
  let dkimDir: string;
  let overrideDir: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'dkim-handoff-test-'));
    dkimDir = join(root, 'rspamd', 'dkim');
    overrideDir = join(root, 'rspamd', 'override.d');
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('menulis private key ke dkimDir dengan nama file rsa-2048-<selector>-<domain>.private.txt', async () => {
    await writeDkimKeyFile({
      dkimDir,
      domainName: 'simonas.id',
      selector: 'sendago',
      privateKeyPem: '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n',
    });

    const privateKey = await readFile(join(dkimDir, 'rsa-2048-sendago-simonas.id.private.txt'), 'utf8');
    expect(privateKey).toContain('BEGIN PRIVATE KEY');
  });

  it('regenerateDkimSigningConfig menulis domain block per domain dengan path container yang benar', async () => {
    await regenerateDkimSigningConfig({
      overrideDir,
      domains: [
        { domainName: 'simonas.id', selector: 'sendago' },
        { domainName: 'yapinet.id', selector: 'sendago' },
      ],
    });

    const conf = await readFile(join(overrideDir, 'dkim_signing.conf'), 'utf8');
    expect(conf).toContain('enabled = true;');
    expect(conf).toContain('simonas.id {');
    expect(conf).toContain(
      'path = "/tmp/docker-mailserver/rspamd/dkim/rsa-2048-sendago-simonas.id.private.txt";',
    );
    expect(conf).toContain('yapinet.id {');
    expect(conf).toContain(
      'path = "/tmp/docker-mailserver/rspamd/dkim/rsa-2048-sendago-yapinet.id.private.txt";',
    );
  });

  it('regenerateDkimSigningConfig idempotent — dipanggil ulang dengan daftar sama menghasilkan isi identik', async () => {
    const domains = [{ domainName: 'simonas.id', selector: 'sendago' }];
    await regenerateDkimSigningConfig({ overrideDir, domains });
    const first = await readFile(join(overrideDir, 'dkim_signing.conf'), 'utf8');
    await regenerateDkimSigningConfig({ overrideDir, domains });
    const second = await readFile(join(overrideDir, 'dkim_signing.conf'), 'utf8');
    expect(second).toBe(first);
  });

  it('regenerateDkimSigningConfig menghapus domain yang sudah tidak ada di daftar (full regenerate, bukan patch)', async () => {
    await regenerateDkimSigningConfig({
      overrideDir,
      domains: [
        { domainName: 'simonas.id', selector: 'sendago' },
        { domainName: 'lama.id', selector: 'sendago' },
      ],
    });
    await regenerateDkimSigningConfig({
      overrideDir,
      domains: [{ domainName: 'simonas.id', selector: 'sendago' }],
    });

    const conf = await readFile(join(overrideDir, 'dkim_signing.conf'), 'utf8');
    expect(conf).toContain('simonas.id {');
    expect(conf).not.toContain('lama.id');
  });
});
