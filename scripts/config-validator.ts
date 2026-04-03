import { config } from 'dotenv';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env from various locations
const envPaths = [
  '.env',
  'apps/backend/.env',
  '.env.local',
];

let loaded = false;
for (const path of envPaths) {
  const resolvedPath = resolve(path);
  const result = config({ path: resolvedPath });
  if (result.error) {
    try {
      // Try parsing directly
      const content = readFileSync(resolvedPath, 'utf-8');
      if (content.trim()) {
        const parseResult = config({ path: resolvedPath });
        if (parseResult.parsed) {
          Object.assign(process.env, parseResult.parsed);
          loaded = true;
          break;
        }
      }
    } catch {
      continue;
    }
  } else if (result.parsed) {
    Object.assign(process.env, result.parsed);
    loaded = true;
    break;
  }
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  fixes: string[];
}

function validateConfiguration(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const fixes: string[] = [];

  const required = [
    { key: 'DATABASE_URL', name: 'Database URL' },
    { key: 'REDIS_URL', name: 'Redis URL' },
    { key: 'JWT_SECRET', name: 'JWT Secret' },
    { key: 'LLM_API_KEY', name: 'LLM API Key' },
  ];

  for (const field of required) {
    const value = process.env[field.key];
    if (!value || value === '' || value.includes('your_')) {
      errors.push(`${field.name} (${field.key}) is missing or using placeholder value`);
      fixes.push(`Set ${field.key} in .env file`);
    }
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (jwtSecret && jwtSecret.length < 64) {
    warnings.push('JWT_SECRET should be at least 64 characters');
    fixes.push('Generate stronger secret: openssl rand -base64 64');
  }

  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl && (dbUrl.includes('123456') || dbUrl.includes('password'))) {
    warnings.push('Database password appears weak');
    fixes.push('Use strong password (16+ chars, mixed case, numbers, symbols)');
  }

  const port = process.env.PORT || '3000';
  if (port === '3001') {
    warnings.push('PORT 3001 conflicts with frontend dev server default');
  }

  const fontPath = process.env.PDF_FONT_PATH;
  if (fontPath) {
    const resolved = resolve(fontPath);
    if (!existsSync(resolved)) {
      warnings.push(`PDF_FONT_PATH specified but file not found: ${fontPath}`);
      fixes.push('Remove PDF_FONT_PATH or correct the path');
    }
  }

  const ocrKey = process.env.BAIDU_OCR_API_KEY;
  if (!ocrKey) {
    warnings.push('BAIDU_OCR_API_KEY not set - OCR functionality will be disabled');
  }

  const minioEndpoint = process.env.MINIO_ENDPOINT;
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

async function main() {
  console.log('🔍 Validating Homework AI configuration...\n');

  const result = validateConfiguration();

  if (result.valid) {
    console.log('✅ Configuration is valid!\n');
    process.exit(0);
  }

  if (result.errors.length > 0) {
    console.error('❌ Errors:');
    result.errors.forEach(e => console.error(`  - ${e}`));
  }

  if (result.warnings.length > 0) {
    console.warn('\n⚠️  Warnings:');
    result.warnings.forEach(w => console.warn(`  - ${w}`));
  }

  if (result.fixes.length > 0) {
    console.log('\n💡 Suggested fixes:');
    result.fixes.forEach(f => console.log(`  - ${f}`));
  }

  console.log();
  process.exit(1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
