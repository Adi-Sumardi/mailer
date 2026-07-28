// Dijalankan sebelum module NestJS di-load (via jest "setupFiles") supaya ConfigModule
// membaca nilai ini dari process.env. Menunjuk ke Postgres test terpisah — JANGAN pernah
// arahkan ke database development/production.
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://sendagomail:sendagomail@localhost:55432/sendagomail_calendar_task_test?schema=public';
process.env.JWT_SECRET = 'test-secret-do-not-use-in-production';
