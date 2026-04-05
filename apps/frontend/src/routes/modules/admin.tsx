/**
 * 管理员路由配�? *
 * 包含管理员角色的所有页面路由�? */

import { lazy } from 'react';
import { Navigate, RouteObject } from 'react-router-dom';

// 懒加载组�?const AdminDashboardPage = lazy(() =>
  import('../../pages/admin/Dashboard').then((module) => ({ default: module.AdminDashboardPage })),
);
const AdminClassesPage = lazy(() =>
  import('../../pages/admin/Classes').then((module) => ({ default: module.AdminClassesPage })),
);
const AdminUsagePage = lazy(() =>
  import('../../pages/admin/Usage').then((module) => ({ default: module.AdminUsagePage })),
);
const AdminUsersPage = lazy(() =>
  import('../../pages/admin/Users').then((module) => ({ default: module.AdminUsersPage })),
);
const AdminConfigPage = lazy(() =>
  import('../../pages/admin/Config').then((module) => ({ default: module.AdminConfigPage })),
);
const AdminSystemBudgetPage = lazy(() =>
  import('../../pages/admin/SystemBudget').then((module) => ({ default: module.AdminSystemBudgetPage })),
);
const AdminSystemRetentionPage = lazy(() =>
  import('../../pages/admin/SystemRetention').then((module) => ({ default: module.AdminSystemRetentionPage })),
);
const AdminQueuePage = lazy(() =>
  import('../../pages/admin/Queue').then((module) => ({ default: module.AdminQueuePage })),
);
const AdminSubmissionDiagnosisPage = lazy(() =>
  import('../../pages/admin/SubmissionDiagnosis').then((m) => ({ default: m.AdminSubmissionDiagnosisPage })),
);
const AdminAuditLogsPage = lazy(() =>
  import('../../pages/admin/AuditLogs').then((m) => ({ default: m.AdminAuditLogsPage })),
);
const AdminAnnouncementsPage = lazy(() =>
  import('../../pages/admin/Announcements').then((m) => ({ default: m.AdminAnnouncementsPage })),
);
const AdminQueueMonitoringPage = lazy(() =>
  import('../../pages/admin/QueueMonitoring').then((m) => ({ default: m.default })),
);
const ProfilePage = lazy(() =>
  import('../../pages/ProfilePage').then((module) => ({ default: module.ProfilePage })),
);

// 导出懒加载组�?export const adminComponents = {
  AdminDashboardPage,
  AdminClassesPage,
  AdminUsagePage,
  AdminUsersPage,
  AdminConfigPage,
  AdminSystemBudgetPage,
  AdminSystemRetentionPage,
  AdminQueuePage,
  AdminSubmissionDiagnosisPage,
  AdminAuditLogsPage,
  AdminAnnouncementsPage,
  AdminQueueMonitoringPage,
  ProfilePage,
};

// 导出路由配置
export const adminRoutes: RouteObject[] = [
  { index: true, element: <Navigate to="/admin/dashboard" replace /> },
  { path: 'dashboard', element: <adminComponents.AdminDashboardPage /> },
  { path: 'classes', element: <adminComponents.AdminClassesPage /> },
  { path: 'usage', element: <adminComponents.AdminUsagePage /> },
  { path: 'users', element: <adminComponents.AdminUsersPage /> },
  { path: 'config', element: <Navigate to="/admin/system/config" replace /> },
  { path: 'system', element: <Navigate to="/admin/system/budget" replace /> },
  { path: 'system/config', element: <adminComponents.AdminConfigPage /> },
  { path: 'system/budget', element: <adminComponents.AdminSystemBudgetPage /> },
  { path: 'system/retention', element: <adminComponents.AdminSystemRetentionPage /> },
  { path: 'system/queue', element: <adminComponents.AdminQueuePage /> },
  { path: 'system/queue/monitoring', element: <adminComponents.AdminQueueMonitoringPage /> },
  { path: 'diagnosis', element: <adminComponents.AdminSubmissionDiagnosisPage /> },
  { path: 'audit-logs', element: <adminComponents.AdminAuditLogsPage /> },
  { path: 'announcements', element: <adminComponents.AdminAnnouncementsPage /> },
  { path: 'profile', element: <adminComponents.ProfilePage /> },
];
