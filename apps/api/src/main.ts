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

function requireProductionConfig(keys: string[]) {
  if (process.env.NODE_ENV !== 'production') return;
  const missing = keys.filter((key) => !process.env[key]?.trim());
  if (missing.length > 0) {
    throw new Error(`Missing required production config: ${missing.join(', ')}`);
  }
}

async function bootstrap() {
  requireProductionConfig([
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'KASPI_WEBHOOK_SECRET',
  ]);

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });
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
