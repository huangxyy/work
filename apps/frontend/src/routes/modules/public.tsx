/**
 * 公共路由配置
 *
 * 包含不需要身份验证的页面路由。
 */

import { lazy } from 'react';
import { RouteObject } from 'react-router-dom';

// 懒加载组件
const LandingPage = lazy(() =>
  import('../../pages/Landing').then((module) => ({ default: module.LandingPage })),
);
const LoginPage = lazy(() => import('../../pages/Login').then((module) => ({ default: module.LoginPage })));
const ForgotPasswordPage = lazy(() =>
  import('../../pages/ForgotPassword').then((module) => ({ default: module.ForgotPasswordPage })),
);
const TermsOfServicePage = lazy(() =>
  import('../../pages/TermsOfService').then((m) => ({ default: m.TermsOfServicePage })),
);
const PrivacyPolicyPage = lazy(() =>
  import('../../pages/PrivacyPolicy').then((m) => ({ default: m.PrivacyPolicyPage })),
);

// 导出懒加载组件
export const publicComponents = {
  LandingPage,
  LoginPage,
  ForgotPasswordPage,
  TermsOfServicePage,
  PrivacyPolicyPage,
};

// 导出路由配置
export const publicRoutes: RouteObject[] = [
  { path: '/', element: <LandingPage /> },
  { path: '/landing', element: <LandingPage /> },
  { path: '/login', element: <LoginPage /> },
  { path: '/forgot-password', element: <ForgotPasswordPage /> },
  { path: '/terms', element: <TermsOfServicePage /> },
  { path: '/privacy', element: <PrivacyPolicyPage /> },
];
