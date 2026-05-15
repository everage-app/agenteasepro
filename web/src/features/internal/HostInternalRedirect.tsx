import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { isInternalHost } from './isInternalHost';

export function HostInternalRedirect() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const hostname = window.location.hostname;
    if (!isInternalHost(hostname)) return;

    const path = location.pathname;

    // Avoid interfering with auth + public flows.
    if (path.startsWith('/login') || path.startsWith('/forgot-password') || path.startsWith('/reset-password') || path.startsWith('/esign')) {
      return;
    }

    if (!path.startsWith('/internal')) {
      navigate('/internal', { replace: true });
    }
  }, [location.pathname, navigate]);

  return null;
}
