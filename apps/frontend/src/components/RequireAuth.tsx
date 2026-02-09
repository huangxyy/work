import { Navigate, useLocation } from 'react-router-dom';
import { authStore, type UserRole } from '../api/client';

type RequireAuthProps = {
  /** Allowed roles for this route group. If empty, any authenticated user is allowed. */
  allowedRoles?: UserRole[];
  children: JSX.Element;
};

/**
 * Route guard component that checks authentication and role-based access.
 *
 * - If the user is not authenticated, redirects to /login.
 * - If the user's role is not in `allowedRoles`, redirects to the
 *   appropriate dashboard for their actual role.
 */
export const RequireAuth = ({ allowedRoles, children }: RequireAuthProps) => {
  const location = useLocation();
  const user = authStore.getUser();
  const token = authStore.getToken();

  // Not authenticated → redirect to login, preserving the intended destination
  if (!token || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Role mismatch → redirect to the user's correct dashboard
  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    const roleHome: Record<UserRole, string> = {
      ADMIN: '/admin/dashboard',
      TEACHER: '/teacher/dashboard',
      STUDENT: '/student/dashboard',
    };
    return <Navigate to={roleHome[user.role] || '/login'} replace />;
  }

  return children;
};
