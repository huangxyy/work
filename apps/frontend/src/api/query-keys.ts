/**
 * Query keys and cache configuration for React Query
 */

// Cache time constants (in milliseconds)
export const CACHE_TIMES = {
  SHORT: 30 * 1000, // 30 seconds
  MEDIUM: 2 * 60 * 1000, // 2 minutes
  LONG: 5 * 60 * 1000, // 5 minutes
  VERY_LONG: 15 * 60 * 1000, // 15 minutes
} as const;

// Stale time constants (in milliseconds)
export const STALE_TIMES = {
  SHORT: 30 * 1000, // 30 seconds - for frequently changing data (submissions status)
  MEDIUM: 2 * 60 * 1000, // 2 minutes - for moderately changing data (homeworks, classes)
  LONG: 5 * 60 * 1000, // 5 minutes - for slowly changing data (user data, metrics)
  VERY_LONG: 15 * 60 * 1000, // 15 minutes - for rarely changing data (config)
} as const;

// Query keys factory
export const queryKeys = {
  // Auth
  auth: {
    all: ['auth'] as const,
    user: () => ['auth', 'user'] as const,
  },

  // Classes
  classes: {
    all: ['classes'] as const,
    list: () => ['classes', 'list'] as const,
    detail: (id: string) => ['classes', 'detail', id] as const,
    students: (classId: string) => ['classes', classId, 'students'] as const,
  },

  // Homeworks
  homeworks: {
    all: ['homeworks'] as const,
    list: (classId?: string) => ['homeworks', 'list', classId] as const,
    summary: (classId: string) => ['homeworks', 'summary', classId] as const,
    detail: (id: string) => ['homeworks', 'detail', id] as const,
    student: () => ['homeworks', 'student'] as const,
  },

  // Submissions
  submissions: {
    all: ['submissions'] as const,
    list: (params?: Record<string, unknown>) => ['submissions', 'list', params] as const,
    detail: (id: string) => ['submissions', 'detail', id] as const,
    homework: (homeworkId: string) => ['submissions', 'homework', homeworkId] as const,
  },

  // Reports
  reports: {
    all: ['reports'] as const,
    classOverview: (classId: string, days?: number) => ['reports', 'class', classId, days] as const,
    studentOverview: (studentId: string, days?: number) => ['reports', 'student', studentId, days] as const,
    studentSelf: (days?: number) => ['reports', 'student', 'self', days] as const,
  },

  // Teacher
  teacher: {
    all: ['teacher'] as const,
    gradingSettings: () => ['teacher', 'grading', 'settings'] as const,
    gradingPolicy: (params: Record<string, unknown>) => ['teacher', 'grading', 'policy', params] as const,
    batches: (homeworkId: string) => ['teacher', 'batches', homeworkId] as const,
    batchDetail: (batchId: string) => ['teacher', 'batches', batchId] as const,
  },

  // Admin
  admin: {
    all: ['admin'] as const,
    metrics: () => ['admin', 'metrics'] as const,
    users: (params?: Record<string, unknown>) => ['admin', 'users', params] as const,
    config: () => ['admin', 'config'] as const,
    usage: (days?: number) => ['admin', 'usage', days] as const,
    queue: (params?: Record<string, unknown>) => ['admin', 'queue', params] as const,
    retention: () => ['admin', 'retention'] as const,
  },

  // Public
  public: {
    all: ['public'] as const,
    overview: (days?: number) => ['public', 'overview', days] as const,
    landing: () => ['public', 'landing'] as const,
  },
} as const;

// Helper function to get query options with cache times
export const getQueryOptions = (
  type: 'short' | 'medium' | 'long' | 'veryLong',
) => {
  const staleTime = STALE_TIMES[type.toUpperCase() as keyof typeof STALE_TIMES];
  const gcTime = CACHE_TIMES[type.toUpperCase() as keyof typeof CACHE_TIMES];

  return {
    staleTime,
    gcTime,
  };
};
