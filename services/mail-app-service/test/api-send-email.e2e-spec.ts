import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { MailboxService } from '../src/mailbox/mailbox.service';
import { AuthServiceClientService } from '../src/auth-service-client/auth-service-client.service';

describe('POST /emails/api-send (e2e) — kirim email via member_id/secret', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mailboxService: MailboxService;
  let validateApiCredential: jest.Mock;

  let senderMailbox: { id: string; emailAddress: string };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AuthServiceClientService)
      .useValue({ validateApiCredential: jest.fn() })
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    mailboxService = app.get(MailboxService);
    validateApiCredential = app.get(AuthServiceClientService).validateApiCredential as jest.Mock;
  });

  afterAll(async () => {
    await prisma.attachment.deleteMany();
    await prisma.email.deleteMany();
    await prisma.folder.deleteMany();
    await prisma.mailbox.deleteMany();
    await app.close();
  });

  beforeEach(async () => {
    await prisma.attachment.deleteMany();
    await prisma.email.deleteMany();
    await prisma.folder.deleteMany();
    await prisma.mailbox.deleteMany();
    senderMailbox = await mailboxService.create({
      userId: 'user-api-sender',
      emailAddress: 'api-sender@sendago.test',
    });
    validateApiCredential.mockReset();
  });

  it('menolak kalau memberId/secret tidak valid', async () => {
    validateApiCredential.mockResolvedValue({ valid: false, reason: 'Member ID atau secret tidak valid' });

    await request(app.getHttpServer())
      .post('/emails/api-send')
      .send({ memberId: 'mbr_salah', secret: 'salah', toAddr: 'x@test.com', subject: 'Hi', body: 'test' })
      .expect(401);
  });

  it('mengirim email lewat mailboxId yang dikembalikan auth-service saat credential valid', async () => {
    validateApiCredential.mockResolvedValue({
      valid: true,
      tenantId: 'tenant-a',
      mailboxId: senderMailbox.id,
      environment: 'sandbox',
      remainingQuota: 49,
    });

    const res = await request(app.getHttpServer())
      .post('/emails/api-send')
      .send({
        memberId: 'mbr_valid',
        secret: 'secret-valid',
        toAddr: 'internal-recipient@sendago.test',
        subject: 'Test via API credential',
        body: 'Dikirim lewat integrasi API',
      })
      .expect(201);

    expect(res.body.fromAddr).toBe(senderMailbox.emailAddress);
    expect(res.body.toAddr).toBe('internal-recipient@sendago.test');
    expect(res.body.remainingQuota).toBe(49);
    expect(res.body.environment).toBe('sandbox');
    expect(validateApiCredential).toHaveBeenCalledWith('mbr_valid', 'secret-valid');
  });

  it('menolak kalau kuota harian sudah habis', async () => {
    validateApiCredential.mockResolvedValue({ valid: false, reason: "Kuota harian (50) untuk environment 'sandbox' sudah habis" });

    const res = await request(app.getHttpServer())
      .post('/emails/api-send')
      .send({ memberId: 'mbr_valid', secret: 'secret-valid', toAddr: 'x@test.com', subject: 'Hi', body: 'test' })
      .expect(401);

    expect(res.body.message).toContain('Kuota harian');
  });
});
