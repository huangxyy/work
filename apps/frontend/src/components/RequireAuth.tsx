import { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { authStore, type UserRole } from '../api/client';
import { fetchMe } from '../api/auth';
import { Spin, Result } from 'antd';

type RequireAuthProps = {
  /** Allowed roles for this route group. If empty, any authenticated user is allowed. */
  allowedRoles?: UserRole[];
  children: JSX.Element;
};

const ROLE_HOME: Record<UserRole, string> = {
  ADMIN: '/admin/dashboard',
  TEACHER: '/teacher/dashboard',
  STUDENT: '/student/dashboard',
};

/**
 * Route guard component that checks authentication and role-based access.
 *
 * - If the user is not authenticated, redirects to /login.
 * - If the user's role is not in `allowedRoles`, redirects to the
 *   appropriate dashboard for their actual role.
 * - Validates the token with the backend on mount.
 */
export const RequireAuth = ({ allowedRoles, children }: RequireAuthProps) => {
  const location = useLocation();
  const [isValidating, setIsValidating] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  
  const user = authStore.getUser();
  const token = authStore.getToken();

  useEffect(() => {
    let mounted = true;

    const validateToken = async () => {
      if (!token) {
        if (mounted) {
          setIsValidating(false);
          setIsAuthenticated(false);
        }
        return;
      }

      try {
        const freshUser = await fetchMe();
        if (mounted) {
          authStore.setUser(freshUser);
          setIsAuthenticated(true);
          setIsValidating(false);
        }
      } catch (error) {
        if (mounted) {
          const isNetworkError = !(error instanceof Object && 'response' in error && error.response);
          setValidationError(
            isNetworkError
              ? '网络连接失败，请检查网络后重试'
              : '登录状态已过期，正在跳转到登录页…',
          );
          setIsAuthenticated(false);
          setIsValidating(false);
        }
      }
    };

    validateToken();

    return () => {
      mounted = false;
    };
  }, [token]);

  if (isValidating) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (validationError && !isAuthenticated) {
    return (
      <Result
        status="warning"
        title={validationError}
        extra={
          <a href="/login" style={{ color: '#1677ff' }}>
            返回登录
          </a>
        }
      />
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    return <Navigate to={ROLE_HOME[user.role] || '/login'} replace />;
  }

  return children;
};
