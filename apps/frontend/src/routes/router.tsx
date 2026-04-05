/**
 * 路由配置
 *
 * 使用 React Router v6 配置应用路由�?
 * 路由按模块拆分，便于维护�?
 */

import { Suspense } from 'react';
import { createBrowserRouter, RouteObject } from 'react-router-dom';
import { AdminLayout } from '../layouts/AdminLayout';
import { TeacherLayout } from '../layouts/TeacherLayout';
import { StudentLayout } from '../layouts/StudentLayout';
import { RequireAuth } from '../components/RequireAuth';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { NotFoundPage, PageFallback } from './route-components';
import {
  publicRoutes,
  studentRoutes,
  teacherRoutes,
  adminRoutes,
} from './modules';

/**
 * �?Suspense 的高阶组�?
 */
const withSuspense = (element: JSX.Element) => (
  <Suspense fallback={<PageFallback />}>{element}</Suspense>
);

/**
 * 创建完整路由配置
 */
export const createAppRoutes = (): RouteObject[] => [
  // 公共路由（无需认证�?
  ...publicRoutes.map((route) => ({
    ...route,
    element: withSuspense(route.element as React.ReactElement),
  })),

  // 学生路由
  {
    path: '/student',
    element: (
      <ErrorBoundary>
        <RequireAuth allowedRoles={['STUDENT']}>
          <StudentLayout />
        </RequireAuth>
      </ErrorBoundary>
    ),
    children: [
      ...studentRoutes.map((route) => ({
        ...route,
        element: withSuspense(route.element as React.ReactElement),
      })),
      { path: '*', element: <NotFoundPage /> },
    ],
  },

  // 教师路由
  {
    path: '/teacher',
    element: (
      <ErrorBoundary>
        <RequireAuth allowedRoles={['TEACHER']}>
          <TeacherLayout />
        </RequireAuth>
      </ErrorBoundary>
    ),
    children: [
      ...teacherRoutes.map((route) => ({
        ...route,
        element: withSuspense(route.element as React.ReactElement),
      })),
      { path: '*', element: <NotFoundPage /> },
    ],
  },

  // 管理员路�?
  {
    path: '/admin',
    element: (
      <ErrorBoundary>
        <RequireAuth allowedRoles={['ADMIN']}>
          <AdminLayout />
        </RequireAuth>
      </ErrorBoundary>
    ),
    children: [
      ...adminRoutes.map((route) => ({
        ...route,
        element: withSuspense(route.element as React.ReactElement),
      })),
      { path: '*', element: <NotFoundPage /> },
    ],
  },

  // 404 页面
  { path: '*', element: <NotFoundPage /> },
];

/**
 * 创建并导出路由实�?
 */
export const router = createBrowserRouter(createAppRoutes());

/**
 * 导出路由工具
 */
export { withSuspense };
export { publicRoutes, studentRoutes, teacherRoutes, adminRoutes } from './modules';
