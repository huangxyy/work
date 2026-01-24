export type GradingMode = 'cheap' | 'quality';

export type GradeEssayParams = {
  text: string;
  needRewrite?: boolean;
  mode?: GradingMode;
  maxTokens?: number;
  temperature?: number;
  rubric?: string;
  strictJson?: boolean;
  shortMode?: boolean;
  lowOnly?: boolean;
  model?: string;
};

export type ProviderInfo = {
  providerName: string;
  model: string;
  baseUrl: string;
};

export interface LlmProvider {
  gradeEssay(params: GradeEssayParams): Promise<string>;
  getProviderInfo(params: GradeEssayParams): ProviderInfo;
}
