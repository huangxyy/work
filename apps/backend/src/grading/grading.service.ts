import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GradingError } from './grading.errors';
import { GradingMeta, GradingResult } from './grading.types';
import { CheapProvider } from './providers/cheap.provider';
import { GradeEssayParams, GradingMode, ProviderInfo } from './providers/provider.interface';
import { BudgetTracker } from './utils/budget';
import { validateGradingResult } from './utils/schema-validate';

export type GradeOptions = {
  needRewrite?: boolean;
  mode?: GradingMode;
  rubric?: string;
};

type AttemptOutcome = {
  result: GradingResult;
  providerInfo: ProviderInfo;
  degradedByBudget: boolean;
};

const DEFAULT_RUBRIC = [
  'Score each dimension (grammar, vocabulary, structure, content, coherence) from 0-20.',
  'totalScore must equal the sum of dimensionScores (0-100).',
  'Provide clear, actionable feedback with concise bullet points.',
  'Be tolerant of OCR noise but focus on English writing quality.',
].join('\n');

@Injectable()
export class GradingService {
  private readonly logger = new Logger(GradingService.name);
  private readonly maxInputChars: number;
  private readonly defaultMaxTokens: number;
  private readonly retryMaxTokens: number;
  private readonly shortMaxTokens: number;
  private readonly defaultTemperature: number;

  constructor(
    private readonly provider: CheapProvider,
    private readonly budgetTracker: BudgetTracker,
    configService: ConfigService,
  ) {
    this.maxInputChars = Number(configService.get<string>('LLM_MAX_INPUT_CHARS') || '6000');
    this.defaultMaxTokens = Number(configService.get<string>('LLM_MAX_TOKENS') || '800');
    this.retryMaxTokens = Math.max(200, Math.floor(this.defaultMaxTokens * 0.7));
    this.shortMaxTokens = Math.max(200, Math.floor(this.defaultMaxTokens * 0.5));
    this.defaultTemperature = Number(configService.get<string>('LLM_TEMPERATURE') || '0.2');
  }

  async grade(text: string, options: GradeOptions = {}) {
    const trimmed = text.trim();
    if (!trimmed) {
      throw new GradingError('LLM_SCHEMA_INVALID', 'OCR text is empty');
    }

    const rubric = options.rubric || DEFAULT_RUBRIC;
    const mode = options.mode || 'cheap';
    const needRewrite = Boolean(options.needRewrite);

    let degraded = false;
    let degradeReason: string | undefined;

    let inputText = trimmed;
    if (trimmed.length > this.maxInputChars) {
      inputText = trimmed.slice(0, this.maxInputChars);
      degraded = true;
      degradeReason = 'INPUT_TOO_LONG';
    }

    const baseParams: GradeEssayParams = {
      text: inputText,
      needRewrite,
      mode,
      rubric,
      temperature: this.defaultTemperature,
    };

    let attemptCount = 0;
    const runAttempt = async (params: GradeEssayParams): Promise<AttemptOutcome> => {
      attemptCount += 1;
      return this.invokeModel(params);
    };

    if (!degraded) {
      try {
        const outcome = await runAttempt({ ...baseParams, maxTokens: this.defaultMaxTokens });
        if (outcome.degradedByBudget) {
          degraded = true;
          degradeReason = degradeReason || 'BUDGET_EXCEEDED';
        }
        return {
          result: outcome.result,
          meta: this.buildMeta(outcome.providerInfo, degraded, degradeReason, attemptCount),
        };
      } catch (error) {
        if (error instanceof GradingError && this.isRetryableApiError(error)) {
          try {
            const outcome = await runAttempt({
              ...baseParams,
              maxTokens: this.retryMaxTokens,
            });
            if (outcome.degradedByBudget) {
              degraded = true;
              degradeReason = degradeReason || 'BUDGET_EXCEEDED';
            }
            return {
              result: outcome.result,
              meta: this.buildMeta(outcome.providerInfo, degraded, degradeReason, attemptCount),
            };
          } catch (retryError) {
            degraded = true;
            degradeReason = degradeReason || 'RETRY_FAILED';
            this.logger.warn(`Retry failed: ${this.describeError(retryError)}`);
          }
        } else if (error instanceof GradingError && error.code === 'LLM_SCHEMA_INVALID') {
          try {
            const outcome = await runAttempt({
              ...baseParams,
              maxTokens: this.defaultMaxTokens,
              strictJson: true,
              temperature: 0,
            });
            return {
              result: outcome.result,
              meta: this.buildMeta(outcome.providerInfo, degraded, degradeReason, attemptCount),
            };
          } catch (retryError) {
            degraded = true;
            degradeReason = degradeReason || 'SCHEMA_RETRY_FAILED';
            this.logger.warn(`Schema retry failed: ${this.describeError(retryError)}`);
          }
        } else {
          throw error;
        }
      }
    }

    const degradedParams: GradeEssayParams = {
      ...baseParams,
      needRewrite: false,
      maxTokens: this.shortMaxTokens,
      shortMode: true,
      lowOnly: true,
      strictJson: true,
      temperature: 0,
    };

    try {
      const outcome = await runAttempt(degradedParams);
      return {
        result: outcome.result,
        meta: this.buildMeta(outcome.providerInfo, true, degradeReason || 'DEGRADED', attemptCount),
      };
    } catch (error) {
      throw error instanceof GradingError
        ? error
        : new GradingError('LLM_API_ERROR', this.describeError(error));
    }
  }

  private async invokeModel(params: GradeEssayParams): Promise<AttemptOutcome> {
    const budgetDecision = await this.budgetTracker.reserveCall();
    if (budgetDecision.exceeded && budgetDecision.mode === 'hard') {
      throw new GradingError('LLM_QUOTA_EXCEEDED', 'Daily LLM quota exceeded');
    }

    if (budgetDecision.exceeded) {
      this.logger.warn(
        `LLM budget exceeded (mode=${budgetDecision.mode}, count=${budgetDecision.count}, limit=${budgetDecision.limit ?? 'n/a'})`,
      );
    }

    const adjustedParams: GradeEssayParams = { ...params };
    let degradedByBudget = false;
    if (budgetDecision.exceeded && budgetDecision.mode === 'soft') {
      degradedByBudget = true;
      adjustedParams.shortMode = true;
      adjustedParams.lowOnly = true;
      adjustedParams.needRewrite = false;
      adjustedParams.maxTokens = Math.min(
        adjustedParams.maxTokens ?? this.shortMaxTokens,
        this.shortMaxTokens,
      );
    }

    await this.provider.refreshConfig();
    const providerInfo = this.provider.getProviderInfo(adjustedParams);
    const raw = await this.provider.gradeEssay(adjustedParams);
    const parsed = this.parseJson(raw);
    const validation = validateGradingResult(parsed);
    if (!validation.valid) {
      throw new GradingError('LLM_SCHEMA_INVALID', validation.errors || 'Schema validation failed');
    }

    return {
      result: parsed as GradingResult,
      providerInfo,
      degradedByBudget,
    };
  }

  private buildMeta(
    providerInfo: ProviderInfo,
    degraded: boolean,
    degradeReason: string | undefined,
    attemptCount: number,
  ): GradingMeta {
    return {
      providerName: providerInfo.providerName,
      model: providerInfo.model,
      degraded,
      degradeReason,
      attemptCount,
    };
  }

  private parseJson(raw: string): unknown {
    const trimmed = raw.trim();
    if (!trimmed) {
      throw new GradingError('LLM_SCHEMA_INVALID', 'Empty LLM response');
    }

    const cleaned = this.stripCodeFences(trimmed);
    try {
      return JSON.parse(cleaned);
    } catch {
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start >= 0 && end > start) {
        try {
          return JSON.parse(cleaned.slice(start, end + 1));
        } catch {
          throw new GradingError('LLM_SCHEMA_INVALID', 'Invalid JSON output');
        }
      }
      throw new GradingError('LLM_SCHEMA_INVALID', 'Invalid JSON output');
    }
  }

  private stripCodeFences(input: string): string {
    if (input.startsWith('```')) {
      const stripped = input.replace(/^```[a-zA-Z]*\n?/, '').replace(/```$/, '');
      return stripped.trim();
    }
    return input;
  }

  private isRetryableApiError(error: GradingError) {
    return error.code === 'LLM_TIMEOUT' || error.code === 'LLM_API_ERROR';
  }

  private describeError(error: unknown): string {
    if (error instanceof Error) {
      return error.message;
    }
    return 'Unknown error';
  }
}
