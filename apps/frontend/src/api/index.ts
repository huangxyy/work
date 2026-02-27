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
export { login, logout } from './auth';

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
  updateHomework,
  updateHomeworkLateSubmission,
  fetchHomeworkDeletePreview,
  deleteHomework,
} from './homeworks';

// Submissions
export {
  createSubmission,
  fetchSubmission,
  regradeSubmission,
  addTeacherFeedback,
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
  fetchClassComparison,
} from './reports';

// Public API
export {
  fetchPublicOverview,
  fetchPublicLanding,
  type PublicLandingPayload,
} from './public';

// Teacher-specific API
export {
  fetchUnsubmittedStudents,
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

// Notifications
export {
  fetchNotifications,
  fetchUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  type NotificationItem,
} from './notifications';

// Announcements
export {
  fetchAnnouncements,
  createAnnouncement,
  deleteAnnouncement,
  type AnnouncementItem,
} from './announcements';

// Templates
export {
  fetchTemplates,
  createTemplate,
  deleteTemplate,
  type TemplateItem,
} from './templates';

// Search
export { globalSearch, type SearchResult } from './search';

// Admin API
export {
  fetchAdminMetrics,
  fetchAdminUsers,
  fetchAdminClassSummaries,
  fetchAdminConfig,
  updateAdminConfig,
  fetchAdminUsage,
  fetchLlmCostSummary,
  bulkImportUsers,
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
  deleteAdminUser,
  updateAdminUser,
  resetAdminUserPassword,
  type AdminMetrics,
  type AdminClassSummary,
  type AdminSystemConfig,
  fetchAdminErrorTrends,
  fetchFeatureFlags,
  updateFeatureFlag,
  type AdminUser,
} from './admin';
