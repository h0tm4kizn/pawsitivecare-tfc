import { BarChart2, Bell, Boxes, BriefcaseBusiness, LayoutDashboard, LogOut, Menu, PawPrint, Settings, ShoppingCart, UserLock, UsersRound, X } from 'lucide-react';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuthStore } from '../../../stores/authStore';
import { useSuppliesFeatureEnabled } from '../../../utils/featureFlags';
import HeaderMessages from './HeaderMessages';
import HeaderNotifications from './HeaderNotifications';
import ProfileHeader from './ProfileHeader';
import { canAccessStaffPage } from '../../../utils/staffTypes';

const HeaderNosePrint = lazy(() => import('./HeaderNosePrint'));

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, testId: 'nav-dashboard' },
  { id: 'appointment', label: 'Appointment', icon: Bell, testId: 'nav-appointment' },
  { id: 'staff', label: 'Staff', icon: UserLock, testId: 'nav-staff' },
  { id: 'customer', label: 'Customer', icon: UsersRound, testId: 'nav-customer' },
  { id: 'pets', label: 'Pets', icon: PawPrint, testId: 'nav-pets' },
  { id: 'settings', label: 'System Settings', icon: Settings, testId: 'nav-settings' },
  { id: 'inventory', label: 'Supplies', icon: Boxes, testId: 'nav-inventory' },
  { id: 'reports', label: 'Reports', icon: BarChart2, testId: 'nav-reports' },
];

export default function AdminHeader({ activePage = 'dashboard', onNavigate, onOpenWalkInSale }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const profileRef = useRef(null);
  const [isScrolled, setIsScrolled] = useState(false);
  const [suppliesEnabled] = useSuppliesFeatureEnabled();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const normalizedRole = String(user?.role || '').toLowerCase();
  const visibleNavItems = navItems.filter((item) => {
    return canAccessStaffPage(user, item.id, suppliesEnabled);
  });
  const serviceNavItem = { id: 'service', label: 'Service', icon: BriefcaseBusiness, testId: 'nav-service' };
  const desktopNavItems = visibleNavItems
    .filter((item) => item.id !== 'settings')
    .flatMap((item) => item.id === 'inventory' && normalizedRole === 'admin'
      ? [serviceNavItem, item]
      : [item]);

  const displayName = user?.name || [user?.first_name, user?.last_name].filter(Boolean).join(' ') || user?.email || 'Administrator';
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'A';

  const handleNavigate = (pageId, payload) => {
    if (pageId === 'settings') {
      window.location.hash = normalizedRole === 'admin' ? '#settings/system' : '#settings';
    } else if (pageId === 'service') {
      window.location.hash = '#service';
    }
    onNavigate?.(pageId, payload);
    setIsMenuOpen(false);
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!isMenuOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMenuOpen]);

  return (
    <header
      className={`sticky top-0 z-30 px-3 sm:px-4 md:px-6 lg:px-8 py-5 font-poppins backdrop-blur transition-colors ${
        isScrolled
          ? 'bg-white/20'
          : 'bg-transparent'
      }`}
    >
      <div className={`mx-auto grid w-full max-w-[1736px] grid-cols-[auto_1fr] items-center gap-3 border-b md:gap-4 ${
        isScrolled
          ? 'border-brand-teal/30'
          : 'border-transparent'
      }`}>
        <button
          type="button"
          onClick={() => handleNavigate('dashboard')}
          className="group inline-flex items-center"
          aria-label="Go to admin dashboard"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-teal text-white shadow-sm transition-transform group-hover:scale-105">
            <img src="/assets/paw-teal.webp" alt="The Fur Club" className="h-9 w-9 object-contain brightness-0 invert" />
          </span>
        </button>

        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 md:gap-3">
          <nav
            className="hidden h-14 items-center gap-0.5 rounded-full border border-brand-teal/30 bg-brand-teal-soft/80 p-1.5 shadow-[inset_0_2px_10px_rgba(23,53,81,0.16)] md:flex"
            aria-label="Admin navigation"
          >
            {desktopNavItems.map(({ id, label, icon: Icon, testId }) => {
              const isActive = id === activePage;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleNavigate(id)}
                  className={`inline-flex h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold tracking-tight transition-all lg:px-5 lg:text-[15px] ${
                    isActive
                      ? 'bg-brand-teal text-white shadow-[0_2px_6px_rgba(79,198,201,0.40)]'
                      : 'text-brand-dark hover:bg-white/50'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                  data-testid={testId}
                >
                  <Icon size={16} strokeWidth={2.35} className="shrink-0" />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>

            <div className="hidden h-14 items-center overflow-visible rounded-full bg-brand-teal-soft/80 shadow-[inset_0_2px_10px_rgba(23,53,81,0.14)] md:flex">
            {canAccessStaffPage(user, 'pets', suppliesEnabled) && (
              <Suspense fallback={<span className="h-11 w-11 rounded-full bg-white/35" />}>
                <HeaderNosePrint onNavigate={handleNavigate} />
              </Suspense>
            )}
            {suppliesEnabled && canAccessStaffPage(user, 'inventory', suppliesEnabled) && (
              <button
                type="button"
                onClick={() => onOpenWalkInSale?.()}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full text-brand-dark transition-all hover:bg-white/50"
                title="Open walk-in sale"
                aria-label="Open walk-in sale"
              >
                <ShoppingCart size={16} strokeWidth={2.35} className="shrink-0" />
              </button>
            )}
            <HeaderMessages />
            <HeaderNotifications onNavigate={handleNavigate} />
          </div>

          <div className="shrink-0">
            <ProfileHeader ref={profileRef} buttonClassName="hidden md:flex" onNavigate={onNavigate} />
          </div>

          <button
            type="button"
            onClick={() => setIsMenuOpen((value) => !value)}
            className="flex h-10 w-10 items-center justify-center rounded-full text-brand-dark transition-colors hover:bg-brand-teal-soft/60 md:hidden mr-2 sm:mr-0"
            aria-label="Toggle admin menu"
            aria-expanded={isMenuOpen}
          >
            {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {typeof document !== 'undefined' ? createPortal(
        <>
          <div
            className={`fixed inset-0 z-[140] bg-black/45 backdrop-blur-sm transition-opacity duration-300 ${
              isMenuOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
            onClick={() => setIsMenuOpen(false)}
          />

          <div
            className={`fixed top-0 right-0 h-[100dvh] w-[min(100vw,320px)] bg-brand-teal text-white z-[150] md:hidden transform transition-transform duration-300 ease-out flex flex-col overflow-y-auto no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden ${
              isMenuOpen ? 'translate-x-0' : 'pointer-events-none translate-x-full'
            }`}
          >
            {/* Header with close button */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
              <h2 className="text-lg font-bold">Menu</h2>
              <button
                type="button"
                onClick={() => setIsMenuOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/10"
                aria-label="Close menu"
              >
                <X size={24} />
              </button>
            </div>

            {/* Navigation items */}
            <nav className="flex-1 overflow-y-auto px-4 py-4 no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden" aria-label="Mobile admin navigation">
              <div className="space-y-2">
                {visibleNavItems.map(({ id, label, icon: Icon, testId }) => {
                  const isActive = id === activePage;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => handleNavigate(id)}
                      className={`w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left text-base font-bold transition-colors ${
                        isActive
                          ? 'bg-white/20'
                          : 'hover:bg-white/10'
                      }`}
                      data-testid={testId}
                      >
                      <Icon size={18} />
                      <>
                        {label}{'\u00A0\u00A0'}
                      </>
                    </button>
                  );
                })}
              </div>
            </nav>

            {/* Profile section */}
            <div className="shrink-0 border-t border-white/10 px-4 py-4 space-y-3">
              <button
                type="button"
                onClick={() => { setIsMenuOpen(false); profileRef.current?.open(); }}
                className="flex w-full items-center gap-3 rounded-xl bg-white/10 px-4 py-3 text-left hover:bg-white/20 transition-colors"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-brand-teal">
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-white">{displayName}</p>
                  <p className="truncate text-xs text-white">{user?.email || ''}</p>
                </div>
                <span className="text-xs text-white">Profile &rsaquo;</span>
              </button>
              <button
                type="button"
                onClick={() => { setIsMenuOpen(false); logout(); }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500 py-2.5 text-sm font-bold text-white hover:bg-red-600 transition-colors"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          </div>
        </>,
        document.body
      ) : null}
    </header>
  );
}
