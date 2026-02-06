import { api } from './client';

export type TeacherSubmissionRow = {
  id: string;
  studentName: string;
  studentAccount: string;
  status: string;
  totalScore?: number | null;
  errorCode?: string | null;
  errorMsg?: string | null;
  updatedAt?: string;
};

export type TeacherBatchUploadResult = {
  homeworkId: string;
  totalImages: number;
  acceptedImages: number;
  createdSubmissions: number;
  skipped: Array<{
    file: string;
    reason: string;
    fileKey?: string;
    analysisZh?: string;
    analysisEn?: string;
    confidence?: number;
    matchedAccount?: string | null;
    matchedBy?: string;
  }>;
  submissions: Array<{
    submissionId: string;
    studentAccount: string;
    studentName: string;
    imageCount: number;
  }>;
  batchId?: string;
  matchResults?: Array<{
    file: string;
    fileKey: string;
    matchedAccount?: string | null;
    matchedName?: string | null;
    matchedBy?: string;
    confidence?: number;
    analysisZh?: string;
    analysisEn?: string;
    reason?: string;
  }>;
};

export type TeacherBatchPreviewResult = {
  preview: boolean;
  totalImages: number;
  matchedImages: number;
  unmatchedCount: number;
  groups: Array<{ account: string; name: string; imageCount: number }>;
  unmatched: Array<{
    file: string;
    reason: string;
    fileKey?: string;
    analysisZh?: string;
    analysisEn?: string;
    confidence?: number;
    matchedAccount?: string | null;
    matchedBy?: string;
  }>;
  skipped: Array<{
    file: string;
    reason: string;
    fileKey?: string;
    analysisZh?: string;
    analysisEn?: string;
    confidence?: number;
    matchedAccount?: string | null;
    matchedBy?: string;
  }>;
  matchResults?: Array<{
    file: string;
    fileKey: string;
    matchedAccount?: string | null;
    matchedName?: string | null;
    matchedBy?: string;
    confidence?: number;
    analysisZh?: string;
    analysisEn?: string;
    reason?: string;
  }>;
};

export const fetchTeacherHomeworkSubmissions = async (homeworkId: string) => {
  const response = await api.get('/teacher/submissions', { params: { homeworkId } });
  return response.data as TeacherSubmissionRow[];
};

export const fetchTeacherGradingSettings = async () => {
  const response = await api.get('/teacher/settings/grading');
  return response.data as {
    grading: {
      defaultMode: string;
      needRewriteDefault: boolean;
      provider?: { id?: string; name?: string };
      model?: string | null;
      cheaperModel?: string | null;
      qualityModel?: string | null;
      maxTokens?: number | null;
      temperature?: number | null;
      topP?: number | null;
      presencePenalty?: number | null;
      frequencyPenalty?: number | null;
      timeoutMs?: number | null;
      responseFormat?: string | null;
      stop?: string[] | null;
      systemPromptSet?: boolean;
    };
    budget: {
      enabled?: boolean;
      dailyCallLimit?: number;
      mode?: 'soft' | 'hard';
    };
  };
};

export const fetchTeacherGradingPolicy = async (params: {
  classId?: string;
  homeworkId?: string;
}) => {
  const response = await api.get('/teacher/settings/grading/policies', { params });
  return response.data as {
    classPolicy?: { classId?: string | null; mode?: string | null; needRewrite?: boolean | null } | null;
    homeworkPolicy?: { homeworkId?: string | null; mode?: string | null; needRewrite?: boolean | null } | null;
    effective: { mode: 'cheap' | 'quality'; needRewrite: boolean };
  };
};

export const fetchTeacherGradingPolicyPreview = async (classId: string) => {
  const response = await api.get('/teacher/settings/grading/policies/preview', { params: { classId } });
  return response.data as {
    classId: string;
    classPolicy?: { classId?: string | null; mode?: string | null; needRewrite?: boolean | null } | null;
    items: Array<{
      homeworkId: string;
      title: string;
      dueAt?: string | null;
      createdAt: string;
      submissionCount: number;
      lastStatus?: string | null;
      lastUpdatedAt?: string | null;
      effective: { mode: 'cheap' | 'quality'; needRewrite: boolean };
      source: { mode: 'default' | 'class' | 'homework'; needRewrite: 'default' | 'class' | 'homework' };
    }>;
  };
};

export const upsertTeacherClassPolicy = async (
  classId: string,
  payload: { mode?: 'cheap' | 'quality'; needRewrite?: boolean },
) => {
  const response = await api.put(`/teacher/settings/grading/policies/class/${classId}`, payload);
  return response.data as { id: string };
};

export const clearTeacherClassPolicy = async (classId: string) => {
  const response = await api.delete(`/teacher/settings/grading/policies/class/${classId}`);
  return response.data as { count?: number };
};

export const upsertTeacherHomeworkPolicy = async (
  homeworkId: string,
  payload: { mode?: 'cheap' | 'quality'; needRewrite?: boolean },
) => {
  const response = await api.put(`/teacher/settings/grading/policies/homework/${homeworkId}`, payload);
  return response.data as { id: string };
};

export const clearTeacherHomeworkPolicy = async (homeworkId: string) => {
  const response = await api.delete(`/teacher/settings/grading/policies/homework/${homeworkId}`);
  return response.data as { count?: number };
};

export const createTeacherBatchSubmissions = async (payload: {
  homeworkId: string;
  images?: File[];
  archive?: File | null;
  mode?: 'cheap' | 'quality';
  needRewrite?: boolean;
  mappingOverrides?: Record<string, string>;
}) => {
  const formData = new FormData();
  formData.append('homeworkId', payload.homeworkId);
  if (payload.mode) {
    formData.append('mode', payload.mode);
  }
  if (payload.needRewrite !== undefined) {
    formData.append('needRewrite', String(payload.needRewrite));
  }
  if (payload.mappingOverrides) {
    formData.append('mappingOverrides', JSON.stringify(payload.mappingOverrides));
  }
  if (payload.images) {
    payload.images.forEach((file) => {
      formData.append('images', file);
    });
  }
  if (payload.archive) {
    formData.append('archive', payload.archive);
  }
  const response = await api.post('/teacher/submissions/batch', formData);
  return response.data as TeacherBatchUploadResult;
};

export const previewTeacherBatchSubmissions = async (payload: {
  homeworkId: string;
  images?: File[];
  archive?: File | null;
}) => {
  const formData = new FormData();
  formData.append('homeworkId', payload.homeworkId);
  formData.append('dryRun', 'true');
  if (payload.images) {
    payload.images.forEach((file) => {
      formData.append('images', file);
    });
  }
  if (payload.archive) {
    formData.append('archive', payload.archive);
  }
  const response = await api.post('/teacher/submissions/batch', formData);
  return response.data as TeacherBatchPreviewResult;
};

export const regradeHomeworkSubmissions = async (payload: {
  homeworkId: string;
  mode?: 'cheap' | 'quality';
  needRewrite?: boolean;
}) => {
  const response = await api.post('/teacher/submissions/regrade', payload);
  return response.data as { homeworkId: string; count: number };
};

export const fetchTeacherBatchUploads = async (homeworkId: string) => {
  const response = await api.get('/teacher/submissions/batches', { params: { homeworkId } });
  return response.data as Array<{
    id: string;
    homeworkId: string;
    uploader: { id: string; name: string; account: string };
    totalImages: number;
    matchedImages: number;
    unmatchedCount: number;
    createdSubmissions: number;
    skipped?: Array<{
      file: string;
      reason: string;
      fileKey?: string;
      analysisZh?: string;
      analysisEn?: string;
      confidence?: number;
      matchedAccount?: string | null;
      matchedBy?: string;
    }> | null;
    mode?: string | null;
    needRewrite: boolean;
    createdAt: string;
    status: string;
    statusCounts: { queued: number; processing: number; done: number; failed: number };
  }>;
};

export const fetchTeacherBatchUploadDetail = async (batchId: string) => {
  const response = await api.get(`/teacher/submissions/batches/${batchId}`);
  return response.data as {
    id: string;
    homework: { id: string; title: string } | null;
    uploader: { id: string; name: string; account: string };
    totalImages: number;
    matchedImages: number;
    unmatchedCount: number;
    createdSubmissions: number;
    skipped?: Array<{
      file: string;
      reason: string;
      fileKey?: string;
      analysisZh?: string;
      analysisEn?: string;
      confidence?: number;
      matchedAccount?: string | null;
      matchedBy?: string;
    }> | null;
    mode?: string | null;
    needRewrite: boolean;
    createdAt: string;
    updatedAt: string;
    status: string;
    statusCounts: { queued: number; processing: number; done: number; failed: number };
    submissions: Array<{
      id: string;
      studentName: string;
      studentAccount: string;
      status: string;
      totalScore?: number | null;
      errorCode?: string | null;
      errorMsg?: string | null;
      updatedAt?: string;
    }>;
  };
};

export const retryTeacherBatchUploads = async (batchId: string) => {
  const response = await api.post(`/teacher/submissions/batches/${batchId}/retry`);
  return response.data as { batchId: string; count: number };
};

export const downloadTeacherHomeworkSubmissionsCsv = async (homeworkId: string, lang?: string) => {
  const response = await api.get('/teacher/submissions/export', {
    params: { homeworkId, lang },
    responseType: 'blob',
  });
  return response.data as Blob;
};

export const downloadTeacherHomeworkImagesZip = async (homeworkId: string) => {
  const response = await api.get('/teacher/submissions/images', {
    params: { homeworkId },
    responseType: 'blob',
  });
  return response.data as Blob;
};

export const downloadTeacherHomeworkRemindersCsv = async (homeworkId: string, lang?: string) => {
  const response = await api.get('/teacher/submissions/reminders', {
    params: { homeworkId, lang },
    responseType: 'blob',
  });
  return response.data as Blob;
};
