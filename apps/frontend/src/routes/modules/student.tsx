/**
 * 学生路由配置
 *
 * 包含学生角色的所有页面路由。
 */

import { lazy } from 'react';
import { Navigate, RouteObject } from 'react-router-dom';

// 懒加载组件
const StudentDashboardPage = lazy(() =>
  import('../../pages/student/Dashboard').then((module) => ({ default: module.StudentDashboardPage })),
);
const StudentHomeworksPage = lazy(() =>
  import('../../pages/student/Homeworks').then((module) => ({ default: module.StudentHomeworksPage })),
);
const StudentHomeworkDetailPage = lazy(() =>
  import('../../pages/student/HomeworkDetail').then((module) => ({ default: module.StudentHomeworkDetailPage })),
);
const SubmitHomeworkPage = lazy(() =>
  import('../../pages/student/SubmitHomework').then((module) => ({ default: module.SubmitHomeworkPage })),
);
const StudentSubmissionsPage = lazy(() =>
  import('../../pages/student/Submissions').then((module) => ({ default: module.StudentSubmissionsPage })),
);
const SubmissionResultPage = lazy(() =>
  import('../../pages/student/SubmissionResult').then((module) => ({ default: module.SubmissionResultPage })),
);
const StudentReportPage = lazy(() =>
  import('../../pages/student/Report').then((module) => ({ default: module.StudentReportPage })),
);
const StudentAnnouncementsPage = lazy(() =>
  import('../../pages/student/Announcements').then((module) => ({ default: module.StudentAnnouncementsPage })),
);
const ProfilePage = lazy(() =>
  import('../../pages/ProfilePage').then((module) => ({ default: module.ProfilePage })),
);

// 导出懒加载组件
export const studentComponents = {
  StudentDashboardPage,
  StudentHomeworksPage,
  StudentHomeworkDetailPage,
  SubmitHomeworkPage,
  StudentSubmissionsPage,
  SubmissionResultPage,
  StudentReportPage,
  StudentAnnouncementsPage,
  ProfilePage,
};

// 导出路由配置
export const studentRoutes: RouteObject[] = [
  { index: true, element: <Navigate to="/student/dashboard" replace /> },
  { path: 'dashboard', element: <StudentDashboardPage /> },
  { path: 'homeworks', element: <StudentHomeworksPage /> },
  { path: 'homeworks/:id', element: <StudentHomeworkDetailPage /> },
  { path: 'submit/:homeworkId', element: <SubmitHomeworkPage /> },
  { path: 'submissions', element: <StudentSubmissionsPage /> },
  { path: 'submission/:id', element: <SubmissionResultPage /> },
  { path: 'report', element: <StudentReportPage /> },
  { path: 'announcements', element: <StudentAnnouncementsPage /> },
  { path: 'profile', element: <ProfilePage /> },
];
