import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import AdminHeader from '../header/AdminHeader';
import AdminDashboard_MobileView from './mobile/AdminDashboard_MobileView';
import DashboardFooter from '../../../components/DashboardFooter';
import { apiFetch } from '../../../api/apiClient';
import { notifyError, notifySuccess } from '../../../utils/notify';
import ScheduleAppointmentButton from '../../../components/reusable-ui/ScheduleAppointmentButton';
import StatBox from './StatBox';
import NewBookingsModal from '../appointment/NewBookingsModal';
import BookAppointment from '../appointment/BookAppointment';
import ServiceCategoryPickerModal from '../appointment/booking/components/ServiceCategoryPickerModal';
import BookingTypePickerModal from '../appointment/components/BookingTypePickerModal';
import { useAppointmentStore } from '../../../stores/appointmentStore';
import { useAuthStore } from '../../../stores/authStore';
import { useAdminHeaderStore } from '../../../stores/adminHeaderStore';
import { useSuppliesFeatureEnabled } from '../../../utils/featureFlags';
import { useDashboardStore } from '../../../stores/dashboardStore';
import { canAccessStaffPage } from '../../../utils/staffTypes';
import useMediaQuery from '../../../hooks/useMediaQuery';
import { CANCELLATION_REASON_OPTIONS } from '../appointment/appointmentConstants';
import { expandAppointmentsForCalendarDate, getServiceCategory, isInProgressStatus, toLocalIsoDate, toManilaIsoDate } from './adminDashboardUtils';
import {
  SkeletonBlock,
  AppointmentCalendar,
  AppointmentToastStack,
  InProgressPanel,
  NeedsAttentionPanel,
} from './AdminDashboardPanels';
import { ConfirmBookingStatusModal } from './AdminDashboardModals';

export { AppointmentCalendar, InProgressPanel, NeedsAttentionPanel } from './AdminDashboardPanels';

import {
  AdminPageFallback,
  AppointmentDetailsModal,
  AppointmentPage,
  AuditLogsPage,
  CancellationReasonModal,
  CustomerPage,
  InventoryPage,
  PetsPage,
  ReportsPage,
  ServicePage,
  SettingsBackupPage,
  SettingsPage,
  StaffPage,
  StatGridSkeleton,
  ViewAllAppointmentToday,
  WalkInSaleModal,
} from './AdminDashboardPageRegistry';
import useBookingNotifications from './useBookingNotifications';
import StaffHomeAttendance from '../staff/components/StaffHomeAttendance';

const getPageFromHash = () => {
  if (typeof window === 'undefined') return 'dashboard';
  if (window.location.hash === '#service') return 'service';
  if (window.location.hash === '#settings' || window.location.hash.startsWith('#settings/')) return 'settings';
  return 'dashboard';
};

const RAW_API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';
const resolveApiBaseUrl = () => {
  if (typeof window === 'undefined') return RAW_API_BASE_URL;
  if (window.location.protocol !== 'https:') return RAW_API_BASE_URL;
  try {
    const parsed = new URL(RAW_API_BASE_URL, window.location.origin);
    const localHosts = new Set(['localhost', '127.0.0.1']);
    if (parsed.protocol === 'http:' && !localHosts.has(parsed.hostname)) {
      parsed.protocol = 'https:';
    }
    return parsed.toString().replace(/\/$/, '');
  } catch {
    return RAW_API_BASE_URL;
  }
};

export default function AdminDashboard() {
  const user = useAuthStore((state) => state.user);
  const token = useAuthStore((state) => state.token);
  const logout = useAuthStore((state) => state.logout);
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const normalizedRole = String(user?.role || '').toLowerCase();
  const monthAppointments = useDashboardStore((state) => state.monthAppointments);
  const pendingAppointments = useDashboardStore((state) => state.pendingAppointments);
  const appointmentsLoading = useDashboardStore((state) => state.appointmentsLoading);
  const loadMonthAppointments = useDashboardStore((state) => state.loadMonthAppointments);
  const isBookCategoryPickerOpen = useAppointmentStore((state) => state.isBookCategoryPickerOpen);
  const isBookAppointmentOpen = useAppointmentStore((state) => state.isBookAppointmentOpen);
  const appointmentBookingCategory = useAppointmentStore((state) => state.appointmentBookingCategory);
  const openBookAppointment = useAppointmentStore((state) => state.openBookAppointment);
  const selectBookAppointmentCategory = useAppointmentStore((state) => state.selectBookAppointmentCategory);
  const closeBookCategoryPicker = useAppointmentStore((state) => state.closeBookCategoryPicker);
  const closeBookAppointment = useAppointmentStore((state) => state.closeBookAppointment);
  const hotelOverview = useAppointmentStore((state) => state.hotelOverview);
  const loadHotelOverview = useAppointmentStore((state) => state.loadHotelOverview);
  const schedule = useAppointmentStore((state) => state.schedule);
  const loadSchedule = useAppointmentStore((state) => state.loadSchedule);
  const updateAppointmentStatus = useAppointmentStore((state) => state.updateAppointmentStatus);
  const appointmentNotifications = useAdminHeaderStore((state) => state.appointmentNotifications);
  const loadNotifications = useAdminHeaderStore((state) => state.loadNotifications);
  const notificationsDisabled = useAdminHeaderStore((state) => state.notificationsDisabled);
  const displayName = user?.name || user?.first_name || 'Len';
  const todayLabel = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Manila',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const greeting = (() => {
    const hour = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' })).getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  })();
  const todayIso = useMemo(() => toLocalIsoDate(new Date()), []);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [autoCompleteAppointmentId, setAutoCompleteAppointmentId] = useState(null);
  const [isStatusSaving, setIsStatusSaving] = useState(false);
  const [isDayListOpen, setIsDayListOpen] = useState(false);
  const [selectedDayIso, setSelectedDayIso] = useState(todayIso);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [selectedStatKey, setSelectedStatKey] = useState(null);
  const [activePage, setActivePage] = useState(getPageFromHash);
  const [focusAppointmentId, setFocusAppointmentId] = useState(null);
  const [focusAppointmentEdit, setFocusAppointmentEdit] = useState(false);
  const [focusOwnerId, setFocusOwnerId] = useState(null);
  const [focusPet, setFocusPet] = useState(null);
  const [newBookingsOpen, setNewBookingsOpen] = useState(false);
  const [walkInSaleOpen, setWalkInSaleOpen] = useState(false);
  const [walkInCategoryPickerOpen, setWalkInCategoryPickerOpen] = useState(false);
  const [walkInBookingOpen, setWalkInBookingOpen] = useState(false);
  const [walkInBookingCategory, setWalkInBookingCategory] = useState(null);
  const [walkInBookingDate, setWalkInBookingDate] = useState(null);
  const [calendarBookingChoiceDate, setCalendarBookingChoiceDate] = useState(null);
  const [newAppointmentChoiceOpen, setNewAppointmentChoiceOpen] = useState(false);
  const [shopHoursLoading, setShopHoursLoading] = useState(true);
  const [shopHoursError, setShopHoursError] = useState(false);
  const [suppliesEnabled] = useSuppliesFeatureEnabled();
  const [confirmingId, setConfirmingId] = useState(null);
  const [confirmBookingTarget, setConfirmBookingTarget] = useState(null);
  const handleNotificationAppointmentOpen = useCallback((appointmentId) => {
    setActivePage('appointment');
    if (appointmentId) {
      setFocusAppointmentId(appointmentId);
      setFocusAppointmentEdit(false);
    }
  }, []);
  const { toasts, removeToast } = useBookingNotifications({
    activePage,
    token,
    normalizedRole,
    staffType: user?.staff_type,
    monthAppointments,
    appointmentNotifications,
    apiBaseUrl: resolveApiBaseUrl,
    onOpenAppointment: handleNotificationAppointmentOpen,
  });
  const isPageAllowed = (pageId) => {
    const knownPages = ['dashboard', 'appointment', 'staff', 'customer', 'pets', 'inventory', 'service', 'reports', 'settings', 'backup', 'audit-logs'];
    if (!knownPages.includes(pageId)) return false;
    return canAccessStaffPage(user, pageId, suppliesEnabled);
  };

  useEffect(() => {
    if (isPageAllowed(activePage)) return;
    setActivePage('dashboard');
  }, [activePage, normalizedRole, suppliesEnabled]);

  useEffect(() => {
    const handleHashChange = () => {
      const page = getPageFromHash();
      if (isPageAllowed(page)) setActivePage(page);
    };

    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handleHashChange);
    };
  }, [normalizedRole, suppliesEnabled]);

  const handleHeaderNavigate = (pageId, payload) => {
    if (!isPageAllowed(pageId)) {
      setActivePage('dashboard');
      setFocusAppointmentId(null);
      setFocusAppointmentEdit(false);
      return;
    }
    if (payload?.openNewBookings) {
      setNewBookingsOpen(true);
      setFocusAppointmentId(null);
      setFocusAppointmentEdit(false);
      void loadMonthAppointments({ force: true, silent: true });
      return;
    }
    if (payload?.openWalkInSale) {
      if (!suppliesEnabled) return;
      setWalkInSaleOpen(true);
      return;
    }
    if (pageId === 'appointment' && payload?.appointmentDate) {
      const date = new Date(`${String(payload.appointmentDate).slice(0, 10)}T00:00:00`);
      if (!Number.isNaN(date.getTime())) {
        useAppointmentStore.getState().setCurrentMonth(date);
      }
    }
    if (pageId === 'service') window.location.hash = '#service';
    setActivePage(pageId);
    setFocusAppointmentId(payload?.appointmentId || null);
    setFocusAppointmentEdit(Boolean(payload?.editAppointment));
    setFocusOwnerId(pageId === 'customer' ? (payload?.ownerId || null) : null);
    setFocusPet(pageId === 'pets' ? {
      petId: payload?.petId || null,
      ownerId: payload?.ownerId || null,
      petName: payload?.petName || null,
    } : null);
    if (pageId === 'appointment' && payload?.pet) {
      openBookAppointment(null, payload.pet);
    }
  };

  const openWalkInBooking = (dateIso = null) => {
    if (dateIso && dateIso !== toManilaIsoDate()) {
      setWalkInBookingDate(null);
      setWalkInBookingCategory(null);
      setWalkInCategoryPickerOpen(false);
      setWalkInBookingOpen(false);
      return;
    }
    setWalkInBookingDate(dateIso);
    setWalkInCategoryPickerOpen(true);
  };
  const openCalendarBookingChoice = (dateIso) => {
    setNewAppointmentChoiceOpen(false);
    setCalendarBookingChoiceDate(dateIso);
  };
  const openNewAppointmentChoice = () => {
    setNewAppointmentChoiceOpen(true);
    setCalendarBookingChoiceDate(toManilaIsoDate());
  };
  const selectCalendarBookingType = (type) => {
    const dateIso = calendarBookingChoiceDate;
    const fromDashboardButton = newAppointmentChoiceOpen;
    setNewAppointmentChoiceOpen(false);
    setCalendarBookingChoiceDate(null);
    if (type === 'walk_in') {
      openWalkInBooking(fromDashboardButton ? toManilaIsoDate() : dateIso);
      return;
    }
    openBookAppointment(fromDashboardButton ? null : dateIso);
  };
  const selectWalkInCategory = (category) => {
    setWalkInCategoryPickerOpen(false);
    setWalkInBookingCategory(category);
    setWalkInBookingOpen(true);
  };

  const selectedDayAppointments = useMemo(() => {
    return expandAppointmentsForCalendarDate(monthAppointments, selectedDayIso)
      .sort((a, b) => String(a?._raw?.start_time || '').localeCompare(String(b?._raw?.start_time || '')));
  }, [monthAppointments, selectedDayIso]);

  const todayAppointments = useMemo(() => {
    return expandAppointmentsForCalendarDate(monthAppointments, todayIso);
  }, [monthAppointments, todayIso]);

  const todayInProgressAppointments = useMemo(() => {
    return todayAppointments
      .filter((appointment) => isInProgressStatus(appointment?.status))
      .sort((a, b) => String(a?._raw?.start_time || '').localeCompare(String(b?._raw?.start_time || '')));
  }, [todayAppointments]);

  const statCards = useMemo(() => {
    const todayActive = todayAppointments.filter((appointment) => isInProgressStatus(appointment?.status)).length;
    const hotelAvailable = Number(hotelOverview?.hotel_available ?? 0);
    const hotelOccupied = Number(hotelOverview?.hotel_occupied ?? 0);
    const hotelTotal = Number(hotelOverview?.hotel_total ?? hotelAvailable + hotelOccupied);
    const hotelDogs = Number(hotelOverview?.hotel_dogs ?? hotelOverview?.hotel_species_counts?.dog ?? 0);
    const hotelCats = Number(hotelOverview?.hotel_cats ?? hotelOverview?.hotel_species_counts?.cat ?? 0);

    const pendingCount = pendingAppointments.length;

    return [
      {
        key: 'new_bookings',
        title: 'NEW BOOKINGS',
        value: pendingCount,
        note: pendingCount > 0 ? 'Bookings not yet approved' : 'No pending bookings',
      },
      {
        key: 'today_total',
        title: "TODAY'S APPOINTMENTS",
        value: todayAppointments.length,
        note: todayAppointments.length > 0 ? 'Sorted by time in the timeline' : 'No appointments today',
      },
      {
        key: 'in_progress_today',
        title: 'IN PROGRESS',
        value: todayActive,
        note: todayActive > 0 ? 'Currently checked in or active' : 'No active appointments',
      },
      {
        key: 'hotelsuite_available',
        title: 'HOTEL OCCUPANCY',
        value: hotelTotal > 0 ? `${hotelOccupied}/${hotelTotal}` : hotelOccupied,
        note: `${hotelAvailable} available - ${hotelDogs} dogs - ${hotelCats} cats`,
      },
    ];
  }, [todayAppointments, hotelOverview, monthAppointments, pendingAppointments]);

  const selectedStat = useMemo(
    () => statCards.find((item) => item.key === selectedStatKey) || null,
    [selectedStatKey, statCards],
  );

  const statModalAppointments = useMemo(() => {
    if (!selectedStatKey) return [];

    if (selectedStatKey === 'new_bookings') {
      return pendingAppointments;
    }
    if (selectedStatKey === 'today_total') {
      return todayAppointments;
    }
    if (selectedStatKey === 'in_progress_today') {
      return todayInProgressAppointments;
    }
    if (selectedStatKey === 'grooming_today') {
      return todayAppointments.filter((appointment) => getServiceCategory(appointment) === 'grooming');
    }
    if (selectedStatKey === 'daycare_today') {
      return todayAppointments.filter((appointment) => getServiceCategory(appointment) === 'daycare');
    }
    if (selectedStatKey === 'hotelsuite_available') {
      return todayAppointments.filter((appointment) => {
        if (getServiceCategory(appointment) !== 'hotel') return false;
        const status = String(appointment?.status || '').toLowerCase().replace(/-/g, '_');
        // Only show active hotel occupancy rows in inventory view.
        return ['pending', 'approved', 'checkin', 'checked_in', 'in_progress'].includes(status);
      });
    }
    return [];
  }, [selectedStatKey, todayAppointments, todayInProgressAppointments, monthAppointments, pendingAppointments]);

  const handleOpenAppointment = (appointment) => {
    if (!appointment) return;
    setSelectedAppointment(appointment);
  };

  const handleOpenDayList = (dateIso) => {
    if (!dateIso) return;
    setSelectedDayIso(dateIso);
    setIsDayListOpen(true);
  };

  const submitStatusUpdate = async (appointment, payload) => {
    if (!appointment?.id || isStatusSaving) return false;
    const { status, ...extra } = payload || {};
    if (!status) return false;

    setIsStatusSaving(true);
    try {
      const ok = await updateAppointmentStatus(appointment.id, status, extra);
      if (ok !== false) {
        await loadMonthAppointments({ force: true, silent: true });
        await loadHotelOverview();
        if (status !== 'completed') setSelectedAppointment(null);
      }
      return ok;
    } finally {
      setIsStatusSaving(false);
    }
  };

  const handleStatusChange = async (appointment, nextStatus, extraData = {}) => {
    if (!appointment?.id || isStatusSaving) return false;
    if (nextStatus === 'cancelled') {
      setCancelTarget(appointment);
      return false;
    }

    // For completing an appointment we adopt the appointment page flow: open the
    // detailed AppointmentDetailsModal and auto-open the complete-service flow.
    if (nextStatus === 'completed' && extraData?.hotel_checkout_confirmed) {
      setAutoCompleteAppointmentId(null);
      return submitStatusUpdate(appointment, { status: nextStatus, ...extraData });
    }
    if (nextStatus === 'completed') {
      // If this is the second call (modal returned data) and matches our auto id,
      // proceed to submit. Otherwise open the modal and set auto-complete id.
      if (autoCompleteAppointmentId && autoCompleteAppointmentId === appointment.id) {
        // Clear auto id before submitting to avoid loops
        setAutoCompleteAppointmentId(null);
        return submitStatusUpdate(appointment, { status: nextStatus, ...extraData });
      }

      // Open details modal and instruct it to auto-open the complete flow
      setSelectedAppointment(appointment);
      setAutoCompleteAppointmentId(appointment.id);
      return false;
    }

    return submitStatusUpdate(appointment, { status: nextStatus, ...extraData });
  };

  const handleConfirmCancellation = async (reason) => {
    if (!cancelTarget) return;
    const target = cancelTarget;
    setCancelTarget(null);
    await submitStatusUpdate(target, {
      status: 'cancelled',
      cancellation_reason: reason,
    });
  };

  useEffect(() => {
    if (!isPageAllowed(activePage)) {
      setActivePage('dashboard');
    }
  }, [activePage, normalizedRole]);

  useEffect(() => {
    setSelectedAppointment((current) => {
      if (!current) return current;
      const refreshed = monthAppointments.find((item) => item.id === current.id);
      if (!refreshed) return current;
      return {
        ...refreshed,
        calendarDateIso: current.calendarDateIso,
        calendarLabel: current.calendarLabel,
        time: current.calendarLabel || refreshed.time,
      };
    });
  }, [monthAppointments]);

  useEffect(() => {
    if (activePage !== 'dashboard') return undefined;
    let active = true;
    setShopHoursLoading(true);
    loadSchedule().then((ok) => {
      if (!active) return;
      setShopHoursError(!ok);
      setShopHoursLoading(false);
    });
    loadHotelOverview();
    const interval = setInterval(() => {
      if (activePage === 'dashboard') {
        loadMonthAppointments({ force: true, silent: true });
        loadHotelOverview();
      }
    }, 30_000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [activePage, loadMonthAppointments, loadHotelOverview, loadSchedule]);

  useEffect(() => {
    if (notificationsDisabled) return undefined;
    loadNotifications();
    const handlePageFocus = () => {
      if (document.visibilityState === 'visible') {
        loadNotifications({ force: true });
      }
    };
    const handleOnline = () => loadNotifications({ force: true });

    const interval = setInterval(() => {
      if (activePage === 'dashboard') {
        loadNotifications({ force: true });
      }
    }, 30_000);

    document.addEventListener('visibilitychange', handlePageFocus);
    window.addEventListener('focus', handlePageFocus);
    window.addEventListener('online', handleOnline);

    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handlePageFocus);
      window.removeEventListener('focus', handlePageFocus);
      window.removeEventListener('online', handleOnline);
    };
  }, [activePage, loadNotifications, notificationsDisabled]);

  useEffect(() => {
    const canRequest = normalizedRole === 'admin' || (normalizedRole === 'staff' && user?.staff_type === 'front_desk');
    if (!canRequest) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, [normalizedRole, user?.staff_type]);

  const mainBackground = activePage === 'appointment'
    ? 'radial-gradient(circle at 85% 12%, rgba(79, 198, 201, 0.10) 0%, rgba(79, 198, 201, 0.05) 34%, #fef9f4 62%)'
    : 'radial-gradient(circle at 85% 12%, rgba(79, 198, 201, 0.18) 0%, rgba(79, 198, 201, 0.10) 36%, #fef9f4 60%)';

  return (
    <main
      className="min-h-screen flex flex-col font-poppins text-brand-dark relative"
      style={{
        background: mainBackground,
      }}
    >
      {/* -- Mobile layout (below lg) -- */}
      {!isDesktop && (
        <div className="flex-1">
          <AdminDashboard_MobileView
            user={user}
            displayName={displayName}
            greeting={greeting}
            todayLabel={todayLabel}
            statCards={statCards}
            activePage={activePage}
            onNavigate={handleHeaderNavigate}
            onOpenWalkInSale={() => setWalkInSaleOpen(true)}
            dashboardLoading={appointmentsLoading && monthAppointments.length === 0}
            onOpenNewAppointment={openNewAppointmentChoice}
            onOpenBookingChoice={openCalendarBookingChoice}
            onLogout={logout}
            onStatClick={(key) => key === 'new_bookings' ? setNewBookingsOpen(true) : setSelectedStatKey(key)}
            onOpenAppointment={handleOpenAppointment}
            onOpenDayList={handleOpenDayList}
          />
          {activePage === 'dashboard' && normalizedRole === 'staff' && <StaffHomeAttendance user={user} />}

          {/* Non-dashboard pages on mobile */}
          <Suspense fallback={<AdminPageFallback page={activePage} />}>
            {activePage === 'appointment' && (
              <AppointmentPage
                focusAppointmentId={focusAppointmentId}
                focusEdit={focusAppointmentEdit}
                onOpenBookingChoice={openCalendarBookingChoice}
                onFocusHandled={() => {
                  setFocusAppointmentId(null);
                  setFocusAppointmentEdit(false);
                }}
              />
            )}
            {activePage === 'staff'     && <StaffPage />}
            {activePage === 'customer'  && (
              <CustomerPage
                focusOwnerId={focusOwnerId}
                onFocusHandled={() => setFocusOwnerId(null)}
              />
            )}
            {activePage === 'pets'      && (
              <PetsPage
                focusPet={focusPet}
                onFocusHandled={() => setFocusPet(null)}
              />
            )}
            {suppliesEnabled && activePage === 'inventory' && <InventoryPage />}
            {activePage === 'service'   && <ServicePage />}
            {activePage === 'reports'   && <ReportsPage />}
            {activePage === 'backup'    && <SettingsBackupPage />}
            {activePage === 'settings'  && <SettingsPage onBack={() => handleHeaderNavigate('dashboard')} />}
            {activePage === 'audit-logs' && <AuditLogsPage />}
          </Suspense>
        </div>
      )}

      {/* -- Desktop layout (lg and above) -- */}
      {isDesktop && (
        <div className="flex-1">
          <AdminHeader
            activePage={activePage}
            onNavigate={handleHeaderNavigate}
            onOpenWalkInSale={() => setWalkInSaleOpen(true)}
          />
          {activePage === 'dashboard' && normalizedRole === 'staff' && <StaffHomeAttendance user={user} />}

          <div className="mx-auto w-full max-w-[1800px] px-3 pt-4 sm:px-4 md:px-6 lg:px-8">

          <Suspense fallback={<AdminPageFallback page={activePage} />}>
            {activePage === 'appointment' && (
              <AppointmentPage
                focusAppointmentId={focusAppointmentId}
                focusEdit={focusAppointmentEdit}
                onOpenBookingChoice={openCalendarBookingChoice}
                onFocusHandled={() => {
                  setFocusAppointmentId(null);
                  setFocusAppointmentEdit(false);
                }}
              />
            )}
            {activePage === 'staff'     && <StaffPage />}
            {activePage === 'customer'  && (
              <CustomerPage
                focusOwnerId={focusOwnerId}
                onFocusHandled={() => setFocusOwnerId(null)}
              />
            )}
            {activePage === 'pets'      && (
              <PetsPage
                focusPet={focusPet}
                onFocusHandled={() => setFocusPet(null)}
              />
            )}
            {suppliesEnabled && activePage === 'inventory' && <InventoryPage />}
            {activePage === 'service'   && <ServicePage />}
            {activePage === 'reports'   && <ReportsPage />}
            {activePage === 'backup'    && <SettingsBackupPage />}
            {activePage === 'settings'  && <SettingsPage />}
            {activePage === 'audit-logs' && <AuditLogsPage />}
          </Suspense>

          {activePage !== 'dashboard' && activePage !== 'appointment' && activePage !== 'staff' && activePage !== 'customer' && activePage !== 'pets' && activePage !== 'inventory' && activePage !== 'service' && activePage !== 'reports' && activePage !== 'settings' && activePage !== 'backup' && activePage !== 'audit-logs' && (
            <section className="px-4 py-8 md:px-6 lg:px-8">
              <div className="rounded-xl border border-brand-teal/20 bg-white p-6 shadow-[0_6px_12px_rgba(23,53,81,0.08)]">
                <h2 className="text-xl font-bold text-brand-dark">
                  {activePage.charAt(0).toUpperCase() + activePage.slice(1)}
                </h2>
                <p className="mt-2 text-sm font-medium text-brand-dark-soft">
                  This page is connected in the header and ready for build-out.
                </p>
              </div>
            </section>
          )}

          {activePage === 'dashboard' && (
            <div className="w-full pb-8 pt-4">
              <section className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="min-w-0">
                  <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <h1 className="font-poppins text-[35px] font-semibold leading-none text-brand-dark">
                        {greeting}, {displayName}!
                      </h1>
                      <div className="mt-2 flex items-center gap-3">
                        <p className="text-xs font-semibold text-brand-dark-soft">Here&apos;s an overview of the station&apos;s status today.</p>
                      </div>
                    </div>
                    <div className="mt-2 flex shrink-0 flex-wrap justify-end gap-2 self-end sm:mt-3 sm:self-auto">
                      {appointmentsLoading && monthAppointments.length === 0 ? (
                        <div role="status" aria-label="Loading new appointment">
                          <SkeletonBlock className="h-11 w-52 rounded-full" />
                        </div>
                      ) : (
                      <ScheduleAppointmentButton
                        label="New Appointment"
                        showIcon
                        className="rounded-full px-6 py-3 text-sm"
                        onClick={openNewAppointmentChoice}
                      />
                      )}
                    </div>
                  </div>

                  <div className="mb-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                    {appointmentsLoading && monthAppointments.length === 0 ? (
                      <StatGridSkeleton />
                    ) : statCards.map((stat) => (
                      <StatBox
                        key={stat.key}
                        title={stat.title}
                        value={stat.value}
                        note={stat.note}
                        onClick={() => stat.key === 'new_bookings' ? setNewBookingsOpen(true) : setSelectedStatKey(stat.key)}
                      />
                    ))}
                  </div>

                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.9fr)]">
                    <InProgressPanel onOpenAppointment={handleOpenAppointment} />
                    <AppointmentCalendar onOpenDayList={handleOpenDayList} onOpenBookingChoice={openCalendarBookingChoice} />
                  </div>
                </div>

                <NeedsAttentionPanel
                  onOpenAppointment={handleOpenAppointment}
                  onOpenNewBookings={() => setNewBookingsOpen(true)}
                />
              </section>
            </div>
          )}

          </div>
        </div>
      )}

      {/* -- Shared modals (work for both mobile and desktop) -- */}
      {activePage === 'dashboard' && (
        <>
          {isDayListOpen && (
            <Suspense fallback={null}>
              <ViewAllAppointmentToday
                isOpen={isDayListOpen}
                dateIso={selectedDayIso}
                appointments={selectedDayAppointments}
                onClose={() => setIsDayListOpen(false)}
                onOpenDetails={(appointment) => {
                  setIsDayListOpen(false);
                  handleOpenAppointment(appointment);
                }}
                onBookAppointment={selectedDayIso >= todayIso ? () => {
                  setIsDayListOpen(false);
                  openCalendarBookingChoice(selectedDayIso);
                } : undefined}
                onStatusChange={handleStatusChange}
                isSaving={isStatusSaving}
              />
            </Suspense>
          )}
          {selectedAppointment && (
            <Suspense fallback={null}>
              <AppointmentDetailsModal
                appointment={selectedAppointment}
                onClose={() => { setSelectedAppointment(null); setAutoCompleteAppointmentId(null); }}
                onStatusChange={handleStatusChange}
                onEdit={(appointment) => {
                  setSelectedAppointment(null);
                  handleHeaderNavigate('appointment', {
                    appointmentId: appointment?.id,
                    editAppointment: true,
                  });
                }}
                isSaving={isStatusSaving}
                autoOpenComplete={Boolean(selectedAppointment && selectedAppointment.id === autoCompleteAppointmentId)}
              />
            </Suspense>
          )}
          <NewBookingsModal
            isOpen={newBookingsOpen}
            appointments={pendingAppointments}
            confirmingId={confirmingId}
            onClose={() => setNewBookingsOpen(false)}
            onViewDetails={(appointment) => {
              setNewBookingsOpen(false);
              handleOpenAppointment(appointment);
            }}
            onConfirm={(appointment) => {
              if (!appointment?.id || confirmingId) return;
              setConfirmBookingTarget(appointment);
            }}
            onReject={(appointment) => {
              if (!appointment?.id || confirmingId) return;
              setNewBookingsOpen(false);
              setCancelTarget(appointment);
            }}
          />
          <ConfirmBookingStatusModal
            appointment={confirmBookingTarget}
            loading={Boolean(confirmingId)}
            onClose={() => {
              if (!confirmingId) setConfirmBookingTarget(null);
            }}
            onConfirm={async () => {
              const appointment = confirmBookingTarget;
              if (!appointment?.id || confirmingId) return;
              setConfirmingId(appointment.id);
              try {
                const response = await apiFetch(`/api/appointments/${appointment.id}/status`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ status: 'approved' }),
                });
                const data = await response.json().catch(() => ({}));
                if (!response.ok) {
                  const fallbackByStatus = {
                    401: 'Your session has expired. Please sign in again.',
                    403: 'You do not have permission to approve this appointment.',
                    404: 'This appointment could not be found. Refresh the list and try again.',
                    409: 'This time slot is already full. Please select another date or time.',
                    422: 'This appointment cannot be approved. Check the booking details and try again.',
                  };
                  const message = response.status >= 500
                    ? 'The appointment could not be approved because of a server error. Please try again later.'
                    : data?.message || fallbackByStatus[response.status] || 'The appointment could not be approved. Please try again.';
                  throw new Error(message);
                }
                await loadMonthAppointments({ force: true });
                await loadHotelOverview();
                setConfirmBookingTarget(null);
                notifySuccess(`Booking approved. Confirmation email sent to owner.`);
              } catch (error) {
                notifyError(error.message || 'Failed to approve booking.');
              } finally {
                setConfirmingId(null);
              }
            }}
          />
          {cancelTarget && (
            <Suspense fallback={null}>
              <CancellationReasonModal
                isOpen={Boolean(cancelTarget)}
                loading={isStatusSaving}
                subject={cancelTarget?.pet || cancelTarget?.name || ''}
                title={cancelTarget?.status === 'pending' ? 'Reject Appointment' : 'Cancel Appointment'}
                description={cancelTarget?.status === 'pending'
                  ? 'A rejection reason is required before rejecting this appointment.'
                  : 'Select a cancellation reason before proceeding.'}
                reasonOptions={CANCELLATION_REASON_OPTIONS}
                onClose={() => setCancelTarget(null)}
                onConfirm={handleConfirmCancellation}
              />
            </Suspense>
          )}
          <StatBox
            variant="modal"
            isOpen={Boolean(selectedStat)}
            item={selectedStat}
            appointments={statModalAppointments}
            hotelOverview={hotelOverview}
            onClose={() => setSelectedStatKey(null)}
          />
        </>
      )}

      <ServiceCategoryPickerModal
        isOpen={isBookCategoryPickerOpen}
        onClose={closeBookCategoryPicker}
        onSelect={selectBookAppointmentCategory}
      />

      <BookingTypePickerModal
        isOpen={Boolean(calendarBookingChoiceDate)}
        dateLabel={calendarBookingChoiceDate || ''}
        onClose={() => {
          setCalendarBookingChoiceDate(null);
          setNewAppointmentChoiceOpen(false);
        }}
        onSelect={selectCalendarBookingType}
        shopHours={schedule?.shop_hours || {}}
        shopHoursLoading={shopHoursLoading}
        shopHoursError={shopHoursError}
      />

      <ServiceCategoryPickerModal
        isOpen={walkInCategoryPickerOpen}
        onClose={() => setWalkInCategoryPickerOpen(false)}
        onSelect={selectWalkInCategory}
      />

      {isBookAppointmentOpen && (
        <BookAppointment
          isOpen={isBookAppointmentOpen}
          onClose={closeBookAppointment}
          initialCategory={appointmentBookingCategory}
        />
      )}

      {walkInBookingOpen && (
        <BookAppointment
          isOpen={walkInBookingOpen}
          onClose={() => {
            setWalkInBookingOpen(false);
            setWalkInBookingCategory(null);
            setWalkInBookingDate(null);
          }}
          initialCategory={walkInBookingCategory}
          initialDate={walkInBookingDate}
          walkInMode
        />
      )}

      {suppliesEnabled && walkInSaleOpen && (
        <Suspense fallback={null}>
          <WalkInSaleModal
            onClose={() => setWalkInSaleOpen(false)}
            onSaved={() => setWalkInSaleOpen(false)}
            overlayClassName="z-[160]"
          />
        </Suspense>
      )}
      <AppointmentToastStack
        toasts={toasts}
        onClose={removeToast}
        onOpenNewBookings={() => setNewBookingsOpen(true)}
      />
      <DashboardFooter />
    </main>
  );
}


/*  */
