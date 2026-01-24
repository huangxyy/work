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
    ? 'Short mode: keep output compact; errors <= 20, suggestions <= 6 each.'
    : 'Standard mode: errors <= 60, suggestions <= 12 each.';
  const lowOnlyLine = lowOnly
    ? 'Only fill suggestions.low. suggestions.mid and suggestions.high must be empty arrays.'
    : 'Fill suggestions.low/mid/high as needed.';
  const jsonLine = strictJson
    ? 'Output MUST be valid JSON only. Do not add any extra text.'
    : 'Output JSON only.';
  return [
    jsonLine,
    modeLine,
    lowOnlyLine,
    'You are grading an English essay from OCR. OCR text may contain noise.',
    'Scoring rubric:',
    rubric,
    'Error type enum:',
    ERROR_TYPES.join(', '),
    'Required JSON keys and order:',
    '1) totalScore (0-100)',
    '2) dimensionScores { grammar, vocabulary, structure, content, coherence, optional handwritingClarity }',
    '3) errors: array of { type, message, original, suggestion, optional startIndex, endIndex }',
    '4) suggestions: { low, mid, high, optional rewrite }',
    '5) summary (<= 300 chars)',
    '6) nextSteps (<= 8 bullets)',
    `needRewrite=${needRewrite ? 'true' : 'false'}. If false, omit rewrite or return empty string.`,
    'OCR TEXT START',
    text,
    'OCR TEXT END',
  ].join('\n');
};
