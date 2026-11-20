import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { NextFunction, Request, Response } from 'express';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { I18nInterceptor } from './common/interceptors/i18n.interceptor';
import { configureTrustProxy } from './common/http/trust-proxy';
import { mimeOf, objectStorage } from './common/files/object-storage';
import { readFile, unlink } from 'fs/promises';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
  app.enableShutdownHooks();
  configureTrustProxy(app);
  const logger = new Logger('HTTP');
  const slowRequestMs = Math.max(
    0,
    Number.parseInt(process.env.SLOW_REQUEST_MS || '1000', 10) || 1000,
  );

  const uploadRoot = join(process.cwd(), 'uploads');
  if (!existsSync(uploadRoot)) {
    mkdirSync(uploadRoot, { recursive: true });
  }
  app.use(cookieParser());
  app.use((req: Request, res: Response, next: NextFunction) => {
    const startedAt = Date.now();
    res.on('finish', () => {
      const elapsedMs = Date.now() - startedAt;
      if (elapsedMs < slowRequestMs && res.statusCode < 500) return;
      logger.warn(
        `${req.method} ${req.originalUrl || req.url} -> ${res.statusCode} in ${elapsedMs}ms`,
      );
    });
    next();
  });
  app.use(
    helmet({
      crossOriginResourcePolicy: false,
    }),
  );
  // С S3 файлы /uploads/… хранятся только в бакете и отдаются оттуда. Старый файл, оставшийся на диске с переезда,
  // при первом запросе уезжает в бакет и удаляется с диска. Без S3 — статика с диска, как раньше.
  app.use('/uploads/', (req: Request, res: Response, next: NextFunction) => {
    const s3 = objectStorage();
    if (!s3 || (req.method !== 'GET' && req.method !== 'HEAD')) return next();
    let rel: string;
    try {
      rel = decodeURIComponent(req.path).replace(/^\/+/, '');
    } catch {
      return next();
    }
    const full = join(uploadRoot, rel);
    if (!rel || rel.includes('..') || !full.startsWith(uploadRoot + '/')) return next();
    const key = `uploads/${rel}`;
    void (async () => {
      let data = await s3.get(key);
      if (!data && existsSync(full)) {
        data = await readFile(full);
        await s3.put(key, data);
        await unlink(full).catch(() => {});
      }
      if (!data) return next();
      res.setHeader('Content-Type', mimeOf(rel));
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Content-Length', String(data.length));
      res.end(req.method === 'HEAD' ? undefined : data);
    })().catch((err: Error) => {
      logger.warn(`S3: ${key}: ${err.message}`);
      next();
    });
  });
  app.useStaticAssets(uploadRoot, { prefix: '/uploads/' });

  app.useStaticAssets(join(process.cwd(), 'public'), { prefix: '/pub/' });
  app.setGlobalPrefix('api/v1');
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,https://my-test.kz,https://www.my-test.kz,https://admin.my-test.kz')
    .split(',')
    .map((o) => o.trim());
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new I18nInterceptor());

  const port = process.env.API_PORT || 3000;
  await app.listen(port);
  console.log(`API running on port ${port}`);
}
bootstrap();
