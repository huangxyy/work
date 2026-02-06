import axios, { type AxiosRequestHeaders } from 'axios';

export type UserRole = 'STUDENT' | 'TEACHER' | 'ADMIN';

export type AuthUser = {
  id: string;
  account: string;
  name: string;
  role: UserRole;
};

export type LoginResponse = {
  token: string;
  user: AuthUser;
};

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

export type TeacherSubmissionRow = {
  id: string;
  studentName: string;
  studentAccount: string;
  status: string;
  totalScore?: number | null;
  errorCode?: string | null;
  errorMsg?: string | null;
  updatedAt?: string;
};

export type TeacherBatchUploadResult = {
  homeworkId: string;
  totalImages: number;
  acceptedImages: number;
  createdSubmissions: number;
  skipped: Array<{
    file: string;
    reason: string;
    fileKey?: string;
    analysisZh?: string;
    analysisEn?: string;
    confidence?: number;
    matchedAccount?: string | null;
    matchedBy?: string;
  }>;
  submissions: Array<{
    submissionId: string;
    studentAccount: string;
    studentName: string;
    imageCount: number;
  }>;
  batchId?: string;
  matchResults?: Array<{
    file: string;
    fileKey: string;
    matchedAccount?: string | null;
    matchedName?: string | null;
    matchedBy?: string;
    confidence?: number;
    analysisZh?: string;
    analysisEn?: string;
    reason?: string;
  }>;
};

export type TeacherBatchPreviewResult = {
  preview: boolean;
  totalImages: number;
  matchedImages: number;
  unmatchedCount: number;
  groups: Array<{ account: string; name: string; imageCount: number }>;
  unmatched: Array<{
    file: string;
    reason: string;
    fileKey?: string;
    analysisZh?: string;
    analysisEn?: string;
    confidence?: number;
    matchedAccount?: string | null;
    matchedBy?: string;
  }>;
  skipped: Array<{
    file: string;
    reason: string;
    fileKey?: string;
    analysisZh?: string;
    analysisEn?: string;
    confidence?: number;
    matchedAccount?: string | null;
    matchedBy?: string;
  }>;
  matchResults?: Array<{
    file: string;
    fileKey: string;
    matchedAccount?: string | null;
    matchedName?: string | null;
    matchedBy?: string;
    confidence?: number;
    analysisZh?: string;
    analysisEn?: string;
    reason?: string;
  }>;
};

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
});

type RequestMeta = { requestKey?: string };
type ConfigWithMeta = {
  metadata?: RequestMeta;
} & {
  method?: string;
  baseURL?: string;
  url?: string;
  params?: unknown;
  signal?: AbortSignal;
  headers?: unknown;
};

const pendingRequests = new Map<string, AbortController>();

const buildRequestKey = (config: ConfigWithMeta) => {
  if (!config.method || !config.url) {
    return null;
  }
  const method = config.method.toLowerCase();
  if (method !== 'get') {
    return null;
  }
  const base = config.baseURL ?? '';
  const url = `${base}${config.url}`;
  let params = '';
  if (config.params) {
    try {
      params = JSON.stringify(config.params);
    } catch {
      params = '';
    }
  }
  return `${method}:${url}:${params}`;
};

api.interceptors.request.use((config) => {
  const configWithMeta = config as ConfigWithMeta;
  const requestKey = buildRequestKey(configWithMeta);
  if (requestKey && !configWithMeta.signal) {
    const previous = pendingRequests.get(requestKey);
    if (previous) {
      previous.abort();
    }
    const controller = new AbortController();
    configWithMeta.signal = controller.signal;
    pendingRequests.set(requestKey, controller);
    configWithMeta.metadata = { requestKey };
  }

  const token = localStorage.getItem('auth_token');
  if (token) {
    const headers = (config.headers || {}) as AxiosRequestHeaders;
    headers.Authorization = `Bearer ${token}`;
    config.headers = headers;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    const configWithMeta = response.config as ConfigWithMeta;
    const requestKey = configWithMeta.metadata?.requestKey;
    if (requestKey) {
      pendingRequests.delete(requestKey);
    }
    return response;
  },
  (error) => {
    const configWithMeta = (error?.config ?? {}) as ConfigWithMeta;
    const requestKey = configWithMeta.metadata?.requestKey;
    if (requestKey) {
      pendingRequests.delete(requestKey);
    }
    return Promise.reject(error);
  },
);

export const authStore = {
  getToken: () => localStorage.getItem('auth_token'),
  setToken: (token: string) => localStorage.setItem('auth_token', token),
  clear: () => localStorage.removeItem('auth_token'),
  setUser: (user: AuthUser) => localStorage.setItem('auth_user', JSON.stringify(user)),
  getUser: (): AuthUser | null => {
    const raw = localStorage.getItem('auth_user');
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as AuthUser;
    } catch {
      return null;
    }
  },
};

export const login = async (account: string, password: string) => {
  const response = await api.post<LoginResponse>('/auth/login', { account, password });
  return response.data;
};

export const fetchStudentHomeworks = async () => {
  const response = await api.get('/homeworks/student');
  return response.data as Array<{
    id: string;
    title: string;
    desc?: string | null;
    dueAt?: string | null;
    allowLateSubmission?: boolean;
    class: { id: string; name: string };
  }>;
};

export const fetchClasses = async () => {
  const response = await api.get('/classes');
  return response.data as Array<{
    id: string;
    name: string;
    grade?: string | null;
    teachers?: Array<{ id: string; name: string; account: string }>;
  }>;
};

export const createClass = async (payload: { name: string; grade?: string }) => {
  const response = await api.post('/classes', payload);
  return response.data;
};

export const fetchHomeworksByClass = async (classId: string) => {
  const response = await api.get('/homeworks', { params: { classId } });
  return response.data as Array<{
    id: string;
    title: string;
    desc?: string | null;
    dueAt?: string | null;
    allowLateSubmission?: boolean;
  }>;
};

export const fetchHomeworksSummaryByClass = async (classId: string) => {
  const response = await api.get('/homeworks/summary', { params: { classId } });
  return response.data as Array<{
    id: string;
    title: string;
    desc?: string | null;
    dueAt?: string | null;
    allowLateSubmission?: boolean;
    createdAt: string;
    totalStudents: number;
    submittedStudents: number;
    pendingStudents: number;
    submissionsTotal: number;
    queuedCount: number;
    processingCount: number;
    doneCount: number;
    failedCount: number;
  }>;
};

export const fetchClassStudents = async (classId: string) => {
  const response = await api.get(`/classes/${classId}/students`);
  return response.data as Array<{
    id: string;
    account: string;
    name: string;
  }>;
};

export const importClassStudents = async (
  classId: string,
  payload: { text?: string; students?: Array<{ account: string; name: string }>; defaultPassword?: string },
) => {
  const response = await api.post(`/classes/${classId}/students/import`, payload);
  return response.data as {
    total: number;
    created: Array<{ account: string; name: string }>;
    existing: Array<{ account: string; name: string }>;
    failed: Array<{ account: string; name: string; error: string }>;
    enrolled: number;
  };
};

export const updateClassTeachers = async (classId: string, teacherIds: string[]) => {
  const response = await api.patch(`/classes/${classId}/teachers`, { teacherIds });
  return response.data as { id: string; teachers: Array<{ id: string; name: string; account: string }> };
};

export const removeClassStudent = async (classId: string, studentId: string) => {
  const response = await api.delete(`/classes/${classId}/students/${studentId}`);
  return response.data as { removed: number };
};

export const fetchTeacherClassReportOverview = async (
  classId: string,
  days = 7,
  topN = 5,
) => {
  const response = await api.get(`/teacher/reports/class/${classId}/overview`, {
    params: { days, topN },
  });
  return response.data as {
    classId: string;
    className: string;
    rangeDays: number;
    totalStudents: number;
    submittedStudents: number;
    pendingStudents: number;
    submissionRate: number;
    summary: { avg: number; min: number; max: number; count: number };
    distribution: Array<{ bucket: string; count: number }>;
    topRank: Array<{ studentId: string; name: string; avgScore: number; count: number }>;
    trend: Array<{ date: string; avg: number; count: number }>;
    errorTypes: Array<{ type: string; count: number; ratio: number }>;
  };
};

export const fetchTeacherStudentReportOverview = async (studentId: string, days = 7) => {
  const response = await api.get(`/teacher/reports/student/${studentId}/overview`, {
    params: { days },
  });
  return response.data as {
    studentId: string;
    studentName: string;
    rangeDays: number;
    summary: { avg: number; min: number; max: number; count: number };
    trend: Array<{ date: string; avg: number; count: number }>;
    errorTypes: Array<{ type: string; count: number; ratio: number }>;
    nextSteps: Array<{ text: string; count: number }>;
  };
};

export const downloadTeacherClassReportCsv = async (classId: string, days = 7, lang?: string) => {
  const response = await api.get(`/teacher/reports/class/${classId}/export`, {
    params: { days, lang },
    responseType: 'blob',
  });
  return response.data as Blob;
};

export const downloadTeacherClassReportPdf = async (classId: string, days = 7, lang?: string) => {
  const response = await api.get(`/teacher/reports/class/${classId}/pdf`, {
    params: { days, lang },
    responseType: 'blob',
  });
  return response.data as Blob;
};

export const downloadTeacherStudentReportPdf = async (studentId: string, days = 7, lang?: string) => {
  const response = await api.get(`/teacher/reports/student/${studentId}/pdf`, {
    params: { days, lang },
    responseType: 'blob',
  });
  return response.data as Blob;
};

export const fetchStudentReportOverview = async (days = 7) => {
  const response = await api.get('/student/reports/overview', { params: { days } });
  return response.data as {
    studentId: string;
    studentName: string;
    rangeDays: number;
    summary: { avg: number; min: number; max: number; count: number };
    trend: Array<{ date: string; avg: number; count: number }>;
    errorTypes: Array<{ type: string; count: number; ratio: number }>;
    nextSteps: Array<{ text: string; count: number }>;
  };
};

export const downloadStudentReportPdf = async (days = 7, lang?: string) => {
  const response = await api.get('/student/reports/pdf', {
    params: { days, lang },
    responseType: 'blob',
  });
  return response.data as Blob;
};

export const createHomework = async (payload: {
  classId: string;
  title: string;
  desc?: string;
  dueAt?: string;
  allowLateSubmission?: boolean;
}) => {
  const response = await api.post('/homeworks', payload);
  return response.data;
};

export const updateHomeworkLateSubmission = async (
  homeworkId: string,
  allowLateSubmission: boolean,
) => {
  const response = await api.patch(`/homeworks/${homeworkId}/late-submission`, {
    allowLateSubmission,
  });
  return response.data as { homeworkId: string; allowLateSubmission: boolean };
};

export const fetchHomeworkDeletePreview = async (homeworkId: string) => {
  const response = await api.get(`/homeworks/${homeworkId}/delete-preview`);
  return response.data as {
    homeworkId: string;
    submissionCount: number;
    imageCount: number;
  };
};

export const deleteHomework = async (homeworkId: string) => {
  const response = await api.delete(`/homeworks/${homeworkId}`);
  return response.data as {
    homeworkId: string;
    deleted: boolean;
    removedObjects: number;
    failedObjectDeletes: number;
  };
};

export const createSubmission = async (payload: {
  homeworkId: string;
  files: File[];
  mode?: 'cheap' | 'quality';
  needRewrite?: boolean;
}) => {
  const formData = new FormData();
  formData.append('homeworkId', payload.homeworkId);
  payload.files.forEach((file) => {
    formData.append('images', file);
  });
  if (payload.mode !== undefined) {
    formData.append('mode', payload.mode);
  }
  if (payload.needRewrite !== undefined) {
    formData.append('needRewrite', String(payload.needRewrite));
  }
  const response = await api.post('/submissions', formData);
  return response.data as { submissionId: string; status: string };
};

export const fetchSubmission = async (id: string) => {
  const response = await api.get(`/submissions/${id}`);
  return response.data as {
    id: string;
    status: 'QUEUED' | 'PROCESSING' | 'DONE' | 'FAILED';
    images: Array<{ id: string; objectKey: string }>;
    student?: { id: string; name: string; account: string } | null;
    homework?: { id: string; title: string } | null;
    createdAt?: string;
    updatedAt?: string;
    ocrText?: string | null;
    gradingJson?: unknown;
    totalScore?: number | null;
    errorCode?: string | null;
    errorMsg?: string | null;
  };
};

export const regradeSubmission = async (
  id: string,
  payload: { mode?: 'cheap' | 'quality'; needRewrite?: boolean },
) => {
  const response = await api.post(`/submissions/${id}/regrade`, payload);
  return response.data as { submissionId: string; status: string };
};

export const fetchStudentSubmissions = async (params?: {
  homeworkId?: string;
  keyword?: string;
  status?: 'QUEUED' | 'PROCESSING' | 'DONE' | 'FAILED';
  from?: string;
  to?: string;
  minScore?: number;
  maxScore?: number;
}) => {
  const response = await api.get('/submissions', { params });
  return response.data as Array<{
    id: string;
    homeworkId: string;
    homeworkTitle: string;
    status: 'QUEUED' | 'PROCESSING' | 'DONE' | 'FAILED';
    totalScore?: number | null;
    errorCode?: string | null;
    errorMsg?: string | null;
    updatedAt?: string;
  }>;
};

export const downloadStudentSubmissionsCsv = async (params?: {
  homeworkId?: string;
  keyword?: string;
  status?: 'QUEUED' | 'PROCESSING' | 'DONE' | 'FAILED';
  from?: string;
  to?: string;
  minScore?: number;
  maxScore?: number;
  lang?: string;
}) => {
  const response = await api.get('/submissions/export', {
    params,
    responseType: 'blob',
  });
  return response.data as Blob;
};

export const fetchAdminMetrics = async () => {
  const response = await api.get('/admin/metrics');
  return response.data as AdminMetrics;
};

export const fetchPublicOverview = async (days = 7) => {
  const response = await api.get('/public/overview', { params: { days } });
  return response.data as {
    days: number;
    homeworks: number;
    submissions: number;
    completionRate: number;
    updatedAt: string;
  };
};

export type PublicLandingPayload = {
  version: number;
  generatedAt: string;
  ttlSeconds: number;
  theme: {
    background: string;
    surface: string;
    surfaceStrong: string;
    text: string;
    muted: string;
    border: string;
    accent: string;
    accentAlt: string;
    glow: string;
    orb1: string;
    orb2: string;
    orb3: string;
    noiseOpacity: number;
  };
  content: {
    zh: {
      brand: { title: string; tagline: string; description: string };
      hero: { headline: string; subhead: string; note: string; primaryCta: string; secondaryCta: string };
      highlights: Array<{ title: string; desc: string }>;
      capabilities: Array<{ title: string; desc: string }>;
      workflow: Array<{ title: string; desc: string }>;
      metrics: Array<{ label: string; value: string; hint?: string }>;
      proof: Array<{ title: string; desc: string }>;
      faq: Array<{ question: string; answer: string }>;
      cta: { title: string; subtitle: string; primary: string; secondary: string };
      consult: {
        title: string;
        subtitle: string;
        fields: { name: string; org: string; contact: string; need: string };
        submit: string;
        success: string;
      };
    };
    en: {
      brand: { title: string; tagline: string; description: string };
      hero: { headline: string; subhead: string; note: string; primaryCta: string; secondaryCta: string };
      highlights: Array<{ title: string; desc: string }>;
      capabilities: Array<{ title: string; desc: string }>;
      workflow: Array<{ title: string; desc: string }>;
      metrics: Array<{ label: string; value: string; hint?: string }>;
      proof: Array<{ title: string; desc: string }>;
      faq: Array<{ question: string; answer: string }>;
      cta: { title: string; subtitle: string; primary: string; secondary: string };
      consult: {
        title: string;
        subtitle: string;
        fields: { name: string; org: string; contact: string; need: string };
        submit: string;
        success: string;
      };
    };
  };
};

export const fetchPublicLanding = async () => {
  const response = await api.get('/public/landing', { timeout: 8000 });
  return response.data as PublicLandingPayload;
};

export type AdminUser = {
  id: string;
  name: string;
  account: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
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

export const fetchTeacherHomeworkSubmissions = async (homeworkId: string) => {
  const response = await api.get('/teacher/submissions', { params: { homeworkId } });
  return response.data as TeacherSubmissionRow[];
};

export const fetchTeacherGradingSettings = async () => {
  const response = await api.get('/teacher/settings/grading');
  return response.data as {
    grading: {
      defaultMode: string;
      needRewriteDefault: boolean;
      provider?: { id?: string; name?: string };
      model?: string | null;
      cheaperModel?: string | null;
      qualityModel?: string | null;
      maxTokens?: number | null;
      temperature?: number | null;
      topP?: number | null;
      presencePenalty?: number | null;
      frequencyPenalty?: number | null;
      timeoutMs?: number | null;
      responseFormat?: string | null;
      stop?: string[] | null;
      systemPromptSet?: boolean;
    };
    budget: {
      enabled?: boolean;
      dailyCallLimit?: number;
      mode?: 'soft' | 'hard';
    };
  };
};

export const fetchTeacherGradingPolicy = async (params: {
  classId?: string;
  homeworkId?: string;
}) => {
  const response = await api.get('/teacher/settings/grading/policies', { params });
  return response.data as {
    classPolicy?: { classId?: string | null; mode?: string | null; needRewrite?: boolean | null } | null;
    homeworkPolicy?: { homeworkId?: string | null; mode?: string | null; needRewrite?: boolean | null } | null;
    effective: { mode: 'cheap' | 'quality'; needRewrite: boolean };
  };
};

export const fetchTeacherGradingPolicyPreview = async (classId: string) => {
  const response = await api.get('/teacher/settings/grading/policies/preview', { params: { classId } });
  return response.data as {
    classId: string;
    classPolicy?: { classId?: string | null; mode?: string | null; needRewrite?: boolean | null } | null;
    items: Array<{
      homeworkId: string;
      title: string;
      dueAt?: string | null;
      createdAt: string;
      submissionCount: number;
      lastStatus?: string | null;
      lastUpdatedAt?: string | null;
      effective: { mode: 'cheap' | 'quality'; needRewrite: boolean };
      source: { mode: 'default' | 'class' | 'homework'; needRewrite: 'default' | 'class' | 'homework' };
    }>;
  };
};

export const upsertTeacherClassPolicy = async (
  classId: string,
  payload: { mode?: 'cheap' | 'quality'; needRewrite?: boolean },
) => {
  const response = await api.put(`/teacher/settings/grading/policies/class/${classId}`, payload);
  return response.data as { id: string };
};

export const clearTeacherClassPolicy = async (classId: string) => {
  const response = await api.delete(`/teacher/settings/grading/policies/class/${classId}`);
  return response.data as { count?: number };
};

export const upsertTeacherHomeworkPolicy = async (
  homeworkId: string,
  payload: { mode?: 'cheap' | 'quality'; needRewrite?: boolean },
) => {
  const response = await api.put(`/teacher/settings/grading/policies/homework/${homeworkId}`, payload);
  return response.data as { id: string };
};

export const clearTeacherHomeworkPolicy = async (homeworkId: string) => {
  const response = await api.delete(`/teacher/settings/grading/policies/homework/${homeworkId}`);
  return response.data as { count?: number };
};

export const createTeacherBatchSubmissions = async (payload: {
  homeworkId: string;
  images?: File[];
  archive?: File | null;
  mode?: 'cheap' | 'quality';
  needRewrite?: boolean;
  mappingOverrides?: Record<string, string>;
}) => {
  const formData = new FormData();
  formData.append('homeworkId', payload.homeworkId);
  if (payload.mode) {
    formData.append('mode', payload.mode);
  }
  if (payload.needRewrite !== undefined) {
    formData.append('needRewrite', String(payload.needRewrite));
  }
  if (payload.mappingOverrides) {
    formData.append('mappingOverrides', JSON.stringify(payload.mappingOverrides));
  }
  if (payload.images) {
    payload.images.forEach((file) => {
      formData.append('images', file);
    });
  }
  if (payload.archive) {
    formData.append('archive', payload.archive);
  }
  const response = await api.post('/teacher/submissions/batch', formData);
  return response.data as TeacherBatchUploadResult;
};

export const previewTeacherBatchSubmissions = async (payload: {
  homeworkId: string;
  images?: File[];
  archive?: File | null;
}) => {
  const formData = new FormData();
  formData.append('homeworkId', payload.homeworkId);
  formData.append('dryRun', 'true');
  if (payload.images) {
    payload.images.forEach((file) => {
      formData.append('images', file);
    });
  }
  if (payload.archive) {
    formData.append('archive', payload.archive);
  }
  const response = await api.post('/teacher/submissions/batch', formData);
  return response.data as TeacherBatchPreviewResult;
};

export const regradeHomeworkSubmissions = async (payload: {
  homeworkId: string;
  mode?: 'cheap' | 'quality';
  needRewrite?: boolean;
}) => {
  const response = await api.post('/teacher/submissions/regrade', payload);
  return response.data as { homeworkId: string; count: number };
};

export const fetchTeacherBatchUploads = async (homeworkId: string) => {
  const response = await api.get('/teacher/submissions/batches', { params: { homeworkId } });
  return response.data as Array<{
    id: string;
    homeworkId: string;
    uploader: { id: string; name: string; account: string };
    totalImages: number;
    matchedImages: number;
    unmatchedCount: number;
    createdSubmissions: number;
    skipped?: Array<{
      file: string;
      reason: string;
      fileKey?: string;
      analysisZh?: string;
      analysisEn?: string;
      confidence?: number;
      matchedAccount?: string | null;
      matchedBy?: string;
    }> | null;
    mode?: string | null;
    needRewrite: boolean;
    createdAt: string;
    status: string;
    statusCounts: { queued: number; processing: number; done: number; failed: number };
  }>;
};

export const fetchTeacherBatchUploadDetail = async (batchId: string) => {
  const response = await api.get(`/teacher/submissions/batches/${batchId}`);
  return response.data as {
    id: string;
    homework: { id: string; title: string } | null;
    uploader: { id: string; name: string; account: string };
    totalImages: number;
    matchedImages: number;
    unmatchedCount: number;
    createdSubmissions: number;
    skipped?: Array<{
      file: string;
      reason: string;
      fileKey?: string;
      analysisZh?: string;
      analysisEn?: string;
      confidence?: number;
      matchedAccount?: string | null;
      matchedBy?: string;
    }> | null;
    mode?: string | null;
    needRewrite: boolean;
    createdAt: string;
    updatedAt: string;
    status: string;
    statusCounts: { queued: number; processing: number; done: number; failed: number };
    submissions: Array<{
      id: string;
      studentName: string;
      studentAccount: string;
      status: string;
      totalScore?: number | null;
      errorCode?: string | null;
      errorMsg?: string | null;
      updatedAt?: string;
    }>;
  };
};

export const retryTeacherBatchUploads = async (batchId: string) => {
  const response = await api.post(`/teacher/submissions/batches/${batchId}/retry`);
  return response.data as { batchId: string; count: number };
};

export const downloadTeacherHomeworkSubmissionsCsv = async (homeworkId: string, lang?: string) => {
  const response = await api.get('/teacher/submissions/export', {
    params: { homeworkId, lang },
    responseType: 'blob',
  });
  return response.data as Blob;
};

export const downloadTeacherHomeworkImagesZip = async (homeworkId: string) => {
  const response = await api.get('/teacher/submissions/images', {
    params: { homeworkId },
    responseType: 'blob',
  });
  return response.data as Blob;
};

export const downloadTeacherHomeworkRemindersCsv = async (homeworkId: string, lang?: string) => {
  const response = await api.get('/teacher/submissions/reminders', {
    params: { homeworkId, lang },
    responseType: 'blob',
  });
  return response.data as Blob;
};

export const downloadTeacherHomeworkPrintPacket = async (
  homeworkId: string,
  options?: { lang?: string; submissionIds?: string[] },
) => {
  const response = await api.get('/teacher/submissions/print', {
    params: {
      homeworkId,
      lang: options?.lang,
      submissionIds: options?.submissionIds?.length ? options.submissionIds.join(',') : undefined,
    },
    responseType: 'blob',
  });

  return {
    blob: response.data as Blob,
    mimeType: String(response.headers['content-type'] || ''),
    fileName: String(response.headers['content-disposition'] || ''),
    files: Number(response.headers['x-print-packet-files'] || 1),
    totalStudents: Number(response.headers['x-print-packet-students'] || 0),
  };
};
