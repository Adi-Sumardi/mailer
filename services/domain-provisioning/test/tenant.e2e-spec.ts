import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { signTestToken } from './jwt.helper';

describe('Tenant (e2e) — FR-01', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const superAdminToken = signTestToken({ sub: 'super-1', role: 'super_admin', tenantId: null });
  const tenantAdminToken = signTestToken({
    sub: 'tadmin-1',
    role: 'tenant_admin',
    tenantId: 'irrelevant-for-tenant-endpoints',
  });

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
  });

  beforeEach(async () => {
    await prisma.domain.deleteMany();
    await prisma.tenant.deleteMany();
  });

  it('rejects request tanpa token (401)', async () => {
    await request(app.getHttpServer())
      .post('/tenants')
      .send({ tenantName: 'Acme Corp' })
      .expect(401);
  });

  it('menolak role tenant_admin membuat tenant (403 — khusus Super Admin)', async () => {
    await request(app.getHttpServer())
      .post('/tenants')
      .set('Authorization', `Bearer ${tenantAdminToken}`)
      .send({ tenantName: 'Acme Corp' })
      .expect(403);
  });

  it('Super Admin dapat membuat tenant baru', async () => {
    const res = await request(app.getHttpServer())
      .post('/tenants')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ tenantName: 'Acme Corp' })
      .expect(201);

    expect(res.body.tenantName).toBe('Acme Corp');
    expect(res.body.billingStatus).toBe('active');
  });

  it('Super Admin dapat menonaktifkan lalu mengaktifkan kembali tenant', async () => {
    const created = await request(app.getHttpServer())
      .post('/tenants')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ tenantName: 'Beta LLC' })
      .expect(201);

    const deactivated = await request(app.getHttpServer())
      .patch(`/tenants/${created.body.id}/deactivate`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);
    expect(deactivated.body.billingStatus).toBe('suspended');
    expect(deactivated.body.deactivatedAt).not.toBeNull();

    const reactivated = await request(app.getHttpServer())
      .patch(`/tenants/${created.body.id}/reactivate`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);
    expect(reactivated.body.billingStatus).toBe('active');
  });

  it('menolak hapus tenant yang masih punya domain terdaftar (409)', async () => {
    const tenant = await prisma.tenant.create({ data: { tenantName: 'Gamma Inc' } });
    await prisma.domain.create({
      data: {
        tenantId: tenant.id,
        domainName: 'gamma-inc.test',
        verificationToken: 'x',
      },
    });

    await request(app.getHttpServer())
      .delete(`/tenants/${tenant.id}`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(409);
  });

  it('menghapus tenant tanpa domain (200)', async () => {
    const tenant = await prisma.tenant.create({ data: { tenantName: 'Delta Ltd' } });

    await request(app.getHttpServer())
      .delete(`/tenants/${tenant.id}`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .expect(200);

    await expect(prisma.tenant.findUnique({ where: { id: tenant.id } })).resolves.toBeNull();
  });
});
