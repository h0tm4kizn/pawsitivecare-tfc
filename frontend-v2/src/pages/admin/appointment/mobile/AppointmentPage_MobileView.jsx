import { AdminSkeleton } from '../../../../components/admin/AdminLoading';
import { CalendarDays, ChevronLeft, ChevronRight, List } from 'lucide-react';
import ScheduleAppointmentButton from '../../../../components/reusable-ui/ScheduleAppointmentButton';
import AppointmentStatBox from '../AppointmentStatBox';
import AppointmentCalendarGrid from '../components/AppointmentCalendarGrid';
import AppointmentFilterSelect from '../components/AppointmentFilterSelect';
import AppointmentList from '../components/AppointmentList';
import LegendItem from '../components/LegendItem';
import useMediaQuery from '../../../../hooks/useMediaQuery';

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'pending', label: 'Pending' },
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

export default function AppointmentPage_MobileView({
  isLoading = false,
  hasLoaded = false,
  error = null,
  view = 'calendar',
  onSetView,
  search = '',
  onSearch,
  statusFilter = 'all',
  onStatusFilter,
  serviceFilter = 'all',
  onServiceFilter,
  sortBy = 'date',
  onSortBy,
  monthLabel = '',
  calendarDays = [],
  appointmentsByDate = {},
  todayIso = '',
  onPrevMonth,
  onNextMonth,
  onDayClick,
  onAppointmentClick,
  onEmptyDayClick,
  listAppointments = [],
  quickStatusAppointmentId = null,
  onSetQuickStatus,
  onUpdateStatus,
  isUpdatingStatus = false,
  onOpenDetails,
  onRequestCancel,
  onMarkComplete,
  onEdit,
  stats = {},
  onOpenStats,
  onOpenBooking,
  pendingBookings = [],
}) {
  const isPhoneWidth = useMediaQuery('(max-width: 767px)');

  return (
    <div className="font-poppins space-y-4 px-4 pb-10 pt-5">

      {/* Page Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold leading-tight text-brand-teal-dark">
            Appointment <span className="text-brand-dark">Scheduling</span>
          </h1>
          <p className="mt-0.5 text-xs text-brand-dark-soft">Manage appointments, schedules, and service queue.</p>
        </div>
        <ScheduleAppointmentButton
          label="Schedule"
          showIcon
          className="shrink-0 px-3 py-2 text-xs font-semibold"
          onClick={onOpenBooking}
        />
      </div>

      {/* Stat Boxes — 2 per row */}
      <div className="grid grid-cols-2 gap-3">
        <AppointmentStatBox loading={isLoading}
          title="PENDING"
          value={pendingBookings?.length ?? 0}
          note="Waiting for approval"
          onClick={() => onOpenStats?.('pending')}
        />
        <AppointmentStatBox loading={isLoading}
          title="TOTAL"
          value={stats.total ?? 0}
          note="This month"
          onClick={() => onOpenStats?.('total')}
        />
        <AppointmentStatBox loading={isLoading}
          title="COMPLETED"
          value={stats.completed ?? 0}
          note="Finished"
          onClick={() => onOpenStats?.('completed')}
        />
        <AppointmentStatBox loading={isLoading}
          title="CANCELLED"
          value={stats.cancelled ?? 0}
          note="Cancelled"
          onClick={() => onOpenStats?.('cancelled')}
        />
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <input
          value={search}
          onChange={(e) => onSearch?.(e.target.value)}
          placeholder="Search pet, owner, or ID..."
          className="w-full rounded-xl border border-brand-teal/30 bg-white py-2.5 pl-4 pr-4 text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
        />
        <div className="flex gap-2">
          <AppointmentFilterSelect value={statusFilter} onChange={onStatusFilter} options={STATUS_FILTER_OPTIONS} widthClass="flex-1 min-w-0" />
          <AppointmentFilterSelect value={serviceFilter} onChange={onServiceFilter} options={SERVICE_FILTER_OPTIONS} widthClass="flex-1 min-w-0" />
        </div>
      </div>

      {/* Calendar / List Panel */}
      <div className="overflow-hidden rounded-xl border border-brand-teal/20 bg-white shadow-[0_6px_12px_rgba(23,53,81,0.08)]">
        <div className="flex items-center justify-between gap-2 border-b border-brand-teal/20 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <button type="button" onClick={onPrevMonth} className="shrink-0 rounded border border-brand-teal/30 p-0.5 hover:bg-brand-teal-light/30">
              <ChevronLeft className="h-4 w-4 text-brand-dark" />
            </button>
            <span className="truncate text-sm font-extrabold text-brand-dark">{monthLabel}</span>
            <button type="button" onClick={onNextMonth} className="shrink-0 rounded border border-brand-teal/30 p-0.5 hover:bg-brand-teal-light/30">
              <ChevronRight className="h-4 w-4 text-brand-dark" />
            </button>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {view === 'list' && (
              <AppointmentFilterSelect
                value={sortBy}
                onChange={onSortBy}
                options={SORT_OPTIONS}
                widthClass="min-w-[100px]"
                compact
              />
            )}
            <div className="flex overflow-hidden rounded-lg border border-brand-teal/30">
              <button
                type="button"
                onClick={() => onSetView?.('calendar')}
                className={`px-3 py-1.5 ${view === 'calendar' ? 'bg-brand-teal text-white' : 'bg-white text-brand-dark-soft'}`}
                title="Calendar View"
              >
                <CalendarDays className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onSetView?.('list')}
                className={`border-l border-brand-teal/30 px-3 py-1.5 ${view === 'list' ? 'bg-brand-teal text-white' : 'bg-white text-brand-dark-soft'}`}
                title="List View"
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {isLoading && <AdminSkeleton variant={view === 'calendar' ? 'calendar' : 'table'} label="Loading appointments" />}
        {!isLoading && error && (
          <div className="px-4 py-5 text-sm font-semibold text-red-500">{error}</div>
        )}

        {!isLoading && hasLoaded && view === 'calendar' && (
          <AppointmentCalendarGrid
            calendarDays={calendarDays}
            appointmentsByDate={appointmentsByDate}
            todayIso={todayIso}
            onDayClick={onDayClick}
            onAppointmentClick={onAppointmentClick}
            onEmptyDayClick={onEmptyDayClick}
            compact={isPhoneWidth}
          />
        )}

        {!isLoading && hasLoaded && view === 'list' && (
          <AppointmentList
            listAppointments={listAppointments}
            quickStatusAppointmentId={quickStatusAppointmentId}
            setQuickStatusAppointmentId={onSetQuickStatus}
            updateAppointmentStatus={onUpdateStatus}
            isUpdatingStatus={isUpdatingStatus}
            todayIso={todayIso}
            onOpenDetails={onOpenDetails}
            onRequestCancel={onRequestCancel}
            onMarkComplete={onMarkComplete}
            onEdit={onEdit}
            variant="cards"
          />
        )}
      </div>

      {/* Legend — after calendar, horizontal */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-brand-teal/20 bg-white px-4 py-3 shadow-[0_4px_10px_rgba(23,53,81,0.07)]">
        <p className="shrink-0 text-[10px] font-extrabold uppercase tracking-wider text-brand-dark">Legend</p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] font-semibold text-brand-dark-soft">
          <LegendItem dotClass="bg-brand-daycare" label="Daycare" />
          <LegendItem dotClass="bg-brand-grooming" label="Grooming" />
          <LegendItem dotClass="bg-brand-hotel" label="Hotel" />
        </div>
      </div>

      {/* Pending Bookings */}
      <section>
        <p className="mb-3 text-xs font-bold uppercase tracking-widest text-brand-dark-soft">Pending Bookings</p>
        {pendingBookings.length === 0 ? (
          <div className="rounded-xl border border-brand-dark-light bg-white px-4 py-6 text-center shadow-[0_4px_10px_rgba(23,53,81,0.07)]">
            <p className="text-xs text-brand-dark-soft">No pending bookings.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pendingBookings.slice(0, 8).map((booking) => {
              const cat = String(booking?.service_category || booking?.serviceType || booking?.service || '').toLowerCase();
              let serviceBg = 'bg-brand-daycare/10 text-brand-daycare border-brand-daycare/30';
              let serviceDot = 'bg-brand-daycare';
              if (cat.includes('hotel') || cat.includes('suite')) {
                serviceBg = 'bg-brand-hotel/10 text-brand-hotel border-brand-hotel/30';
                serviceDot = 'bg-brand-hotel';
              } else if (cat.includes('groom')) {
                serviceBg = 'bg-brand-grooming/10 text-brand-grooming border-brand-grooming/30';
                serviceDot = 'bg-brand-grooming';
              }
              return (
                <button
                  key={booking.id}
                  type="button"
                  onClick={() => onOpenDetails?.(booking)}
                  className={`w-full flex items-start gap-2.5 rounded-xl border ${serviceBg} px-4 py-3 text-left transition-opacity hover:opacity-80`}
                >
                  <span className={`${serviceDot} mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-brand-dark">{booking.pet}</p>
                    <p className="truncate text-[11px] text-brand-dark-soft">{booking.owner}</p>
                    <p className="truncate text-[11px] font-semibold capitalize text-brand-teal">{booking.service}</p>
                    {(booking?._raw?.reschedule_requested_at || String(booking?._raw?.notes || '').includes('[Reschedule Request]')) && (
                      <p className="mt-1 text-[10px] font-bold text-amber-700">Reschedule request</p>
                    )}
                  </div>
                  <p className="shrink-0 whitespace-nowrap text-[10px] text-brand-dark-soft">
                    {booking.date}{booking.time ? ` ${booking.time}` : ''}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </section>

    </div>
  );
}
