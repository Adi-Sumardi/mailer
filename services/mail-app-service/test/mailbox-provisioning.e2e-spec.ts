import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Mailbox provisioning (e2e) — internal API key guard', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.folder.deleteMany();
    await prisma.mailbox.deleteMany();
    await app.close();
  });

  beforeEach(async () => {
    await prisma.folder.deleteMany();
    await prisma.mailbox.deleteMany();
  });

  it('menolak POST /mailboxes tanpa internal API key (401)', async () => {
    await request(app.getHttpServer())
      .post('/mailboxes')
      .send({ userId: 'user-x', emailAddress: 'x@sendago.test' })
      .expect(401);
  });

  it('menolak POST /mailboxes dengan internal API key salah (401)', async () => {
    await request(app.getHttpServer())
      .post('/mailboxes')
      .set('X-Internal-Api-Key', 'salah')
      .send({ userId: 'user-x', emailAddress: 'x@sendago.test' })
      .expect(401);
  });

  it('mengizinkan POST /mailboxes dengan internal API key benar', async () => {
    const res = await request(app.getHttpServer())
      .post('/mailboxes')
      .set('X-Internal-Api-Key', process.env.INTERNAL_API_KEY as string)
      .send({ userId: 'user-x', emailAddress: 'x@sendago.test' })
      .expect(201);

    expect(res.body.emailAddress).toBe('x@sendago.test');
  });

  it('idempotent: retry POST /mailboxes dengan userId yang sama mengembalikan mailbox yang sama, bukan 409', async () => {
    const first = await request(app.getHttpServer())
      .post('/mailboxes')
      .set('X-Internal-Api-Key', process.env.INTERNAL_API_KEY as string)
      .send({ userId: 'user-retry', emailAddress: 'retry@sendago.test' })
      .expect(201);

    const retry = await request(app.getHttpServer())
      .post('/mailboxes')
      .set('X-Internal-Api-Key', process.env.INTERNAL_API_KEY as string)
      .send({ userId: 'user-retry', emailAddress: 'retry@sendago.test' })
      .expect(201);

    expect(retry.body.id).toBe(first.body.id);

    const mailboxCount = await prisma.mailbox.count({ where: { userId: 'user-retry' } });
    expect(mailboxCount).toBe(1);
  });

  it('tetap menolak (409) kalau emailAddress sudah dipakai userId lain', async () => {
    await request(app.getHttpServer())
      .post('/mailboxes')
      .set('X-Internal-Api-Key', process.env.INTERNAL_API_KEY as string)
      .send({ userId: 'user-a', emailAddress: 'shared@sendago.test' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/mailboxes')
      .set('X-Internal-Api-Key', process.env.INTERNAL_API_KEY as string)
      .send({ userId: 'user-b', emailAddress: 'shared@sendago.test' })
      .expect(409);
  });
});
