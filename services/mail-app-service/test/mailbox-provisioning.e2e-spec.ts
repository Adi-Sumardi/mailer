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
});
