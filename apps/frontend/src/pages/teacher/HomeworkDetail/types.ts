import type { TeacherBatchUploadResult, TeacherBatchPreviewResult } from '../../../api';

export type HomeworkItem = {
  id: string;
  title: string;
  desc?: string | null;
  dueAt?: string | null;
  allowLateSubmission?: boolean;
};

export type SubmissionRow = {
  id: string;
  studentName: string;
  studentAccount: string;
  status: string;
  totalScore?: number | null;
  updatedAt?: string;
};

export type BatchStatusCounts = {
  done?: number;
  processing?: number;
  queued?: number;
  failed?: number;
};

export type BatchHistoryRow = {
  id: string;
  createdAt: string;
  uploader?: { name: string; account: string };
  totalImages: number;
  matchedImages: number;
  unmatchedCount: number;
  createdSubmissions: number;
  status: string;
  statusCounts?: BatchStatusCounts;
};

export type { TeacherBatchUploadResult, TeacherBatchPreviewResult };
