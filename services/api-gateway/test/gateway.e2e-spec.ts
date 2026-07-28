import express, { Express } from 'express';
import { Server } from 'http';
import request from 'supertest';
import { createApp, GatewayConfig } from '../src/app';

function startMockUpstream(name: string): Promise<{ server: Server; url: string }> {
  return new Promise((resolve) => {
    const app: Express = express();
    app.use(express.json());
    app.all('*', (req, res) => {
      res.json({ upstream: name, method: req.method, path: req.originalUrl });
    });
    const server = app.listen(0, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

describe('API Gateway (e2e)', () => {
  let servers: Server[] = [];
  let config: GatewayConfig;
  let app: Express;

  beforeAll(async () => {
    const auth = await startMockUpstream('auth-service');
    const domain = await startMockUpstream('domain-provisioning');
    const mail = await startMockUpstream('mail-app-service');
    const calendar = await startMockUpstream('calendar-task-service');
    const automation = await startMockUpstream('automation-engine');
    servers = [auth.server, domain.server, mail.server, calendar.server, automation.server];

    config = {
      authServiceUrl: auth.url,
      domainProvisioningServiceUrl: domain.url,
      mailAppServiceUrl: mail.url,
      calendarTaskServiceUrl: calendar.url,
      automationEngineUrl: automation.url,
      corsOrigin: 'http://localhost:5173',
      rateLimitMax: 300,
    };
    app = createApp(config);
  });

  afterAll(async () => {
    await Promise.all(servers.map((s) => new Promise((resolve) => s.close(resolve))));
  });

  it('GET /health mengembalikan status ok tanpa proxy ke upstream manapun', async () => {
    const res = await request(app).get('/health').expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('merutekan /auth/* ke auth-service', async () => {
    const res = await request(app).post('/auth/login').send({ email: 'a@b.com' }).expect(200);
    expect(res.body.upstream).toBe('auth-service');
    expect(res.body.path).toBe('/auth/login');
  });

  it('merutekan /tenants/* dan /domains/* ke domain-provisioning', async () => {
    const tenants = await request(app).get('/tenants').expect(200);
    expect(tenants.body.upstream).toBe('domain-provisioning');

    const domains = await request(app).get('/domains?tenantId=x').expect(200);
    expect(domains.body.upstream).toBe('domain-provisioning');
    expect(domains.body.path).toBe('/domains?tenantId=x');
  });

  it('merutekan /mailboxes, /folders, /emails ke mail-app-service', async () => {
    const mailboxes = await request(app).post('/mailboxes').expect(200);
    expect(mailboxes.body.upstream).toBe('mail-app-service');
    expect(mailboxes.body.path).toBe('/mailboxes');

    const folders = await request(app).get('/folders').expect(200);
    expect(folders.body.upstream).toBe('mail-app-service');
    expect(folders.body.path).toBe('/folders');

    const emails = await request(app).get('/emails/search?q=halo').expect(200);
    expect(emails.body.upstream).toBe('mail-app-service');
    expect(emails.body.path).toBe('/emails/search?q=halo');
  });

  it('merutekan /calendar-events dan /tasks ke calendar-task-service', async () => {
    const events = await request(app).get('/calendar-events').expect(200);
    expect(events.body.upstream).toBe('calendar-task-service');

    const tasks = await request(app).get('/tasks').expect(200);
    expect(tasks.body.upstream).toBe('calendar-task-service');
  });

  it('merutekan /automation-rules ke automation-engine', async () => {
    const res = await request(app).get('/automation-rules').expect(200);
    expect(res.body.upstream).toBe('automation-engine');
  });

  it('memblokir /internal/* — tidak pernah diteruskan ke upstream manapun (403)', async () => {
    const res = await request(app).get('/internal/tenants/abc/exists').expect(403);
    expect(res.body.upstream).toBeUndefined();
  });

  it('mengembalikan 404 untuk path yang tidak dikenal', async () => {
    await request(app).get('/tidak-ada-route-seperti-ini').expect(404);
  });

  it('menerapkan rate limit per IP', async () => {
    const limitedApp = createApp({ ...config, rateLimitMax: 2 });

    await request(limitedApp).get('/health').expect(200);
    await request(limitedApp).get('/health').expect(200);
    await request(limitedApp).get('/health').expect(429);
  });
});
