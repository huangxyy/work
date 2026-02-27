import { Logger } from '@nestjs/common';

type EnvRule = {
  key: string;
  required: boolean;
  description: string;
};

const ENV_RULES: EnvRule[] = [
  { key: 'DATABASE_URL', required: true, description: 'MySQL connection string' },
  { key: 'JWT_SECRET', required: true, description: 'JWT signing secret' },
  { key: 'REDIS_URL', required: false, description: 'Redis connection URL (defaults to localhost)' },
  { key: 'MINIO_ENDPOINT', required: false, description: 'MinIO S3 endpoint' },
  { key: 'MINIO_ACCESS_KEY', required: false, description: 'MinIO access key' },
  { key: 'MINIO_SECRET_KEY', required: false, description: 'MinIO secret key' },
];

const SECURITY_CHECKS = [
  {
    key: 'JWT_SECRET',
    check: (val: string) => val.length >= 32,
    warning: 'JWT_SECRET should be at least 32 characters for production',
  },
  {
    key: 'NODE_ENV',
    check: (val: string) => val === 'production' || val === 'development',
    warning: 'NODE_ENV should be "production" or "development"',
  },
];

export function validateEnvironment(): void {
  const logger = new Logger('EnvValidator');
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const rule of ENV_RULES) {
    const value = process.env[rule.key];
    if (rule.required && !value?.trim()) {
      errors.push(`Missing required env: ${rule.key} (${rule.description})`);
    }
  }

  for (const sc of SECURITY_CHECKS) {
    const value = process.env[sc.key];
    if (value && !sc.check(value)) {
      warnings.push(sc.warning);
    }
  }

  for (const w of warnings) {
    logger.warn(`[Security] ${w}`);
  }

  if (errors.length > 0) {
    for (const e of errors) {
      logger.error(`[Security] ${e}`);
    }
    throw new Error(
      `Environment validation failed:\n${errors.join('\n')}`,
    );
  }

  logger.log('Environment validation passed');
}
