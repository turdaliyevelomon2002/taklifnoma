import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AppConfig } from './config/app-config.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  const config = app.get(AppConfig);

  // Proksi ortida haqiqiy mijoz IP'si (rate limit shunga tayanadi).
  app.set('trust proxy', config.get('TRUST_PROXY'));
  app.disable('x-powered-by');

  app.use(helmet());
  app.use(cookieParser());
  // JSON so'rovlar uchun kichik limit; fayllar multipart orqali alohida keladi.
  app.useBodyParser('json', { limit: '256kb' });

  app.enableCors({ origin: config.get('CORS_ORIGINS'), credentials: true });
  app.setGlobalPrefix('api');
  app.enableShutdownHooks();

  const port = config.get('PORT');
  await app.listen(port);
  Logger.log(`API: http://localhost:${port}/api`, 'Bootstrap');
}

void bootstrap();
