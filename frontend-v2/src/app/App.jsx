import { Component, Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import GlobalToastHost from '../components/GlobalToastHost.jsx';
import ScrollToTopButton from '../components/ScrollToTopButton.jsx';
import { useAuthStore } from '../stores/authStore';

const LandingPage = lazy(() => import('../landing_page/MainLandingPage.jsx'));
const PhoneScannerPage = lazy(() => import('../pages/PhoneScannerPage.jsx'));
const ServicesRoutes = lazy(() => import('../landing_page/services/routes.jsx'));

export default function App() {
  return (
    <BrowserRouter>
      <AppErrorBoundary>
        <GlobalModalScrollLock />
        <AuthStorageNotice />
        <Routes>
          {/* Standalone page - no PowerSync, no auth, no global providers */}
          <Route path="/scan/:token" element={<Suspense fallback={null}><PhoneScannerPage /></Suspense>} />

          {/* All other routes use global UI providers; dashboards add PowerSync after login. */}
          <Route
            path="*"
            element={
              <Suspense>
                <Routes>
                  <Route path="/services/*" element={<ServicesRoutes />} />
                  <Route path="*" element={<LandingPage />} />
                </Routes>
                <GlobalToastHost />
                <ScrollToTopButton />
              </Suspense>
            }
          />
        </Routes>
      </AppErrorBoundary>
    </BrowserRouter>
  );
}

function AuthStorageNotice() {
  const unavailable = useAuthStore((state) => state.authStorageUnavailable);
  if (!unavailable) return null;

  return (
    <div role="status" className="fixed bottom-4 left-1/2 z-[100] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-lg">
      Browser storage is full or unavailable. You can keep using this tab, but your sign-in will not survive a reload or closing the tab.
    </div>
  );
}

function GlobalModalScrollLock() {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return undefined;

    const body = document.body;
    const html = document.documentElement;
    const saved = {
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
      bodyPaddingRight: body.style.paddingRight,
      bodyTouchAction: body.style.touchAction,
      bodyOverscroll: body.style.overscrollBehavior,
      htmlOverflow: html.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
    };
    let scrollY = window.scrollY;
    let lockedByGlobal = false;

    const hasVisibleModalOverlay = () => {
      const nodes = document.querySelectorAll('[class*="fixed"]');
      for (const node of nodes) {
        const el = node;
        if (!(el instanceof HTMLElement)) continue;
        const style = window.getComputedStyle(el);
        if (style.position !== 'fixed') continue;
        if (style.visibility === 'hidden' || style.display === 'none') continue;
        if (style.opacity === '0' || style.pointerEvents === 'none') continue;

        const rect = el.getBoundingClientRect();
        if (rect.width < 40 || rect.height < 40) continue;

        const cls = String(el.className || '');
        const isOverlayLike =
          cls.includes('inset-0') ||
          cls.includes('inset-y-0') ||
          cls.includes('top-0') ||
          cls.includes('bottom-0') ||
          cls.includes('backdrop-blur') ||
          cls.includes('bg-brand-dark/') ||
          cls.includes('bg-black/');

        if (isOverlayLike) return true;
      }
      return false;
    };

    const syncScrollLock = () => {
      // Another lock manager is active (e.g., modal hook) - do not override.
      if (body.getAttribute('data-scroll-lock-owner') === 'hook') {
        return;
      }

      if (hasVisibleModalOverlay()) {
        if (!lockedByGlobal) {
          scrollY = window.scrollY;
          const scrollbarWidth = Math.max(0, window.innerWidth - html.clientWidth);
          body.style.overflow = 'hidden';
          body.style.position = 'fixed';
          body.style.top = `-${scrollY}px`;
          body.style.left = '0';
          body.style.right = '0';
          body.style.width = '100%';
          body.style.touchAction = 'none';
          body.style.overscrollBehavior = 'none';
          html.style.overflow = 'hidden';
          html.style.overscrollBehavior = 'none';
          if (scrollbarWidth > 0) {
            body.style.paddingRight = `${scrollbarWidth}px`;
          }
          lockedByGlobal = true;
          body.setAttribute('data-scroll-lock-owner', 'global');
        }
      } else if (lockedByGlobal) {
        body.style.overflow = saved.bodyOverflow;
        body.style.position = saved.bodyPosition;
        body.style.top = saved.bodyTop;
        body.style.left = saved.bodyLeft;
        body.style.right = saved.bodyRight;
        body.style.width = saved.bodyWidth;
        body.style.paddingRight = saved.bodyPaddingRight;
        body.style.touchAction = saved.bodyTouchAction;
        body.style.overscrollBehavior = saved.bodyOverscroll;
        html.style.overflow = saved.htmlOverflow;
        html.style.overscrollBehavior = saved.htmlOverscroll;
        requestAnimationFrame(() => window.scrollTo(0, scrollY));
        lockedByGlobal = false;
        if (body.getAttribute('data-scroll-lock-owner') === 'global') {
          body.removeAttribute('data-scroll-lock-owner');
        }
      }
    };

    const observer = new MutationObserver(syncScrollLock);
    observer.observe(body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style'],
    });

    syncScrollLock();
    window.addEventListener('resize', syncScrollLock);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', syncScrollLock);
      if (lockedByGlobal) {
        body.style.overflow = saved.bodyOverflow;
        body.style.position = saved.bodyPosition;
        body.style.top = saved.bodyTop;
        body.style.left = saved.bodyLeft;
        body.style.right = saved.bodyRight;
        body.style.width = saved.bodyWidth;
        body.style.paddingRight = saved.bodyPaddingRight;
        body.style.touchAction = saved.bodyTouchAction;
        body.style.overscrollBehavior = saved.bodyOverscroll;
        html.style.overflow = saved.htmlOverflow;
        html.style.overscrollBehavior = saved.htmlOverscroll;
        if (body.getAttribute('data-scroll-lock-owner') === 'global') {
          body.removeAttribute('data-scroll-lock-owner');
        }
      }
    };
  }, []);

  return null;
}

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    if (!import.meta.env.DEV) return;
    const redact = (value) => String(value || '')
      .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [redacted]')
      .replace(/([?&](?:token|access_token|auth)=)[^&\s]+/gi, '$1[redacted]');
    console.error('[Frontend render error]', {
      name: error?.name || 'Error',
      message: redact(error?.message),
      stack: redact(error?.stack),
      componentStack: redact(info?.componentStack),
    });
  }

  render() {
    if (this.state.error) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-brand-surface px-6 font-poppins text-brand-dark">
          <section className="max-w-xl rounded-2xl border border-brand-dark-light bg-white p-6 shadow-lg">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-orange">Frontend Error</p>
            <h1 className="mt-2 text-2xl font-bold">The app could not render this screen.</h1>
            <p className="mt-3 text-sm leading-6 text-brand-dark-soft">
              Check the browser console for the full error. The app is showing this message instead of a blank white page.
            </p>
            <pre className="mt-4 overflow-auto rounded-lg bg-brand-surface p-3 text-xs text-brand-dark">
              {this.state.error?.message || 'Unknown error'}
            </pre>
            <button
              type="button"
              onClick={() => {
                window.location.reload();
              }}
              className="mt-4 rounded-full bg-brand-teal px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-teal-dark"
            >
              Reload app
            </button>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
