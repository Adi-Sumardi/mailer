# api-gateway

Satu pintu masuk HTTP untuk seluruh backend SendagoMail — meneruskan request ke service yang sesuai berdasarkan path prefix. Selaras dengan "Edge/Gateway" di `docs/architecture_diagram.png` (API Gateway + Load Balancer + Rate Limiter), walau versi ini masih minimal (belum WAF/load balancer sungguhan).

## Stack
Express + `http-proxy-middleware` + `express-rate-limit` + `cors`. Sengaja **bukan** NestJS — gateway ini murni reverse-proxy tipis, tidak perlu DI/module system.

## Menjalankan Secara Lokal

```bash
cp .env.example .env      # sesuaikan URL tiap service & CORS_ORIGIN
npm install
npm run start:dev
```

Pastikan kelima service backend (`auth-service`, `domain-provisioning`, `mail-app-service`, `calendar-task-service`, `automation-engine`) sudah jalan di port yang cocok dengan `.env` sebelum mengetes lewat gateway.

## Tabel Rute

| Prefix | Diteruskan ke |
|---|---|
| `/auth/*` | `auth-service` |
| `/tenants/*`, `/domains/*` | `domain-provisioning` |
| `/mailboxes/*`, `/folders/*`, `/emails/*` | `mail-app-service` |
| `/calendar-events/*`, `/tasks/*` | `calendar-task-service` |
| `/automation-rules/*` | `automation-engine` |
| `/internal/*` | **Diblokir (403)** — endpoint service-to-service tidak boleh diakses lewat gateway publik |
| `/health` | Cek kesehatan gateway sendiri (tidak diteruskan ke manapun) |

## Catatan Implementasi
- **Bug nyata yang ketemu & diperbaiki saat development:** Express `app.use(prefix, middleware)` otomatis **menghapus** prefix dari `req.url` sebelum masuk ke middleware — padahal service upstream (mis. `auth-service` dengan `@Controller('auth')`) tetap mengharapkan path lengkap termasuk prefix (`/auth/login`, bukan `/login`). Diperbaiki dengan `pathRewrite` yang mengembalikan prefix tadi (lihat `src/app.ts`). Ini kelas bug yang **tidak akan ketahuan** tanpa test end-to-end sungguhan lewat HTTP terhadap upstream nyata (bukan mock module) — makanya test di sini spin up mock HTTP server sungguhan, bukan `jest.mock`.
- `/internal/*` diblokir secara eksplisit sebagai lapisan pertahanan tambahan — jangan cuma andalkan "tidak ada di tabel rute", karena kalau nanti ada yang menambah entri baru yang sengaja/tidak sengaja meng-cover `/internal`, blokir eksplisit ini tetap jadi jaring pengaman terakhir.
- Rate limiting masih sangat sederhana (in-memory per-instance, window 15 menit) — tidak akan bekerja benar kalau gateway di-scale ke banyak instance (butuh Redis-backed limiter untuk itu).
- Belum ada autentikasi/otorisasi di level gateway — validasi JWT sepenuhnya didelegasikan ke masing-masing service (lihat `JwtAuthGuard` di tiap service). Gateway ini murni routing, bukan API management penuh (belum ada API key management, request/response transformation, dsb.).

## Testing

```bash
npm run test:e2e
```

`test:e2e` (9 test) tidak butuh kelima service asli jalan — men-spin-up 5 mock HTTP server sungguhan (bukan `jest.mock`) yang mengembalikan `{upstream, method, path}` dari request yang diterima, lalu memverifikasi lewat `createApp()` + supertest: routing per prefix (termasuk **path lengkap yang diteruskan cocok persis**, termasuk kasus query-string), `/health`, blokir `/internal/*` (403), 404 untuk route tak dikenal, dan rate limiting.

## TODO
- [x] Routing berbasis path prefix ke 5 service
- [x] Blokir eksplisit endpoint `/internal/*`
- [x] Rate limiting dasar per-IP
- [x] CORS untuk frontend
- [x] Test end-to-end dengan mock upstream server sungguhan (9 test)
- [ ] Autentikasi/validasi JWT di level gateway (opsional — saat ini didelegasikan ke tiap service)
- [ ] Rate limiter berbasis Redis (supaya benar saat gateway di-scale multi-instance)
- [ ] WAF / load balancer sungguhan (saat ini asumsi 1 instance gateway, 1 instance tiap service)
- [ ] Circuit breaker / retry saat upstream service down
