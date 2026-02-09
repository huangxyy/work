import { api } from './client';

export const fetchStudentHomeworks = async () => {
  const response = await api.get('/homeworks/student');
  return response.data as Array<{
    id: string;
    title: string;
    desc?: string | null;
    dueAt?: string | null;
    allowLateSubmission?: boolean;
    class: { id: string; name: string };
  }>;
};

export const fetchHomeworksByClass = async (classId: string) => {
  const response = await api.get('/homeworks', { params: { classId } });
  return response.data as Array<{
    id: string;
    title: string;
    desc?: string | null;
    dueAt?: string | null;
    allowLateSubmission?: boolean;
  }>;
};

export const fetchHomeworksSummaryByClass = async (classId: string) => {
  const response = await api.get('/homeworks/summary', { params: { classId } });
  return response.data as Array<{
    id: string;
    title: string;
    desc?: string | null;
    dueAt?: string | null;
    allowLateSubmission?: boolean;
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

export const createHomework = async (payload: {
  classId: string;
  title: string;
  desc?: string;
  dueAt?: string;
  allowLateSubmission?: boolean;
}) => {
  const response = await api.post('/homeworks', payload);
  return response.data;
};

export const updateHomeworkLateSubmission = async (
  homeworkId: string,
  allowLateSubmission: boolean,
) => {
  const response = await api.patch(`/homeworks/${homeworkId}/late-submission`, {
    allowLateSubmission,
  });
  return response.data as { homeworkId: string; allowLateSubmission: boolean };
};

export const fetchHomeworkDeletePreview = async (homeworkId: string) => {
  const response = await api.get(`/homeworks/${homeworkId}/delete-preview`);
  return response.data as {
    homeworkId: string;
    submissionCount: number;
    imageCount: number;
  };
};

export const deleteHomework = async (homeworkId: string) => {
  const response = await api.delete(`/homeworks/${homeworkId}`);
  return response.data as {
    homeworkId: string;
    deleted: boolean;
    removedObjects: number;
    failedObjectDeletes: number;
  };
};
