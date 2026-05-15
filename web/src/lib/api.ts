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

const readStoredRefreshToken = (): string | null => {
  const token = localStorage.getItem('utahcontracts_refresh_token');
  if (!token || token === 'null' || token === 'undefined') return null;
  return token;
};

let refreshInFlight: Promise<string | null> | null = null;

const refreshAccessToken = async (): Promise<string | null> => {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    const refreshToken = readStoredRefreshToken();
    if (!refreshToken) return null;

    try {
      const res = await axios.post('/api/auth/refresh', { refreshToken });
      const token = res.data?.token;
      const nextRefresh = res.data?.refreshToken;
      const agent = res.data?.agent;
      if (!token || typeof token !== 'string') return null;

      localStorage.setItem('utahcontracts_token', token);
      if (nextRefresh && typeof nextRefresh === 'string') {
        localStorage.setItem('utahcontracts_refresh_token', nextRefresh);
      }
      useAuthStore.setState((state) => ({
        ...state,
        token,
        refreshToken: (nextRefresh || refreshToken) as string,
        agent: agent ?? state.agent,
      }));
      return token;
    } catch {
      return null;
    }
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
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
  async (error) => {
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
      const originalRequest = error?.config || {};
      const hasStoredToken = Boolean(readStoredToken());
      const isAuthEndpoint = /\/auth\/(login|signup|forgot-password|reset-password|verify-email)/i.test(requestPath);
      const canRetry = !originalRequest?._retry;

      if (hasStoredToken && !isAuthEndpoint && canRetry) {
        originalRequest._retry = true;
        const refreshedToken = await refreshAccessToken();
        if (refreshedToken) {
          originalRequest.headers = originalRequest.headers ?? {};
          originalRequest.headers.Authorization = `Bearer ${refreshedToken}`;
          return api.request(originalRequest);
        }
      }

      if (hasStoredToken && !isAuthEndpoint) {
        try {
          useAuthStore.getState().logout();
        } catch {
          localStorage.removeItem('utahcontracts_token');
          localStorage.removeItem('utahcontracts_refresh_token');
        }
      }
    }

    return Promise.reject(error);
  },
);

export default api;
