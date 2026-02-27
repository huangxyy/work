import { api, authStore } from './client';
import type { LoginResponse, AuthUser } from './client';

export const login = async (account: string, password: string) => {
  const response = await api.post<LoginResponse>('/auth/login', { account, password });
  return response.data;
};

export const fetchMe = async () => {
  const response = await api.get<AuthUser>('/auth/me');
  return response.data;
};

export const logout = async () => {
  try {
    await api.post('/auth/logout');
  } finally {
    authStore.clear();
  }
};
