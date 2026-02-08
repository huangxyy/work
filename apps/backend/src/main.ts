import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters';

const parseCorsOrigins = (rawValue: string | undefined): string[] =>
  (rawValue || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const corsOrigins = parseCorsOrigins(configService.get<string>('CORS_ORIGIN'));

  app.set('trust proxy', 1);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  if (corsOrigins.length === 0 || corsOrigins.includes('*')) {
    app.enableCors();
    if (corsOrigins.length === 0) {
      Logger.warn('CORS_ORIGIN is not configured, allowing all origins.');
    }
  } else {
    app.enableCors({ origin: corsOrigins, credentials: true });
  }

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  await app.listen(port);
  Logger.log(`API server listening on ${await app.getUrl()}`);
}

bootstrap();
