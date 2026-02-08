import { api } from './client';
import type { UserRole } from './client';

export type AdminMetrics = {
  users: { total: number; students: number; teachers: number; admins: number };
  classes: { total: number };
  enrollments: { total: number };
  homeworks: { total: number };
  submissions: { total: number; today: number };
  updatedAt: string;
};

export type AdminClassSummary = {
  id: string;
  name: string;
  grade?: string | null;
  teachers: Array<{ id: string; name: string; account: string }>;
  studentCount: number;
  teacherCount: number;
  homeworkCount: number;
  createdAt: string;
};

export type AdminSystemConfig = {
  llm: {
    providerName: string;
    baseUrl: string;
    apiKeySet: boolean;
    model: string;
    cheaperModel?: string;
    qualityModel?: string;
    maxTokens: number;
    temperature: number;
    topP?: number;
    presencePenalty?: number;
    frequencyPenalty?: number;
    timeoutMs: number;
    stop?: string[];
    responseFormat?: string;
    systemPrompt?: string;
    activeProviderId?: string;
  };
  llmProviders?: Array<{
    id: string;
    name?: string;
    baseUrl: string;
    path?: string;
    apiKeySet?: boolean;
    enabled?: boolean;
    headers?: Array<{ key: string; value: string; secret?: boolean }>;
    models?: Array<{ name: string; priceIn?: number; priceOut?: number; isDefault?: boolean }>;
  }>;
  ocr: {
    apiKeySet: boolean;
    secretKeySet: boolean;
  };
  budget: {
    enabled: boolean;
    dailyCallLimit?: number;
    mode: 'soft' | 'hard';
  };
  health?: {
    llm?: {
      ok: boolean;
      checkedAt: string;
      reason?: string;
      status?: number;
      latencyMs?: number;
      model?: string;
    } | null;
    ocr?: {
      ok: boolean;
      checkedAt: string;
      reason?: string;
      status?: number;
      latencyMs?: number;
      model?: string;
    } | null;
  };
};

export type AdminUser = {
  id: string;
  name: string;
  account: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
};

export const fetchAdminMetrics = async () => {
  const response = await api.get('/admin/metrics');
  return response.data as AdminMetrics;
};

export const fetchAdminUsers = async (params?: {
  keyword?: string;
  role?: UserRole;
  isActive?: boolean;
}) => {
  const response = await api.get('/admin/users', { params });
  return response.data as AdminUser[];
};

export const fetchAdminClassSummaries = async () => {
  const response = await api.get('/admin/classes/summary');
  return response.data as AdminClassSummary[];
};

export const fetchAdminConfig = async () => {
  const response = await api.get('/admin/config');
  return response.data as AdminSystemConfig;
};

export const updateAdminConfig = async (payload: {
  llm?: {
    providerName?: string;
    baseUrl?: string;
    apiKey?: string;
    model?: string;
    cheaperModel?: string;
    qualityModel?: string;
    maxTokens?: number;
    temperature?: number;
    topP?: number;
    presencePenalty?: number;
    frequencyPenalty?: number;
    timeoutMs?: number;
    stop?: string[];
    responseFormat?: string;
    systemPrompt?: string;
    activeProviderId?: string;
  };
  llmProviders?: Array<{
    id: string;
    name?: string;
    baseUrl?: string;
    path?: string;
    apiKey?: string;
    clearApiKey?: boolean;
    enabled?: boolean;
    headers?: Array<{ key: string; value: string; secret?: boolean }>;
    models?: Array<{ name: string; priceIn?: number; priceOut?: number; isDefault?: boolean }>;
  }>;
  ocr?: { apiKey?: string; secretKey?: string };
  budget?: { enabled?: boolean; dailyCallLimit?: number; mode?: 'soft' | 'hard' };
}) => {
  const response = await api.put('/admin/config', payload);
  return response.data as AdminSystemConfig;
};

export const fetchAdminUsage = async (days = 7) => {
  const response = await api.get('/admin/usage', { params: { days } });
  return response.data as {
    days: number;
    summary: {
      total: number;
      done: number;
      failed: number;
      queued: number;
      processing: number;
    };
    daily: Array<{
      date: string;
      total: number;
      done: number;
      failed: number;
      queued: number;
      processing: number;
    }>;
    errors: Array<{ code: string; count: number }>;
    updatedAt: string;
  };
};

export const fetchAdminQueueMetrics = async (params?: { status?: string; limit?: number }) => {
  const response = await api.get('/admin/queue/metrics', { params });
  return response.data as {
    queue: string;
    isPaused?: boolean;
    updatedAt: string;
    counts: {
      waiting: number;
      active: number;
      delayed: number;
      failed: number;
      completed: number;
      paused: number;
    };
    jobs: Array<{
      id: string | number;
      name: string;
      status: string;
      attemptsMade: number;
      timestamp: number;
      processedOn?: number | null;
      finishedOn?: number | null;
      failedReason?: string | null;
      data?: Record<string, unknown>;
    }>;
  };
};

export const retryAdminFailedJobs = async (limit?: number) => {
  const response = await api.post('/admin/queue/retry-failed', { limit });
  return response.data as { retried: number; skipped: number; total: number };
};

export const cleanAdminQueue = async (payload: {
  status?: string;
  graceMs?: number;
  limit?: number;
}) => {
  const response = await api.post('/admin/queue/clean', payload);
  return response.data as { total: number; details: Record<string, number> };
};

export const pauseAdminQueue = async () => {
  const response = await api.post('/admin/queue/pause');
  return response.data as { paused: boolean };
};

export const resumeAdminQueue = async () => {
  const response = await api.post('/admin/queue/resume');
  return response.data as { paused: boolean };
};

export const testAdminLlmHealth = async () => {
  const response = await api.get('/admin/health/llm');
  return response.data as { ok: boolean; status?: number; latencyMs?: number; reason?: string; model?: string };
};

export const testAdminLlmCall = async (payload: {
  providerId?: string;
  model?: string;
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
  responseFormat?: string;
  stop?: string[];
}) => {
  const response = await api.post('/admin/llm/test', payload);
  return response.data as {
    ok: boolean;
    status?: number;
    latencyMs?: number;
    provider?: string;
    model?: string;
    response?: string;
    usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | null;
    cost?: number;
    error?: string;
  };
};

export const fetchAdminLlmLogs = async (params?: {
  page?: number;
  pageSize?: number;
  providerId?: string;
  model?: string;
  status?: string;
  source?: string;
  from?: string;
  to?: string;
}) => {
  const response = await api.get('/admin/llm/logs', { params });
  return response.data as {
    items: Array<{
      id: string;
      source: string;
      providerId?: string | null;
      providerName?: string | null;
      model?: string | null;
      status: string;
      latencyMs?: number | null;
      promptTokens?: number | null;
      completionTokens?: number | null;
      totalTokens?: number | null;
      cost?: number | null;
      prompt?: string | null;
      systemPrompt?: string | null;
      response?: string | null;
      error?: string | null;
      meta?: unknown;
      userId?: string | null;
      submissionId?: string | null;
      createdAt: string;
    }>;
    total: number;
    page: number;
    pageSize: number;
  };
};

export const clearAdminLlmLogs = async (payload: { before?: string; source?: string }) => {
  const response = await api.delete('/admin/llm/logs', { data: payload });
  return response.data as { deleted: number };
};

export const testAdminOcrHealth = async () => {
  const response = await api.get('/admin/health/ocr');
  return response.data as { ok: boolean; status?: number; latencyMs?: number; reason?: string };
};

export const fetchAdminRetentionStatus = async () => {
  const response = await api.get('/admin/retention/status');
  return response.data as {
    config: {
      retentionDays: number;
      dryRunDefault: boolean;
      batchSizeDefault: number;
      cron: string;
      runRetention: boolean;
    };
    history: Array<{
      ranAt: string;
      invokedBy: 'cron' | 'manual';
      cutoffDate: string;
      scanned: number;
      deleted: number;
      minioOk: number;
      minioFailed: number;
      dbFailed: number;
      dryRun: boolean;
      durationMs: number;
      sampleSubmissionIds: string[];
      sampleObjectKeys: string[];
    }>;
  };
};

export const runAdminRetention = async (payload: { days?: number; dryRun?: boolean; batchSize?: number }) => {
  const response = await api.post('/admin/retention/run', payload);
  return response.data as {
    cutoffDate: string;
    scanned: number;
    deleted: number;
    minioOk: number;
    minioFailed: number;
    dbFailed: number;
    dryRun: boolean;
    durationMs: number;
    sampleSubmissionIds: string[];
    sampleObjectKeys: string[];
  };
};

export const createAdminUser = async (payload: {
  account: string;
  name: string;
  role?: UserRole;
  password: string;
}) => {
  const response = await api.post('/admin/users', payload);
  return response.data as AdminUser;
};

export const updateAdminUser = async (
  id: string,
  payload: { name?: string; role?: UserRole; isActive?: boolean },
) => {
  const response = await api.patch(`/admin/users/${id}`, payload);
  return response.data as AdminUser;
};

export const resetAdminUserPassword = async (id: string, password: string) => {
  const response = await api.post(`/admin/users/${id}/reset-password`, { password });
  return response.data as { id: string; ok: boolean };
};
