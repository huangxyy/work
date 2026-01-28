import { PageContainer } from '@ant-design/pro-components';
import { Result } from 'antd';
import { Navigate, createBrowserRouter } from 'react-router-dom';
import { AdminLayout } from '../layouts/AdminLayout';
import { TeacherLayout } from '../layouts/TeacherLayout';
import { StudentLayout } from '../layouts/StudentLayout';
import { LoginPage } from '../pages/Login';
import { AdminDashboardPage } from '../pages/admin/Dashboard';
import { AdminConfigPage } from '../pages/admin/Config';
import { AdminSystemBudgetPage } from '../pages/admin/SystemBudget';
import { AdminSystemRetentionPage } from '../pages/admin/SystemRetention';
import { AdminUsersPage } from '../pages/admin/Users';
import { StudentDashboardPage } from '../pages/student/Dashboard';
import { StudentHomeworkDetailPage } from '../pages/student/HomeworkDetail';
import { StudentHomeworksPage } from '../pages/student/Homeworks';
import { StudentReportPage } from '../pages/student/Report';
import { SubmissionResultPage } from '../pages/student/SubmissionResult';
import { StudentSubmissionsPage } from '../pages/student/Submissions';
import { SubmitHomeworkPage } from '../pages/student/SubmitHomework';
import { TeacherClassDetailPage } from '../pages/teacher/ClassDetail';
import { TeacherClassesPage } from '../pages/teacher/Classes';
import { TeacherDashboardPage } from '../pages/teacher/Dashboard';
import { TeacherHomeworkDetailPage } from '../pages/teacher/HomeworkDetail';
import { TeacherHomeworksPage } from '../pages/teacher/Homeworks';
import { TeacherReportPage } from '../pages/teacher/Report';
import { TeacherSettingsGradingPage } from '../pages/teacher/SettingsGrading';
import { TeacherSubmissionDetailPage } from '../pages/teacher/SubmissionDetail';
import { useI18n } from '../i18n';

const NotFoundPage = () => {
  const { t } = useI18n();

  return (
    <PageContainer title={t('errors.pageNotFoundTitle')} breadcrumb={{ items: [] }}>
      <Result status="404" title="404" subTitle={t('errors.pageNotFoundSubtitle')} />
    </PageContainer>
  );
};

export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/login" replace /> },
  { path: '/login', element: <LoginPage /> },
  {
    path: '/student',
    element: <StudentLayout />,
    children: [
      { index: true, element: <Navigate to="/student/dashboard" replace /> },
      { path: 'dashboard', element: <StudentDashboardPage /> },
      { path: 'homeworks', element: <StudentHomeworksPage /> },
      { path: 'homeworks/:id', element: <StudentHomeworkDetailPage /> },
      { path: 'submit/:homeworkId', element: <SubmitHomeworkPage /> },
      { path: 'submissions', element: <StudentSubmissionsPage /> },
      { path: 'submission/:id', element: <SubmissionResultPage /> },
      { path: 'report', element: <StudentReportPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: '/teacher',
    element: <TeacherLayout />,
    children: [
      { index: true, element: <Navigate to="/teacher/dashboard" replace /> },
      { path: 'dashboard', element: <TeacherDashboardPage /> },
      { path: 'classes', element: <TeacherClassesPage /> },
      { path: 'classes/:id', element: <TeacherClassDetailPage /> },
      { path: 'homeworks', element: <TeacherHomeworksPage /> },
      { path: 'homeworks/:id', element: <TeacherHomeworkDetailPage /> },
      { path: 'submission/:id', element: <TeacherSubmissionDetailPage /> },
      { path: 'reports', element: <TeacherReportPage /> },
      { path: 'settings', element: <Navigate to="/teacher/settings/grading" replace /> },
      { path: 'settings/grading', element: <TeacherSettingsGradingPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <Navigate to="/admin/dashboard" replace /> },
      { path: 'dashboard', element: <AdminDashboardPage /> },
      { path: 'users', element: <AdminUsersPage /> },
      { path: 'system', element: <Navigate to="/admin/system/budget" replace /> },
      { path: 'system/config', element: <AdminConfigPage /> },
      { path: 'system/budget', element: <AdminSystemBudgetPage /> },
      { path: 'system/retention', element: <AdminSystemRetentionPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
