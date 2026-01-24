import { existsSync } from 'fs';
import path from 'path';

export const resolveGradingAssetPath = (relativePath: string): string => {
  const candidates = [
    path.resolve(process.cwd(), 'apps', 'backend', 'src', 'grading', relativePath),
    path.resolve(process.cwd(), 'src', 'grading', relativePath),
    path.resolve(__dirname, '..', relativePath),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Missing grading asset: ${relativePath}`);
};
