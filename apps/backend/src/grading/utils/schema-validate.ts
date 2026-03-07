import { readFileSync } from 'fs';
import Ajv from 'ajv';
import { resolveGradingAssetPath } from './asset-path';

const schemaPath = resolveGradingAssetPath('schemas/gradingResult.schema.json');
const schema = JSON.parse(readFileSync(schemaPath, 'utf-8')) as object;

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
const validate = ajv.compile(schema);

const CORE_DIMENSION_KEYS = ['grammar', 'vocabulary', 'structure', 'content', 'coherence'] as const;
const SCORE_TOLERANCE = 0.001;

export type SchemaValidationResult = {
  valid: boolean;
  errors?: string;
};

const validateTotalScoreConsistency = (data: unknown): string | undefined => {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return 'Invalid schema';
  }

  const payload = data as Record<string, unknown>;
  const totalScore = payload.totalScore;
  const dimensionScores = payload.dimensionScores;

  if (
    typeof totalScore !== 'number' ||
    !dimensionScores ||
    typeof dimensionScores !== 'object' ||
    Array.isArray(dimensionScores)
  ) {
    return 'Invalid schema';
  }

  const scoreMap = dimensionScores as Record<string, unknown>;
  const expectedTotal = CORE_DIMENSION_KEYS.reduce((sum, key) => {
    const value = scoreMap[key];
    return typeof value === 'number' ? sum + value : sum;
  }, 0);

  if (Math.abs(totalScore - expectedTotal) > SCORE_TOLERANCE) {
    return `totalScore must equal the sum of grammar/vocabulary/structure/content/coherence (${expectedTotal})`;
  }

  return undefined;
};

export const validateGradingResult = (data: unknown): SchemaValidationResult => {
  const valid = validate(data);
  if (!valid) {
    return {
      valid: false,
      errors: validate.errors ? ajv.errorsText(validate.errors, { separator: '; ' }) : 'Invalid schema',
    };
  }

  const scoreConsistencyError = validateTotalScoreConsistency(data);
  if (scoreConsistencyError) {
    return {
      valid: false,
      errors: scoreConsistencyError,
    };
  }

  return { valid: true };
};
