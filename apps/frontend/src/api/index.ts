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
    summary: { avg: number; min: number; max: number; count: number };
    distribution: Array<{ bucket: string; count: number }>;
    topRank: Array<{ studentId: string; name: string; avgScore: number; count: number }>;
    trend: Array<{ date: string; avg: number; count: number }>;
    errorTypes: Array<{ type: string; count: number; ratio: number }>;
  };
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
    ocrText?: string | null;
    gradingJson?: unknown;
    totalScore?: number | null;
    errorCode?: string | null;
    errorMsg?: string | null;
  };
};
