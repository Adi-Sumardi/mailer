import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { MailAppClientService } from '../src/mail-app-client/mail-app-client.service';
import { DomainProvisioningClientService } from '../src/domain-provisioning-client/domain-provisioning-client.service';

describe('Auth (e2e) — BR-08', () => {
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
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  beforeEach(async () => {
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
  });

  it('super_admin dapat register tanpa tenantId', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'super@sendago.test', password: 'password123', role: 'super_admin' })
      .expect(201);

    expect(res.body.user.role).toBe('super_admin');
    expect(res.body.user.tenantId).toBeNull();
    expect(res.body.accessToken).toBeDefined();
  });

  it('menolak register tenant_admin tanpa tenantId (400)', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'tadmin@sendago.test', password: 'password123', role: 'tenant_admin' })
      .expect(400);
  });

  it('tenant_admin dapat register dengan tenantId', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'tadmin@sendago.test',
        password: 'password123',
        role: 'tenant_admin',
        tenantId: 'tenant-abc',
      })
      .expect(201);

    expect(res.body.user.tenantId).toBe('tenant-abc');
  });

  it('menolak email duplikat (409)', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'dup@sendago.test', password: 'password123', role: 'super_admin' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'dup@sendago.test', password: 'password123', role: 'super_admin' })
      .expect(409);
  });

  it('end_user register tetap berhasil walau mail-app-service tidak terjangkau (mailboxId null)', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'enduser@sendago.test',
        password: 'password123',
        role: 'end_user',
        tenantId: 'tenant-abc',
      })
      .expect(201);

    expect(res.body.user.mailboxId).toBeNull();
  });

  it('end_user register berhasil provisioning mailbox saat mail-app-service tersedia', async () => {
    const mailAppClient = app.get(MailAppClientService);
    const spy = jest.spyOn(mailAppClient, 'provisionMailbox').mockResolvedValueOnce('mailbox-xyz');

    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'enduser2@sendago.test',
        password: 'password123',
        role: 'end_user',
        tenantId: 'tenant-abc',
      })
      .expect(201);

    expect(res.body.user.mailboxId).toBe('mailbox-xyz');
    spy.mockRestore();
  });

  it('login berhasil dengan kredensial benar, berisi payload role+tenantId+mailboxId', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'login@sendago.test', password: 'password123', role: 'super_admin' })
      .expect(201);

    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'login@sendago.test', password: 'password123' })
      .expect(201);

    expect(res.body.accessToken).toBeDefined();

    const decoded = JSON.parse(
      Buffer.from(res.body.accessToken.split('.')[1], 'base64').toString(),
    );
    expect(decoded.role).toBe('super_admin');
    expect(decoded.tenantId).toBeNull();
  });

  it('login ditolak untuk password salah (401)', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'wrongpass@sendago.test', password: 'password123', role: 'super_admin' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'wrongpass@sendago.test', password: 'salahbanget' })
      .expect(401);
  });

  it('GET /auth/me butuh token (401 tanpa token) dan mengembalikan profil dengan token valid', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);

    const registered = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'me@sendago.test', password: 'password123', role: 'super_admin' })
      .expect(201);

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${registered.body.accessToken}`)
      .expect(200);

    expect(me.body.email).toBe('me@sendago.test');
  });

  it('password disimpan ter-hash, tidak pernah dikembalikan mentah', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'hash@sendago.test', password: 'password123', role: 'super_admin' })
      .expect(201);

    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.user.password).toBeUndefined();

    const stored = await prisma.user.findUniqueOrThrow({ where: { email: 'hash@sendago.test' } });
    expect(stored.passwordHash).not.toBe('password123');
  });

  it('register mengembalikan refreshToken, dan login juga mengembalikan refreshToken baru', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'rt@sendago.test', password: 'password123', role: 'super_admin' })
      .expect(201);
    expect(res.body.refreshToken).toBeDefined();

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'rt@sendago.test', password: 'password123' })
      .expect(201);
    expect(login.body.refreshToken).toBeDefined();
    expect(login.body.refreshToken).not.toBe(res.body.refreshToken);
  });

  it('POST /auth/refresh menerbitkan accessToken baru dan merotasi refreshToken', async () => {
    const registered = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'refresh@sendago.test', password: 'password123', role: 'super_admin' })
      .expect(201);

    const refreshed = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: registered.body.refreshToken })
      .expect(201);

    expect(refreshed.body.accessToken).toBeDefined();
    expect(refreshed.body.refreshToken).toBeDefined();
    expect(refreshed.body.refreshToken).not.toBe(registered.body.refreshToken);
  });

  it('refreshToken lama tidak bisa dipakai ulang setelah dirotasi (401)', async () => {
    const registered = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'rotate@sendago.test', password: 'password123', role: 'super_admin' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: registered.body.refreshToken })
      .expect(201);

    // Pakai refreshToken yang sama lagi — sudah revoked oleh rotasi di atas.
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: registered.body.refreshToken })
      .expect(401);
  });

  it('menolak refreshToken yang tidak dikenal (401)', async () => {
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: 'tidak-pernah-ada' })
      .expect(401);
  });

  it('POST /auth/logout merevoke refreshToken sehingga tidak bisa dipakai lagi', async () => {
    const registered = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'logout@sendago.test', password: 'password123', role: 'super_admin' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/logout')
      .send({ refreshToken: registered.body.refreshToken })
      .expect(201);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: registered.body.refreshToken })
      .expect(401);
  });

  it('BR-08: menolak register dengan tenantId yang terkonfirmasi tidak ada di domain-provisioning (400)', async () => {
    const domainClient = app.get(DomainProvisioningClientService);
    const spy = jest.spyOn(domainClient, 'tenantExists').mockResolvedValueOnce(false);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'tenant-invalid@sendago.test',
        password: 'password123',
        role: 'tenant_admin',
        tenantId: 'tenant-tidak-ada',
      })
      .expect(400);

    spy.mockRestore();
  });

  it('BR-08: mengizinkan register dengan tenantId yang terkonfirmasi ada di domain-provisioning', async () => {
    const domainClient = app.get(DomainProvisioningClientService);
    const spy = jest.spyOn(domainClient, 'tenantExists').mockResolvedValueOnce(true);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'tenant-valid@sendago.test',
        password: 'password123',
        role: 'tenant_admin',
        tenantId: 'tenant-ada',
      })
      .expect(201);

    spy.mockRestore();
  });

  it('Google 2FA Flow: generate, enable, login dengan 2FA, dan disable', async () => {
    const { authenticator } = require('otplib');

    // 1. Register & Login awal
    const reg = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: '2fa@sendago.test', password: 'password123', role: 'super_admin' })
      .expect(201);

    const token = reg.body.accessToken;

    // 2. Generate 2FA secret & QR
    const genRes = await request(app.getHttpServer())
      .post('/auth/2fa/generate')
      .set('Authorization', `Bearer ${token}`)
      .expect(201);

    expect(genRes.body.secret).toBeDefined();
    expect(genRes.body.qrCodeUrl).toContain('data:image/png');

    const secret = genRes.body.secret;
    const validCode = authenticator.generate(secret);

    // 3. Enable 2FA dengan kode valid
    await request(app.getHttpServer())
      .post('/auth/2fa/enable')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: validCode })
      .expect(201);

    // 4. Try login -> Menerima require2FA: true & mfaToken
    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: '2fa@sendago.test', password: 'password123' })
      .expect(201);

    expect(loginRes.body.require2FA).toBe(true);
    expect(loginRes.body.mfaToken).toBeDefined();

    // 5. Complete login2FA dengan mfaToken + kode TOTP baru
    const codeStep2 = authenticator.generate(secret);
    const login2FaRes = await request(app.getHttpServer())
      .post('/auth/login-2fa')
      .send({ mfaToken: loginRes.body.mfaToken, code: codeStep2 })
      .expect(201);

    expect(login2FaRes.body.accessToken).toBeDefined();
    expect(login2FaRes.body.user.isTwoFactorEnabled).toBe(true);

    // 6. Disable 2FA
    const disableCode = authenticator.generate(secret);
    await request(app.getHttpServer())
      .post('/auth/2fa/disable')
      .set('Authorization', `Bearer ${token}`)
      .send({ code: disableCode })
      .expect(201);

    // 7. Login biasa kembali tanpa 2FA
    const normalLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: '2fa@sendago.test', password: 'password123' })
      .expect(201);

    expect(normalLogin.body.require2FA).toBeUndefined();
    expect(normalLogin.body.accessToken).toBeDefined();
  });
});


