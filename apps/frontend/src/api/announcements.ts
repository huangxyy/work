import { api } from './client';

export type AnnouncementItem = {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  createdAt: string;
  author: { id: string; name: string };
  class?: { id: string; name: string } | null;
};

export async function fetchAnnouncements(classId?: string): Promise<AnnouncementItem[]> {
  const res = await api.get('/announcements', { params: classId ? { classId } : {} });
  return res.data;
}

export async function createAnnouncement(data: { classId?: string; title: string; content: string; pinned?: boolean }) {
  const res = await api.post('/announcements', data);
  return res.data;
}

export async function deleteAnnouncement(id: string) {
  const res = await api.delete(`/announcements/${id}`);
  return res.data;
}
