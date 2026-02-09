export type GradingDimensionScores = {
  grammar: number;
  vocabulary: number;
  structure: number;
  content: number;
  coherence: number;
  handwritingClarity?: number;
};

export type GradingErrorItem = {
  type: string;
  message: string;
  original: string;
  suggestion: string;
  startIndex?: number;
  endIndex?: number;
};

export type GradingSuggestions = {
  low: string[];
  mid: string[];
  high: string[];
  rewrite?: string;
  sampleEssay: string;
};

export type GradingResult = {
  totalScore: number;
  dimensionScores: GradingDimensionScores;
  errors: GradingErrorItem[];
  suggestions: GradingSuggestions;
  summary: string;
  nextSteps: string[];
};

export type GradingMeta = {
  providerName: string;
  model: string;
  degraded: boolean;
  degradeReason?: string;
  attemptCount: number;
};
