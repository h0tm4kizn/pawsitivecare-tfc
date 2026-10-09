import { Fragment, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SpeedInsights } from '@vercel/speed-insights/react';
import './index.css';
import App from './app/App.jsx';
import { removeDisposableApiCache } from './utils/browserStorage';

// Older builds persisted API responses that were never read by offline fallback.
// Remove only those confirmed disposable entries; PowerSync and mutation queues are untouched.
removeDisposableApiCache();

// Keep Supabase-hosted images available after the app switches to local SQLite
// or the device temporarily loses connectivity. The database syncs the URL;
// the service worker caches the actual image response separately.
const clearDevBrowserState = import.meta.env.DEV && import.meta.env.VITE_DEV_CLEAR_BROWSER_CACHE === 'true';

if (!clearDevBrowserState && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/offline-image-cache.js', { scope: '/' }).catch(() => {});
  });
}

if (clearDevBrowserState && typeof window !== 'undefined') {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .catch(() => {});
  }

  if ('caches' in window) {
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
      .catch(() => {});
  }
}

const RootWrapper = import.meta.env.DEV ? Fragment : StrictMode;

createRoot(document.getElementById('root')).render(
  <RootWrapper>
    <App />
    <SpeedInsights />
  </RootWrapper>,
);
