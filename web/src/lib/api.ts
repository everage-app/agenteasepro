import axios from 'axios';
import { useAuthStore } from '../features/auth/authStore';
import { reportClientError } from './telemetry';

const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
});

const readStoredToken = (): string | null => {
  const token = localStorage.getItem('utahcontracts_token');
  if (!token || token === 'null' || token === 'undefined') return null;
  return token;
};

api.interceptors.request.use((config) => {
  const token = readStoredToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const serverError = error?.response?.data?.error;
    const requestPath = `${error?.config?.url || ''}`;

    // Capture server-side failures (best-effort).
    // Use fetch-based telemetry to avoid recursive axios interceptor loops.
    if (!status || status >= 500) {
      const message = serverError || error?.message || 'API error';
      reportClientError({
        source: 'server',
        message,
        path: requestPath,
        meta: {
          status: status ?? null,
          method: error?.config?.method || null,
        },
      });
    }

    if (status === 401) {
      // Ensure we don't keep retrying with a broken/stale token.
      // Some API routes return variants like "Invalid or expired token".
      const hasStoredToken = Boolean(readStoredToken());
      const isAuthEndpoint = /\/auth\/(login|signup|forgot-password|reset-password|verify-email)/i.test(requestPath);
      if (hasStoredToken && !isAuthEndpoint) {
        try {
          useAuthStore.getState().logout();
        } catch {
          localStorage.removeItem('utahcontracts_token');
        }
      }
    }

    return Promise.reject(error);
  },
);

export default api;
