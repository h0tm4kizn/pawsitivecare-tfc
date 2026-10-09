import { useMemo, useState, useEffect } from 'react';
import ServiceAcknowledgmentModal from '../../../components/modals/ServiceAcknowledgmentModal';
import {
  TODAY,
  toIso,
  isSame,
  isPastAppointment,
} from './appointment/appointmentHelpers';
import AppointmentDetailModal from './appointment/AppointmentDetailModal';
import DayAppointmentsModal from './appointment/DayAppointmentsModal';
import UpcomingAppointmentCard from './appointment/UpcomingAppointmentCard';
import AllUpcomingAppointmentsModal from './appointment/AllUpcomingAppointmentsModal';
import HistoryModal from './appointment/HistoryModal';

export default function AppointmentSection({ appointments = [], loading = false, onRefresh, onBook, focusDate = null }) {
  const [currentMonth, setCurrentMonth] = useState(
    new Date(TODAY.getFullYear(), TODAY.getMonth(), 1),
  );
  const [selectedDate, setSelectedDate] = useState(null);
  const [showHistory,  setShowHistory]  = useState(false);
  const [dayModal,     setDayModal]     = useState(null);
  const [detailApt,    setDetailApt]    = useState(null);
  const [showAcknowledgment, setShowAcknowledgment] = useState(null);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [quickBookDate, setQuickBookDate] = useState(null);

  const focusCalendarOnDate = (dateValue) => {
    const isoDate = String(dateValue || '').slice(0, 10);
    const [year, month, day] = isoDate.split('-').map(Number);
    if (!year || !month || !day) return;
    setCurrentMonth(new Date(year, month - 1, 1));
    setSelectedDate(isoDate);
  };

  useEffect(() => {
    if (focusDate) focusCalendarOnDate(focusDate);
  }, [focusDate]);

  useEffect(() => {
    const openLinkedAppointment = (event) => {
      const appointmentId = event.detail?.appointmentId;
      const appointment = appointments.find((item) => String(item.id) === String(appointmentId));
      if (!appointment) return;
      focusCalendarOnDate(appointment.appointment_date);
      setDayModal(null);
      setShowHistory(false);
      setShowAllUpcoming(false);
      setDetailApt(appointment);
    };
    window.addEventListener('client:open-appointment', openLinkedAppointment);
    return () => window.removeEventListener('client:open-appointment', openLinkedAppointment);
  }, [appointments]);

  const upcoming = useMemo(() =>
    [...appointments]
      .filter((a) => {
        const s = String(a.status || '').toLowerCase();
        if (s === 'cancelled' || s === 'completed' || s === 'no_show' || s === 'rejected') return false;
        if (isPastAppointment(a)) return false;
        return true;
      })
      .sort((a, b) => new Date(a.appointment_date) - new Date(b.appointment_date)),
    [appointments],
  );

  const apptDates = useMemo(() =>
    new Set(
      appointments
        .filter((a) => {
          const s = String(a.status || '').toLowerCase();
          return s !== 'cancelled' && s !== 'completed' && s !== 'no_show' && s !== 'rejected';
        })
        .map((a) => a.appointment_date)
        .filter(Boolean)
    ),
    [appointments],
  );

  const visibleUpcoming = upcoming.slice(0, 3);
  const hiddenUpcomingCount = Math.max(upcoming.length - visibleUpcoming.length, 0);

  const calendarDays = useMemo(() => {
    const y        = currentMonth.getFullYear();
    const m        = currentMonth.getMonth();
    const firstDay = new Date(y, m, 1).getDay();
    const daysInM  = new Date(y, m + 1, 0).getDate();
    const offset   = (firstDay + 6) % 7;
    const cells    = Array(offset).fill(null);
    for (let d = 1; d <= daysInM; d++) cells.push(new Date(y, m, d));
    return cells;
  }, [currentMonth]);

  const monthLabel = currentMonth.toLocaleDateString('en-US', { timeZone: 'Asia/Manila',  month: 'long', year: 'numeric' });
  const prevMonth  = () => setCurrentMonth((p) => new Date(p.getFullYear(), p.getMonth() - 1, 1));
  const nextMonth  = () => setCurrentMonth((p) => new Date(p.getFullYear(), p.getMonth() + 1, 1));

  return (
    <div>
      <style>{`
        .upcoming-scroll { scrollbar-width: none; }
        .upcoming-scroll::-webkit-scrollbar { width: 0px; }
        .upcoming-scroll:hover { scrollbar-width: thin; scrollbar-color: #d1d5db transparent; }
        .upcoming-scroll:hover::-webkit-scrollbar { width: 4px; }
        .upcoming-scroll:hover::-webkit-scrollbar-track { background: transparent; }
        .upcoming-scroll:hover::-webkit-scrollbar-thumb { background-color: #d1d5db; border-radius: 99px; }
        .upcoming-scroll:hover::-webkit-scrollbar-thumb:hover { background-color: #f97316; }
        .history-scroll { scrollbar-width: none; }
        .history-scroll::-webkit-scrollbar { width: 0px; }
        .history-scroll:hover { scrollbar-width: thin; scrollbar-color: #d1d5db transparent; }
        .history-scroll:hover::-webkit-scrollbar { width: 4px; }
        .history-scroll:hover::-webkit-scrollbar-track { background: transparent; }
        .history-scroll:hover::-webkit-scrollbar-thumb { background-color: #d1d5db; border-radius: 99px; }
        .history-scroll:hover::-webkit-scrollbar-thumb:hover { background-color: #f97316; }
      `}</style>
      <div className="mb-2 hidden grid-cols-3 gap-4 lg:grid">
        <p className="px-1 text-xs font-bold uppercase tracking-widest text-brand-dark-soft">Appointments</p>
        <div className="col-span-2 flex items-center justify-end px-1">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-brand-dark-soft">
              <span className="h-2 w-2 rounded-full bg-brand-daycare" />
              Pet Daycare
            </span>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-brand-dark-soft">
              <span className="h-2 w-2 rounded-full bg-brand-grooming" />
              Pet Grooming
            </span>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-brand-dark-soft">
              <span className="h-2 w-2 rounded-full bg-brand-hotel" />
              Pet Hotel
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3 lg:items-stretch">

        {/* ── Appointments Calendar (left) - Hidden on mobile ── */}
        <div className="hidden h-full flex-col rounded-2xl bg-white p-4 shadow-sm border border-brand-dark-light sm:p-5 lg:flex justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold text-brand-dark">{monthLabel}</span>
            <div className="flex gap-1">
              <button type="button" onClick={prevMonth}
                className="w-6 h-6 flex items-center justify-center rounded-full border border-brand-dark-light text-brand-dark-soft hover:bg-brand-surface transition-colors">
                <i className="fa-solid fa-chevron-left text-[10px]" />
              </button>
              <button type="button" onClick={nextMonth}
                className="w-6 h-6 flex items-center justify-center rounded-full border border-brand-dark-light text-brand-dark-soft hover:bg-brand-surface transition-colors">
                <i className="fa-solid fa-chevron-right text-[10px]" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 text-center mb-2">
            {['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d) => (
              <span key={d} className="text-[10px] font-semibold text-brand-dark-soft">{d}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-1 text-center">
            {calendarDays.map((d, i) => {
              if (!d) return <span key={`blank-${i}`} className="py-1.5" />;
              const isToday = isSame(d, TODAY);
              const dateStr = toIso(d);
              const hasApt  = apptDates.has(dateStr);
              const isPast  = d < TODAY;

              const getDotColor = () => 'bg-brand-teal';

              return (
                <button key={toIso(d)}
                  type="button"
                  disabled={isPast}
                  onClick={() => {
                    setSelectedDate(toIso(d));
                    if (hasApt && !isPast) setDayModal(toIso(d));
                    else if (!isPast && !hasApt && onBook) setQuickBookDate(toIso(d));
                  }}
                  className={`relative mx-auto flex h-9 w-9 items-center justify-center rounded-full text-xs select-none
                    ${isPast ? 'text-gray-400 cursor-not-allowed'
                      : isToday ? 'font-bold text-brand-teal cursor-pointer hover:bg-brand-teal/10'
                      : hasApt ? 'font-medium text-brand-dark cursor-pointer hover:bg-brand-surface'
                      : 'font-medium text-brand-dark cursor-pointer hover:bg-brand-surface'}
                    ${selectedDate === toIso(d) ? 'bg-gray-200' : ''}`}
                >
                  {d.getDate()}
                  {hasApt && !isPast && (
                    <span className={`absolute bottom-0.5 h-1 w-1 rounded-full ${getDotColor()}`} />
                  )}
                </button>
              );
            })}
          </div>

        </div>

        {/* ── Upcoming Schedule (right) ── */}
        <div className="flex min-h-[260px] flex-col rounded-2xl border border-brand-dark-light bg-white p-4 shadow-sm lg:col-span-2 lg:h-full lg:min-h-[320px]">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-brand-dark-soft">Upcoming Schedule</p>
              <p className="mt-0.5 text-[10px] font-medium text-brand-dark-soft">
                {upcoming.length} upcoming appointment{upcoming.length === 1 ? '' : 's'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowHistory(true)}
              className="shrink-0 flex items-center gap-1.5 text-[10px] font-bold text-brand-teal transition-colors hover:underline"
            >
              <i className="fa-solid fa-clock-rotate-left text-[9px]" />
              View History
            </button>
          </div>

          <div className="space-y-1.5 overflow-y-auto scrollbar-teal flex-1 upcoming-scroll">
            {upcoming.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center h-full">
                <i className="fa-regular fa-calendar-xmark text-2xl text-brand-dark-soft/30 mb-2" />
                <p className="text-xs text-brand-dark-soft">No upcoming appointments.</p>
                {onBook && (
                  <button
                    type="button"
                    onClick={() => onBook(null, '')}
                    className="mt-4 hidden rounded-xl bg-brand-teal px-4 py-2 text-[11px] font-bold text-white transition-colors hover:brightness-95 lg:block"
                  >
                    Book Appointment
                  </button>
                )}
              </div>
            ) : (
              <>
                {visibleUpcoming.map((apt) => (
                  <UpcomingAppointmentCard
                    key={apt.id}
                    apt={apt}
                    onClick={() => {
                      focusCalendarOnDate(apt.appointment_date);
                      setDetailApt(apt);
                    }}
                  />
                ))}
                {hiddenUpcomingCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAllUpcoming(true)}
                    className="w-full rounded-xl border border-dashed border-brand-teal/40 bg-white px-4 py-3 text-center text-xs font-bold text-brand-teal transition-colors hover:border-brand-teal hover:bg-brand-teal-light/40"
                  >
                    +{hiddenUpcomingCount} upcoming appointment{hiddenUpcomingCount === 1 ? '' : 's'}
                  </button>
                )}
              </>
            )}
          </div>

        </div>

      </div>

      <DayAppointmentsModal
        isOpen={!!dayModal}
        date={dayModal}
        appointments={appointments}
        onClose={() => setDayModal(null)}
        onBookDate={onBook ? (date) => setQuickBookDate(date) : undefined}
      />

      <HistoryModal
        isOpen={showHistory}
        appointments={appointments}
        loading={loading}
        onClose={() => setShowHistory(false)}
      />

      <AllUpcomingAppointmentsModal
        isOpen={showAllUpcoming}
        appointments={upcoming}
        onClose={() => setShowAllUpcoming(false)}
        onSelect={(apt) => {
          focusCalendarOnDate(apt.appointment_date);
          setDetailApt(apt);
        }}
      />

      <AppointmentDetailModal
        isOpen={!!detailApt}
        apt={detailApt}
        onClose={() => setDetailApt(null)}
        onCancelled={() => { setDetailApt(null); onRefresh?.(); }}
        onRescheduled={(newAppointmentDate) => {
          focusCalendarOnDate(newAppointmentDate);
          setDetailApt(null);
          onRefresh?.();
        }}
      />

      <ServiceAcknowledgmentModal
        isOpen={!!showAcknowledgment}
        appointmentId={showAcknowledgment}
        onClose={() => setShowAcknowledgment(null)}
      />

      {/* Quick Book Overlay (date without appointment clicked) */}
      {quickBookDate && onBook && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setQuickBookDate(null)}
        >
          <div className="flex flex-col items-center gap-5 px-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-bold text-white/90 uppercase tracking-widest">
              Book for {new Date(quickBookDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
            <div className="grid grid-cols-3 gap-6 w-full max-w-3xl">
              {/* Daycare */}
              <button type="button"
                onClick={() => { setQuickBookDate(null); onBook(quickBookDate, 'daycare'); }}
                className="rounded-3xl bg-white shadow-2xl border border-brand-daycare/20 hover:border-brand-daycare/40 hover:shadow-[0_8px_24px_rgba(251,191,36,0.3)] transition-all flex flex-col items-center justify-center px-8 py-14 hover:scale-[1.03]">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-brand-daycare-soft mb-5">
                  <i className="fa-solid fa-bone text-4xl text-brand-daycare" />
                </div>
                <p className="text-base font-extrabold uppercase tracking-widest text-brand-daycare text-center">Pet Daycare</p>
                <p className="mt-3 max-w-[210px] text-center text-xs leading-relaxed text-brand-dark-soft">
                  Safe daytime care, play, and socialization for eligible dogs.
                </p>
              </button>
              {/* Grooming */}
              <button type="button"
                onClick={() => { setQuickBookDate(null); onBook(quickBookDate, 'grooming'); }}
                className="rounded-3xl bg-white shadow-2xl border border-brand-grooming/20 hover:border-brand-grooming/40 hover:shadow-[0_8px_24px_rgba(167,139,250,0.3)] transition-all flex flex-col items-center justify-center px-8 py-14 hover:scale-[1.03]">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-brand-grooming-soft mb-5">
                  <i className="fa-solid fa-scissors text-4xl text-brand-grooming" />
                </div>
                <p className="text-base font-extrabold uppercase tracking-widest text-brand-grooming text-center">Pet Grooming</p>
                <p className="mt-3 max-w-[210px] text-center text-xs leading-relaxed text-brand-dark-soft">
                  Full grooming packages or individual Pawsome Extras.
                </p>
              </button>
              {/* Pet Hotel */}
              <button type="button"
                onClick={() => { setQuickBookDate(null); onBook(quickBookDate, 'hotel'); }}
                className="rounded-3xl bg-white shadow-2xl border border-brand-hotel/20 hover:border-brand-hotel/40 hover:shadow-[0_8px_24px_rgba(251,113,133,0.3)] transition-all flex flex-col items-center justify-center px-8 py-14 hover:scale-[1.03]">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-brand-hotel-soft mb-5">
                  <i className="fa-solid fa-hotel text-4xl text-brand-hotel" />
                </div>
                <p className="text-base font-extrabold uppercase tracking-widest text-brand-hotel text-center">Pet Hotel</p>
                <p className="mt-3 max-w-[210px] text-center text-xs leading-relaxed text-brand-dark-soft">
                  Overnight stays with suite selection, dates, and reservation reference.
                </p>
              </button>
            </div>
            <button type="button" onClick={() => setQuickBookDate(null)}
              className="text-xs font-semibold text-white/70 hover:text-white transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
