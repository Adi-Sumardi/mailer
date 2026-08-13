import { mkdtemp, readFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { regeneratePostfixTenantMaps } from './mail-engine-handoff.util';

describe('mail-engine-handoff.util', () => {
  let mapsDir: string;

  beforeEach(async () => {
    mapsDir = await mkdtemp(join(tmpdir(), 'postfix-maps-test-'));
  });

  afterEach(async () => {
    await rm(mapsDir, { recursive: true, force: true });
  });

  it('menulis relay_domains + transport_maps untuk tiap domain tenant', async () => {
    await regeneratePostfixTenantMaps({
      mapsDir,
      domainNames: ['yapinet.id', 'simonas.id'],
    });

    const domains = await readFile(join(mapsDir, 'sendago-tenant-domains.cf'), 'utf8');
    expect(domains).toContain('yapinet.id OK');
    expect(domains).toContain('simonas.id OK');

    const transport = await readFile(join(mapsDir, 'sendago-transport.cf'), 'utf8');
    expect(transport).toContain('yapinet.id sendago-ingest:');
    expect(transport).toContain('simonas.id sendago-ingest:');
  });

  it('idempotent — dipanggil ulang dengan daftar sama menghasilkan isi identik', async () => {
    const params = { mapsDir, domainNames: ['yapinet.id'] };
    await regeneratePostfixTenantMaps(params);
    const first = await readFile(join(mapsDir, 'sendago-transport.cf'), 'utf8');
    await regeneratePostfixTenantMaps(params);
    const second = await readFile(join(mapsDir, 'sendago-transport.cf'), 'utf8');
    expect(second).toBe(first);
  });

  it('menghapus domain yang sudah tidak ada di daftar (full regenerate, bukan patch)', async () => {
    await regeneratePostfixTenantMaps({ mapsDir, domainNames: ['yapinet.id', 'lama.id'] });
    await regeneratePostfixTenantMaps({ mapsDir, domainNames: ['yapinet.id'] });

    const domains = await readFile(join(mapsDir, 'sendago-tenant-domains.cf'), 'utf8');
    expect(domains).toContain('yapinet.id OK');
    expect(domains).not.toContain('lama.id');
  });

  it('daftar kosong tetap menghasilkan file valid (hanya komentar), bukan gagal', async () => {
    await regeneratePostfixTenantMaps({ mapsDir, domainNames: [] });

    const domains = await readFile(join(mapsDir, 'sendago-tenant-domains.cf'), 'utf8');
    expect(domains).toContain('#');
    expect(domains).not.toContain(' OK');
  });
});
