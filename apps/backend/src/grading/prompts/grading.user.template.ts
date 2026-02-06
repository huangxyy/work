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

// Detailed scoring criteria reference
const SCORING_GUIDE = {
  grammar: {
    excellent: '18-20: Few to no errors; complex structures used correctly',
    good: '15-17: Minor errors that do not impede understanding',
    fair: '12-14: Noticeable errors but meaning remains clear',
    weak: '9-11: Frequent errors that occasionally obscure meaning',
    poor: '0-8: Errors so frequent that meaning is often lost',
  },
  vocabulary: {
    excellent: '18-20: Precise, varied, and contextually appropriate word choices',
    good: '15-17: Generally appropriate with some variety',
    fair: '12-14: Basic vocabulary with repetition or awkward choices',
    weak: '9-11: Limited range, frequent inappropriate choices',
    poor: '0-8: Very limited range, often confusing word usage',
  },
  structure: {
    excellent: '18-20: Clear intro/body/conclusion; effective paragraphing; logical flow',
    good: '15-17: Basic structure present with minor organizational issues',
    fair: '12-14: Structure evident but paragraphs weak or disorganized',
    weak: '9-11: Poor paragraphing, missing intro/conclusion',
    poor: '0-8: No discernible structure',
  },
  content: {
    excellent: '18-20: Insightful ideas; strong supporting details; original thinking',
    good: '15-17: Clear ideas with adequate support',
    fair: '12-14: Ideas present but underdeveloped or generic',
    weak: '9-11: Ideas vague, minimal supporting detail',
    poor: '0-8: Off-topic, no clear ideas',
  },
  coherence: {
    excellent: '18-20: Smooth transitions; clear logical connections throughout',
    good: '15-17: Generally coherent with occasional abrupt transitions',
    fair: '12-14: Basic coherence but connections sometimes unclear',
    weak: '9-11: Choppy flow, difficult to follow at times',
    poor: '0-8: Disconnected, no logical flow',
  },
};

const ERROR_TYPE_DESCRIPTIONS = {
  grammar: 'Subject-verb agreement, tense consistency, sentence fragments, run-ons, article usage, prepositions',
  vocabulary: 'Word form errors (e.g., "happy" vs "happiness"), collocation mistakes, register issues, wrong word choice',
  structure: 'Paragraph problems, missing thesis statement, poor essay organization, ineffective introduction/conclusion',
  content: 'Unsupported claims, logical fallacies, off-topic statements, underdeveloped arguments',
  coherence: 'Missing transitions, abrupt shifts between ideas, confusing logical connections, poor flow',
  spelling: 'Actual misspellings (distinguish from OCR recognition errors)',
  punctuation: 'Comma splices, missing periods, incorrect comma usage, quotation mark errors, apostrophe errors',
  style: 'Awkward phrasing, inconsistent tone, excessive wordiness, informal language in formal writing',
  clarity: 'Ambiguous statements, confusing syntax, pronoun reference errors, unclear antecedents',
  other: 'Issues not fitting above categories',
};

const SUGGESTION_LEVEL_GUIDES = {
  low: 'Focus on: spelling corrections, basic grammar fixes, punctuation corrections, obvious word form errors. These are immediate fixes the student should make.',
  mid: 'Focus on: paragraph structure, transition words, sentence combining, clarifying ambiguous statements, improving word choice. These address organization and clarity.',
  high: 'Focus on: argument sophistication, vocabulary enhancement, stylistic refinement, developing ideas more deeply, advanced rhetorical techniques. These elevate the essay to a higher level.',
};

export const buildUserPrompt = ({
  text,
  rubric,
  needRewrite,
  shortMode,
  strictJson,
  lowOnly,
}: UserPromptParams) => {
  // Mode-specific constraints
  const modeSection = shortMode
    ? `SHORT MODE CONSTRAINTS:
- Maximum 10 errors (prioritize most impactful errors)
- Maximum 3 suggestions per category
- Summary maximum 120 characters
- nextSteps maximum 3 items
- sampleEssay maximum 300 characters`
    : `STANDARD MODE CONSTRAINTS:
- Maximum 60 errors (be thorough - identify all significant errors)
- Maximum 12 suggestions per category
- Summary maximum 300 characters
- nextSteps maximum 8 items
- sampleEssay maximum 1500 characters`;

  // Low-only mode handling
  const lowOnlyWarning = lowOnly
    ? 'IMPORTANT: Only fill suggestions.low array. suggestions.mid and suggestions.high MUST be empty arrays [].'
    : 'Fill suggestions.low/mid/high arrays as appropriate based on student needs.';

  // JSON format requirements
  const jsonRequirements = strictJson
    ? `CRITICAL JSON REQUIREMENTS:
- Output MUST be valid JSON only
- NO markdown formatting (no \`\`\`json or \`\`\`)
- NO comments inside JSON
- NO trailing commas
- Use double quotes for strings (not single quotes)
- Numeric scores must be numbers (not strings like "15")
- Do NOT include any properties not defined in the schema
- If needRewrite=false, omit "rewrite" property entirely`
    : `Output valid JSON only. Use double quotes, no trailing commas.`;

  // Scoring requirements
  const scoringSection = `SCORING REQUIREMENTS:
- Each dimension score (grammar, vocabulary, structure, content, coherence) must be 0-20
- handwritingClarity (if present) must be 0-20
- totalScore MUST equal the exact sum of all dimension scores (range 0-100)
- Be accurate - do not inflate scores. Honest assessment helps students learn.`;

  // Error reporting requirements
  const errorSection = `ERROR REPORTING REQUIREMENTS:
- For each error, provide: type, message, original, suggestion
- type must be one of: ${ERROR_TYPES.join(', ')}
- message: Explain WHY this is wrong (educational focus) - not just "incorrect"
- original: The exact text as it appears in the OCR
- suggestion: The corrected version
- startIndex/endIndex: Character positions (optional but helpful when possible)

Error Type Definitions:
${Object.entries(ERROR_TYPE_DESCRIPTIONS)
  .map(([type, desc]) => `- ${type}: ${desc}`)
  .join('\n')}

IMPORTANT: Be thorough in error detection. Students need to see their mistakes to learn from them.`;

  // Suggestions guidance
  const suggestionsSection = `SUGGESTIONS GUIDANCE:
- low: ${SUGGESTION_LEVEL_GUIDES.low}
- mid: ${SUGGESTION_LEVEL_GUIDES.mid}
- high: ${SUGGESTION_LEVEL_GUIDES.high}

${lowOnlyWarning}

- sampleEssay: Write a model response demonstrating excellent writing. This should be a complete essay that shows, not just tells, what good writing looks like. Adapt it to the same topic/prompt as the student's essay.
- Each suggestion should be actionable and specific.
- Frame feedback constructively - focus on what the student CAN do to improve.`;

  // Summary and next steps
  const summarySection = `SUMMARY AND NEXT STEPS:
- summary: A concise overview of the essay's strengths and main areas for improvement. Be honest but encouraging.
- nextSteps: Specific, actionable steps for the student to take. Each step should be something concrete they can work on.

Example nextSteps:
- "Review subject-verb agreement rules, especially with singular nouns ending in 's'"
- "Practice using transition words to improve flow between paragraphs"`;

  // OCR handling
  const ocrNote = `OCR NOTE:
The text below comes from OCR (optical character recognition) of handwritten work.
- Distinguish between actual writing errors and OCR artifacts.
- If text is clearly garbled (e.g., "1" instead of "I"), this is likely OCR noise.
- However, do not overlook real errors. Be thorough in identifying actual writing mistakes.`;

  // Build the complete prompt
  const sections = [
    jsonRequirements,
    '',
    modeSection,
    '',
    scoringSection,
    '',
    errorSection,
    '',
    suggestionsSection,
    '',
    summarySection,
    '',
    ocrNote,
    '',
    rubric ? `CUSTOM RUBRIC/OVERRIDES:\n${rubric}` : '',
    '',
    'OUTPUT SCHEMA (required keys in order):',
    '1) totalScore (number, 0-100)',
    '2) dimensionScores { grammar, vocabulary, structure, content, coherence, optional handwritingClarity }',
    '3) errors: array of { type, message, original, suggestion, optional startIndex, endIndex }',
    '4) suggestions: { low, mid, high, optional rewrite, sampleEssay }',
    '5) summary (string)',
    '6) nextSteps (array of strings)',
    '',
    `needRewrite=${needRewrite ? 'true' : 'false'}. If false, omit rewrite property.`,
    '',
    '--- OCR TEXT START ---',
    text,
    '--- OCR TEXT END ---',
  ];

  return sections.filter(Boolean).join('\n');
};
