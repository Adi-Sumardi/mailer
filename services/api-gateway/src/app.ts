import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createProxyMiddleware } from 'http-proxy-middleware';

export interface GatewayConfig {
  authServiceUrl: string;
  domainProvisioningServiceUrl: string;
  mailAppServiceUrl: string;
  calendarTaskServiceUrl: string;
  automationEngineUrl: string;
  corsOrigin: string;
  rateLimitMax: number;
}

// Path prefix -> base URL upstream service. Satu-satunya "peta rute" gateway ini.
function buildRouteTable(config: GatewayConfig): Array<{ prefix: string; target: string }> {
  return [
    { prefix: '/auth', target: config.authServiceUrl },
    { prefix: '/users', target: config.authServiceUrl },
    { prefix: '/tenants', target: config.domainProvisioningServiceUrl },
    { prefix: '/domains', target: config.domainProvisioningServiceUrl },
    { prefix: '/mailboxes', target: config.mailAppServiceUrl },
    { prefix: '/folders', target: config.mailAppServiceUrl },
    { prefix: '/emails', target: config.mailAppServiceUrl },
    { prefix: '/calendar-events', target: config.calendarTaskServiceUrl },
    { prefix: '/tasks', target: config.calendarTaskServiceUrl },
    { prefix: '/automation-rules', target: config.automationEngineUrl },
  ];
}

export function createApp(config: GatewayConfig): Express {
  const app = express();

  app.use(cors({ origin: config.corsOrigin.split(',').map((o) => o.trim()) }));
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000,
      max: config.rateLimitMax,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  // Endpoint /internal/* (service-to-service, diproteksi X-Internal-Api-Key di service masing-masing)
  // TIDAK PERNAH diekspos lewat gateway publik — blokir eksplisit di sini sebagai lapisan
  // pertahanan tambahan, jangan andalkan cuma proxy prefix table di bawah tidak mencantumkannya.
  app.use('/internal', (_req: Request, res: Response) => {
    res.status(403).json({ message: 'Endpoint internal tidak dapat diakses lewat gateway publik' });
  });

  // POST /emails/ingest dipanggil mail-engine (Postfix pipe) langsung ke mail-app-service,
  // TIDAK lewat gateway. Diblokir eksplisit di sini karena prefix /emails di route table
  // bawah akan mem-proxy-nya ke publik — dan endpoint itu bisa menyuntikkan email ke Inbox
  // siapa pun kalau INTERNAL_API_KEY sampai bocor. Tidak ada alasan sah memanggilnya dari luar.
  app.use('/emails/ingest', (_req: Request, res: Response) => {
    res.status(403).json({ message: 'Endpoint ingest tidak dapat diakses lewat gateway publik' });
  });

  for (const { prefix, target } of buildRouteTable(config)) {
    app.use(
      prefix,
      createProxyMiddleware({
        target,
        changeOrigin: true,
        // Express `app.use(prefix, ...)` MENGHAPUS prefix dari req.url sebelum masuk ke
        // middleware ini — tapi service upstream (NestJS `@Controller('auth')` dkk.) tetap
        // mengharapkan path lengkap termasuk prefix (mis. `/auth/login`, bukan `/login`).
        // pathRewrite mengembalikan prefix yang sudah dihapus tadi.
        pathRewrite: (path) => {
          // Kasus khusus: exact match ke prefix (mis. GET /domains) atau exact match + query
          // (mis. GET /domains?x=1) — req.url yang sudah di-strip Express jadi '/' atau '/?x=1'.
          // Kalau digabung mentah-mentah dengan prefix, muncul trailing slash aneh sebelum '?'.
          const stripped = path === '/' || path.startsWith('/?') ? path.slice(1) : path;
          return (prefix + stripped).replace(/\/{2,}/g, '/');
        },
      }),
    );
  }

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ message: 'Route tidak ditemukan di API Gateway' });
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(502).json({ message: 'Upstream service tidak dapat dihubungi', error: err.message });
  });

  return app;
}
