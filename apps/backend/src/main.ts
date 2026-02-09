import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
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

  app.use(helmet());
  app.set('trust proxy', 1);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  if (corsOrigins.includes('*')) {
    // Wildcard CORS must NOT send credentials — browsers block
    // `Access-Control-Allow-Credentials: true` when origin is `*`.
    app.enableCors({ origin: '*', credentials: false });
    Logger.warn('CORS_ORIGIN set to *, allowing all origins without credentials. Avoid this in production.');
  } else if (corsOrigins.length === 0) {
    app.enableCors({ origin: ['http://localhost:5173', 'http://localhost:3001'], credentials: true });
    Logger.warn('CORS_ORIGIN is not configured, falling back to localhost dev origins.');
  } else {
    app.enableCors({ origin: corsOrigins, credentials: true });
  }

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  await app.listen(port);
  Logger.log(`API server listening on ${await app.getUrl()}`);
}

bootstrap();
