import 'dotenv/config';
import { createApp, GatewayConfig } from './app';

const config: GatewayConfig = {
  authServiceUrl: process.env.AUTH_SERVICE_URL ?? 'http://localhost:3000',
  domainProvisioningServiceUrl: process.env.DOMAIN_PROVISIONING_SERVICE_URL ?? 'http://localhost:3001',
  mailAppServiceUrl: process.env.MAIL_APP_SERVICE_URL ?? 'http://localhost:3002',
  calendarTaskServiceUrl: process.env.CALENDAR_TASK_SERVICE_URL ?? 'http://localhost:3003',
  automationEngineUrl: process.env.AUTOMATION_ENGINE_URL ?? 'http://localhost:3004',
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? '300'),
};

const app = createApp(config);
const port = process.env.PORT ?? 8080;

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`api-gateway listening on port ${port}`);
});
