import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { promises as dns } from 'dns';
import { existsSync, rmSync } from 'fs';
import { join } from 'path';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { signTestToken } from './jwt.helper';

jest.mock('dns', () => ({
  promises: { resolveTxt: jest.fn() },
}));

describe('Domain (e2e) — FR-02 s/d FR-05', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  let tenantAId: string;
  let tenantBId: string;
  let tenantAAdminToken: string;
  let superAdminToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.domain.deleteMany();
    await prisma.tenant.deleteMany();
    await app.close();
    rmSync(process.env.DKIM_KEYS_DIR as string, { recursive: true, force: true });
    rmSync(process.env.DKIM_OVERRIDE_DIR as string, { recursive: true, force: true });
  });

  beforeEach(async () => {
    await prisma.domain.deleteMany();
    await prisma.tenant.deleteMany();

    const tenantA = await prisma.tenant.create({ data: { tenantName: 'Tenant A' } });
    const tenantB = await prisma.tenant.create({ data: { tenantName: 'Tenant B' } });
    tenantAId = tenantA.id;
    tenantBId = tenantB.id;

    tenantAAdminToken = signTestToken({ sub: 'admin-a', role: 'tenant_admin', tenantId: tenantAId });
    superAdminToken = signTestToken({ sub: 'super-1', role: 'super_admin', tenantId: null });

    (dns.resolveTxt as jest.Mock).mockReset();
  });

  it('rejects request tanpa token (401)', async () => {
    await request(app.getHttpServer())
      .post('/domains')
      .send({ tenantId: tenantAId, domainName: 'acme.test' })
      .expect(401);
  });

  it('Tenant Admin menambahkan domain miliknya sendiri, generate DKIM keypair, dan hand-off ke mail-engine', async () => {
    const res = await request(app.getHttpServer())
      .post('/domains')
      .set('Authorization', `Bearer ${tenantAAdminToken}`)
      .send({ tenantId: tenantAId, domainName: 'acme-a.test' })
      .expect(201);

    expect(res.body.verificationStatus).toBe('pending');
    expect(res.body.mxRecord).toBe('10 mail.test.local.');
    expect(res.body.dkimSelector).toBe('sendago');

    const privateKeyPath = join(
      process.env.DKIM_KEYS_DIR as string,
      'rsa-2048-sendago-acme-a.test.private.txt',
    );
    expect(existsSync(privateKeyPath)).toBe(true);

    const signingConfPath = join(process.env.DKIM_OVERRIDE_DIR as string, 'dkim_signing.conf');
    expect(existsSync(signingConfPath)).toBe(true);
  });

  it('menolak Tenant Admin menambahkan domain untuk tenant lain (403)', async () => {
    await request(app.getHttpServer())
      .post('/domains')
      .set('Authorization', `Bearer ${tenantAAdminToken}`)
      .send({ tenantId: tenantBId, domainName: 'acme-b.test' })
      .expect(403);
  });

  it('Super Admin boleh menambahkan domain untuk tenant manapun', async () => {
    await request(app.getHttpServer())
      .post('/domains')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ tenantId: tenantBId, domainName: 'acme-super.test' })
      .expect(201);
  });

  it('menolak list domain tenant lain (403) dan mengizinkan list domain sendiri (200)', async () => {
    await request(app.getHttpServer())
      .get(`/domains?tenantId=${tenantBId}`)
      .set('Authorization', `Bearer ${tenantAAdminToken}`)
      .expect(403);

    await request(app.getHttpServer())
      .get(`/domains?tenantId=${tenantAId}`)
      .set('Authorization', `Bearer ${tenantAAdminToken}`)
      .expect(200);
  });

  it('memberi instruksi TXT record yang mengandung token verifikasi', async () => {
    const created = await request(app.getHttpServer())
      .post('/domains')
      .set('Authorization', `Bearer ${tenantAAdminToken}`)
      .send({ tenantId: tenantAId, domainName: 'acme-txt.test' })
      .expect(201);

    const instructions = await request(app.getHttpServer())
      .get(`/domains/${created.body.id}/verification-instructions`)
      .set('Authorization', `Bearer ${tenantAAdminToken}`)
      .expect(200);

    expect(instructions.body.recordType).toBe('TXT');
    expect(instructions.body.value).toBe(
      `sendagomail-verify=${created.body.verificationToken}`,
    );
  });

  it('FR-04: status berubah jadi verified saat TXT record cocok', async () => {
    const created = await request(app.getHttpServer())
      .post('/domains')
      .set('Authorization', `Bearer ${tenantAAdminToken}`)
      .send({ tenantId: tenantAId, domainName: 'acme-verify-ok.test' })
      .expect(201);

    (dns.resolveTxt as jest.Mock).mockResolvedValueOnce([
      [`sendagomail-verify=${created.body.verificationToken}`],
    ]);

    const verified = await request(app.getHttpServer())
      .post(`/domains/${created.body.id}/verify`)
      .set('Authorization', `Bearer ${tenantAAdminToken}`)
      .expect(201);

    expect(verified.body.verificationStatus).toBe('verified');
    expect(verified.body.verifiedAt).not.toBeNull();
  });

  it('FR-04: status tetap failed kalau TXT record tidak ditemukan/tidak cocok', async () => {
    const created = await request(app.getHttpServer())
      .post('/domains')
      .set('Authorization', `Bearer ${tenantAAdminToken}`)
      .send({ tenantId: tenantAId, domainName: 'acme-verify-fail.test' })
      .expect(201);

    (dns.resolveTxt as jest.Mock).mockRejectedValueOnce(new Error('NXDOMAIN'));

    const failed = await request(app.getHttpServer())
      .post(`/domains/${created.body.id}/verify`)
      .set('Authorization', `Bearer ${tenantAAdminToken}`)
      .expect(201);

    expect(failed.body.verificationStatus).toBe('failed');
  });

  it('FR-03: dns-records tidak mengekspos private key DKIM', async () => {
    const created = await request(app.getHttpServer())
      .post('/domains')
      .set('Authorization', `Bearer ${tenantAAdminToken}`)
      .send({ tenantId: tenantAId, domainName: 'acme-dns.test' })
      .expect(201);

    const dnsRecords = await request(app.getHttpServer())
      .get(`/domains/${created.body.id}/dns-records`)
      .set('Authorization', `Bearer ${tenantAAdminToken}`)
      .expect(200);

    expect(dnsRecords.body.dkim.host).toBe('sendago._domainkey.acme-dns.test');
    expect(dnsRecords.body.dkim.value).toMatch(/^v=DKIM1; k=rsa; p=/);
    expect(JSON.stringify(dnsRecords.body)).not.toContain('PRIVATE KEY');
  });
});
