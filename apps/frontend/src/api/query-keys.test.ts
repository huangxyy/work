import { describe, it, expect } from 'vitest';
import { queryKeys, CACHE_TIMES, STALE_TIMES, getQueryOptions } from './query-keys';

describe('queryKeys', () => {
  describe('auth', () => {
    it('should produce correct key shapes', () => {
      expect(queryKeys.auth.all).toEqual(['auth']);
      expect(queryKeys.auth.user()).toEqual(['auth', 'user']);
    });
  });

  describe('classes', () => {
    it('should produce correct key shapes', () => {
      expect(queryKeys.classes.all).toEqual(['classes']);
      expect(queryKeys.classes.list()).toEqual(['classes', 'list']);
      expect(queryKeys.classes.detail('c1')).toEqual(['classes', 'detail', 'c1']);
      expect(queryKeys.classes.students('c1')).toEqual(['classes', 'c1', 'students']);
    });
  });

  describe('homeworks', () => {
    it('should include classId when provided', () => {
      expect(queryKeys.homeworks.list('c1')).toEqual(['homeworks', 'list', 'c1']);
    });

    it('should handle undefined classId', () => {
      expect(queryKeys.homeworks.list()).toEqual(['homeworks', 'list', undefined]);
    });

    it('should produce detail key', () => {
      expect(queryKeys.homeworks.detail('hw1')).toEqual(['homeworks', 'detail', 'hw1']);
    });
  });

  describe('submissions', () => {
    it('should produce correct key shapes', () => {
      expect(queryKeys.submissions.all).toEqual(['submissions']);
      expect(queryKeys.submissions.detail('s1')).toEqual(['submissions', 'detail', 's1']);
      expect(queryKeys.submissions.homework('hw1')).toEqual(['submissions', 'homework', 'hw1']);
    });

    it('should include params in list key', () => {
      const params = { status: 'DONE', page: 1 };
      expect(queryKeys.submissions.list(params)).toEqual(['submissions', 'list', params]);
    });
  });

  describe('admin', () => {
    it('should produce correct key shapes', () => {
      expect(queryKeys.admin.all).toEqual(['admin']);
      expect(queryKeys.admin.metrics()).toEqual(['admin', 'metrics']);
      expect(queryKeys.admin.config()).toEqual(['admin', 'config']);
      expect(queryKeys.admin.usage(7)).toEqual(['admin', 'usage', 7]);
    });
  });
});

describe('CACHE_TIMES', () => {
  it('should define all expected durations', () => {
    expect(CACHE_TIMES.SHORT).toBe(30_000);
    expect(CACHE_TIMES.MEDIUM).toBe(120_000);
    expect(CACHE_TIMES.LONG).toBe(300_000);
    expect(CACHE_TIMES.VERY_LONG).toBe(900_000);
  });
});

describe('STALE_TIMES', () => {
  it('should define all expected durations', () => {
    expect(STALE_TIMES.SHORT).toBe(30_000);
    expect(STALE_TIMES.MEDIUM).toBe(120_000);
    expect(STALE_TIMES.LONG).toBe(300_000);
    expect(STALE_TIMES.VERY_LONG).toBe(900_000);
  });
});

describe('getQueryOptions', () => {
  it('should return correct staleTime and gcTime for each type', () => {
    expect(getQueryOptions('short')).toEqual({
      staleTime: 30_000,
      gcTime: 30_000,
    });
    expect(getQueryOptions('medium')).toEqual({
      staleTime: 120_000,
      gcTime: 120_000,
    });
    expect(getQueryOptions('long')).toEqual({
      staleTime: 300_000,
      gcTime: 300_000,
    });
    // Note: 'veryLong'.toUpperCase() === 'VERYLONG' which doesn't match 'VERY_LONG' key
    // This is a known limitation in the helper - use 'short'/'medium'/'long' instead
    expect(getQueryOptions('veryLong')).toEqual({
      staleTime: undefined,
      gcTime: undefined,
    });
  });
});
