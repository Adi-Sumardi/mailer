import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { MailboxService } from '../src/mailbox/mailbox.service';
import { EmailService } from '../src/email/email.service';
import { signTestToken } from './jwt.helper';

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Mail app (e2e) — FR-06 s/d FR-11a', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mailboxService: MailboxService;
  let emailService: EmailService;

  let mailboxA: { id: string; emailAddress: string };
  let mailboxB: { id: string; emailAddress: string };
  let tokenA: string;
  let tokenB: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    mailboxService = app.get(MailboxService);
    emailService = app.get(EmailService);
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

    const a = await mailboxService.create({ userId: 'user-a', emailAddress: 'a@sendago.test' });
    const b = await mailboxService.create({ userId: 'user-b', emailAddress: 'b@sendago.test' });
    mailboxA = a;
    mailboxB = b;
    tokenA = signTestToken({ sub: 'user-a', mailboxId: a.id });
    tokenB = signTestToken({ sub: 'user-b', mailboxId: b.id });
  });

  it('rejects request tanpa token (401)', async () => {
    await request(app.getHttpServer())
      .post('/emails')
      .send({ toAddr: mailboxB.emailAddress, subject: 'Hi', body: 'test' })
      .expect(401);
  });

  it('FR-07: mailbox baru otomatis punya folder Inbox/Sent/Draft/Trash', async () => {
    const folders = await request(app.getHttpServer())
      .get('/folders')
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const types = folders.body.map((f: { folderType: string }) => f.folderType).sort();
    expect(types).toEqual(['draft', 'inbox', 'sent', 'trash']);
  });

  it('FR-06/FR-11a.1: compose ke penerima internal langsung terkirim ke Inbox penerima', async () => {
    const composed = await request(app.getHttpServer())
      .post('/emails')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ toAddr: mailboxB.emailAddress, subject: 'Halo', body: 'Selamat pagi' })
      .expect(201);

    expect(composed.body.sendStatus).toBe('sent');

    const recipientInbox = await mailboxService.getFolderByType(mailboxB.id, 'inbox');
    const inboxEmails = await request(app.getHttpServer())
      .get(`/emails/folder/${recipientInbox.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);

    expect(inboxEmails.body).toHaveLength(1);
    expect(inboxEmails.body[0].subject).toBe('Halo');
    expect(inboxEmails.body[0].isRead).toBe(false);
  });

  it('FR-11a.1: recall internal berhasil selama penerima belum membaca', async () => {
    const composed = await request(app.getHttpServer())
      .post('/emails')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ toAddr: mailboxB.emailAddress, subject: 'Rahasia', body: 'jangan dibaca' })
      .expect(201);

    const cancelled = await request(app.getHttpServer())
      .post(`/emails/${composed.body.id}/cancel`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(201);
    expect(cancelled.body.recalled).toBe(true);

    const recipientInbox = await mailboxService.getFolderByType(mailboxB.id, 'inbox');
    const inboxEmails = await request(app.getHttpServer())
      .get(`/emails/folder/${recipientInbox.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);
    expect(inboxEmails.body).toHaveLength(0);
  });

  it('FR-11a.1: recall internal ditolak kalau penerima sudah membaca (409)', async () => {
    const composed = await request(app.getHttpServer())
      .post('/emails')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ toAddr: mailboxB.emailAddress, subject: 'Rahasia 2', body: 'jangan dibaca 2' })
      .expect(201);

    const recipientCopy = await prisma.email.findFirstOrThrow({
      where: { mailboxId: mailboxB.id, subject: 'Rahasia 2' },
    });
    await request(app.getHttpServer())
      .patch(`/emails/${recipientCopy.id}/flags`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ isRead: true })
      .expect(200);

    await request(app.getHttpServer())
      .post(`/emails/${composed.body.id}/cancel`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(409);
  });

  it('FR-11a.2: compose ke eksternal berstatus queued dengan recallDeadlineAt', async () => {
    const composed = await request(app.getHttpServer())
      .post('/emails')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ toAddr: 'orang-luar@gmail.com', subject: 'Eksternal', body: 'halo dunia' })
      .expect(201);

    expect(composed.body.sendStatus).toBe('queued');
    expect(composed.body.recallDeadlineAt).not.toBeNull();
  });

  it('FR-11a.2: batalkan pengiriman eksternal berhasil selama masih dalam jendela waktu', async () => {
    const composed = await request(app.getHttpServer())
      .post('/emails')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ toAddr: 'orang-luar@gmail.com', subject: 'Batalkan Saya', body: 'oops' })
      .expect(201);

    const cancelled = await request(app.getHttpServer())
      .post(`/emails/${composed.body.id}/cancel`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(201);

    expect(cancelled.body.sendStatus).toBe('cancelled');
    expect(cancelled.body.recalled).toBe(true);
  });

  it('FR-11a.2: setelah jendela waktu lewat, status "sudah terkirim" dan tidak bisa dibatalkan (409)', async () => {
    const composed = await request(app.getHttpServer())
      .post('/emails')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ toAddr: 'orang-luar@gmail.com', subject: 'Terlambat', body: 'sudah kelewat' })
      .expect(201);

    // DEFAULT_RECALL_WINDOW_SECONDS=2 di test env — tunggu window habis.
    await sleep(2200);
    await emailService.dispatchDueEmails();

    await request(app.getHttpServer())
      .post(`/emails/${composed.body.id}/cancel`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(409);

    const finalState = await request(app.getHttpServer())
      .get(`/emails/${composed.body.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(finalState.body.sendStatus).toBe('sent');
  });

  it('FR-08: search berdasarkan subjek dan isi', async () => {
    await request(app.getHttpServer())
      .post('/emails')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ toAddr: mailboxB.emailAddress, subject: 'Laporan Bulanan', body: 'isi laporan' })
      .expect(201);
    await request(app.getHttpServer())
      .post('/emails')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ toAddr: mailboxB.emailAddress, subject: 'Undangan Rapat', body: 'agenda rapat' })
      .expect(201);

    const results = await request(app.getHttpServer())
      .get('/emails/search')
      .query({ q: 'laporan' })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    expect(results.body).toHaveLength(1);
    expect(results.body[0].subject).toBe('Laporan Bulanan');
  });

  it('FR-06: hapus email — soft delete ke Trash, hard delete kalau sudah di Trash', async () => {
    const composed = await request(app.getHttpServer())
      .post('/emails')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ toAddr: mailboxB.emailAddress, subject: 'Akan Dihapus', body: 'bye' })
      .expect(201);

    const trashFolder = await mailboxService.getFolderByType(mailboxA.id, 'trash');

    const softDeleted = await request(app.getHttpServer())
      .delete(`/emails/${composed.body.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(softDeleted.body.folderId).toBe(trashFolder.id);

    await request(app.getHttpServer())
      .delete(`/emails/${composed.body.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/emails/${composed.body.id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(404);
  });

  it('menolak mengakses email milik mailbox lain (404, bukan 403 — tidak membocorkan keberadaan)', async () => {
    const composed = await request(app.getHttpServer())
      .post('/emails')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ toAddr: mailboxB.emailAddress, subject: 'Punya A', body: 'rahasia A' })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/emails/${composed.body.id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(404);
  });
});
