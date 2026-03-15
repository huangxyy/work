import axios, { type AxiosRequestHeaders } from 'axios';
import { authTokenStorage, authUserStorage } from '../utils/storage';

export type UserRole = 'STUDENT' | 'TEACHER' | 'ADMIN';

export type AuthUser = {
  id: string;
  account: string;
  name: string;
  role: UserRole;
  email?: string | null;
  phone?: string | null;
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
    } catch (error) {
      // 忽略序列化错误
      params = '';
    }
  }
  return `${method}:${url}:${params}`;
};

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  timeout: 30_000,
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

  // 使用封装的 storage 工具
  const token = authTokenStorage.get();
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

    if (axios.isCancel(error)) {
      return Promise.reject(error);
    }

    if (
      error?.response?.status === 401 &&
      !configWithMeta.url?.includes('/auth/login')
    ) {
      authStore.clear();
      if (!window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  },
);

export const authStore = {
  getToken: () => authTokenStorage.get(),
  setToken: (token: string) => authTokenStorage.set(token),
  clear: () => {
    authTokenStorage.remove();
    authUserStorage.remove();
  },
  setUser: (user: AuthUser) => authUserStorage.set(user),
  getUser: (): AuthUser | null => authUserStorage.get(),
};

export type LoginResponse = {
  token: string;
  user: AuthUser;
};
