import { api } from './client';
import type { LoginResponse } from './client';

export const login = async (account: string, password: string) => {
  const response = await api.post<LoginResponse>('/auth/login', { account, password });
  return response.data;
};
