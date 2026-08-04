import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { promises as dns } from 'dns';
import * as nodemailer from 'nodemailer';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { MailboxService } from '../src/mailbox/mailbox.service';
import { EmailService } from '../src/email/email.service';
import { signTestToken } from './jwt.helper';

jest.mock('dns', () => ({
  promises: { resolveMx: jest.fn() },
}));
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(),
}));

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('Email Template (e2e) — branding kustom per mailbox', () => {
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
    await prisma.emailTemplate.deleteMany();
    await prisma.attachment.deleteMany();
    await prisma.email.deleteMany();
    await prisma.folder.deleteMany();
    await prisma.mailbox.deleteMany();
    await app.close();
  });

  beforeEach(async () => {
    await prisma.emailTemplate.deleteMany();
    await prisma.attachment.deleteMany();
    await prisma.email.deleteMany();
    await prisma.folder.deleteMany();
    await prisma.mailbox.deleteMany();
    mailboxA = await mailboxService.create({ userId: 'user-tpl-a', emailAddress: 'tpl-a@sendago.test' });
    mailboxB = await mailboxService.create({ userId: 'user-tpl-b', emailAddress: 'tpl-b@sendago.test' });
    tokenA = signTestToken({ sub: 'user-tpl-a', mailboxId: mailboxA.id });
    tokenB = signTestToken({ sub: 'user-tpl-b', mailboxId: mailboxB.id });
    (dns.resolveMx as jest.Mock).mockReset();
    (nodemailer.createTransport as jest.Mock).mockReset();
  });

  it('GET template mailbox baru mengembalikan null (belum ada konfigurasi)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/mailboxes/${mailboxA.id}/template`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(res.body).toBeNull();
  });

  it('menolak akses template mailbox milik orang lain (403)', async () => {
    await request(app.getHttpServer())
      .get(`/mailboxes/${mailboxB.id}/template`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(403);

    await request(app.getHttpServer())
      .put(`/mailboxes/${mailboxB.id}/template`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Hack' })
      .expect(403);
  });

  it('PUT upsert menyimpan judul/subjudul/warna/footer', async () => {
    const res = await request(app.getHttpServer())
      .put(`/mailboxes/${mailboxA.id}/template`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'SIMONAS',
        subtitle: 'Digital Asrama YAPI',
        logoPosition: 'center',
        primaryColor: '#2563eb',
        accentColor: '#1e3a8a',
        footerText: 'Email otomatis dari SIMONAS',
      })
      .expect(200);

    expect(res.body.title).toBe('SIMONAS');
    expect(res.body.logoPosition).toBe('center');
    expect(res.body.primaryColor).toBe('#2563eb');

    const fetched = await request(app.getHttpServer())
      .get(`/mailboxes/${mailboxA.id}/template`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(fetched.body.subtitle).toBe('Digital Asrama YAPI');
  });

  it('menolak warna yang bukan hex color valid (400)', async () => {
    await request(app.getHttpServer())
      .put(`/mailboxes/${mailboxA.id}/template`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ primaryColor: 'not-a-color' })
      .expect(400);
  });

  it('upload logo, GET logo mengembalikan bytes yang sama, lalu DELETE menghapusnya', async () => {
    const fakeLogo = Buffer.from('fake-png-bytes-for-testing');

    const uploaded = await request(app.getHttpServer())
      .post(`/mailboxes/${mailboxA.id}/template/logo`)
      .set('Authorization', `Bearer ${tokenA}`)
      .attach('logo', fakeLogo, { filename: 'logo.png', contentType: 'image/png' })
      .expect(201);
    expect(uploaded.body.logoFilename).toBe(`${mailboxA.id}.png`);

    const fetched = await request(app.getHttpServer())
      .get(`/mailboxes/${mailboxA.id}/template/logo`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);
    expect(Buffer.compare(fetched.body, fakeLogo)).toBe(0);

    await request(app.getHttpServer())
      .delete(`/mailboxes/${mailboxA.id}/template/logo`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/mailboxes/${mailboxA.id}/template/logo`)
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(404);
  });

  it('menolak upload file dengan tipe tidak didukung (400)', async () => {
    await request(app.getHttpServer())
      .post(`/mailboxes/${mailboxA.id}/template/logo`)
      .set('Authorization', `Bearer ${tokenA}`)
      .attach('logo', Buffer.from('not an image'), { filename: 'file.txt', contentType: 'text/plain' })
      .expect(400);
  });

  it('email terkirim dari mailbox dengan template kustom memakai judul/subjudul/logo custom, bukan default', async () => {
    await request(app.getHttpServer())
      .put(`/mailboxes/${mailboxA.id}/template`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'SIMONAS', subtitle: 'Digital Asrama YAPI', footerText: 'Email dari SIMONAS' })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/mailboxes/${mailboxA.id}/template/logo`)
      .set('Authorization', `Bearer ${tokenA}`)
      .attach('logo', Buffer.from('fake-logo-bytes'), { filename: 'logo.png', contentType: 'image/png' })
      .expect(201);

    (dns.resolveMx as jest.Mock).mockResolvedValueOnce([{ exchange: 'mx.gmail-test.invalid', priority: 10 }]);
    const sendMail = jest.fn().mockResolvedValueOnce({});
    (nodemailer.createTransport as jest.Mock).mockReturnValueOnce({ sendMail });

    await request(app.getHttpServer())
      .post('/emails')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ toAddr: 'orang-luar@gmail.com', subject: 'Test branding', body: 'halo' })
      .expect(201);

    await sleep(2200);
    await emailService.dispatchDueEmails();

    expect(sendMail).toHaveBeenCalled();
    const sentHtml = sendMail.mock.calls[0][0].html as string;
    expect(sentHtml).toContain('SIMONAS');
    expect(sentHtml).toContain('Digital Asrama YAPI');
    expect(sentHtml).toContain('Email dari SIMONAS');
    expect(sentHtml).not.toContain('Dikirim lewat SendagoMail');

    const attachments = sendMail.mock.calls[0][0].attachments as Array<{ filename: string }>;
    expect(attachments.some((a) => a.filename === `${mailboxA.id}.png`)).toBe(true);
  });

  it('email terkirim dari mailbox TANPA template kustom tetap pakai branding default (tidak berubah)', async () => {
    (dns.resolveMx as jest.Mock).mockResolvedValueOnce([{ exchange: 'mx.gmail-test.invalid', priority: 10 }]);
    const sendMail = jest.fn().mockResolvedValueOnce({});
    (nodemailer.createTransport as jest.Mock).mockReturnValueOnce({ sendMail });

    await request(app.getHttpServer())
      .post('/emails')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ toAddr: 'orang-luar@gmail.com', subject: 'Test default', body: 'halo' })
      .expect(201);

    await sleep(2200);
    await emailService.dispatchDueEmails();

    const sentHtml = sendMail.mock.calls[0][0].html as string;
    expect(sentHtml).toContain('Dikirim lewat SendagoMail — produk adilabs');
  });
});
