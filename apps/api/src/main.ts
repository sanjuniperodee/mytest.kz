import { existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { I18nInterceptor } from './common/interceptors/i18n.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const uploadRoot = join(process.cwd(), 'uploads');
  if (!existsSync(uploadRoot)) {
    mkdirSync(uploadRoot, { recursive: true });
  }
  app.useStaticAssets(uploadRoot, { prefix: '/uploads/' });

  app.setGlobalPrefix('api/v1');
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,https://my-test.kz')
    .split(',')
    .map((o) => o.trim());
  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  app.useGlobalInterceptors(new I18nInterceptor());

  const port = process.env.API_PORT || 3000;
  await app.listen(port);
  console.log(`API running on port ${port}`);
}
bootstrap();
