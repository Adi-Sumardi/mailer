import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { signTestToken } from './jwt.helper';

describe('API Credential (e2e) — member_id/secret, sandbox vs production quota', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const tenantAdminToken = signTestToken({
    sub: 'tadmin-1',
    role: 'tenant_admin',
    tenantId: 'tenant-a',
    mailboxId: null,
  });
  const otherTenantAdminToken = signTestToken({
    sub: 'tadmin-2',
    role: 'tenant_admin',
    tenantId: 'tenant-b',
    mailboxId: null,
  });
  const endUserToken = signTestToken({
    sub: 'user-1',
    role: 'end_user',
    tenantId: 'tenant-a',
    mailboxId: 'mailbox-1',
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.apiCredential.deleteMany();
    await app.close();
  });

  beforeEach(async () => {
    await prisma.apiCredential.deleteMany();
  });

  it('menolak create tanpa token (401)', async () => {
    await request(app.getHttpServer())
      .post('/auth/api-credentials')
      .send({ name: 'Integrasi A' })
      .expect(401);
  });

  it('menolak create untuk role end_user (403 — khusus tenant_admin)', async () => {
    await request(app.getHttpServer())
      .post('/auth/api-credentials')
      .set('Authorization', `Bearer ${endUserToken}`)
      .send({ name: 'Integrasi A' })
      .expect(403);
  });

  it('tenant_admin membuat credential sandbox — dapat memberId+secret sekali, limit 50/hari', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/api-credentials')
      .set('Authorization', `Bearer ${tenantAdminToken}`)
      .send({ name: 'Integrasi Sandbox', environment: 'sandbox' })
      .expect(201);

    expect(res.body.memberId).toMatch(/^mbr_/);
    expect(res.body.secret).toBeDefined();
    expect(res.body.environment).toBe('sandbox');
    expect(res.body.dailyEmailLimit).toBe(50);
  });

  it('tenant_admin membuat credential production — limit lebih besar dari sandbox', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/api-credentials')
      .set('Authorization', `Bearer ${tenantAdminToken}`)
      .send({ name: 'Integrasi Production', environment: 'production' })
      .expect(201);

    expect(res.body.environment).toBe('production');
    expect(res.body.dailyEmailLimit).toBeGreaterThan(50);
  });

  it('default environment adalah sandbox kalau tidak diisi', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/api-credentials')
      .set('Authorization', `Bearer ${tenantAdminToken}`)
      .send({ name: 'Tanpa environment' })
      .expect(201);

    expect(res.body.environment).toBe('sandbox');
  });

  it('GET list tidak pernah mengembalikan secret', async () => {
    await request(app.getHttpServer())
      .post('/auth/api-credentials')
      .set('Authorization', `Bearer ${tenantAdminToken}`)
      .send({ name: 'Integrasi A' })
      .expect(201);

    const list = await request(app.getHttpServer())
      .get('/auth/api-credentials')
      .set('Authorization', `Bearer ${tenantAdminToken}`)
      .expect(200);

    expect(list.body).toHaveLength(1);
    expect(list.body[0].secret).toBeUndefined();
    expect(list.body[0].secretHash).toBeUndefined();
  });

  it('POST /auth/api-credentials/validate berhasil dengan memberId+secret benar, mengonsumsi kuota', async () => {
    const created = await request(app.getHttpServer())
      .post('/auth/api-credentials')
      .set('Authorization', `Bearer ${tenantAdminToken}`)
      .send({ name: 'Integrasi A', environment: 'sandbox' })
      .expect(201);

    const validated = await request(app.getHttpServer())
      .post('/auth/api-credentials/validate')
      .send({ memberId: created.body.memberId, secret: created.body.secret })
      .expect(201);

    expect(validated.body.valid).toBe(true);
    expect(validated.body.remainingQuota).toBe(49);
    expect(validated.body.tenantId).toBe('tenant-a');
  });

  it('validate menolak secret yang salah', async () => {
    const created = await request(app.getHttpServer())
      .post('/auth/api-credentials')
      .set('Authorization', `Bearer ${tenantAdminToken}`)
      .send({ name: 'Integrasi A' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/auth/api-credentials/validate')
      .send({ memberId: created.body.memberId, secret: 'secret-salah' })
      .expect(201);

    expect(res.body.valid).toBe(false);
  });

  it('validate menolak memberId yang tidak dikenal', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/api-credentials/validate')
      .send({ memberId: 'mbr_tidak_ada', secret: 'apapun' })
      .expect(201);

    expect(res.body.valid).toBe(false);
  });

  it('validate menolak setelah kuota harian habis', async () => {
    const created = await request(app.getHttpServer())
      .post('/auth/api-credentials')
      .set('Authorization', `Bearer ${tenantAdminToken}`)
      .send({ name: 'Integrasi Kuota Habis', environment: 'sandbox' })
      .expect(201);

    // Set langsung ke DB supaya test cepat — simulasikan kuota sudah terpakai semua.
    await prisma.apiCredential.update({
      where: { memberId: created.body.memberId },
      data: { emailsSentToday: 50 },
    });

    const res = await request(app.getHttpServer())
      .post('/auth/api-credentials/validate')
      .send({ memberId: created.body.memberId, secret: created.body.secret })
      .expect(201);

    expect(res.body.valid).toBe(false);
    expect(res.body.reason).toContain('Kuota harian');
  });

  it('kuota otomatis reset di hari berikutnya', async () => {
    const created = await request(app.getHttpServer())
      .post('/auth/api-credentials')
      .set('Authorization', `Bearer ${tenantAdminToken}`)
      .send({ name: 'Integrasi Reset', environment: 'sandbox' })
      .expect(201);

    const yesterday = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await prisma.apiCredential.update({
      where: { memberId: created.body.memberId },
      data: { emailsSentToday: 50, quotaResetAt: yesterday },
    });

    const res = await request(app.getHttpServer())
      .post('/auth/api-credentials/validate')
      .send({ memberId: created.body.memberId, secret: created.body.secret })
      .expect(201);

    expect(res.body.valid).toBe(true);
    expect(res.body.remainingQuota).toBe(49);
  });

  it('revoke membuat credential tidak bisa dipakai lagi', async () => {
    const created = await request(app.getHttpServer())
      .post('/auth/api-credentials')
      .set('Authorization', `Bearer ${tenantAdminToken}`)
      .send({ name: 'Integrasi Revoke' })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/auth/api-credentials/${created.body.id}`)
      .set('Authorization', `Bearer ${tenantAdminToken}`)
      .expect(200);

    const res = await request(app.getHttpServer())
      .post('/auth/api-credentials/validate')
      .send({ memberId: created.body.memberId, secret: created.body.secret })
      .expect(201);

    expect(res.body.valid).toBe(false);
  });

  it('mengisolasi credential antar tenant — tenant lain tidak bisa revoke', async () => {
    const created = await request(app.getHttpServer())
      .post('/auth/api-credentials')
      .set('Authorization', `Bearer ${tenantAdminToken}`)
      .send({ name: 'Milik Tenant A' })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/auth/api-credentials/${created.body.id}`)
      .set('Authorization', `Bearer ${otherTenantAdminToken}`)
      .expect(404);
  });

  it('list credential hanya menampilkan milik tenant sendiri', async () => {
    await request(app.getHttpServer())
      .post('/auth/api-credentials')
      .set('Authorization', `Bearer ${tenantAdminToken}`)
      .send({ name: 'Milik Tenant A' })
      .expect(201);

    const listForOther = await request(app.getHttpServer())
      .get('/auth/api-credentials')
      .set('Authorization', `Bearer ${otherTenantAdminToken}`)
      .expect(200);

    expect(listForOther.body).toHaveLength(0);
  });
});
