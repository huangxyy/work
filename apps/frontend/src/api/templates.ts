import { api } from './client';

export type TemplateItem = { id: string; title: string; desc?: string; createdAt: string; updatedAt: string };

export async function fetchTemplates(): Promise<TemplateItem[]> {
  const res = await api.get('/homework-templates');
  return res.data;
}

export async function createTemplate(data: { title: string; desc?: string }) {
  const res = await api.post('/homework-templates', data);
  return res.data;
}

export async function deleteTemplate(id: string) {
  const res = await api.delete(`/homework-templates/${id}`);
  return res.data;
}
