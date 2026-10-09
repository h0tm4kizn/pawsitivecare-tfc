import { lazy, Suspense, useState, useEffect, useRef } from 'react';
import Header from "./Header";
import { useAuthStore } from '../stores/authStore';
import { useLocation } from 'react-router-dom';
import useMediaQuery from '../hooks/useMediaQuery';
import { apiFetch } from '../api/apiClient';

const Footer = lazy(() => import('./Footer'));
const FAQ = lazy(() => import('./FAQ'));
const AboutUs = lazy(() => import('./AboutUs'));
const Services = lazy(() => import('./services/Services'));
const Contact = lazy(() => import('./Contact'));
const LandingPageMobileView = lazy(() => import('./mobile/LandingPage_MobileView'));

const AdminDashboard = lazy(() => import('../pages/admin/dashboard/AdminDashboard'));
const StaffDashboard = lazy(() => import('../pages/staff/StaffDashboard'));
const CustomerDashboard = lazy(() => import('../pages/customer/CustomerDashboard'));
const PowerSyncProvider = lazy(() => import('../components/PowerSyncProvider'));
const LoginModal = lazy(() => import('./LoginModal'));
const Register = lazy(() => import('./Register'));
const ForgotPassword = lazy(() => import('./ForgotPassword'));
const ResetPassword = lazy(() => import('./ResetPassword'));


const HERO_BACKGROUND_SRC = "/assets/landing_bg.webp";

export default function MainLandingPage() {
  const location = useLocation();
  const isDesktop = useMediaQuery('(min-width: 1280px)', true);
  const isLoggedIn = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const login = useAuthStore((state) => state.login);
  const logout = useAuthStore((state) => state.logout);
  const updateUser = useAuthStore((state) => state.updateUser);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false);
  const [authChecked, setAuthChecked] = useState(!isLoggedIn);
  const hadInitialSession = useRef(isLoggedIn);
  useEffect(() => {
    // Defer setState to avoid cascading renders warning
    const params = new URLSearchParams(window.location.search);
    if (params.get('token') && params.get('email')) {
      setTimeout(() => setIsResetPasswordOpen(true), 0);
    }
  }, []);

  useEffect(() => {
    if (!location.hash) return;

    const scrollToHash = () => {
      const target = document.getElementById(location.hash.slice(1));
      target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const frameId = window.requestAnimationFrame(scrollToHash);
    return () => window.cancelAnimationFrame(frameId);
  }, [location.hash]);

  useEffect(() => {
    if (!isLoggedIn) {
      setAuthChecked(true);
      return undefined;
    }

    // The login response has already passed the server-side verification check.
    // Do not make a newly authenticated customer wait for a second /api/me
    // round trip before showing the dashboard. Keep the check for sessions
    // restored from storage, where the cached user may be stale.
    if (!hadInitialSession.current) {
      setAuthChecked(true);
      return undefined;
    }

    // Admin/staff accounts are not subject to customer email verification.
    // Avoid an unnecessary startup request for those dashboards.
    const role = String(user?.role || '').toLowerCase();
    if (role !== 'customer' && role !== 'client') {
      setAuthChecked(true);
      return undefined;
    }

    if (user?.email_verified_at) {
      setAuthChecked(true);
      return undefined;
    }

    let active = true;
    setAuthChecked(false);
    apiFetch('/api/me')
      .then(async (response) => {
        if (response.ok) return;
        const payload = await response.json().catch(() => ({}));
        if (response.status === 403 && payload?.data?.requires_verification) logout();
      })
      .catch(() => {})
      .finally(() => {
        if (active) setAuthChecked(true);
      });

    return () => { active = false; };
  }, [isLoggedIn, logout]);

  const normalizedRole = user?.role?.toLowerCase();

  const openLoginModal = () => setIsLoginModalOpen(true);
  const closeLoginModal = () => setIsLoginModalOpen(false);
  const openRegisterModal = () => { setIsRegisterOpen(true); setIsLoginModalOpen(false); };
  const closeRegisterModal = () => setIsRegisterOpen(false);

  const handleLoginAttempt = ({ token: authToken, user: authUser, remember }) => {
    login({ token: authToken, user: authUser, remember });
    closeLoginModal();
  };

  const handleLogout = () => logout();
  const navigateFromHeader = (target = '') => {
    if (target === 'home') {
      // Use a small delay to ensure DOM is ready, then scroll to top
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }, 50);
      return;
    }
  };
  const handleFooterNavigate = (sectionId) => {
    window.setTimeout(() => {
      const target = document.getElementById(sectionId);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        window.location.hash = `#${sectionId}`;
      }
    }, 120);
  };

  if (isLoggedIn && !authChecked) return null;

  if (isLoggedIn) {
    if (normalizedRole === 'admin') {
      return (
        <Suspense fallback={null}>
          <PowerSyncProvider>
            <AdminDashboard onLogout={handleLogout} currentUser={user} />
          </PowerSyncProvider>
        </Suspense>
      );
    }
    if (normalizedRole === 'staff') {
      return (
        <Suspense fallback={null}>
          <PowerSyncProvider>
            <StaffDashboard onLogout={handleLogout} currentUser={user} />
          </PowerSyncProvider>
        </Suspense>
      );
    }
    if (normalizedRole === 'customer' || normalizedRole === 'client') {
      return (
        <Suspense fallback={null}>
          <PowerSyncProvider>
            <CustomerDashboard onLogout={handleLogout} currentUser={user} onUserUpdated={(name) => updateUser((p) => ({ ...p, name }))} />
          </PowerSyncProvider>
        </Suspense>
      );
    }
    return (
      <Suspense fallback={null}>
        <PowerSyncProvider>
          <CustomerDashboard onLogout={handleLogout} currentUser={user} onUserUpdated={(name) => updateUser((p) => ({ ...p, name }))} />
        </PowerSyncProvider>
      </Suspense>
    );
  }

  return (
    <main
      className="w-full font-poppins flex flex-col min-h-screen lg:bg-cover lg:bg-center lg:bg-scroll lg:bg-fixed"
      style={{ backgroundImage: "url('/assets/bg_1.webp')" }}
    >
      {!isDesktop && (
        <div className="xl:hidden">
          <Suspense fallback={null}>
            <LandingPageMobileView
              onOpenLogin={openLoginModal}
              onOpenRegister={openRegisterModal}
              onNavigate={navigateFromHeader}
              hideHero={false}
            />
          </Suspense>
        </div>
      )}

      {isDesktop && (
        <>
          <div className="sticky top-0 z-50 hidden xl:block">
        <Header
          onOpenLogin={openLoginModal}
          onOpenRegister={openRegisterModal}
          onNavigate={navigateFromHeader}
          forceTopStyle={false}
          forceSolidHeader={false}
        />
      </div>

      <div className="hidden xl:flex xl:flex-col">
        <section id="home" className="relative -mt-20 md:-mt-24 pt-20 md:pt-24 w-full min-h-[100svh] md:min-h-screen overflow-hidden flex flex-col scroll-mt-24">
          <img
            src={HERO_BACKGROUND_SRC}
            alt="Pet Station Background"
            className="absolute top-0 left-0 w-full h-full object-cover object-bottom z-0"
          />
          <div
            className="absolute inset-0 z-0"
            style={{
              background: 'radial-gradient(circle at 60% 30%, rgba(79,198,201,0.18) 0%, rgba(115,108,222,0.10) 60%, rgba(23,53,81,0.18) 100%)',
            }}
          />
          <div className="relative z-10 flex flex-col items-center justify-center translate-y-10 md:translate-y-14 flex-grow text-center px-5 sm:px-8 pt-6 sm:pt-10 pb-10 w-full">
            <h1
              className="text-[30px] leading-[1.15] sm:text-5xl md:text-6xl lg:text-7xl font-bauhaus font-bold text-white mb-2 w-full max-w-4xl tracking-wide mt-0 sm:mt-4"
              style={{ textShadow: '0 2px 5px rgba(0, 0, 0, 0.34)' }}
            >
              Uniting Hearts and Paws <br /> in a Haven of Love
            </h1>
            <p
              className="text-white font-poppins text-sm md:text-base max-w-sm sm:max-w-md mb-7 sm:mb-8 font-medium"
              style={{ textShadow: '0 1px 4px rgba(0, 0, 0, 0.32)' }}
            >
              Providing the best care for your furry friends at The Fur Club Pet Station.
            </p>
            <div className="flex w-full max-w-[260px] sm:max-w-none flex-col sm:flex-row gap-3 sm:gap-4 justify-center mt-2 sm:mt-4">
              <button
                onClick={openLoginModal}
                className="animate-float-soft w-full sm:w-auto bg-brand-orange text-brand-white px-6 sm:px-10 py-2.5 sm:py-3 rounded-full font-poppins font-semibold text-sm sm:text-lg hover:-translate-y-1 hover:bg-brand-teal transition-all duration-300 shadow-lg"
              >
                Book with Us!
              </button>
              <a
                href="#services"
                className="w-full sm:w-auto px-6 sm:px-10 py-2.5 sm:py-3 rounded-full font-poppins font-semibold text-sm sm:text-lg border-2 border-white text-white hover:-translate-y-1 hover:bg-white hover:text-brand-dark transition-all duration-300 shadow-lg"
              >
                Our Services
              </a>
            </div>
          </div>
        </section>
          </div>
        </>
      )}
      <Suspense fallback={null}>
        <Services onOpenLogin={openLoginModal} />
        <AboutUs onBookNow={openLoginModal} />
        <FAQ />
        <Contact />
        <Footer
          onOpenLogin={openLoginModal}
          onNavigateSection={handleFooterNavigate}
        />
      </Suspense>
      {isLoginModalOpen && (
        <Suspense fallback={null}>
          <LoginModal
            isOpen={isLoginModalOpen}
            onLogin={handleLoginAttempt}
            onClose={closeLoginModal}
            onOpenRegister={openRegisterModal}
            onForgotPassword={() => { setIsLoginModalOpen(false); setIsForgotPasswordOpen(true); }}
          />
        </Suspense>
      )}
      {isRegisterOpen && (
        <Suspense fallback={null}>
          <Register
            isOpen={isRegisterOpen}
            onClose={closeRegisterModal}
            onSwitchToLogin={() => { closeRegisterModal(); openLoginModal(); }}
            onRegisterSuccess={handleLoginAttempt}
          />
        </Suspense>
      )}
      {isForgotPasswordOpen && (
        <Suspense fallback={null}>
          <ForgotPassword
            isOpen={isForgotPasswordOpen}
            onClose={() => setIsForgotPasswordOpen(false)}
            onBackToLogin={() => { setIsForgotPasswordOpen(false); setIsLoginModalOpen(true); }}
          />
        </Suspense>
      )}
      {isResetPasswordOpen && (
        <Suspense fallback={null}>
          <ResetPassword
            isOpen={isResetPasswordOpen}
            onClose={() => setIsResetPasswordOpen(false)}
            onBackToLogin={() => { setIsResetPasswordOpen(false); setIsLoginModalOpen(true); }}
          />
        </Suspense>
      )}
    </main>
  );
}
