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
    timeoutMs: number;
  };
  ocr: {
    baseUrl: string;
    timeoutMs: number;
  };
  budget: {
    enabled: boolean;
    dailyCallLimit?: number;
    mode: 'soft' | 'hard';
  };
};

export type TeacherSubmissionRow = {
  id: string;
  studentName: string;
  studentAccount: string;
  status: string;
  totalScore?: number | null;
  updatedAt?: string;
};

export type TeacherBatchUploadResult = {
  homeworkId: string;
  totalImages: number;
  acceptedImages: number;
  createdSubmissions: number;
  skipped: Array<{ file: string; reason: string }>;
  submissions: Array<{
    submissionId: string;
    studentAccount: string;
    studentName: string;
    imageCount: number;
  }>;
};

export type TeacherBatchPreviewResult = {
  preview: boolean;
  totalImages: number;
  matchedImages: number;
  unmatchedCount: number;
  groups: Array<{ account: string; name: string; imageCount: number }>;
  unmatched: Array<{ file: string; reason: string; fileKey?: string }>;
  skipped: Array<{ file: string; reason: string; fileKey?: string }>;
};

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    const headers = (config.headers || {}) as AxiosRequestHeaders;
    headers.Authorization = `Bearer ${token}`;
    config.headers = headers;
  }
  return config;
});

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
    class: { id: string; name: string };
  }>;
};

export const fetchClasses = async () => {
  const response = await api.get('/classes');
  return response.data as Array<{
    id: string;
    name: string;
    grade?: string | null;
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
  }>;
};

export const fetchHomeworksSummaryByClass = async (classId: string) => {
  const response = await api.get('/homeworks/summary', { params: { classId } });
  return response.data as Array<{
    id: string;
    title: string;
    desc?: string | null;
    dueAt?: string | null;
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

export const downloadTeacherClassReportCsv = async (classId: string, days = 7) => {
  const response = await api.get(`/teacher/reports/class/${classId}/export`, {
    params: { days },
    responseType: 'blob',
  });
  return response.data as Blob;
};

export const downloadTeacherClassReportPdf = async (classId: string, days = 7) => {
  const response = await api.get(`/teacher/reports/class/${classId}/pdf`, {
    params: { days },
    responseType: 'blob',
  });
  return response.data as Blob;
};

export const downloadTeacherStudentReportPdf = async (studentId: string, days = 7) => {
  const response = await api.get(`/teacher/reports/student/${studentId}/pdf`, {
    params: { days },
    responseType: 'blob',
  });
  return response.data as Blob;
};

export const createHomework = async (payload: {
  classId: string;
  title: string;
  desc?: string;
  dueAt?: string;
}) => {
  const response = await api.post('/homeworks', payload);
  return response.data;
};

export const createSubmission = async (payload: {
  homeworkId: string;
  files: File[];
}) => {
  const formData = new FormData();
  formData.append('homeworkId', payload.homeworkId);
  payload.files.forEach((file) => {
    formData.append('images', file);
  });
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

export const fetchStudentSubmissions = async () => {
  const response = await api.get('/submissions');
  return response.data as Array<{
    id: string;
    homeworkTitle: string;
    status: 'QUEUED' | 'PROCESSING' | 'DONE' | 'FAILED';
    totalScore?: number | null;
    updatedAt?: string;
  }>;
};

export const fetchAdminMetrics = async () => {
  const response = await api.get('/admin/metrics');
  return response.data as AdminMetrics;
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
    timeoutMs?: number;
  };
  ocr?: { baseUrl?: string; timeoutMs?: number };
  budget?: { enabled?: boolean; dailyCallLimit?: number; mode?: 'soft' | 'hard' };
}) => {
  const response = await api.put('/admin/config', payload);
  return response.data as AdminSystemConfig;
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
