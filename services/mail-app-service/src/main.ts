import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

// POST /emails/api-send menerima lampiran sebagai base64 di body JSON (mis. invoice PDF).
// Default body limit Express cuma 100kb — jauh di bawah lampiran apa pun, dan gagalnya
// berupa 413 yang membingungkan integrator. Base64 membengkakkan ukuran ~33%, jadi batas
// ini disetel di atas MAX_ATTACHMENT_SIZE_KB (default 25MB) + overhead encoding.
const JSON_BODY_LIMIT = '40mb';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.use(json({ limit: JSON_BODY_LIMIT }));
  app.use(urlencoded({ limit: JSON_BODY_LIMIT, extended: true }));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  const port = process.env.PORT ?? 3002;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`mail-app-service listening on port ${port}`);
}
bootstrap();
