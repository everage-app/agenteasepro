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

const isNonFatalRejection = (reason: any): boolean => {
  if (!reason) return false;

  const name = typeof reason?.name === 'string' ? reason.name.toLowerCase() : '';
  const message = typeof reason?.message === 'string' ? reason.message.toLowerCase() : '';

  if (reason?.isAxiosError) return true;
  if (reason?.response && typeof reason.response.status === 'number') return true;
  if (name === 'aborterror' || message.includes('aborted')) return true;
  if (message.includes('network error')) return true;

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
  showCrash(event?.message || 'Runtime error');
  hideLoader();
});
window.addEventListener('unhandledrejection', (event) => {
  const reason = (event as PromiseRejectionEvent).reason;
  if (isNonFatalRejection(reason)) {
    return;
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
