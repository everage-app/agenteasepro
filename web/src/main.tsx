import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { ThemeProvider } from './hooks/useTheme';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

const rootEl = document.getElementById('root');
const loaderEl = document.getElementById('app-loading');
const crashEl = document.getElementById('app-crash');
const crashMsgEl = document.getElementById('app-crash-message');
const crashReloadBtn = document.getElementById('app-crash-reload');

if (import.meta.env.VITE_E2E_DISABLE_MOTION === 'true') {
  document.documentElement.setAttribute('data-e2e-disable-motion', 'true');
}

const hideLoader = () => {
  if (!loaderEl) return;
  loaderEl.classList.add('fade-out');
  window.setTimeout(() => {
    loaderEl.remove();
  }, 300);
};

const showCrash = (message: unknown) => {
  if (!crashEl || !crashMsgEl) return;
  const text = message instanceof Error ? message.message : String(message || 'Unknown error');
  crashMsgEl.textContent = text;
  crashEl.style.display = 'block';
};

const CHUNK_RELOAD_KEY = 'aep_chunk_reload_attempts';
const MAX_CHUNK_RELOAD_ATTEMPTS = 2;

const isChunkLoadError = (value: unknown): boolean => {
  const text = String(value || '').toLowerCase();
  return text.includes('failed to fetch dynamically imported module')
    || text.includes('loading chunk')
    || text.includes('chunkloaderror');
};

const reloadForChunkErrorOnce = (): boolean => {
  let attempts = 0;
  try {
    attempts = Number(window.sessionStorage.getItem(CHUNK_RELOAD_KEY) || '0');
    if (attempts >= MAX_CHUNK_RELOAD_ATTEMPTS) {
      window.sessionStorage.removeItem(CHUNK_RELOAD_KEY);
      return false;
    }
    window.sessionStorage.setItem(CHUNK_RELOAD_KEY, String(attempts + 1));
  } catch {
    // Continue even when storage is unavailable.
  }

  const nextUrl = new URL(window.location.href);
  nextUrl.searchParams.set('_aep_refresh', String(Date.now()));
  window.location.replace(nextUrl.toString());
  return true;
};

const isNonFatalRejection = (reason: any): boolean => {
  if (!reason) return false;

  const name = typeof reason?.name === 'string' ? reason.name.toLowerCase() : '';
  const message = typeof reason?.message === 'string' ? reason.message.toLowerCase() : '';

  if (reason?.isAxiosError) return true;
  if (reason?.response && typeof reason.response.status === 'number') return true;
  if (name === 'aborterror' || message.includes('aborted')) return true;
  if (message.includes('network error')) return true;
  if (message.includes('failed to fetch')) return true;
  if (message.includes('load failed')) return true;
  if (message.includes('networkerror when attempting to fetch resource')) return true;

  return false;
};

if (crashReloadBtn) {
  crashReloadBtn.addEventListener('click', () => {
    window.location.reload();
  });
}

window.addEventListener('error', (event) => {
  const msg = String(event?.message || '').toLowerCase();
  if (msg.includes('resizeobserver loop limit exceeded')) {
    return;
  }
  if (isChunkLoadError(event?.message) || isChunkLoadError(event?.error?.message)) {
    if (reloadForChunkErrorOnce()) return;
  }
  showCrash(event?.message || 'Runtime error');
  hideLoader();
});
window.addEventListener('unhandledrejection', (event) => {
  const reason = (event as PromiseRejectionEvent).reason;
  if (isNonFatalRejection(reason)) {
    return;
  }
  if (isChunkLoadError(reason?.message || reason)) {
    if (reloadForChunkErrorOnce()) return;
  }
  showCrash(reason?.message || reason || 'Unhandled promise rejection');
  hideLoader();
});

if (!rootEl) {
  hideLoader();
  throw new Error('Missing #root element');
}

ReactDOM.createRoot(rootEl as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);

requestAnimationFrame(hideLoader);
window.setTimeout(hideLoader, 2000);
