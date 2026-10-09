import { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  BarChart2, Bell, Boxes, CalendarPlus, LayoutDashboard, LogOut,
  Menu, PawPrint, Scissors, Settings, ShoppingCart, UserLock, UsersRound, X,
} from 'lucide-react';
import StatBox from '../StatBox';
import { AppointmentCalendar, InProgressPanel, NeedsAttentionPanel } from '../AdminDashboard';
import HeaderMessages from '../../header/HeaderMessages';
import HeaderNotifications from '../../header/HeaderNotifications';
import ProfileHeader from '../../header/ProfileHeader';
import { useSuppliesFeatureEnabled } from '../../../../utils/featureFlags';
import { canAccessStaffPage } from '../../../../utils/staffTypes';

const HeaderNosePrint = lazy(() => import('../../header/HeaderNosePrint'));

const NAV_ITEMS = [
  { id: 'dashboard',   label: 'Dashboard',   icon: LayoutDashboard },
  { id: 'appointment', label: 'Appointment',  icon: Bell },
  { id: 'staff',       label: 'Staff',        icon: UserLock, staffHidden: true },
  { id: 'customer',    label: 'Customer',     icon: UsersRound },
  { id: 'pets',        label: 'Pets',         icon: PawPrint },
  { id: 'service',      label: 'Services',     icon: Scissors, staffHidden: true },
  { id: 'inventory',   label: 'Supplies',     icon: Boxes },
  { id: 'reports',     label: 'Reports',      icon: BarChart2, staffHidden: true },
  { id: 'settings',    label: 'System Settings', icon: Settings },
];

const getMobileStatNote = (stat) => {
  if (stat.key === 'grooming_today') {
    return String(stat.note || '')
      .replace('ready for appointments', 'ready')
      .replace('No grooming appointments today', 'No grooming today');
  }

  if (stat.key === 'daycare_today') {
    return String(stat.note || '')
      .replace('currently in progress', 'active')
      .replace('No daycare appointments today', 'No daycare today');
  }

  return stat.note;
};

export default function AdminDashboard_MobileView({
  user,
  displayName   = 'Admin',
  greeting      = 'Good day',
  todayLabel    = '',
  statCards     = [],
  activePage    = 'dashboard',
  onNavigate,
  onOpenWalkInSale,
  onOpenNewAppointment,
  dashboardLoading = false,
  onLogout,
  onStatClick,
  onOpenAppointment,
  onOpenDayList,
  onOpenBookingChoice,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const profileRef = useRef(null);
  const [suppliesEnabled] = useSuppliesFeatureEnabled();

  useEffect(() => {
    if (!menuOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [menuOpen]);

  const visibleNavItems = NAV_ITEMS.filter((item) => {
    return canAccessStaffPage(user, item.id, suppliesEnabled);
  });

  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || 'A';

  const navigate = (pageId) => {
    if (pageId === 'settings') {
      window.location.hash = '#settings';
    }
    setMenuOpen(false);
    onNavigate?.(pageId);
  };

  return (
    <div className="font-poppins">

      {/* -- Mobile Header -- */}
      <header className="sticky top-0 z-40 px-4 py-3 bg-white/90 backdrop-blur border-b border-brand-teal/20 shadow-sm">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('dashboard')}
            className="flex items-center gap-2"
            aria-label="Go to dashboard"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-teal shadow-sm">
              <img src="/assets/paw-teal.webp" alt="The Fur Club" className="h-7 w-7 object-contain brightness-0 invert" />
            </span>
            <img src="/assets/furclub_text.webp" alt="Fur Club" className="h-4 w-auto object-contain" />
          </button>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full text-brand-dark transition-colors hover:bg-brand-teal-soft/60"
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>
        </div>
      </header>

      {/* -- Hamburger Drawer (portal) -- */}
      {typeof document !== 'undefined' && createPortal(
        <>
          {/* Backdrop */}
          <div
            className={`fixed inset-0 z-[140] bg-black/45 backdrop-blur-sm transition-opacity duration-300 ${
              menuOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
            onClick={() => setMenuOpen(false)}
          />

          {/* Drawer */}
          <aside
            className={`fixed inset-y-0 right-0 z-[150] flex h-[100dvh] w-[min(85vw,300px)] flex-col bg-white shadow-2xl transition-transform duration-300 ${
              menuOpen ? 'translate-x-0' : 'pointer-events-none translate-x-full'
            }`}
          >
            {/* Profile header strip - teal */}
            <div className="bg-brand-teal px-5 py-5 flex items-center justify-between shrink-0">
              <button
                type="button"
                onClick={() => { setMenuOpen(false); profileRef.current?.open(); }}
                className="flex items-center gap-3 min-w-0 flex-1 text-left"
                aria-label="Edit profile"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-sm font-bold text-brand-teal">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">{displayName}</p>
                  <p className="text-[11px] text-white/60 truncate mt-0.5">{user?.email || ''}</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="ml-2 shrink-0 text-white/70 hover:text-white"
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>
            <div className="h-1 bg-brand-teal-light shrink-0" />

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-3">

              {/* Tools */}
              <div className="rounded-xl border border-brand-dark-light bg-white px-3 py-2.5">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-brand-dark-soft">Tools</p>
                <div className="flex h-14 items-center overflow-visible rounded-full border border-brand-dark-light bg-white px-2 shadow-sm">
                  <div className="flex min-w-0 flex-1 items-center justify-center">
                    <Suspense fallback={<span className="inline-flex h-10 w-10 rounded-full bg-brand-teal/15" />}>
                      {canAccessStaffPage(user, 'pets', suppliesEnabled) && <HeaderNosePrint onNavigate={(id, payload) => { setMenuOpen(false); onNavigate?.(id, payload); }} />}
                    </Suspense>
                  </div>
                  {suppliesEnabled && canAccessStaffPage(user, 'inventory', suppliesEnabled) && (
                    <div className="flex min-w-0 flex-1 items-center justify-center">
                      <button
                        type="button"
                        onClick={() => { setMenuOpen(false); onOpenWalkInSale?.(); }}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-full text-brand-dark transition-colors hover:bg-white/50"
                        aria-label="Open walk-in sale"
                      >
                        <ShoppingCart size={16} strokeWidth={2.35} />
                      </button>
                    </div>
                  )}
                  <div className="flex min-w-0 flex-1 items-center justify-center">
                    <HeaderMessages />
                  </div>
                  <div className="flex min-w-0 flex-1 items-center justify-center">
                    <HeaderNotifications onNavigate={(id, payload) => { setMenuOpen(false); onNavigate?.(id, payload); }} />
                  </div>
                </div>
              </div>

              {/* Navigation */}
              <div className="rounded-xl border border-brand-dark-light bg-white px-4 py-3 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-dark-soft mb-2">Menu</p>
                {visibleNavItems.map(({ id, label, icon: Icon }) => {
                  const isActive = activePage === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => navigate(id)}
                      className={`w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-left transition-colors ${
                        isActive
                          ? 'bg-brand-teal text-white'
                          : 'text-brand-dark hover:bg-brand-teal/10 hover:text-brand-teal'
                      }`}
                    >
                      <Icon size={16} className="shrink-0" />
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Logout */}
            <div className="shrink-0 border-t border-brand-dark-light px-4 py-4">
              <button
                type="button"
                onClick={() => { setMenuOpen(false); onLogout?.(); }}
                className="w-full flex items-center gap-2 justify-end px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 transition-colors"
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          </aside>
        </>,
        document.body
      )}

      {/* ProfileHeader portal - always mounted so ref works */}
      <ProfileHeader
        ref={profileRef}
        buttonClassName="hidden"
        onNavigate={onNavigate}
        onLogout={onLogout}
      />

      {/* -- Dashboard Content (dashboard page only) -- */}
      {activePage === 'dashboard' && (
        <div className="px-4 pb-10 pt-5 space-y-5">

          {/* Welcome row */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-brand-dark leading-tight">
                {greeting}, {displayName.split(' ')[0]}!
              </h1>
              <p className="text-[11px] text-brand-dark-soft mt-0.5">Here&apos;s an overview of the station&apos;s status today.</p>
            </div>
            <div className="flex shrink-0 items-center">
              {dashboardLoading ? (
                <span role="status" aria-label="Loading new appointment" className="h-10 w-44 animate-pulse rounded-full bg-brand-surface" />
              ) : (
                <button
                  type="button"
                  onClick={onOpenNewAppointment}
                  className="flex items-center gap-1.5 rounded-full bg-brand-teal px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-brand-teal-dark"
                >
                  <CalendarPlus size={14} />
                  New Appointment
                </button>
              )}
            </div>
          </div>

          {/* Stat Boxes - 2 per row */}
          <div className="grid grid-cols-2 gap-3">
            {statCards.map((stat) => (
              <StatBox
                key={stat.key}
                title={stat.title}
                value={stat.value}
                note={getMobileStatNote(stat)}
                onClick={() => onStatClick?.(stat.key)}
              />
            ))}
          </div>

          {/* Status Reminders */}
          <section>
            <NeedsAttentionPanel
              onOpenAppointment={onOpenAppointment}
              onOpenNewBookings={() => onStatClick?.('new_bookings')}
            />
          </section>

          {/* Today Timeline */}
          <section>
            <InProgressPanel onOpenAppointment={onOpenAppointment} />
          </section>

          {/* Weekly Calendar */}
          <section>
            <AppointmentCalendar onOpenDayList={onOpenDayList} onOpenBookingChoice={onOpenBookingChoice} />
          </section>

        </div>
      )}
    </div>
  );
}
