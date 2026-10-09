import { CalendarDays, ChevronLeft, ChevronRight, List } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { AdminSkeleton, AdminLoadState } from '../../../components/admin/AdminLoading';
import { useAppointmentStore } from '../../../stores/appointmentStore';
import { notify, notifyError, notifySuccess } from '../../../utils/notify';
import CancellationReasonModal from '../../../components/modals/CancellationReasonModal';
import AppointmentDetailsModal from './AppointmentDetailsModal';
import AppointmentEditModal from './AppointmentEditModal';
import AppointmentStatBox from './AppointmentStatBox';
import ViewAllAppointmentToday from './ViewAllAppointmentToday';
import AppointmentCalendarGrid from './components/AppointmentCalendarGrid';
import AppointmentFilterSelect from './components/AppointmentFilterSelect';
import AppointmentList from './components/AppointmentList';
import AppointmentPage_MobileView from './mobile/AppointmentPage_MobileView';
import { CANCELLATION_REASON_OPTIONS } from './appointmentConstants';
import NewBookingsModal from './NewBookingsModal';
import CompletedCancelledAppointmentsModal from '../../../components/modals/CompletedCancelledAppointmentsModal';

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'pending', label: 'Pending Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];
const SERVICE_FILTER_OPTIONS = [
  { value: 'all', label: 'All Services' },
  { value: 'daycare', label: 'Daycare' },
  { value: 'grooming', label: 'Grooming' },
  { value: 'hotelsuite', label: 'Hotel Suite' },
];
const SORT_OPTIONS = [
  { value: 'date', label: 'Sort: Date' },
  { value: 'id', label: 'Sort: ID' },
  { value: 'status', label: 'Sort: Status' },
];

const buildCalendarDays = (monthDate) => {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(new Date(year, month, d));
  return cells;
};

const toIsoDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDaysIso = (dateIso, days) => {
  const date = new Date(`${dateIso}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toIsoDate(date);
};

const getHotelCalendarLabel = (item, dateIso) => {
  const checkIn = item?.dateIso;
  const nights = Math.max(1, Number(item?._raw?.hotel_nights || 0));
  const checkOut = checkIn ? addDaysIso(checkIn, nights) : '';
  if (dateIso === checkIn) return 'Check-in';
  if (dateIso === checkOut) return 'Check-out';
  return 'Staying';
};

const getAppointmentMinutes = (item) => {
  const value = String(item?._raw?.start_time || item?.startTime || item?.time || '');
  const match = value.match(/(\d{1,2}):(\d{2})/);
  if (!match) return 24 * 60;
  return Number(match[1]) * 60 + Number(match[2]);
};

const compareCalendarDayAppointments = (a, b) => {
  const aLabel = String(a?.calendarLabel || a?.time || '').toLowerCase();
  const bLabel = String(b?.calendarLabel || b?.time || '').toLowerCase();
  const aRank = aLabel === 'staying' ? 0 : 1;
  const bRank = bLabel === 'staying' ? 0 : 1;
  if (aRank !== bRank) return aRank - bRank;

  const aMinutes = getAppointmentMinutes(a);
  const bMinutes = getAppointmentMinutes(b);
  if (aMinutes !== bMinutes) return aMinutes - bMinutes;

  return String(a?.pet || '').localeCompare(String(b?.pet || ''));
};

const expandCalendarAppointments = (appointments, monthDate) => {
  const monthStart = toIsoDate(new Date(monthDate.getFullYear(), monthDate.getMonth(), 1));
  const monthEnd = toIsoDate(new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0));
  const expanded = {};

  appointments.forEach((item) => {
    const raw = item?._raw || {};
    const isHotel = item?.serviceType === 'hotelsuite' || String(raw?.service?.category || '').toLowerCase() === 'hotel' || Number(raw?.hotel_nights || 0) > 0;
    const checkIn = item?.dateIso;
    if (!checkIn) return;

    if (!isHotel) {
      if (!expanded[checkIn]) expanded[checkIn] = [];
      expanded[checkIn].push(item);
      return;
    }

    const nights = Math.max(1, Number(raw?.hotel_nights || 1));
    for (let offset = 0; offset <= nights; offset += 1) {
      const dateIso = addDaysIso(checkIn, offset);
      if (dateIso < monthStart || dateIso > monthEnd) continue;
      if (!expanded[dateIso]) expanded[dateIso] = [];
      const label = getHotelCalendarLabel(item, dateIso);
      expanded[dateIso].push({
        ...item,
        dateIso,
        time: label,
        calendarLabel: label,
        calendarDateIso: dateIso,
      });
    }
  });

  Object.keys(expanded).forEach((dateIso) => {
    expanded[dateIso].sort(compareCalendarDayAppointments);
  });

  return expanded;
};

export default function AppointmentPage({ focusAppointmentId = null, focusEdit = false, onFocusHandled, onOpenBookingChoice }) {
  const [isDayListOpen, setIsDayListOpen] = useState(false);
  const [selectedDayIso, setSelectedDayIso] = useState('');
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [editingAppointment, setEditingAppointment] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [confirmingBookingId, setConfirmingBookingId] = useState(null);
  const [currentTimeMs, setCurrentTimeMs] = useState(() => Date.now());
  const [endOfDayReminderSent, setEndOfDayReminderSent] = useState(false);
  const view = useAppointmentStore((state) => state.view);
  const search = useAppointmentStore((state) => state.search);
  const statusFilter = useAppointmentStore((state) => state.statusFilter);
  const serviceFilter = useAppointmentStore((state) => state.serviceFilter);
  const sortBy = useAppointmentStore((state) => state.sortBy);
  const currentMonth = useAppointmentStore((state) => state.currentMonth);
  const monthAppointments = useAppointmentStore((state) => state.monthAppointments);
  const quickStatusAppointmentId = useAppointmentStore((state) => state.quickStatusAppointmentId);
  const activeStatsType = useAppointmentStore((state) => state.activeStatsType);
  const isLoading = useAppointmentStore((state) => state.isLoading);
  const hasLoaded = useAppointmentStore((state) => state.hasLoaded);
  const isUpdatingStatus = useAppointmentStore((state) => state.isUpdatingStatus);
  const error = useAppointmentStore((state) => state.error);
  const initialLoading = !hasLoaded && !error;

  const setView = useAppointmentStore((state) => state.setView);
  const setSearch = useAppointmentStore((state) => state.setSearch);
  const setStatusFilter = useAppointmentStore((state) => state.setStatusFilter);
  const setServiceFilter = useAppointmentStore((state) => state.setServiceFilter);
  const setSortBy = useAppointmentStore((state) => state.setSortBy);
  const setSelectedDateIso = useAppointmentStore((state) => state.setSelectedDateIso);
  const setQuickStatusAppointmentId = useAppointmentStore((state) => state.setQuickStatusAppointmentId);
  const openStatsModal = useAppointmentStore((state) => state.openStatsModal);
  const closeStatsModal = useAppointmentStore((state) => state.closeStatsModal);
  const openBookAppointment = useAppointmentStore((state) => state.openBookAppointment);
  const goToPrevMonth = useAppointmentStore((state) => state.goToPrevMonth);
  const goToNextMonth = useAppointmentStore((state) => state.goToNextMonth);
  const loadSchedule = useAppointmentStore((state) => state.loadSchedule);
  const loadAppointments = useAppointmentStore((state) => state.loadAppointments);
  const updateAppointmentStatus = useAppointmentStore((state) => state.updateAppointmentStatus);

  const pushToast = (message, type = 'success') => {
    if (type === 'error') {
      notifyError(message || 'Something went wrong.');
      return;
    }
    notifySuccess(message || 'Success.');
  };

  const handleQuickStatusUpdate = async (appointmentId, status, extra = {}) => {
    return updateAppointmentStatus(appointmentId, status, extra);
  };

  const previousQuery = useRef(null);
  useEffect(() => {
    const query = { month: currentMonth.getTime(), search: search.trim() };
    const typing = previousQuery.current?.month === query.month && previousQuery.current.search !== query.search;
    previousQuery.current = query;
    if (!typing) {
      loadAppointments({ search: query.search });
      return;
    }
    const timer = setTimeout(() => loadAppointments({ search: query.search }), 250);
    return () => clearTimeout(timer);
  }, [currentMonth, search, loadAppointments]);

  useEffect(() => {
    const refreshAfterMutation = () => loadAppointments({ force: true, search: search.trim() });
    window.addEventListener('admin-data-changed', refreshAfterMutation);
    return () => window.removeEventListener('admin-data-changed', refreshAfterMutation);
  }, [loadAppointments, search]);

  useEffect(() => {
    // Poll every 5 minutes without force so the store's cache is respected.
    // Force-refreshes happen on explicit user actions (approve/reject/reschedule).
    const interval = setInterval(() => {
      loadAppointments({ silent: true });
    }, 300_000);
    return () => clearInterval(interval);
  }, [loadAppointments]);

  useEffect(() => {
    const interval = setInterval(() => setCurrentTimeMs(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    loadSchedule();
  }, [loadSchedule]);

  // Status and service filters are applied client-side (cheap field comparisons).
  // Text search is handled server-side via the debounced ?search= API parameter above.
  const filteredAppointments = useMemo(() => {
    return monthAppointments.filter((item) => {
      const itemStatus = String(item.status || '').toLowerCase().replace(/-/g, '_');
      if (statusFilter !== 'all' && !(statusFilter === 'cancelled' ? itemStatus === 'cancelled' || itemStatus === 'no_show' : itemStatus.includes(statusFilter))) return false;
      if (serviceFilter !== 'all' && item.serviceType !== serviceFilter) return false;
      return true;
    });
  }, [monthAppointments, statusFilter, serviceFilter]);


  const appointmentsByDate = useMemo(
    () => expandCalendarAppointments(filteredAppointments, currentMonth),
    [filteredAppointments, currentMonth],
  );

  const listAppointments = useMemo(() => {
    const statusOrder = { pending: 0, approved: 1, in_progress: 2, completed: 3, cancelled: 4, no_show: 4 };
    const rows = [...filteredAppointments];
    rows.sort((a, b) => {
      if (sortBy === 'id') {
        const na = parseInt(String(a.displayId || '').replace(/\D/g, '') || '0', 10);
        const nb = parseInt(String(b.displayId || '').replace(/\D/g, '') || '0', 10);
        return na - nb;
      }
      if (sortBy === 'status') {
        const sa = statusOrder[String(a.status || '').toLowerCase().replace(/-/g, '_')] ?? 99;
        const sb = statusOrder[String(b.status || '').toLowerCase().replace(/-/g, '_')] ?? 99;
        if (sa !== sb) return sa - sb;
        // secondary: date then time
        if (a.dateIso !== b.dateIso) return (a.dateIso || '') < (b.dateIso || '') ? -1 : 1;
        return String(a._raw?.start_time || '').localeCompare(String(b._raw?.start_time || ''));
      }
      // default: sort by date
      const da = a.dateIso || '';
      const db = b.dateIso || '';
      if (da !== db) return da < db ? -1 : 1;
      return String(a._raw?.start_time || '').localeCompare(String(b._raw?.start_time || ''));
    });
    return rows;
  }, [filteredAppointments, sortBy]);

  const stats = useMemo(() => {
    const total = monthAppointments.length;
    const pending = monthAppointments.filter((item) => String(item.status).toLowerCase() === 'pending').length;
    const completed = monthAppointments.filter((item) => String(item.status).toLowerCase().includes('complete')).length;
    const cancelled = monthAppointments.filter((item) => {
      const itemStatus = String(item.status || '').toLowerCase().replace(/-/g, '_');
      return itemStatus.includes('cancel') || itemStatus === 'no_show';
    }).length;
    return { total, pending, completed, cancelled };
  }, [monthAppointments]);

  const selectedStat = useMemo(() => {
    if (!activeStatsType) return null;
    const labelByKey = { total: 'Total', pending: 'Pending Bookings', completed: 'Completed', cancelled: 'Cancelled' };
    return { key: activeStatsType, title: labelByKey[activeStatsType] || 'Stats' };
  }, [activeStatsType]);

  const selectedDayAppointments = useMemo(() => {
    if (!selectedDayIso) return [];
    return (appointmentsByDate[selectedDayIso] || [])
      .sort(compareCalendarDayAppointments);
  }, [appointmentsByDate, selectedDayIso]);

  const pendingBookings = useMemo(
    () => monthAppointments.filter((item) => String(item.status || '').toLowerCase() === 'pending'),
    [monthAppointments],
  );
  const selectedStatType = selectedStat?.key || '';
  const selectedStatAppointments = useMemo(() => {
    if (!selectedStatType || selectedStatType === 'total') return monthAppointments;
    if (selectedStatType === 'completed') {
      return monthAppointments.filter((item) => String(item.status || '').toLowerCase().includes('complete'));
    }
    if (selectedStatType === 'cancelled') {
      return monthAppointments.filter((item) => {
        const itemStatus = String(item.status || '').toLowerCase().replace(/-/g, '_');
        return itemStatus.includes('cancel') || itemStatus === 'no_show';
      });
    }
    return [];
  }, [monthAppointments, selectedStatType]);

  const monthLabel = useMemo(
    () => currentMonth.toLocaleDateString('en-US', { timeZone: 'Asia/Manila',  month: 'long', year: 'numeric' }),
    [currentMonth],
  );
  const calendarDays = useMemo(() => buildCalendarDays(currentMonth), [currentMonth]);
  const todayIso = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, []);

  const appointmentsNeedingStatusUpdate = useMemo(
    () => monthAppointments.filter((item) => {
      const status = String(item.status || '').toLowerCase().replace(/-/g, '_');
      return item.dateIso && item.dateIso < todayIso && ['approved', 'in_progress'].includes(status);
    }),
    [monthAppointments, todayIso],
  );

  const todayAppointmentsNeedingStatusUpdate = useMemo(
    () => monthAppointments.filter((item) => {
      const status = String(item.status || '').toLowerCase().replace(/-/g, '_');
      return item.dateIso === todayIso && ['approved', 'in_progress'].includes(status);
    }),
    [monthAppointments, todayIso],
  );

  const isEndOfDayReminderTime = new Date(currentTimeMs).getHours() >= 17;

  const openBookingForDate = (dateIso) => {
    if (dateIso && dateIso < todayIso) return;
    setSelectedDateIso(dateIso);
    if (onOpenBookingChoice) {
      onOpenBookingChoice(dateIso);
    } else {
      openBookAppointment(dateIso);
    }
  };

  useEffect(() => {
    if (!isEndOfDayReminderTime || endOfDayReminderSent || todayAppointmentsNeedingStatusUpdate.length === 0) return;
    notify(
      `${todayAppointmentsNeedingStatusUpdate.length} appointment${todayAppointmentsNeedingStatusUpdate.length === 1 ? '' : 's'} still need a status update before closing. Update them in the appointment list or edit the appointment.`,
      'warning',
      7000,
    );
    setEndOfDayReminderSent(true);
  }, [endOfDayReminderSent, isEndOfDayReminderTime, todayAppointmentsNeedingStatusUpdate.length]);

  useEffect(() => {
    if (!focusAppointmentId || monthAppointments.length === 0) return;
    const target = monthAppointments.find((item) => String(item.id) === String(focusAppointmentId));
    if (target) {
      if (focusEdit) {
        setEditingAppointment(target);
        setSelectedAppointment(null);
      } else {
        setSelectedAppointment(target);
      }
      setSelectedDateIso(target.dateIso || todayIso);
      onFocusHandled?.();
    }
  }, [focusAppointmentId, focusEdit, monthAppointments, onFocusHandled, setSelectedDateIso, todayIso]);

  return (
    <>
      <AdminLoadState loading={isLoading && hasLoaded} error={error} onRetry={() => loadAppointments({ force: true, search: search.trim() })} />

      {/* Mobile layout */}
      <div className="lg:hidden">
        <AppointmentPage_MobileView
          isLoading={initialLoading}
          hasLoaded={hasLoaded}
          error={error}
          view={view}
          onSetView={setView}
          search={search}
          onSearch={setSearch}
          statusFilter={statusFilter}
          onStatusFilter={setStatusFilter}
          serviceFilter={serviceFilter}
          onServiceFilter={setServiceFilter}
          sortBy={sortBy}
          onSortBy={setSortBy}
          monthLabel={monthLabel}
          calendarDays={calendarDays}
          appointmentsByDate={appointmentsByDate}
          todayIso={todayIso}
          onPrevMonth={goToPrevMonth}
          onNextMonth={goToNextMonth}
          onDayClick={(dateIso) => {
            setSelectedDateIso(dateIso);
            setSelectedDayIso(dateIso);
            setIsDayListOpen(true);
          }}
          onAppointmentClick={(appointment) => setSelectedAppointment(appointment)}
          onEmptyDayClick={openBookingForDate}
          listAppointments={listAppointments}
          quickStatusAppointmentId={quickStatusAppointmentId}
          onSetQuickStatus={setQuickStatusAppointmentId}
          onUpdateStatus={handleQuickStatusUpdate}
          isUpdatingStatus={isUpdatingStatus}
          onOpenDetails={(appointment) => setSelectedAppointment(appointment)}
          onRequestCancel={(appointment) => {
            setQuickStatusAppointmentId(null);
            setCancelTarget(appointment);
          }}
          onMarkComplete={(appointment) => {
            if (!appointment?.id) return;
            setQuickStatusAppointmentId(appointment.id);
            handleQuickStatusUpdate(appointment.id, 'completed');
          }}
          onEdit={(appointment) => {
            setQuickStatusAppointmentId(null);
            setEditingAppointment(appointment);
          }}
          stats={stats}
          onOpenStats={openStatsModal}
          onOpenBooking={() => openBookAppointment()}
          pendingBookings={pendingBookings}
        />
      </div>

      {/* Desktop layout */}
      <div className="hidden lg:block">
        <section className="space-y-5 py-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-extrabold text-brand-teal-dark">
                Appointment <span className="text-brand-dark">Scheduling</span>
              </h1>
              <p className="text-sm text-brand-dark-soft">Manage appointments, schedules, and service queue.</p>
            </div>
          </div>

          <div className="hidden">
            <AppointmentStatBox loading={initialLoading}
              compact
              title="TOTAL APPOINTMENTS"
              value={stats.total}
              note="Appointments this month"
              onClick={() => openStatsModal('total')}
            />
            <AppointmentStatBox loading={initialLoading}
              compact
              title="COMPLETED APPOINTMENTS"
              value={stats.completed}
              note="Finished appointments"
              onClick={() => openStatsModal('completed')}
            />
            <AppointmentStatBox loading={initialLoading}
              compact
              title="CANCELLED APPOINTMENTS"
              value={stats.cancelled}
              note="Cancelled appointments"
              onClick={() => openStatsModal('cancelled')}
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-[1fr_230px]">
            <div className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <div className="relative w-full sm:flex-1">
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search pet, owner, or ID..."
                    className="w-full rounded-xl border border-brand-teal/30 bg-white py-2.5 pl-4 pr-4 text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
                  />
                </div>
                <div className="flex shrink-0 gap-2">
                  <AppointmentFilterSelect value={statusFilter} onChange={setStatusFilter} options={STATUS_FILTER_OPTIONS} widthClass="min-w-[118px]" />
                  <AppointmentFilterSelect value={serviceFilter} onChange={setServiceFilter} options={SERVICE_FILTER_OPTIONS} widthClass="min-w-[122px]" />
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-brand-teal/20 bg-white shadow-[0_6px_12px_rgba(23,53,81,0.08)]">
                <div className="flex items-center justify-between gap-2 border-b border-brand-teal/20 px-4 py-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <button type="button" onClick={goToPrevMonth} className="shrink-0 rounded border border-brand-teal/30 p-0.5 hover:bg-brand-teal-light/30">
                      <ChevronLeft className="h-4 w-4 text-brand-dark" />
                    </button>
                    <span className="truncate text-sm font-extrabold text-brand-dark sm:text-base">{monthLabel}</span>
                    <button type="button" onClick={goToNextMonth} className="shrink-0 rounded border border-brand-teal/30 p-0.5 hover:bg-brand-teal-light/30">
                      <ChevronRight className="h-4 w-4 text-brand-dark" />
                    </button>
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    <div className="hidden items-center gap-3 rounded-full border border-brand-teal/20 bg-brand-surface px-3 py-1.5 text-[10px] font-bold xl:flex">
                      <span className="inline-flex items-center gap-1.5 text-brand-daycare"><span className="h-2.5 w-2.5 rounded-full bg-brand-daycare-soft ring-1 ring-brand-daycare/30" />Daycare</span>
                      <span className="inline-flex items-center gap-1.5 text-brand-grooming"><span className="h-2.5 w-2.5 rounded-full bg-brand-grooming-soft ring-1 ring-brand-grooming/30" />Grooming</span>
                      <span className="inline-flex items-center gap-1.5 text-brand-hotel"><span className="h-2.5 w-2.5 rounded-full bg-brand-hotel-soft ring-1 ring-brand-hotel/30" />Hotel</span>
                    </div>
                    {view === 'list' && (
                      <AppointmentFilterSelect
                        value={sortBy}
                        onChange={setSortBy}
                        options={SORT_OPTIONS}
                        widthClass="min-w-[110px]"
                        compact
                      />
                    )}
                    <div className="flex overflow-hidden rounded-lg border border-brand-teal/30">
                      <button
                        type="button"
                        onClick={() => setView('calendar')}
                        className={`px-3 py-1.5 ${view === 'calendar' ? 'bg-brand-teal text-white' : 'bg-white text-brand-dark-soft'}`}
                        title="Calendar View"
                      >
                        <CalendarDays className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setView('list')}
                        className={`border-l border-brand-teal/30 px-3 py-1.5 ${view === 'list' ? 'bg-brand-teal text-white' : 'bg-white text-brand-dark-soft'}`}
                        title="List View"
                      >
                        <List className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {initialLoading && <AdminSkeleton variant={view === 'calendar' ? 'calendar' : 'table'} label="Loading appointments" />}

                {!initialLoading && hasLoaded && view === 'calendar' && (
                  <AppointmentCalendarGrid
                    calendarDays={calendarDays}
                    appointmentsByDate={appointmentsByDate}
                    todayIso={todayIso}
                    onDayClick={(dateIso) => {
                      setSelectedDateIso(dateIso);
                      setSelectedDayIso(dateIso);
                      setIsDayListOpen(true);
                    }}
                    onAppointmentClick={(appointment) => {
                      setSelectedAppointment(appointment);
                    }}
                    onEmptyDayClick={openBookingForDate}
                  />
                )}

                {!initialLoading && hasLoaded && view === 'list' && (
                  <AppointmentList
                    listAppointments={listAppointments}
                    quickStatusAppointmentId={quickStatusAppointmentId}
                    setQuickStatusAppointmentId={setQuickStatusAppointmentId}
                    updateAppointmentStatus={handleQuickStatusUpdate}
                    isUpdatingStatus={isUpdatingStatus}
                    todayIso={todayIso}
                    onOpenDetails={(appointment) => {
                      setSelectedAppointment(appointment);
                    }}
                    onRequestCancel={(appointment) => {
                      setQuickStatusAppointmentId(null);
                      setCancelTarget(appointment);
                    }}
                    onMarkComplete={(appointment) => {
                      if (!appointment?.id) return;
                      setQuickStatusAppointmentId(appointment.id);
                      handleQuickStatusUpdate(appointment.id, 'completed');
                    }}
                    onEdit={(appointment) => {
                      setQuickStatusAppointmentId(null);
                      setEditingAppointment(appointment);
                    }}
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 self-start sm:grid-cols-4 xl:grid-cols-1">
              {isEndOfDayReminderTime && todayAppointmentsNeedingStatusUpdate.length > 0 && (
                <div className="col-span-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-amber-800 sm:col-span-4 xl:col-span-1">
                  <p className="text-xs font-extrabold">Status reminder</p>
                  <p className="mt-1 text-[11px] font-semibold leading-snug">
                    {todayAppointmentsNeedingStatusUpdate.length} appointment{todayAppointmentsNeedingStatusUpdate.length === 1 ? '' : 's'} today still need to be completed or cancelled.
                  </p>
                </div>
              )}

              {appointmentsNeedingStatusUpdate.length > 0 && (
                <div className="col-span-2 rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-amber-800 sm:col-span-4 xl:col-span-1">
                  <p className="text-xs font-extrabold">Past appointments need review</p>
                  <p className="mt-1 text-[11px] font-semibold leading-snug">
                    {appointmentsNeedingStatusUpdate.length} past appointment{appointmentsNeedingStatusUpdate.length === 1 ? '' : 's'} are still approved or in progress.
                  </p>
                </div>
              )}

              <AppointmentStatBox loading={initialLoading}
                compact
                title="PENDING BOOKINGS"
                value={stats.pending}
                note="Waiting for approval"
                onClick={() => openStatsModal('pending')}
              />
              <AppointmentStatBox loading={initialLoading}
                compact
                title="TOTAL APPOINTMENTS"
                value={stats.total}
                note="Appointments this month"
                onClick={() => openStatsModal('total')}
              />
              <AppointmentStatBox loading={initialLoading}
                compact
                title="COMPLETED APPOINTMENTS"
                value={stats.completed}
                note="Finished appointments"
                onClick={() => openStatsModal('completed')}
              />
              <AppointmentStatBox loading={initialLoading}
                compact
                title="CANCELLED APPOINTMENTS"
                value={stats.cancelled}
                note="Cancelled appointments"
                onClick={() => openStatsModal('cancelled')}
              />
            </div>
          </div>
        </section>
      </div>

      {/* Shared modals — outside both wrappers */}
      {selectedStat?.key === 'pending' ? (
        <NewBookingsModal
          isOpen
          appointments={pendingBookings}
          confirmingId={confirmingBookingId}
          onClose={closeStatsModal}
          onViewDetails={(appointment) => {
            closeStatsModal();
            setSelectedAppointment(appointment);
          }}
          onConfirm={async (appointment) => {
            if (!appointment?.id || confirmingBookingId) return;
            setConfirmingBookingId(appointment.id);
            const ok = await handleQuickStatusUpdate(appointment.id, 'approved');
            if (ok !== false) {
              await loadAppointments({ force: true, silent: true });
              notifySuccess('Booking approved. Confirmation email sent to owner.');
            }
            setConfirmingBookingId(null);
          }}
        />
      ) : (
        <CompletedCancelledAppointmentsModal
          isOpen={Boolean(selectedStat)}
          type={selectedStat?.key || 'total'}
          appointments={selectedStatAppointments}
          onClose={closeStatsModal}
        />
      )}

      <ViewAllAppointmentToday
        isOpen={isDayListOpen}
        dateIso={selectedDayIso}
        appointments={selectedDayAppointments}
        onClose={() => setIsDayListOpen(false)}
        onOpenDetails={(appointment) => {
          setIsDayListOpen(false);
          setSelectedAppointment(appointment);
        }}
        onBookAppointment={() => {
          setIsDayListOpen(false);
          if (onOpenBookingChoice) {
            onOpenBookingChoice(selectedDayIso);
          } else {
            openBookAppointment(selectedDayIso);
          }
        }}
        onStatusChange={async (appointment, status) => {
          if (!appointment?.id) return false;
          if (status === 'cancelled') {
            setQuickStatusAppointmentId(null);
            setCancelTarget(appointment);
            return false;
          }
          setQuickStatusAppointmentId(appointment.id);
          return handleQuickStatusUpdate(appointment.id, status);
        }}
        isSaving={isUpdatingStatus}
      />

      <AppointmentDetailsModal
        appointment={selectedAppointment}
        onClose={() => setSelectedAppointment(null)}
        onEdit={(appointment) => {
          setSelectedAppointment(null);
          setEditingAppointment(appointment);
        }}
        onStatusChange={async (appointment, status, extra = {}) => {
          if (!appointment?.id) return false;
          setQuickStatusAppointmentId(appointment.id);
          const ok = await handleQuickStatusUpdate(appointment.id, status, extra);
          if (ok !== false) setSelectedAppointment(null);
          return ok;
        }}
        onRequestCancel={(appointment) => setCancelTarget(appointment)}
        isSaving={isUpdatingStatus}
      />

      <AppointmentEditModal
        isOpen={Boolean(editingAppointment)}
        appointment={editingAppointment}
        onClose={() => setEditingAppointment(null)}
        onSaved={async () => {
          setEditingAppointment(null);
          await loadAppointments({ force: true, silent: true });
        }}
        onNotify={pushToast}
      />

      <CancellationReasonModal
        isOpen={Boolean(cancelTarget)}
        loading={isUpdatingStatus}
        title={cancelTarget?.status === 'pending' ? 'Reject Appointment' : 'Cancel Appointment'}
        description={cancelTarget?.status === 'pending'
          ? 'A rejection reason is required before rejecting this appointment.'
          : 'Select a cancellation reason before proceeding.'}
        subject={cancelTarget?.displayId || ''}
        reasonOptions={CANCELLATION_REASON_OPTIONS}
        onClose={() => setCancelTarget(null)}
        onConfirm={async (reason) => {
          if (!cancelTarget?.id) return;
          const ok = await handleQuickStatusUpdate(cancelTarget.id, 'cancelled', { cancellation_reason: reason });
          if (ok !== false) {
            setCancelTarget(null);
            setSelectedAppointment(null);
            setQuickStatusAppointmentId(null);
            void loadAppointments({ force: true, silent: true, search: search.trim() });
          }
        }}
      />
    </>
  );
}
