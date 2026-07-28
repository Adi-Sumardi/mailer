// Dijalankan sebelum module NestJS di-load (via jest "setupFiles") supaya ConfigModule
// membaca nilai ini dari process.env. Menunjuk ke Postgres test terpisah — JANGAN pernah
// arahkan ke database development/production.
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://sendagomail:sendagomail@localhost:55432/sendagomail_auth_test?schema=public';
process.env.JWT_SECRET = 'test-secret-do-not-use-in-production';
process.env.JWT_EXPIRES_IN = '1h';
process.env.REFRESH_TOKEN_DAYS = '30';
process.env.INTERNAL_API_KEY = 'test-internal-key-do-not-use-in-production';
// Sengaja arah ke port yang tidak ada listener — menguji graceful-degradation saat
// mail-app-service/domain-provisioning tidak terjangkau (lihat MailAppClientService,
// DomainProvisioningClientService).
process.env.MAIL_APP_SERVICE_URL = 'http://localhost:9999';
process.env.DOMAIN_PROVISIONING_SERVICE_URL = 'http://localhost:9998';
