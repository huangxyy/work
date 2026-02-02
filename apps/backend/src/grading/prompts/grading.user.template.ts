export type UserPromptParams = {
  text: string;
  rubric: string;
  needRewrite: boolean;
  shortMode?: boolean;
  strictJson?: boolean;
  lowOnly?: boolean;
};

const ERROR_TYPES = [
  'grammar',
  'vocabulary',
  'structure',
  'content',
  'coherence',
  'spelling',
  'punctuation',
  'style',
  'clarity',
  'other',
];

export const buildUserPrompt = ({
  text,
  rubric,
  needRewrite,
  shortMode,
  strictJson,
  lowOnly,
}: UserPromptParams) => {
  const modeLine = shortMode
    ? 'Short mode: keep output compact; errors <= 10, suggestions <= 3 each.'
    : 'Standard mode: errors <= 60, suggestions <= 12 each.';
  const lowOnlyLine = lowOnly
    ? 'Only fill suggestions.low. suggestions.mid and suggestions.high must be empty arrays.'
    : 'Fill suggestions.low/mid/high as needed.';
  const jsonLine = strictJson
    ? 'Output MUST be valid JSON only. Do not add any extra text.'
    : 'Output JSON only.';
  const summaryLine = shortMode
    ? 'Summary <= 120 chars. nextSteps <= 3 items.'
    : 'Summary <= 300 chars. nextSteps <= 8 items.';
  const scoreLine =
    'Score ranges: grammar/vocabulary/structure/content/coherence (and handwritingClarity if present) must be 0-20.';
  const totalLine = 'totalScore must equal the sum of dimensionScores (0-100).';
  const jsonRulesLine = 'Use double quotes, no trailing commas, and numeric values (not strings).';
  const sampleLine = shortMode
    ? 'Include suggestions.sampleEssay (<= 300 chars) as a model answer.'
    : 'Include suggestions.sampleEssay (<= 1500 chars) as a model answer.';
  const truncationLine =
    'If output risks truncation, shorten sampleEssay and suggestions first; do not truncate JSON.';
  return [
    jsonLine,
    modeLine,
    lowOnlyLine,
    summaryLine,
    scoreLine,
    totalLine,
    jsonRulesLine,
    sampleLine,
    truncationLine,
    'You are grading an English essay from OCR. OCR text may contain noise.',
    'Scoring rubric:',
    rubric,
    'Error type enum:',
    ERROR_TYPES.join(', '),
    'Required JSON keys and order:',
    '1) totalScore (0-100)',
    '2) dimensionScores { grammar, vocabulary, structure, content, coherence, optional handwritingClarity }',
    '3) errors: array of { type, message, original, suggestion, optional startIndex, endIndex }',
    '4) suggestions: { low, mid, high, rewrite, sampleEssay }',
    '5) summary (<= 300 chars)',
    '6) nextSteps (<= 8 bullets)',
    `needRewrite=${needRewrite ? 'true' : 'false'}. If false, omit rewrite or return empty string.`,
    'OCR TEXT START',
    text,
    'OCR TEXT END',
  ].join('\n');
};
