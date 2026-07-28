import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { signTestToken } from './jwt.helper';

describe('Automation Rule (e2e) — FR-19 s/d FR-21', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const userAId = 'user-a';
  const userBId = 'user-b';
  const tokenA = signTestToken({ sub: userAId, role: 'end_user', tenantId: null, mailboxId: null });
  const tokenB = signTestToken({ sub: userBId, role: 'end_user', tenantId: null, mailboxId: null });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.automationRule.deleteMany();
    await app.close();
  });

  beforeEach(async () => {
    await prisma.automationRule.deleteMany();
  });

  it('rejects request tanpa token (401)', async () => {
    await request(app.getHttpServer())
      .post('/automation-rules')
      .send({ name: 'Vendor', conditionField: 'sender', conditionValue: '@vendor.com', actionType: 'move_folder' })
      .expect(401);
  });

  it('FR-19: buat aturan kondisi + aksi', async () => {
    const res = await request(app.getHttpServer())
      .post('/automation-rules')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Pindahkan email vendor',
        conditionField: 'sender',
        conditionOperator: 'contains',
        conditionValue: '@vendor.com',
        actionType: 'move_folder',
        actionValue: 'Vendor',
      })
      .expect(201);

    expect(res.body.name).toBe('Pindahkan email vendor');
    expect(res.body.isActive).toBe(true);
  });

  it('FR-21: nonaktifkan aturan tanpa menghapus, lalu aktifkan lagi', async () => {
    const created = await request(app.getHttpServer())
      .post('/automation-rules')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Auto-reply libur',
        conditionField: 'subject',
        conditionValue: 'urgent',
        actionType: 'auto_reply',
        actionValue: 'Saya sedang cuti',
      })
      .expect(201);

    const deactivated = await request(app.getHttpServer())
      .patch(`/automation-rules/${created.body.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ isActive: false })
      .expect(200);
    expect(deactivated.body.isActive).toBe(false);

    const stillExists = await request(app.getHttpServer())
      .get(`/automation-rules/${created.body.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(stillExists.body.id).toBe(created.body.id);

    const reactivated = await request(app.getHttpServer())
      .patch(`/automation-rules/${created.body.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ isActive: true })
      .expect(200);
    expect(reactivated.body.isActive).toBe(true);
  });

  it('FR-20: execute mencocokkan email masuk terhadap aturan aktif, mengabaikan yang nonaktif', async () => {
    await request(app.getHttpServer())
      .post('/automation-rules')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Vendor rule',
        conditionField: 'sender',
        conditionValue: '@vendor.com',
        actionType: 'move_folder',
        actionValue: 'Vendor',
      })
      .expect(201);

    const inactive = await request(app.getHttpServer())
      .post('/automation-rules')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Rule nonaktif',
        conditionField: 'sender',
        conditionValue: '@vendor.com',
        actionType: 'delete',
      })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/automation-rules/${inactive.body.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ isActive: false })
      .expect(200);

    const result = await request(app.getHttpServer())
      .post('/automation-rules/execute')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ fromAddr: 'billing@vendor.com', subject: 'Invoice', body: 'isi invoice' })
      .expect(201);

    expect(result.body.matchedCount).toBe(1);
    expect(result.body.actions[0].actionType).toBe('move_folder');
    expect(result.body.actions[0].actionValue).toBe('Vendor');
  });

  it('FR-20: execute tidak mencocokkan email yang tidak sesuai kondisi', async () => {
    await request(app.getHttpServer())
      .post('/automation-rules')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Vendor rule',
        conditionField: 'sender',
        conditionValue: '@vendor.com',
        actionType: 'move_folder',
        actionValue: 'Vendor',
      })
      .expect(201);

    const result = await request(app.getHttpServer())
      .post('/automation-rules/execute')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ fromAddr: 'teman@gmail.com', subject: 'Halo', body: 'apa kabar' })
      .expect(201);

    expect(result.body.matchedCount).toBe(0);
  });

  it('mengisolasi aturan antar user (404 untuk user lain, execute hanya evaluasi milik sendiri)', async () => {
    await request(app.getHttpServer())
      .post('/automation-rules')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Rule milik A',
        conditionField: 'sender',
        conditionValue: '@vendor.com',
        actionType: 'delete',
      })
      .expect(201);

    const resultForB = await request(app.getHttpServer())
      .post('/automation-rules/execute')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ fromAddr: 'billing@vendor.com', subject: 'Invoice', body: 'isi' })
      .expect(201);
    expect(resultForB.body.matchedCount).toBe(0);

    const listForB = await request(app.getHttpServer())
      .get('/automation-rules')
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(listForB.body).toHaveLength(0);
  });
});
