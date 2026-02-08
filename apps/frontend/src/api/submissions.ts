import { api } from './client';

export const createSubmission = async (payload: {
  homeworkId: string;
  files: File[];
  mode?: 'cheap' | 'quality';
  needRewrite?: boolean;
}) => {
  const formData = new FormData();
  formData.append('homeworkId', payload.homeworkId);
  payload.files.forEach((file) => {
    formData.append('images', file);
  });
  if (payload.mode !== undefined) {
    formData.append('mode', payload.mode);
  }
  if (payload.needRewrite !== undefined) {
    formData.append('needRewrite', String(payload.needRewrite));
  }
  const response = await api.post('/submissions', formData);
  return response.data as { submissionId: string; status: string };
};

export const fetchSubmission = async (id: string) => {
  const response = await api.get(`/submissions/${id}`);
  return response.data as {
    id: string;
    status: 'QUEUED' | 'PROCESSING' | 'DONE' | 'FAILED';
    images: Array<{ id: string; objectKey: string }>;
    student?: { id: string; name: string; account: string } | null;
    homework?: { id: string; title: string } | null;
    createdAt?: string;
    updatedAt?: string;
    ocrText?: string | null;
    gradingJson?: unknown;
    totalScore?: number | null;
    errorCode?: string | null;
    errorMsg?: string | null;
  };
};

export const regradeSubmission = async (
  id: string,
  payload: { mode?: 'cheap' | 'quality'; needRewrite?: boolean },
) => {
  const response = await api.post(`/submissions/${id}/regrade`, payload);
  return response.data as { submissionId: string; status: string };
};

export const fetchStudentSubmissions = async (params?: {
  homeworkId?: string;
  keyword?: string;
  status?: 'QUEUED' | 'PROCESSING' | 'DONE' | 'FAILED';
  from?: string;
  to?: string;
  minScore?: number;
  maxScore?: number;
}) => {
  const response = await api.get('/submissions', { params });
  return response.data as Array<{
    id: string;
    homeworkId: string;
    homeworkTitle: string;
    status: 'QUEUED' | 'PROCESSING' | 'DONE' | 'FAILED';
    totalScore?: number | null;
    errorCode?: string | null;
    errorMsg?: string | null;
    updatedAt?: string;
  }>;
};

export const downloadStudentSubmissionsCsv = async (params?: {
  homeworkId?: string;
  keyword?: string;
  status?: 'QUEUED' | 'PROCESSING' | 'DONE' | 'FAILED';
  from?: string;
  to?: string;
  minScore?: number;
  maxScore?: number;
  lang?: string;
}) => {
  const response = await api.get('/submissions/export', {
    params,
    responseType: 'blob',
  });
  return response.data as Blob;
};
