/**
 * 教师路由配置
 *
 * 包含教师角色的所有页面路由�? */

import { lazy } from 'react';
import { Navigate, RouteObject } from 'react-router-dom';

// 懒加载组�?const TeacherDashboardPage = lazy(() =>
  import('../../pages/teacher/Dashboard').then((module) => ({ default: module.TeacherDashboardPage })),
);
const TeacherClassesPage = lazy(() =>
  import('../../pages/teacher/Classes').then((module) => ({ default: module.TeacherClassesPage })),
);
const TeacherClassDetailPage = lazy(() =>
  import('../../pages/teacher/ClassDetail').then((module) => ({ default: module.TeacherClassDetailPage })),
);
const TeacherBatchUploadDetailPage = lazy(() =>
  import('../../pages/teacher/BatchUploadDetail').then((module) => ({
    default: module.TeacherBatchUploadDetailPage,
  })),
);
const TeacherHomeworksPage = lazy(() =>
  import('../../pages/teacher/Homeworks').then((module) => ({ default: module.TeacherHomeworksPage })),
);
const TeacherHomeworkDetailPage = lazy(() =>
  import('../../pages/teacher/HomeworkDetail').then((module) => ({ default: module.TeacherHomeworkDetailPage })),
);
const TeacherSubmissionDetailPage = lazy(() =>
  import('../../pages/teacher/SubmissionDetail').then((module) => ({ default: module.TeacherSubmissionDetailPage })),
);
const TeacherReportPage = lazy(() =>
  import('../../pages/teacher/Report').then((module) => ({ default: module.TeacherReportPage })),
);
const TeacherStudentReportPage = lazy(() =>
  import('../../pages/teacher/StudentReport').then((module) => ({ default: module.TeacherStudentReportPage })),
);
const TeacherAnnouncementsPage = lazy(() =>
  import('../../pages/teacher/Announcements').then((module) => ({ default: module.TeacherAnnouncementsPage })),
);
const ProfilePage = lazy(() =>
  import('../../pages/ProfilePage').then((module) => ({ default: module.ProfilePage })),
);

// 导出懒加载组�?export const teacherComponents = {
  TeacherDashboardPage,
  TeacherClassesPage,
  TeacherClassDetailPage,
  TeacherBatchUploadDetailPage,
  TeacherHomeworksPage,
  TeacherHomeworkDetailPage,
  TeacherSubmissionDetailPage,
  TeacherReportPage,
  TeacherStudentReportPage,
  TeacherAnnouncementsPage,
  ProfilePage,
};

// 导出路由配置
export const teacherRoutes: RouteObject[] = [
  { index: true, element: <Navigate to="/teacher/dashboard" replace /> },
  { path: 'dashboard', element: <teacherComponents.TeacherDashboardPage /> },
  { path: 'classes', element: <teacherComponents.TeacherClassesPage /> },
  { path: 'classes/:id', element: <teacherComponents.TeacherClassDetailPage /> },
  { path: 'batches/:id', element: <teacherComponents.TeacherBatchUploadDetailPage /> },
  { path: 'homeworks', element: <teacherComponents.TeacherHomeworksPage /> },
  { path: 'homeworks/:id', element: <teacherComponents.TeacherHomeworkDetailPage /> },
  { path: 'submission/:id', element: <teacherComponents.TeacherSubmissionDetailPage /> },
  { path: 'reports', element: <teacherComponents.TeacherReportPage /> },
  { path: 'reports/student/:studentId', element: <teacherComponents.TeacherStudentReportPage /> },
  { path: 'announcements', element: <teacherComponents.TeacherAnnouncementsPage /> },
  { path: 'profile', element: <teacherComponents.ProfilePage /> },
];
