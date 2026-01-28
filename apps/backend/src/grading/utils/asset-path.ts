import { existsSync } from 'fs';
import { resolve } from 'path';

export const resolveGradingAssetPath = (relativePath: string): string => {
  const candidates = [
    resolve(process.cwd(), 'apps', 'backend', 'src', 'grading', relativePath),
    resolve(process.cwd(), 'src', 'grading', relativePath),
    resolve(__dirname, '..', relativePath),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Missing grading asset: ${relativePath}`);
};
