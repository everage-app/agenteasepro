import { Navigate, useLocation } from 'react-router-dom';
import { ReactNode } from 'react';
import { useAuthStore } from './authStore';

interface Props {
  children: ReactNode;
}

export function ProtectedRoute({ children }: Props) {
  const token = useAuthStore((s) => s.token);
  const emailVerified = useAuthStore((s) => s.emailVerified);
  const location = useLocation();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Allow unverified users to access the verify-email page only
  if (!emailVerified && location.pathname !== '/verify-email') {
    return <Navigate to="/verify-email" replace />;
  }

  return <>{children}</>;
}
