import { api } from './client';

export type SearchResult = {
  type: 'submission' | 'homework' | 'student' | 'class';
  id: string;
  title: string;
  subtitle?: string;
  linkTo: string;
};

export async function globalSearch(q: string): Promise<SearchResult[]> {
  if (!q || q.trim().length < 2) return [];
  const res = await api.get('/search', { params: { q: q.trim() } });
  return res.data;
}
