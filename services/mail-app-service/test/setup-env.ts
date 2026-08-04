// Dijalankan sebelum module NestJS di-load (via jest "setupFiles") supaya ConfigModule
// membaca nilai ini dari process.env. Menunjuk ke Postgres test terpisah — JANGAN pernah
// arahkan ke database development/production.
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://sendagomail:sendagomail@localhost:55432/sendagomail_mail_app_test?schema=public';
process.env.JWT_SECRET = 'test-secret-do-not-use-in-production';
process.env.INTERNAL_API_KEY = 'test-internal-key-do-not-use-in-production';
process.env.DEFAULT_RECALL_WINDOW_SECONDS = '2';
process.env.MAX_ATTACHMENT_SIZE_KB = '25600';
// Arahkan upload logo template ke folder temp, bukan direktori production sungguhan.
process.env.TEMPLATE_LOGOS_DIR = require('path').join(__dirname, '.tmp-template-logos');
