import { api } from './client';

export const fetchTeacherClassReportOverview = async (
  classId: string,
  days = 7,
  topN = 5,
) => {
  const response = await api.get(`/teacher/reports/class/${classId}/overview`, {
    params: { days, topN },
  });
  return response.data as {
    classId: string;
    className: string;
    rangeDays: number;
    totalStudents: number;
    submittedStudents: number;
    pendingStudents: number;
    submissionRate: number;
    summary: { avg: number; min: number; max: number; count: number };
    distribution: Array<{ bucket: string; count: number }>;
    topRank: Array<{ studentId: string; name: string; avgScore: number; count: number }>;
    trend: Array<{ date: string; avg: number; count: number }>;
    errorTypes: Array<{ type: string; count: number; ratio: number }>;
  };
};

export const fetchTeacherStudentReportOverview = async (studentId: string, days = 7) => {
  const response = await api.get(`/teacher/reports/student/${studentId}/overview`, {
    params: { days },
  });
  return response.data as {
    studentId: string;
    studentName: string;
    rangeDays: number;
    summary: { avg: number; min: number; max: number; count: number };
    trend: Array<{ date: string; avg: number; count: number }>;
    errorTypes: Array<{ type: string; count: number; ratio: number }>;
    nextSteps: Array<{ text: string; count: number }>;
  };
};

export const downloadTeacherClassReportCsv = async (classId: string, days = 7, lang?: string) => {
  const response = await api.get(`/teacher/reports/class/${classId}/export`, {
    params: { days, lang },
    responseType: 'blob',
  });
  return response.data as Blob;
};

export const downloadTeacherClassReportPdf = async (classId: string, days = 7, lang?: string) => {
  const response = await api.get(`/teacher/reports/class/${classId}/pdf`, {
    params: { days, lang },
    responseType: 'blob',
  });
  return response.data as Blob;
};

export const downloadTeacherStudentReportPdf = async (studentId: string, days = 7, lang?: string) => {
  const response = await api.get(`/teacher/reports/student/${studentId}/pdf`, {
    params: { days, lang },
    responseType: 'blob',
  });
  return response.data as Blob;
};

export const fetchStudentReportOverview = async (days = 7) => {
  const response = await api.get('/student/reports/overview', { params: { days } });
  return response.data as {
    studentId: string;
    studentName: string;
    rangeDays: number;
    summary: { avg: number; min: number; max: number; count: number };
    trend: Array<{ date: string; avg: number; count: number }>;
    errorTypes: Array<{ type: string; count: number; ratio: number }>;
    nextSteps: Array<{ text: string; count: number }>;
  };
};

export const downloadStudentReportPdf = async (days = 7, lang?: string) => {
  const response = await api.get('/student/reports/pdf', {
    params: { days, lang },
    responseType: 'blob',
  });
  return response.data as Blob;
};
