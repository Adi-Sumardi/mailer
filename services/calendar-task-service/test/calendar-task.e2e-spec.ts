import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { signTestToken } from './jwt.helper';

describe('Calendar & Task (e2e) — FR-12 s/d FR-18', () => {
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
    await prisma.calendarEvent.deleteMany();
    await prisma.task.deleteMany();
    await app.close();
  });

  beforeEach(async () => {
    await prisma.calendarEvent.deleteMany();
    await prisma.task.deleteMany();
  });

  describe('Calendar Event', () => {
    it('rejects request tanpa token (401)', async () => {
      await request(app.getHttpServer())
        .post('/calendar-events')
        .send({ title: 'Meeting', startTime: '2026-08-01T09:00:00Z', endTime: '2026-08-01T10:00:00Z' })
        .expect(401);
    });

    it('FR-12: CRUD acara kalender', async () => {
      const created = await request(app.getHttpServer())
        .post('/calendar-events')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          title: 'Sprint Planning',
          startTime: '2026-08-01T09:00:00Z',
          endTime: '2026-08-01T10:00:00Z',
          location: 'Ruang Rapat A',
        })
        .expect(201);
      expect(created.body.title).toBe('Sprint Planning');

      const updated = await request(app.getHttpServer())
        .patch(`/calendar-events/${created.body.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ title: 'Sprint Planning (Updated)' })
        .expect(200);
      expect(updated.body.title).toBe('Sprint Planning (Updated)');

      await request(app.getHttpServer())
        .delete(`/calendar-events/${created.body.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/calendar-events/${created.body.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(404);
    });

    it('FR-13: menyimpan recurrenceRule apa adanya', async () => {
      const created = await request(app.getHttpServer())
        .post('/calendar-events')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          title: 'Standup Harian',
          startTime: '2026-08-01T09:00:00Z',
          endTime: '2026-08-01T09:15:00Z',
          recurrenceRule: 'FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR',
        })
        .expect(201);

      expect(created.body.recurrenceRule).toBe('FREQ=DAILY;BYDAY=MO,TU,WE,TH,FR');
    });

    it('FR-15: filter dateFrom/dateTo untuk tampilan kalender', async () => {
      await request(app.getHttpServer())
        .post('/calendar-events')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ title: 'Januari', startTime: '2026-01-01T09:00:00Z', endTime: '2026-01-01T10:00:00Z' })
        .expect(201);
      await request(app.getHttpServer())
        .post('/calendar-events')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ title: 'Agustus', startTime: '2026-08-01T09:00:00Z', endTime: '2026-08-01T10:00:00Z' })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/calendar-events')
        .query({ dateFrom: '2026-07-01T00:00:00Z', dateTo: '2026-08-31T23:59:59Z' })
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].title).toBe('Agustus');
    });

    it('mengisolasi event antar user (404 untuk user lain)', async () => {
      const created = await request(app.getHttpServer())
        .post('/calendar-events')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ title: 'Rahasia A', startTime: '2026-08-01T09:00:00Z', endTime: '2026-08-01T10:00:00Z' })
        .expect(201);

      await request(app.getHttpServer())
        .get(`/calendar-events/${created.body.id}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(404);
    });
  });

  describe('Task', () => {
    it('FR-16: buat tugas dengan judul, deadline, prioritas', async () => {
      const res = await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ title: 'Review PR', dueDate: '2026-08-05T17:00:00Z', priority: 'high' })
        .expect(201);

      expect(res.body.title).toBe('Review PR');
      expect(res.body.priority).toBe('high');
      expect(res.body.status).toBe('todo');
    });

    it('FR-17: update status tugas', async () => {
      const created = await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ title: 'Deploy ke staging' })
        .expect(201);

      const updated = await request(app.getHttpServer())
        .patch(`/tasks/${created.body.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ status: 'in_progress' })
        .expect(200);

      expect(updated.body.status).toBe('in_progress');
    });

    it('FR-18: convert email jadi tugas', async () => {
      const res = await request(app.getHttpServer())
        .post('/tasks/from-email')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ emailId: 'email-123', title: 'Follow up dari email vendor' })
        .expect(201);

      expect(res.body.linkedEmailId).toBe('email-123');
      expect(res.body.title).toBe('Follow up dari email vendor');
    });

    it('filter berdasarkan status', async () => {
      await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ title: 'Task 1' })
        .expect(201);
      const t2 = await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ title: 'Task 2' })
        .expect(201);
      await request(app.getHttpServer())
        .patch(`/tasks/${t2.body.id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ status: 'done' })
        .expect(200);

      const doneTasks = await request(app.getHttpServer())
        .get('/tasks')
        .query({ status: 'done' })
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(200);

      expect(doneTasks.body).toHaveLength(1);
      expect(doneTasks.body[0].title).toBe('Task 2');
    });

    it('mengisolasi task antar user (404 untuk user lain)', async () => {
      const created = await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ title: 'Rahasia A' })
        .expect(201);

      await request(app.getHttpServer())
        .delete(`/tasks/${created.body.id}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .expect(404);
    });
  });
});
