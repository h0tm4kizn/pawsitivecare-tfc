import { CalendarDays, ChevronLeft, ChevronRight, Eye, Search, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useEffect, useMemo, useState } from 'react';
import useBodyScrollLock from '../../../hooks/useBodyScrollLock';
import '../../../utils/recordFormatters';
import { useDashboardStore } from '../../../stores/dashboardStore';
import {
  buildWeekDays,
  calendarLegend,
  formatStatusLabel,
  getHotelStageForDate,
  getServiceCategory,
  isPastGraceWindow,
  groupAppointmentsByDate,
  needsAppointmentStatusUpdate,
  normalizeStatus,
  toLocalIsoDate,
} from './adminDashboardUtils';

export const SkeletonBlock = ({ className = '' }) => (
  <div className={`animate-pulse rounded-lg bg-brand-surface ${className}`} aria-hidden="true" />
);

const Panel = ({ children, className = '' }) => (
  <section className={`overflow-hidden rounded-xl bg-white shadow-[0_6px_12px_rgba(23,53,81,0.08)] ${className}`}>
    {children}
  </section>
);

const SearchPill = ({ value = '', onChange, className = '' }) => (
  <label className={`flex h-8 w-full items-center gap-2 rounded-full border border-brand-teal/40 bg-white/40 px-3 text-xs text-brand-dark-soft focus-within:ring-1 focus-within:ring-brand-teal sm:w-64 ${className}`}>
    <Search size={13} />
    <input
      type="search"
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
      placeholder="Search..."
      className="min-w-0 flex-1 bg-transparent text-xs text-brand-dark placeholder:text-brand-dark-soft focus:outline-none"
    />
  </label>
);

const AdminListSkeleton = ({ rows = 4 }) => (
  <div className="space-y-2" aria-hidden="true">
    {Array.from({ length: rows }, (_, item) => (
      <div key={item} className="rounded-xl border border-brand-teal/15 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <SkeletonBlock className="h-9 w-9 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <SkeletonBlock className="h-3 w-2/3" />
            <SkeletonBlock className="h-2.5 w-1/2" />
          </div>
          <SkeletonBlock className="h-6 w-16" />
        </div>
      </div>
    ))}
  </div>
);

const AdminTableSkeleton = ({ rows = 5 }) => (
  <tbody aria-hidden="true">
    {Array.from({ length: rows }, (_, item) => (
      <tr key={item}>
        <td className="py-4"><SkeletonBlock className="h-3 w-14" /></td>
        <td className="py-4"><SkeletonBlock className="h-3 w-24" /></td>
        <td className="py-4"><SkeletonBlock className="h-3 w-20" /></td>
        <td className="py-4"><SkeletonBlock className="h-3 w-28" /></td>
        <td className="py-4 text-right"><SkeletonBlock className="ml-auto h-7 w-7 rounded-full" /></td>
      </tr>
    ))}
  </tbody>
);

const getToastTone = (type) => {
  if (type === 'hotel') {
    return { icon: 'fa-hotel', badgeBg: 'bg-brand-hotel-soft', badgeText: 'text-brand-hotel' };
  }
  if (type === 'daycare') {
    return { icon: 'fa-bone', badgeBg: 'bg-brand-daycare-soft', badgeText: 'text-brand-daycare' };
  }
  return { icon: 'fa-scissors', badgeBg: 'bg-brand-grooming-soft', badgeText: 'text-brand-grooming' };
};

export function AppointmentToastStack({ toasts = [], onClose, onOpenNewBookings }) {
  if (!Array.isArray(toasts) || toasts.length === 0) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[260] flex w-[min(92vw,340px)] flex-col gap-2">
      {toasts.map((toast) => (
        <AppointmentToast key={toast.id} toast={toast} onClose={onClose} onOpenNewBookings={onOpenNewBookings} />
      ))}
    </div>
  );
}

function AppointmentToast({ toast, onClose, onOpenNewBookings }) {
  const tone = getToastTone(toast?.type);
  const appointmentCode = String(toast?.appointmentCode || '').trim();

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpenNewBookings}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpenNewBookings?.();
        }
      }}
      className={`pointer-events-auto w-full rounded-xl border border-brand-teal/20 bg-white/95 p-3 text-left shadow-[0_10px_24px_rgba(23,53,81,0.14)] transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_14px_28px_rgba(23,53,81,0.18)] ${
        toast?.visible && !toast?.leaving ? 'translate-x-0 opacity-100' : 'translate-x-4 opacity-0'
      }`}
      aria-label="Open new bookings"
    >
      <div className="flex items-start gap-2.5">
        <div className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${tone.badgeBg}`}>
          <i className={`fa-solid ${tone.icon} text-sm ${tone.badgeText}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-extrabold tracking-wide text-brand-dark">
            {appointmentCode || 'NEW APPOINTMENT'}
          </p>
          <p className="truncate text-xs font-semibold text-brand-dark-soft">{toast?.message}</p>
        </div>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onClose?.(toast?.id);
          }}
          className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-brand-dark-soft transition hover:bg-brand-surface hover:text-brand-dark"
          aria-label="Dismiss notification"
        >
          <i className="fa-solid fa-xmark text-[10px]" />
        </button>
      </div>
    </div>
  );
}

function SearchAndContentShell({ title, children, searchText, setSearchText, loading = false }) {
  return (
    <>
      <div className="mb-3 flex flex-col gap-2 border-b border-brand-dark/20 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-sm font-semibold text-brand-dark">{loading ? <SkeletonBlock className="h-5 w-36" /> : title}</h2>
        {loading ? <SkeletonBlock className="h-8 w-full rounded-full sm:w-64" /> : <SearchPill value={searchText} onChange={setSearchText} />}
      </div>
      {children}
    </>
  );
}

export function InProgressPanel({ onOpenAppointment }) {
  const monthAppointments = useDashboardStore((state) => state.monthAppointments);
  const appointmentsLoading = useDashboardStore((state) => state.appointmentsLoading);
  const [searchText, setSearchText] = useState('');
  const normalizedSearch = searchText.trim().toLowerCase();
  const todayIso = useMemo(() => toLocalIsoDate(new Date()), []);

  const todayRows = useMemo(() => {
    return monthAppointments
      .filter((appointment) => {
        if (appointment?.dateIso !== todayIso) return false;

        const hasService = Boolean(appointment?._raw?.service_id || appointment?.service);
        if (!hasService) return false;

        if (!normalizedSearch) return true;
        const searchable = [
          appointment?.displayId,
          appointment?.owner,
          appointment?.pet,
          appointment?.service,
          appointment?.status,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return searchable.includes(normalizedSearch);
      })
      .sort((a, b) => String(a?._raw?.start_time || '').localeCompare(String(b?._raw?.start_time || '')));
  }, [monthAppointments, normalizedSearch, todayIso]);

  const getTimelineTone = (appointment) => {
    const category = getServiceCategory(appointment);
    if (category === 'hotel') return {
      gradient: 'bg-gradient-to-r from-brand-hotel-soft/90 via-white to-white',
      service: 'text-brand-hotel',
      badge: 'bg-brand-hotel-soft text-brand-hotel',
    };
    if (category === 'daycare') return {
      gradient: 'bg-gradient-to-r from-brand-daycare-soft/90 via-white to-white',
      service: 'text-brand-daycare',
      badge: 'bg-brand-daycare-soft text-brand-daycare',
    };
    return {
      gradient: 'bg-gradient-to-r from-brand-grooming-soft/90 via-white to-white',
      service: 'text-brand-grooming',
      badge: 'bg-brand-grooming-soft text-brand-grooming',
    };
  };

  return (
    <Panel className="min-h-[330px] px-4 py-4 sm:px-5">
      <SearchAndContentShell title="TODAY TIMELINE" loading={appointmentsLoading && monthAppointments.length === 0} searchText={searchText} setSearchText={setSearchText}>
        <div className="space-y-2 lg:hidden">
          {appointmentsLoading && monthAppointments.length === 0 && <AdminListSkeleton rows={3} />}
          {todayRows.map((row) => {
            const tone = getTimelineTone(row);
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => onOpenAppointment?.(row)}
                className={`w-full rounded-xl border border-brand-teal/15 px-4 py-3 text-left shadow-[0_4px_10px_rgba(23,53,81,0.07)] transition hover:border-brand-teal/35 hover:shadow-[0_6px_14px_rgba(23,53,81,0.12)] ${tone.gradient}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="shrink-0 text-xs font-bold text-brand-dark">{row.time || '--:--'}</p>
                  <span className={`max-w-[126px] truncate rounded-full px-2 py-1 text-[9px] font-extrabold uppercase tracking-wide ${tone.badge}`}>
                    {formatStatusLabel(row.status)}
                  </span>
                </div>
                <div className="mt-2 min-w-0">
                  <p className="truncate text-sm font-extrabold text-brand-dark">{row.pet || '-'}</p>
                  <p className="mt-0.5 truncate text-[11px] font-semibold text-brand-dark-soft">{row.owner || '-'}</p>
                </div>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <p className={`min-w-0 truncate text-[11px] font-extrabold ${tone.service}`}>
                    {row.service || `Service #${row?._raw?.service_id || '-'}`}
                  </p>
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-brand-teal/40 text-brand-teal">
                    <Eye size={14} />
                  </span>
                </div>
              </button>
            );
          })}
          {!appointmentsLoading && todayRows.length === 0 && (
            <div className="rounded-xl border border-brand-dark-light bg-white px-4 py-7 text-center">
              <CalendarDays className="mx-auto mb-2 text-brand-dark/25" size={24} />
              <p className="text-xs font-semibold text-brand-dark-soft">No appointments scheduled for today.</p>
            </div>
          )}
        </div>

        <table className="hidden w-full table-fixed text-left lg:table">
          <thead>
            <tr className="border-b border-brand-dark-light text-[10px] font-semibold text-brand-dark">
              <th className="w-[18%] pb-2">{appointmentsLoading && monthAppointments.length === 0 ? <SkeletonBlock className="h-3 w-12 max-w-full" /> : 'Time'}</th>
              <th className="w-[22%] pb-2">{appointmentsLoading && monthAppointments.length === 0 ? <SkeletonBlock className="h-3 w-12 max-w-full" /> : 'Owner'}</th>
              <th className="w-[18%] pb-2">{appointmentsLoading && monthAppointments.length === 0 ? <SkeletonBlock className="h-3 w-12 max-w-full" /> : 'Pet'}</th>
              <th className="w-[28%] pb-2">{appointmentsLoading && monthAppointments.length === 0 ? <SkeletonBlock className="h-3 w-12 max-w-full" /> : 'Service'}</th>
              <th className="w-[14%] pb-2 text-right">{appointmentsLoading && monthAppointments.length === 0 ? <SkeletonBlock className="h-3 w-12 max-w-full" /> : 'Actions'}</th>
            </tr>
          </thead>
          {appointmentsLoading && monthAppointments.length === 0 ? (
            <AdminTableSkeleton rows={5} />
          ) : (
            <tbody>
              {todayRows.map((row) => (
                <tr key={row.id} className="text-[10px] font-medium text-brand-dark">
                  <td className="py-4 font-bold">{row.time || '--:--'}</td>
                  <td className="py-4">{row.owner || '-'}</td>
                  <td className="py-4">{row.pet || '-'}</td>
                  <td className="py-4">
                    <span>{row.service || `Service #${row?._raw?.service_id || '-'}`}</span>
                    <span className="mt-1 block text-[8px] font-semibold text-amber-700">{formatStatusLabel(row.status)}</span>
                  </td>
                  <td className="py-4 text-right">
                    <button
                      type="button"
                      onClick={() => onOpenAppointment?.(row)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-brand-teal/40 text-brand-teal transition hover:bg-brand-teal hover:text-white"
                      aria-label="View appointment details"
                    >
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              ))}
              {!appointmentsLoading && todayRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-7 text-center text-[10px] font-semibold text-brand-dark-soft">
                    No appointments scheduled for today.
                  </td>
                </tr>
              )}
            </tbody>
          )}
        </table>
      </SearchAndContentShell>
    </Panel>
  );
}

export function AppointmentCalendar({ onOpenDayList, onOpenBookingChoice }) {
  const calendarMonth = useDashboardStore((state) => state.calendarMonth);
  const selectedCalendarDate = useDashboardStore((state) => state.selectedCalendarDate);
  const monthAppointments = useDashboardStore((state) => state.monthAppointments);
  const appointmentsLoading = useDashboardStore((state) => state.appointmentsLoading);
  const appointmentsError = useDashboardStore((state) => state.appointmentsError);
  const setCalendarMonth = useDashboardStore((state) => state.setCalendarMonth);
  const setSelectedCalendarDate = useDashboardStore((state) => state.setSelectedCalendarDate);
  const goToCurrentMonth = useDashboardStore((state) => state.goToCurrentMonth);
  const loadMonthAppointments = useDashboardStore((state) => state.loadMonthAppointments);
  const selectedDate = useMemo(() => new Date(`${selectedCalendarDate}T00:00:00`), [selectedCalendarDate]);
  const weekDaysList = useMemo(() => buildWeekDays(selectedDate), [selectedDate]);
  const weekLabel = `${weekDaysList[0].date.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' })} - ${weekDaysList[6].date.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' })}`;
  const appointmentsByDate = useMemo(() => groupAppointmentsByDate(monthAppointments), [monthAppointments]);
  const weekAppointmentCount = weekDaysList.reduce((total, day) => total + (appointmentsByDate[day.iso]?.total || 0), 0);

  useEffect(() => {
    loadMonthAppointments();
  }, [calendarMonth, loadMonthAppointments]);

  const goToWeek = (days) => {
    const nextDate = new Date(selectedDate);
    nextDate.setDate(selectedDate.getDate() + days);
    setSelectedCalendarDate(toLocalIsoDate(nextDate));
    setCalendarMonth(nextDate);
  };

  const goToCurrentWeek = () => {
    const today = new Date();
    setSelectedCalendarDate(toLocalIsoDate(today));
    setCalendarMonth(today);
    goToCurrentMonth();
  };

  if (appointmentsLoading && monthAppointments.length === 0) {
    return (
      <Panel className="min-h-[430px] px-5 py-4">
        <div role="status" aria-label="Loading weekly calendar">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="space-y-2">
              <SkeletonBlock className="h-5 w-32" />
              <SkeletonBlock className="h-3 w-28" />
            </div>
            <SkeletonBlock className="h-7 w-16 rounded-full" />
          </div>
          <div className="divide-y divide-brand-teal/20 overflow-hidden rounded-lg border border-brand-teal/35">
            {Array.from({ length: 7 }, (_, index) => (
              <div key={index} className="flex min-h-[48px] items-center gap-3 px-3 py-2.5">
                <SkeletonBlock className="h-9 w-9 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <SkeletonBlock className="h-3 w-10" />
                  <SkeletonBlock className="h-2.5 w-12" />
                </div>
                <SkeletonBlock className="h-3 w-20" />
              </div>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between gap-2">
            <SkeletonBlock className="h-4 w-40" />
            <SkeletonBlock className="h-6 w-20 rounded-full" />
          </div>
          <SkeletonBlock className="mt-2 h-4 w-32" />
        </div>
      </Panel>
    );
  }

  return (
    <Panel className="min-h-[430px] px-5 py-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-brand-dark">Weekly Calendar</p>
          <p className="mt-0.5 text-[10px] font-semibold text-brand-dark-soft">{weekLabel}</p>
        </div>
        <div className="flex w-fit items-center gap-1 rounded-full border border-brand-teal/40 bg-white/40 px-2 py-1 text-[10px] font-semibold text-brand-teal-dark">
          <button type="button" onClick={() => goToWeek(-7)} className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-white/70" aria-label="Previous week">
            <ChevronLeft size={12} />
          </button>
          <button type="button" onClick={() => goToWeek(7)} className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-white/70" aria-label="Next week">
            <ChevronRight size={12} />
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-brand-teal/35 bg-white">
        <div className="divide-y divide-brand-teal/20">
          {weekDaysList.map((day) => {
            const counts = appointmentsByDate[day.iso];
            const isSelected = selectedCalendarDate === day.iso;
            const isPast = !day.isToday && day.iso < toLocalIsoDate(new Date());

            return (
              <button
                type="button"
                onClick={() => {
                  setSelectedCalendarDate(day.iso);
                  if (counts?.total > 0) {
                    onOpenDayList?.(day.iso);
                  } else if (!isPast) {
                    onOpenBookingChoice?.(day.iso);
                  }
                }}
                key={day.iso}
                className={`group flex min-h-[48px] w-full items-center justify-between gap-3 px-3 py-2.5 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-teal ${
                  isPast && !counts?.total
                    ? 'cursor-not-allowed opacity-35'
                    : isPast
                      ? 'opacity-60 hover:bg-brand-teal-light/30'
                      : 'hover:bg-brand-teal-light/60'
                } ${day.isToday ? 'bg-brand-teal-light/50' : ''} ${isSelected ? 'bg-brand-teal-light/45 ring-2 ring-inset ring-brand-teal' : ''}`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                    day.isToday ? 'bg-brand-teal text-white' : 'bg-brand-surface text-brand-teal-dark'
                  }`}>
                    {day.dayNumber}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wide text-brand-dark">{day.dayName}</p>
                    <p className="mt-0.5 text-[10px] font-semibold text-brand-dark-soft">
                      {day.date.toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric' })}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  {counts?.total > 0 ? (
                    calendarLegend.map(({ key, bgClass, textClass }) => (
                      counts[key] > 0 && (
                        <span key={key} className={`inline-flex min-h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[9px] font-extrabold ${bgClass} ${textClass}`}>
                          {counts[key]}
                        </span>
                      )
                    ))
                  ) : (
                    <span className="text-[10px] font-semibold text-brand-dark-soft">No appointments</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-4">
          {calendarLegend.map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${item.bgClass} ${item.ringClass}`} />
              <span className="text-[10px] font-bold text-brand-dark-soft">{item.label}</span>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={goToCurrentWeek}
          className="rounded-full border border-brand-teal/40 px-3 py-1 text-[10px] font-semibold text-brand-teal-dark transition-colors hover:bg-brand-teal hover:text-white"
        >
          This Week
        </button>
      </div>

      <div className="mt-2 min-h-4 text-[10px] font-semibold text-brand-dark-soft">
        {appointmentsLoading && 'Loading appointments...'}
        {!appointmentsLoading && appointmentsError && <span className="text-red-500">{appointmentsError} <button type="button" className="ml-2 underline" onClick={() => loadMonthAppointments({ force: true })}>Retry</button></span>}
        {!appointmentsLoading && !appointmentsError && `${weekAppointmentCount} appointment${weekAppointmentCount === 1 ? '' : 's'} this week`}
      </div>
    </Panel>
  );
}

export function NeedsAttentionPanel({ onOpenAppointment, onOpenNewBookings }) {
  const appointmentsError = useDashboardStore((state) => state.appointmentsError);
  const monthAppointments = useDashboardStore((state) => state.monthAppointments);
  const appointmentsLoading = useDashboardStore((state) => state.appointmentsLoading);
  const todayIso = useMemo(() => toLocalIsoDate(new Date()), []);
  const isEndOfDayReminderTime = new Date().getHours() >= 17;

  const pendingBookings = useMemo(
    () => monthAppointments.filter((appointment) => normalizeStatus(appointment?.status) === 'pending'),
    [monthAppointments],
  );

  const todayNeedsStatusUpdate = useMemo(
    () => monthAppointments.filter((appointment) => {
      if (appointment?.dateIso !== todayIso) return false;
      if (!needsAppointmentStatusUpdate(appointment?.status)) return false;
      if (isPastGraceWindow(appointment, todayIso)) return false;
      return true;
    }),
    [monthAppointments, todayIso],
  );

  const overdueGraceAppointments = useMemo(
    () => monthAppointments.filter((appointment) => isPastGraceWindow(appointment, todayIso)),
    [monthAppointments, todayIso],
  );

  const pastNeedsReview = useMemo(
    () => monthAppointments.filter((appointment) => {
      if (!appointment?.dateIso || appointment.dateIso >= todayIso) return false;
      return needsAppointmentStatusUpdate(appointment?.status);
    }),
    [monthAppointments, todayIso],
  );

  const hotelCheckouts = useMemo(
    () => monthAppointments.filter((appointment) => {
      if (getServiceCategory(appointment) !== 'hotel') return false;
      if (getHotelStageForDate(appointment, todayIso) !== 'Check-out') return false;
      return ['approved', 'checkin', 'checked_in', 'in_progress'].includes(normalizeStatus(appointment?.status));
    }),
    [monthAppointments, todayIso],
  );

  const taskItems = [
    ...overdueGraceAppointments.slice(0, 3).map((appointment) => ({
      key: `grace-overdue-${appointment.id}`,
      eyebrow: 'Grace period exceeded',
      title: appointment.pet || 'Appointment',
      detail: `${appointment.time || '--:--'} - past 15-minute grace; please reschedule or cancel`,
      bgClass: 'bg-gradient-to-r from-red-100/80 via-rose-100/70 to-red-100/60 hover:from-red-200/70 hover:via-rose-100 hover:to-red-100/80',
      appointment,
    })),
    ...pastNeedsReview.slice(0, 3).map((appointment) => ({
      key: `past-status-${appointment.id}`,
      eyebrow: 'Missed status update',
      title: appointment.pet || 'Appointment',
      detail: `${appointment.date || appointment.dateIso || 'Past date'} - needs status update`,
      bgClass: 'bg-gradient-to-r from-red-100/80 via-rose-100/70 to-red-100/60 hover:from-red-200/70 hover:via-rose-100 hover:to-red-100/80',
      appointment,
    })),
    ...(isEndOfDayReminderTime ? todayNeedsStatusUpdate.slice(0, 3).map((appointment) => ({
      key: `today-status-${appointment.id}`,
      eyebrow: "Update today's status",
      title: appointment.pet || 'Appointment',
      detail: `${appointment.time || '--:--'} - mark as completed, cancelled, or still in progress`,
      bgClass: 'bg-white hover:bg-brand-teal-light/25',
      appointment,
    })) : []),
    ...hotelCheckouts.slice(0, 2).map((appointment) => ({
      key: `checkout-${appointment.id}`,
      eyebrow: 'Hotel check-out',
      title: appointment.pet || 'Hotel guest',
      detail: `${appointment.owner || 'Owner'} - ${appointment.service || 'Hotel suite'}`,
      bgClass: 'bg-white hover:bg-brand-teal-light/25',
      appointment,
    })),
    ...pendingBookings.slice(0, 2).map((appointment) => ({
      key: `pending-${appointment.id}`,
      eyebrow: 'Booking confirmation',
      title: appointment.pet || 'New booking',
      detail: `${appointment.owner || 'Owner'} - ${appointment.service || 'Service'}`,
      bgClass: 'bg-white hover:bg-brand-teal-light/25',
      appointment,
      onClick: onOpenNewBookings,
    })),
  ].slice(0, 6);

  return (
    <Panel className="flex h-full min-h-[560px] flex-col px-5 py-4">
      <div className="border-b border-brand-dark/20 pb-3">
        {appointmentsLoading && monthAppointments.length === 0 ? (
          <div role="status" aria-label="Loading status reminders">
            <SkeletonBlock className="h-5 w-36" />
            <SkeletonBlock className="mt-1 h-3.5 w-56 max-w-full" />
          </div>
        ) : (
          <>
            <h2 className="text-sm font-semibold text-brand-dark">STATUS REMINDERS</h2>
            <p className="mt-1 text-[10px] font-semibold text-brand-dark-soft">Appointments that still need an update.</p>
          </>
        )}
      </div>

      <div className="mt-4 space-y-3">
        {appointmentsLoading && monthAppointments.length === 0 && <AdminListSkeleton rows={5} />}
        {taskItems.map((item) => {
          const handleClick = item.onClick || (() => onOpenAppointment?.(item.appointment));
          return (
            <button
              key={item.key}
              type="button"
              onClick={handleClick}
              className={`w-full rounded-lg border border-brand-teal/15 px-3 py-3 text-left transition hover:border-brand-teal/35 ${item.bgClass}`}
            >
              <p className="text-[10px] font-bold uppercase tracking-wide text-brand-dark-soft">{item.eyebrow}</p>
              <p className="mt-1 truncate text-sm font-bold text-brand-dark">{item.title}</p>
              <p className="mt-0.5 truncate text-[10px] font-semibold text-brand-dark-soft">{item.detail}</p>
            </button>
          );
        })}
        {appointmentsError && (
          <p role="alert" className="text-xs font-semibold text-red-600">
            Unable to refresh reminders. {appointmentsError}
          </p>
        )}
        {!appointmentsLoading && !appointmentsError && taskItems.length === 0 && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-5 text-center">
            <p className="text-sm font-bold text-emerald-700">All clear for now</p>
            <p className="mt-1 text-[10px] font-semibold text-emerald-700/75">No urgent appointment actions need attention.</p>
          </div>
        )}
      </div>
    </Panel>
  );
}

function UpcomingAppointmentsModal({ isOpen, title, appointments, onClose, onOpenAppointment }) {
  useBodyScrollLock(isOpen);
  if (!isOpen) return null;

  const getServiceStripeClass = (appointment) => {
    const category = getServiceCategory(appointment);
    if (category === 'hotel') return 'bg-brand-hotel';
    if (category === 'daycare') return 'bg-brand-daycare';
    return 'bg-brand-grooming';
  };

  return createPortal(
    <div className="fixed inset-0 z-[130] h-[100dvh] min-h-[100dvh] w-screen bg-brand-dark/40 backdrop-blur-sm" onClick={onClose}>
      <div
        className="ml-auto flex h-full w-full max-w-[460px] flex-col overflow-hidden bg-white shadow-[-18px_0_40px_rgba(23,53,81,0.24)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between bg-brand-teal px-5 py-4">
          <h3 className="text-sm font-extrabold text-white">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/30"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
        <div className="h-1 bg-white" />

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4">
          {appointments.map((appointment) => (
            <button
              key={`modal-${appointment.id}`}
              type="button"
              onClick={() => onOpenAppointment?.(appointment)}
              className="relative grid w-full grid-cols-[1fr_112px] items-center gap-3 overflow-hidden rounded-xl border border-brand-teal/15 bg-white px-4 py-3 pl-5 text-left shadow-sm transition hover:border-brand-teal/35 hover:bg-brand-surface/70"
            >
              <span className={`absolute left-0 top-0 h-full w-1.5 ${getServiceStripeClass(appointment)}`} />
              <div className="min-w-0">
                <p className="truncate text-sm font-extrabold text-brand-dark">{appointment.pet || '-'}</p>
                <p className="mt-1 truncate text-xs font-semibold text-brand-dark-soft">{appointment.owner || '-'}</p>
                <p className="mt-1 truncate text-[11px] font-semibold text-brand-dark-soft">{appointment.service || 'Service'}</p>
              </div>
              <div className="min-w-0 text-right">
                <p className="truncate text-xs font-medium text-brand-dark">{appointment.time || '--:--'}</p>
                <p className="mt-1 truncate text-[10px] font-semibold text-brand-teal-dark">
                  {String(appointment.status || 'Pending').replace(/_/g, ' ')}
                </p>
              </div>
            </button>
          ))}
          {appointments.length === 0 && (
            <p className="py-8 text-center text-sm font-semibold text-brand-dark-soft">
              No appointments found.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
