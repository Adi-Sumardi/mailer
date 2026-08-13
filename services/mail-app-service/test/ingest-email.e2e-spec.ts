import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { MailboxService } from '../src/mailbox/mailbox.service';

// Email masuk dari dunia luar: Postfix mem-pipe ke skrip sendago-ingest yang memanggil
// endpoint ini. Sebelum fitur ini ada, Postfix menolak email ke domain tenant sama sekali
// ("Relay access denied") — MX menunjuk ke server kita tapi domainnya tidak dikenal.
describe('POST /emails/ingest (e2e) — email masuk dari luar', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mailboxService: MailboxService;
  let recipient: { id: string; emailAddress: string };

  const INTERNAL_KEY = process.env.INTERNAL_API_KEY as string;

  function rawEmail(opts: { from: string; to: string; subject: string; body: string }) {
    return Buffer.from(
      [
        `From: Pengirim Luar <${opts.from}>`,
        `To: <${opts.to}>`,
        `Subject: ${opts.subject}`,
        'Date: Wed, 13 Aug 2026 07:00:00 +0700',
        'Content-Type: text/plain; charset=utf-8',
        '',
        opts.body,
        '',
      ].join('\r\n'),
      'utf8',
    );
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    prisma = app.get(PrismaService);
    mailboxService = app.get(MailboxService);
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
    recipient = await mailboxService.create({
      userId: 'user-inbound',
      emailAddress: 'sendmail@yapinet.test',
    });
  });

  it('menolak tanpa internal API key (401)', async () => {
    await request(app.getHttpServer())
      .post('/emails/ingest')
      .send({ recipient: recipient.emailAddress, rawBase64: rawEmail({
        from: 'luar@gmail.test', to: recipient.emailAddress, subject: 'Hai', body: 'isi',
      }).toString('base64') })
      .expect(401);
  });

  it('menyimpan email masuk ke folder Inbox penerima', async () => {
    const raw = rawEmail({
      from: 'klien@gmail.test',
      to: recipient.emailAddress,
      subject: 'Pertanyaan invoice',
      body: 'Halo, saya mau tanya soal invoice bulan ini.',
    });

    const res = await request(app.getHttpServer())
      .post('/emails/ingest')
      .set('X-Internal-Api-Key', INTERNAL_KEY)
      .send({ recipient: recipient.emailAddress, rawBase64: raw.toString('base64') })
      .expect(201);

    const email = await prisma.email.findUnique({ where: { id: res.body.id } });
    expect(email).not.toBeNull();
    expect(email?.fromAddr).toBe('klien@gmail.test');
    expect(email?.subject).toBe('Pertanyaan invoice');
    expect(email?.body).toContain('tanya soal invoice');
    expect(email?.isRead).toBe(false);

    const inbox = await mailboxService.getFolderByType(recipient.id, 'inbox');
    expect(email?.folderId).toBe(inbox.id);
    expect(email?.mailboxId).toBe(recipient.id);
  });

  it('email masuk langsung muncul lewat API folder Inbox (terlihat user di webmail)', async () => {
    const raw = rawEmail({
      from: 'klien@gmail.test', to: recipient.emailAddress, subject: 'Masuk', body: 'halo',
    });
    await request(app.getHttpServer())
      .post('/emails/ingest')
      .set('X-Internal-Api-Key', INTERNAL_KEY)
      .send({ recipient: recipient.emailAddress, rawBase64: raw.toString('base64') })
      .expect(201);

    const inbox = await mailboxService.getFolderByType(recipient.id, 'inbox');
    const listed = await prisma.email.findMany({ where: { folderId: inbox.id } });
    expect(listed).toHaveLength(1);
    expect(listed[0].subject).toBe('Masuk');
  });

  it('menyimpan lampiran email masuk sebagai file sungguhan di disk', async () => {
    const pdf = Buffer.from('%PDF-1.4\n%LAMPIRAN-MASUK\n%%EOF\n', 'utf8');
    const raw = Buffer.from(
      [
        'From: <klien@gmail.test>',
        `To: <${recipient.emailAddress}>`,
        'Subject: Invoice terlampir',
        'Content-Type: multipart/mixed; boundary="BATAS"',
        '',
        '--BATAS',
        'Content-Type: text/plain; charset=utf-8',
        '',
        'Terlampir invoice.',
        '',
        '--BATAS',
        'Content-Type: application/pdf; name="tagihan.pdf"',
        'Content-Disposition: attachment; filename="tagihan.pdf"',
        'Content-Transfer-Encoding: base64',
        '',
        pdf.toString('base64'),
        '',
        '--BATAS--',
        '',
      ].join('\r\n'),
      'utf8',
    );

    const res = await request(app.getHttpServer())
      .post('/emails/ingest')
      .set('X-Internal-Api-Key', INTERNAL_KEY)
      .send({ recipient: recipient.emailAddress, rawBase64: raw.toString('base64') })
      .expect(201);

    const stored = await prisma.attachment.findMany({ where: { emailId: res.body.id } });
    expect(stored).toHaveLength(1);
    expect(stored[0].filename).toBe('tagihan.pdf');

    const absolutePath = path.join(process.env.ATTACHMENTS_DIR as string, stored[0].storagePath);
    expect(fs.readFileSync(absolutePath).equals(pdf)).toBe(true);
  });

  // Skrip sendago-ingest menerjemahkan 404 jadi exit 67 (bounce permanen) — pengirim dapat
  // kabar, alih-alih email diterima lalu hilang tanpa jejak.
  it('mengembalikan 404 kalau alamat penerima tidak dikenal', async () => {
    const raw = rawEmail({
      from: 'klien@gmail.test', to: 'tidakada@yapinet.test', subject: 'Hai', body: 'isi',
    });

    await request(app.getHttpServer())
      .post('/emails/ingest')
      .set('X-Internal-Api-Key', INTERNAL_KEY)
      .send({ recipient: 'tidakada@yapinet.test', rawBase64: raw.toString('base64') })
      .expect(404);
  });
});
