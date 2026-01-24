import { readFileSync } from 'fs';
import Ajv from 'ajv';
import { resolveGradingAssetPath } from './asset-path';

const schemaPath = resolveGradingAssetPath('schemas/gradingResult.schema.json');
const schema = JSON.parse(readFileSync(schemaPath, 'utf-8')) as object;

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
const validate = ajv.compile(schema);

export type SchemaValidationResult = {
  valid: boolean;
  errors?: string;
};

export const validateGradingResult = (data: unknown): SchemaValidationResult => {
  const valid = validate(data);
  if (valid) {
    return { valid: true };
  }

  return {
    valid: false,
    errors: validate.errors ? ajv.errorsText(validate.errors, { separator: '; ' }) : 'Invalid schema',
  };
};
