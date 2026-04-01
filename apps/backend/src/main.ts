import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters';
import { validateEnvironment } from './common/security';

const parseCorsOrigins = (rawValue: string | undefined): string[] =>
  (rawValue || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

async function bootstrap() {
  validateEnvironment();

  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const configService = app.get(ConfigService);
  const corsOrigins = parseCorsOrigins(configService.get<string>('CORS_ORIGIN'));
  const isProduction = configService.get<string>('NODE_ENV') === 'production';

  app.use(
    helmet({
      contentSecurityPolicy: isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'blob:'],
              connectSrc: ["'self'"],
              fontSrc: ["'self'", 'data:'],
              objectSrc: ["'none'"],
              frameAncestors: ["'none'"],
              baseUri: ["'self'"],
              formAction: ["'self'"],
            },
          }
        : false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.set('trust proxy', 1);
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Homework AI API')
    .setDescription('AI-powered English essay grading system')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);

  if (corsOrigins.includes('*')) {
    if (isProduction) {
      Logger.error('SECURITY WARNING: CORS_ORIGIN set to * in production environment! This is a security risk. Please configure specific origins.');
      throw new Error('Wildcard CORS origin (*) is not allowed in production. Please configure CORS_ORIGIN with specific domains.');
    }
    app.enableCors({ origin: '*', credentials: false });
    Logger.warn('CORS_ORIGIN set to *, allowing all origins without credentials. Avoid this in production.');
  } else if (corsOrigins.length === 0) {
    const devOrigins = ['http://localhost:5173', 'http://localhost:3001'];
    app.enableCors({ 
      origin: (origin, callback) => {
        if (!origin || devOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(null, true);
        }
      }, 
      credentials: true 
    });
    if (isProduction) {
      Logger.warn('CORS_ORIGIN is not configured in production. Falling back to localhost origins which may not work correctly.');
    } else {
      Logger.debug('CORS_ORIGIN is not configured, falling back to localhost dev origins.');
    }
  } else {
    app.enableCors({ origin: corsOrigins, credentials: true });
  }

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  await app.listen(port, '0.0.0.0');
  Logger.log(`API server listening on http://0.0.0.0:${port}`);
}

bootstrap();
