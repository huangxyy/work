/**
 * API Module Index
 * Re-exports all API functions and types from modular files
 */

// React Query helpers
export { queryKeys, getQueryOptions, CACHE_TIMES, STALE_TIMES } from './query-keys';

// Core client, auth store, and base types
export {
  api,
  authStore,
  type UserRole,
  type AuthUser,
  type LoginResponse,
} from './client';

// Authentication
export { login } from './auth';

// Classes management
export {
  fetchClasses,
  createClass,
  fetchClassStudents,
  importClassStudents,
  updateClassTeachers,
  removeClassStudent,
} from './classes';

// Homeworks
export {
  fetchStudentHomeworks,
  fetchHomeworksByClass,
  fetchHomeworksSummaryByClass,
  createHomework,
  updateHomeworkLateSubmission,
  fetchHomeworkDeletePreview,
  deleteHomework,
} from './homeworks';

// Submissions
export {
  createSubmission,
  fetchSubmission,
  regradeSubmission,
  fetchStudentSubmissions,
  downloadStudentSubmissionsCsv,
} from './submissions';

// Reports (student & teacher)
export {
  fetchTeacherClassReportOverview,
  fetchTeacherStudentReportOverview,
  downloadTeacherClassReportCsv,
  downloadTeacherClassReportPdf,
  downloadTeacherStudentReportPdf,
  fetchStudentReportOverview,
  downloadStudentReportPdf,
} from './reports';

// Public API
export {
  fetchPublicOverview,
  fetchPublicLanding,
  type PublicLandingPayload,
} from './public';

// Teacher-specific API
export {
  fetchTeacherHomeworkSubmissions,
  fetchTeacherGradingSettings,
  fetchTeacherGradingPolicy,
  fetchTeacherGradingPolicyPreview,
  upsertTeacherClassPolicy,
  clearTeacherClassPolicy,
  upsertTeacherHomeworkPolicy,
  clearTeacherHomeworkPolicy,
  createTeacherBatchSubmissions,
  previewTeacherBatchSubmissions,
  regradeHomeworkSubmissions,
  fetchTeacherBatchUploads,
  fetchTeacherBatchUploadDetail,
  retryTeacherBatchUploads,
  retrySkippedSubmission,
  downloadTeacherHomeworkSubmissionsCsv,
  downloadTeacherHomeworkImagesZip,
  downloadTeacherHomeworkRemindersCsv,
  downloadTeacherSubmissionsPdf,
  type TeacherSubmissionRow,
  type TeacherBatchUploadResult,
  type TeacherBatchPreviewResult,
} from './teacher';

// Admin API
export {
  fetchAdminMetrics,
  fetchAdminUsers,
  fetchAdminClassSummaries,
  fetchAdminConfig,
  updateAdminConfig,
  fetchAdminUsage,
  fetchAdminQueueMetrics,
  retryAdminFailedJobs,
  cleanAdminQueue,
  pauseAdminQueue,
  resumeAdminQueue,
  testAdminLlmHealth,
  testAdminLlmCall,
  fetchAdminLlmLogs,
  clearAdminLlmLogs,
  testAdminOcrHealth,
  fetchAdminRetentionStatus,
  runAdminRetention,
  createAdminUser,
  updateAdminUser,
  resetAdminUserPassword,
  type AdminMetrics,
  type AdminClassSummary,
  type AdminSystemConfig,
  type AdminUser,
} from './admin';
