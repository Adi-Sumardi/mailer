import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Tenant internal existence check (e2e) — internal API key guard', () => {
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
    await prisma.domain.deleteMany();
    await prisma.tenant.deleteMany();
    await app.close();
  });

  beforeEach(async () => {
    await prisma.domain.deleteMany();
    await prisma.tenant.deleteMany();
  });

  it('menolak tanpa internal API key (401)', async () => {
    await request(app.getHttpServer()).get('/internal/tenants/whatever/exists').expect(401);
  });

  it('mengembalikan exists=true untuk tenant yang ada', async () => {
    const tenant = await prisma.tenant.create({ data: { tenantName: 'Ada' } });

    const res = await request(app.getHttpServer())
      .get(`/internal/tenants/${tenant.id}/exists`)
      .set('X-Internal-Api-Key', process.env.INTERNAL_API_KEY as string)
      .expect(200);

    expect(res.body.exists).toBe(true);
  });

  it('mengembalikan exists=false untuk tenant yang tidak ada', async () => {
    const res = await request(app.getHttpServer())
      .get('/internal/tenants/00000000-0000-0000-0000-000000000000/exists')
      .set('X-Internal-Api-Key', process.env.INTERNAL_API_KEY as string)
      .expect(200);

    expect(res.body.exists).toBe(false);
  });
});
