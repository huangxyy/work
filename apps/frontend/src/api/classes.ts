import { api } from './client';

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
