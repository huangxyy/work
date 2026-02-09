import axios, { type AxiosRequestHeaders } from 'axios';

export type UserRole = 'STUDENT' | 'TEACHER' | 'ADMIN';

export type AuthUser = {
  id: string;
  account: string;
  name: string;
  role: UserRole;
};

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

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
});

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

    // Auto-logout on 401 (expired/invalid token) to redirect to login.
    // Avoid redirect loops by skipping the login endpoint itself.
    if (
      error?.response?.status === 401 &&
      !configWithMeta.url?.includes('/auth/login')
    ) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      // Only redirect if not already on the login page
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
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

export type LoginResponse = {
  token: string;
  user: AuthUser;
};
