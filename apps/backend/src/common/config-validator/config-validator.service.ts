import { Injectable, Logger } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { existsSync } from 'fs';
import { resolve } from 'path';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  fixes: string[];
}

@Injectable()
export class ConfigValidatorService {
  private readonly logger = new Logger(ConfigValidatorService.name);

  constructor(private readonly config: NestConfigService) {}

  validate(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fixes: string[] = [];

    // Required fields validation
    const required = [
      { key: 'DATABASE_URL', name: 'Database URL' },
      { key: 'REDIS_URL', name: 'Redis URL' },
      { key: 'JWT_SECRET', name: 'JWT Secret' },
      { key: 'LLM_API_KEY', name: 'LLM API Key' },
    ];

    for (const field of required) {
      const value = this.config.get(field.key);
      if (!value || value === '' || value.includes('your_')) {
        errors.push(`${field.name} (${field.key}) is missing or using placeholder value`);
        fixes.push(`Set ${field.key} in .env file`);
      }
    }

    // JWT secret strength
    const jwtSecret = this.config.get('JWT_SECRET');
    if (jwtSecret && jwtSecret.length < 64) {
      warnings.push('JWT_SECRET should be at least 64 characters');
      fixes.push('Generate stronger secret: openssl rand -base64 64');
    }

    // Password strength warnings
    const dbUrl = this.config.get('DATABASE_URL');
    if (dbUrl && (dbUrl.includes('123456') || dbUrl.includes('password'))) {
      warnings.push('Database password appears weak');
      fixes.push('Use strong password (16+ chars, mixed case, numbers, symbols)');
    }

    // Port conflict detection
    const port = this.config.get('PORT', 3000);
    const portStr = String(port);
    if (portStr === '3001') {
      warnings.push('PORT 3001 conflicts with frontend dev server default');
    }

    // Font path validation
    const fontPath = this.config.get('PDF_FONT_PATH');
    if (fontPath) {
      const resolved = resolve(fontPath);
      if (!existsSync(resolved)) {
        warnings.push(`PDF_FONT_PATH specified but file not found: ${fontPath}`);
        fixes.push('Remove PDF_FONT_PATH or correct the path');
      }
    }

    // OCR keys
    const ocrKey = this.config.get('BAIDU_OCR_API_KEY');
    if (!ocrKey) {
      warnings.push('BAIDU_OCR_API_KEY not set - OCR functionality will be disabled');
    }

    // MinIO configuration
    const minioEndpoint = this.config.get('MINIO_ENDPOINT');
    if (minioEndpoint?.includes('localhost')) {
      warnings.push('MINIO_ENDPOINT uses localhost - this may cause issues in production');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      fixes,
    };
  }

  getConfigSummary(): Record<string, string | boolean | null | undefined> {
    return {
      database: !!this.config.get('DATABASE_URL'),
      redis: !!this.config.get('REDIS_URL'),
      jwtSecret: !!this.config.get('JWT_SECRET'),
      llmApiKey: !!this.config.get('LLM_API_KEY'),
      ocrApiKey: !!this.config.get('BAIDU_OCR_API_KEY'),
      minio: !!this.config.get('MINIO_ENDPOINT'),
      smtp: !!this.config.get('SMTP_HOST'),
      retentionDays: this.config.get('RETENTION_DAYS'),
      budgetLimit: this.config.get('BUDGET_DAILY_LIMIT'),
      workerConcurrency: this.config.get('WORKER_CONCURRENCY'),
    };
  }
}
