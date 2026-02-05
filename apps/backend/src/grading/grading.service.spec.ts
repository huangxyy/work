import { ConfigService } from '@nestjs/config';
import { GradingError } from './grading.errors';
import { GradingService } from './grading.service';
import { CheapProvider } from './providers/cheap.provider';
import { BudgetTracker } from './utils/budget';

describe('GradingService', () => {
  let gradingService: GradingService;
  let cheapProvider: jest.Mocked<CheapProvider>;
  let budgetTracker: jest.Mocked<BudgetTracker>;
  let configService: jest.Mocked<ConfigService>;

  const validGradingResult = JSON.stringify({
    totalScore: 75,
    dimensionScores: {
      grammar: 15,
      vocabulary: 15,
      structure: 15,
      content: 15,
      coherence: 15,
    },
    errors: [],
    suggestions: { low: [], mid: [], high: [], sampleEssay: 'Sample essay.' },
    summary: 'Good work.',
    nextSteps: ['Keep practicing.'],
  });

  beforeEach(() => {
    cheapProvider = {
      refreshConfig: jest.fn().mockResolvedValue(undefined),
      getProviderInfo: jest.fn().mockReturnValue({
        providerName: 'test-provider',
        model: 'test-model',
      }),
      gradeEssay: jest.fn().mockResolvedValue(validGradingResult),
    } as unknown as jest.Mocked<CheapProvider>;

    budgetTracker = {
      reserveCall: jest.fn().mockResolvedValue({
        exceeded: false,
        mode: 'soft',
        count: 1,
        limit: 100,
      }),
    } as unknown as jest.Mocked<BudgetTracker>;

    configService = {
      get: jest.fn().mockReturnValue(undefined),
    } as unknown as jest.Mocked<ConfigService>;

    gradingService = new GradingService(cheapProvider, budgetTracker, configService);
  });

  describe('grade', () => {
    it('should grade essay successfully', async () => {
      const result = await gradingService.grade('This is a test essay.');

      expect(result.result.totalScore).toBe(75);
      expect(result.meta.providerName).toBe('test-provider');
      expect(result.meta.degraded).toBe(false);
    });

    it('should throw error if text is null', async () => {
      await expect(gradingService.grade(null as unknown as string)).rejects.toThrow(GradingError);
    });

    it('should throw error if text is undefined', async () => {
      await expect(gradingService.grade(undefined as unknown as string)).rejects.toThrow(
        GradingError,
      );
    });

    it('should throw error if text is empty', async () => {
      await expect(gradingService.grade('')).rejects.toThrow(GradingError);
    });

    it('should throw error if text is only whitespace', async () => {
      await expect(gradingService.grade('   ')).rejects.toThrow(GradingError);
    });

    it('should truncate long input and set degraded flag', async () => {
      const longText = 'a'.repeat(10000);
      const result = await gradingService.grade(longText);

      expect(result.meta.degraded).toBe(true);
      expect(result.meta.degradeReason).toBe('INPUT_TOO_LONG');
    });

    it('should use custom rubric when provided', async () => {
      await gradingService.grade('Test essay', { rubric: 'Custom rubric' });

      expect(cheapProvider.gradeEssay).toHaveBeenCalledWith(
        expect.objectContaining({
          rubric: 'Custom rubric',
        }),
      );
    });

    it('should set needRewrite option', async () => {
      await gradingService.grade('Test essay', { needRewrite: true });

      expect(cheapProvider.gradeEssay).toHaveBeenCalledWith(
        expect.objectContaining({
          needRewrite: true,
        }),
      );
    });
  });

  describe('retry logic', () => {
    it('should retry on LLM_TIMEOUT error', async () => {
      cheapProvider.gradeEssay = jest
        .fn()
        .mockRejectedValueOnce(new GradingError('LLM_TIMEOUT', 'Timeout'))
        .mockResolvedValueOnce(validGradingResult);

      const result = await gradingService.grade('Test essay');

      expect(cheapProvider.gradeEssay).toHaveBeenCalledTimes(2);
      expect(result.result.totalScore).toBe(75);
    });

    it('should retry on LLM_API_ERROR', async () => {
      cheapProvider.gradeEssay = jest
        .fn()
        .mockRejectedValueOnce(new GradingError('LLM_API_ERROR', 'API Error'))
        .mockResolvedValueOnce(validGradingResult);

      const result = await gradingService.grade('Test essay');

      expect(cheapProvider.gradeEssay).toHaveBeenCalledTimes(2);
      expect(result.result.totalScore).toBe(75);
    });

    it('should retry on LLM_SCHEMA_INVALID error', async () => {
      cheapProvider.gradeEssay = jest
        .fn()
        .mockRejectedValueOnce(new GradingError('LLM_SCHEMA_INVALID', 'Invalid schema'))
        .mockResolvedValueOnce(validGradingResult);

      const result = await gradingService.grade('Test essay');

      expect(cheapProvider.gradeEssay).toHaveBeenCalledTimes(2);
      expect(result.result.totalScore).toBe(75);
    });

    it('should throw MAX_RETRIES_EXCEEDED after too many retries', async () => {
      cheapProvider.gradeEssay = jest
        .fn()
        .mockRejectedValue(new GradingError('LLM_TIMEOUT', 'Timeout'));

      await expect(gradingService.grade('Test essay')).rejects.toThrow('Maximum retry attempts');
    });
  });

  describe('budget checks', () => {
    it('should throw error when hard budget limit exceeded', async () => {
      budgetTracker.reserveCall = jest.fn().mockResolvedValue({
        exceeded: true,
        mode: 'hard',
        count: 101,
        limit: 100,
      });

      await expect(gradingService.grade('Test essay')).rejects.toThrow(GradingError);
    });

    it('should degrade when soft budget limit exceeded', async () => {
      budgetTracker.reserveCall = jest.fn().mockResolvedValue({
        exceeded: true,
        mode: 'soft',
        count: 101,
        limit: 100,
      });

      const result = await gradingService.grade('Test essay');

      expect(result.meta.degraded).toBe(true);
      expect(result.meta.degradeReason).toBe('BUDGET_EXCEEDED');
    });

    it('should use shortMode when soft budget exceeded', async () => {
      budgetTracker.reserveCall = jest.fn().mockResolvedValue({
        exceeded: true,
        mode: 'soft',
        count: 101,
        limit: 100,
      });

      await gradingService.grade('Test essay');

      expect(cheapProvider.gradeEssay).toHaveBeenCalledWith(
        expect.objectContaining({
          shortMode: true,
          lowOnly: true,
          needRewrite: false,
        }),
      );
    });
  });

  describe('JSON parsing', () => {
    it('should parse valid JSON response', async () => {
      const result = await gradingService.grade('Test essay');
      expect(result.result.totalScore).toBe(75);
    });

    it('should parse JSON wrapped in code fences', async () => {
      cheapProvider.gradeEssay = jest
        .fn()
        .mockResolvedValue('```json\n' + validGradingResult + '\n```');

      const result = await gradingService.grade('Test essay');
      expect(result.result.totalScore).toBe(75);
    });

    it('should handle JSON with trailing commas', async () => {
      const jsonWithTrailingComma = JSON.stringify({
        totalScore: 75,
        dimensionScores: {
          grammar: 15,
          vocabulary: 15,
          structure: 15,
          content: 15,
          coherence: 15,
        },
        errors: [],
        suggestions: { low: [], mid: [], high: [], sampleEssay: 'Sample essay.' },
        summary: 'Good work.',
        nextSteps: ['Keep practicing.'],
      }).replace('}', ',}');

      cheapProvider.gradeEssay = jest.fn().mockResolvedValue(jsonWithTrailingComma);

      const result = await gradingService.grade('Test essay');
      expect(result.result.totalScore).toBe(75);
    });

    it('should throw on empty response', async () => {
      cheapProvider.gradeEssay = jest.fn().mockResolvedValue('');

      await expect(gradingService.grade('Test essay')).rejects.toThrow(GradingError);
    });
  });
});
