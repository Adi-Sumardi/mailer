import { join } from 'path';

// Dijalankan sebelum module NestJS di-load (via jest "setupFiles") supaya ConfigModule
// membaca nilai ini dari process.env. Menunjuk ke Postgres test terpisah — JANGAN pernah
// arahkan ke database development/production.
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://sendagomail:sendagomail@localhost:55432/sendagomail_domain_provisioning_test?schema=public';
process.env.JWT_SECRET = 'test-secret-do-not-use-in-production';
process.env.INTERNAL_API_KEY = 'test-internal-key-do-not-use-in-production';
process.env.MAIL_ENGINE_MX_HOST = 'mail.test.local';
process.env.MAIL_ENGINE_MX_PRIORITY = '10';
process.env.DOMAIN_VERIFICATION_TXT_PREFIX = 'sendagomail-verify';
// Arahkan hand-off DKIM ke folder temp, bukan mail-engine/config/rspamd sungguhan.
process.env.DKIM_KEYS_DIR = join(__dirname, '.tmp-dkim-keys', 'dkim');
process.env.DKIM_OVERRIDE_DIR = join(__dirname, '.tmp-dkim-keys', 'override.d');
