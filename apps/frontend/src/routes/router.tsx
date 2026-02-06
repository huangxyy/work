import { PageContainer } from '@ant-design/pro-components';
import { Result, Spin } from 'antd';
import { lazy, Suspense } from 'react';
import { Navigate, createBrowserRouter } from 'react-router-dom';
import { AdminLayout } from '../layouts/AdminLayout';
import { TeacherLayout } from '../layouts/TeacherLayout';
import { StudentLayout } from '../layouts/StudentLayout';
import { useI18n } from '../i18n';

const LoginPage = lazy(() => import('../pages/Login').then((module) => ({ default: module.LoginPage })));
const LandingPage = lazy(() =>
  import('../pages/Landing').then((module) => ({ default: module.LandingPage })),
);
const AdminDashboardPage = lazy(() =>
  import('../pages/admin/Dashboard').then((module) => ({ default: module.AdminDashboardPage })),
);
const AdminClassesPage = lazy(() =>
  import('../pages/admin/Classes').then((module) => ({ default: module.AdminClassesPage })),
);
const AdminConfigPage = lazy(() =>
  import('../pages/admin/Config').then((module) => ({ default: module.AdminConfigPage })),
);
const AdminSystemBudgetPage = lazy(() =>
  import('../pages/admin/SystemBudget').then((module) => ({ default: module.AdminSystemBudgetPage })),
);
const AdminSystemRetentionPage = lazy(() =>
  import('../pages/admin/SystemRetention').then((module) => ({ default: module.AdminSystemRetentionPage })),
);
const AdminQueuePage = lazy(() =>
  import('../pages/admin/Queue').then((module) => ({ default: module.AdminQueuePage })),
);
const AdminUsersPage = lazy(() =>
  import('../pages/admin/Users').then((module) => ({ default: module.AdminUsersPage })),
);
const AdminUsagePage = lazy(() =>
  import('../pages/admin/Usage').then((module) => ({ default: module.AdminUsagePage })),
);
const StudentDashboardPage = lazy(() =>
  import('../pages/student/Dashboard').then((module) => ({ default: module.StudentDashboardPage })),
);
const StudentHomeworkDetailPage = lazy(() =>
  import('../pages/student/HomeworkDetail').then((module) => ({ default: module.StudentHomeworkDetailPage })),
);
const StudentHomeworksPage = lazy(() =>
  import('../pages/student/Homeworks').then((module) => ({ default: module.StudentHomeworksPage })),
);
const StudentReportPage = lazy(() =>
  import('../pages/student/Report').then((module) => ({ default: module.StudentReportPage })),
);
const SubmissionResultPage = lazy(() =>
  import('../pages/student/SubmissionResult').then((module) => ({ default: module.SubmissionResultPage })),
);
const StudentSubmissionsPage = lazy(() =>
  import('../pages/student/Submissions').then((module) => ({ default: module.StudentSubmissionsPage })),
);
const SubmitHomeworkPage = lazy(() =>
  import('../pages/student/SubmitHomework').then((module) => ({ default: module.SubmitHomeworkPage })),
);
const TeacherClassDetailPage = lazy(() =>
  import('../pages/teacher/ClassDetail').then((module) => ({ default: module.TeacherClassDetailPage })),
);
const TeacherClassesPage = lazy(() =>
  import('../pages/teacher/Classes').then((module) => ({ default: module.TeacherClassesPage })),
);
const TeacherBatchUploadDetailPage = lazy(() =>
  import('../pages/teacher/BatchUploadDetail').then((module) => ({
    default: module.TeacherBatchUploadDetailPage,
  })),
);
const TeacherDashboardPage = lazy(() =>
  import('../pages/teacher/Dashboard').then((module) => ({ default: module.TeacherDashboardPage })),
);
const TeacherHomeworkDetailPage = lazy(() =>
  import('../pages/teacher/HomeworkDetail').then((module) => ({ default: module.TeacherHomeworkDetailPage })),
);
const TeacherHomeworksPage = lazy(() =>
  import('../pages/teacher/Homeworks').then((module) => ({ default: module.TeacherHomeworksPage })),
);
const TeacherReportPage = lazy(() =>
  import('../pages/teacher/Report').then((module) => ({ default: module.TeacherReportPage })),
);
const TeacherStudentReportPage = lazy(() =>
  import('../pages/teacher/StudentReport').then((module) => ({ default: module.TeacherStudentReportPage })),
);
const TeacherSettingsGradingPage = lazy(() =>
  import('../pages/teacher/SettingsGrading').then((module) => ({ default: module.TeacherSettingsGradingPage })),
);
const TeacherSubmissionDetailPage = lazy(() =>
  import('../pages/teacher/SubmissionDetail').then((module) => ({ default: module.TeacherSubmissionDetailPage })),
);

const PageFallback = () => (
  <div style={{ display: 'flex', justifyContent: 'center', padding: '48px 0' }}>
    <Spin size="large" />
  </div>
);

const withSuspense = (element: JSX.Element) => (
  <Suspense fallback={<PageFallback />}>{element}</Suspense>
);

const NotFoundPage = () => {
  const { t } = useI18n();

  return (
    <PageContainer title={t('errors.pageNotFoundTitle')} breadcrumb={{ items: [] }}>
      <Result status="404" title="404" subTitle={t('errors.pageNotFoundSubtitle')} />
    </PageContainer>
  );
};

export const router = createBrowserRouter([
  { path: '/', element: withSuspense(<LandingPage />) },
  { path: '/landing', element: withSuspense(<LandingPage />) },
  { path: '/login', element: withSuspense(<LoginPage />) },
  {
    path: '/student',
    element: <StudentLayout />,
    children: [
      { index: true, element: <Navigate to="/student/dashboard" replace /> },
      { path: 'dashboard', element: withSuspense(<StudentDashboardPage />) },
      { path: 'homeworks', element: withSuspense(<StudentHomeworksPage />) },
      { path: 'homeworks/:id', element: withSuspense(<StudentHomeworkDetailPage />) },
      { path: 'submit/:homeworkId', element: withSuspense(<SubmitHomeworkPage />) },
      { path: 'submissions', element: withSuspense(<StudentSubmissionsPage />) },
      { path: 'submission/:id', element: withSuspense(<SubmissionResultPage />) },
      { path: 'report', element: withSuspense(<StudentReportPage />) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: '/teacher',
    element: <TeacherLayout />,
    children: [
      { index: true, element: <Navigate to="/teacher/dashboard" replace /> },
      { path: 'dashboard', element: withSuspense(<TeacherDashboardPage />) },
      { path: 'classes', element: withSuspense(<TeacherClassesPage />) },
      { path: 'classes/:id', element: withSuspense(<TeacherClassDetailPage />) },
      { path: 'batches/:id', element: withSuspense(<TeacherBatchUploadDetailPage />) },
      { path: 'homeworks', element: withSuspense(<TeacherHomeworksPage />) },
      { path: 'homeworks/:id', element: withSuspense(<TeacherHomeworkDetailPage />) },
      { path: 'submission/:id', element: withSuspense(<TeacherSubmissionDetailPage />) },
      { path: 'reports', element: withSuspense(<TeacherReportPage />) },
      { path: 'reports/student/:studentId', element: withSuspense(<TeacherStudentReportPage />) },
      { path: 'settings', element: <Navigate to="/teacher/dashboard" replace /> },
      { path: 'settings/grading', element: <Navigate to="/teacher/dashboard" replace /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <Navigate to="/admin/dashboard" replace /> },
      { path: 'dashboard', element: withSuspense(<AdminDashboardPage />) },
      { path: 'classes', element: withSuspense(<AdminClassesPage />) },
      { path: 'usage', element: withSuspense(<AdminUsagePage />) },
      { path: 'users', element: withSuspense(<AdminUsersPage />) },
      { path: 'system', element: <Navigate to="/admin/system/budget" replace /> },
      { path: 'system/config', element: withSuspense(<AdminConfigPage />) },
      { path: 'system/budget', element: withSuspense(<AdminSystemBudgetPage />) },
      { path: 'system/retention', element: withSuspense(<AdminSystemRetentionPage />) },
      { path: 'system/queue', element: withSuspense(<AdminQueuePage />) },
      { path: 'system/grading', element: withSuspense(<TeacherSettingsGradingPage />) },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
