import { AdminStatSkeleton } from '../../../components/admin/AdminLoading';
import { X } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import CompletedCancelledAppointmentsModal from '../../../components/modals/CompletedCancelledAppointmentsModal';

const labelByKey = {
  total: 'Total Appointments',
  pending: 'Pending Bookings',
  in_progress: 'In Progress Appointments',
  approved: 'Approved Appointments',
  completed: 'Completed Appointments',
  cancelled: 'Cancelled Appointments',
};

function MetricStrip({ items = [] }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-4 border-b border-brand-dark-light px-1 pb-4 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-dark-soft">{item.label}</p>
          <p className={`mt-1 text-3xl font-bold leading-none ${item.valueClass || 'text-brand-dark'}`}>{item.value}</p>
          {item.subtitle ? <p className="mt-1 text-[11px] font-semibold text-brand-dark-soft">{item.subtitle}</p> : null}
        </div>
      ))}
    </div>
  );
}

function StatusMetricBox({ label, value, subtitle = '', tone = 'teal', onClick = null }) {
  const toneClass =
    tone === 'yellow'
      ? 'border-amber-200 bg-amber-50 text-amber-700'
      : tone === 'green'
        ? 'border-emerald-200 bg-emerald-50 text-emerald-600'
      : tone === 'red'
        ? 'border-red-200 bg-red-50 text-red-600'
        : 'border-brand-teal/25 bg-brand-teal/5 text-brand-teal';

  return (
    <button
      type="button"
      onClick={onClick || undefined}
      className={`min-h-[96px] rounded-xl border px-3 py-3 text-left transition ${toneClass} ${onClick ? 'hover:-translate-y-0.5 hover:shadow-[0_8px_16px_rgba(23,53,81,0.10)]' : ''}`}
    >
      <p className="text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">{label}</p>
      <p className="mt-1.5 text-3xl font-extrabold leading-none">{value}</p>
      {subtitle ? <p className="mt-1.5 text-[10px] font-semibold text-brand-dark-soft">{subtitle}</p> : null}
    </button>
  );
}

function ViewListButton({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex min-h-[36px] items-center justify-center rounded-lg border border-brand-teal/35 bg-white px-4 py-2 text-xs font-bold text-brand-teal transition hover:bg-brand-teal hover:text-white"
    >
      {children}
    </button>
  );
}

function AppointmentStatCard({ title, value, note, onClick, compact = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group w-full rounded-xl border border-brand-teal/20 bg-white text-left shadow-[0_6px_12px_rgba(23,53,81,0.08)] transition-all hover:-translate-y-0.5 hover:shadow-[0_10px_18px_rgba(23,53,81,0.14)] focus:outline-none focus:ring-2 focus:ring-brand-teal/30 ${
        compact ? 'min-h-[96px] px-4 py-3' : 'min-h-[112px] px-4 py-3'
      }`}
    >
      <p className={`font-semibold text-brand-dark ${compact ? 'text-[10px]' : 'text-xs'}`}>{title}</p>
      <p className={`font-extrabold leading-none text-brand-teal ${compact ? 'mt-1.5 text-2xl' : 'mt-3 text-3xl'}`}>{value}</p>
      <p className={`font-medium text-brand-teal-dark/90 ${compact ? 'mt-1 text-[10px]' : 'mt-3 text-xs'}`}>{note}</p>
    </button>
  );
}

function AppointmentStatsModal({ isOpen, item, onClose, monthAppointments = [] }) {
  const [listModalType, setListModalType] = useState(null);
  if (!isOpen || !item) return null;
  const statsType = item.key;

  const completed = monthAppointments.filter((entry) => String(entry.status || '').toLowerCase().includes('complete'));
  const cancelled = monthAppointments.filter((entry) => {
    const status = String(entry.status || '').toLowerCase().replace(/-/g, '_');
    return status.includes('cancel') || status === 'no_show';
  });
  const approved = monthAppointments.filter((entry) => String(entry.status || '').toLowerCase().replace(/-/g, '_') === 'approved');
  const inProgress = monthAppointments.filter((entry) => String(entry.status || '').toLowerCase().includes('in_progress'));
  const pending = monthAppointments.filter((entry) => String(entry.status || '').toLowerCase().replace(/-/g, '_') === 'pending');

  if (statsType === 'completed' || statsType === 'cancelled') {
    return (
      <CompletedCancelledAppointmentsModal
        isOpen
        type={statsType}
        appointments={statsType === 'completed' ? completed : cancelled}
        onClose={onClose}
      />
    );
  }

  const content = {
    total: {
      body: (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <StatusMetricBox label="Total This Month" value={monthAppointments.length} subtitle="All statuses" onClick={() => setListModalType('total')} />
            <StatusMetricBox label="Pending" value={pending.length} subtitle="Awaiting approval" onClick={() => setListModalType('pending')} />
            <StatusMetricBox label="Approved" value={approved.length} subtitle="Ready to serve" onClick={() => setListModalType('approved')} />
            <StatusMetricBox label="In Progress" value={inProgress.length} subtitle="Ongoing" tone="yellow" onClick={() => setListModalType('in_progress')} />
            <StatusMetricBox label="Completed" value={completed.length} subtitle="Finished" tone="green" onClick={() => setListModalType('completed')} />
            <StatusMetricBox label="Cancelled" value={cancelled.length} subtitle="Did not proceed" tone="red" onClick={() => setListModalType('cancelled')} />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <ViewListButton onClick={() => setListModalType('total')}>View This Month Appointments</ViewListButton>
            <ViewListButton onClick={() => setListModalType('pending')}>View Pending Bookings</ViewListButton>
          </div>
        </div>
      ),
    },
    pending: {
      body: (
        <div className="space-y-4">
          <MetricStrip items={[{ label: 'Pending', value: pending.length, subtitle: 'Waiting for approval', valueClass: 'text-brand-teal' }]} />
          <ViewListButton onClick={() => setListModalType('pending')}>View Pending Bookings</ViewListButton>
        </div>
      ),
    },
  };

  const { body } = content[statsType] || content.total;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[80] flex h-[100dvh] min-h-[100dvh] w-screen items-center justify-center p-4 backdrop-blur-sm bg-brand-dark/40"
        onClick={onClose}
      >
        <div
          className="relative z-10 flex max-h-[88dvh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between bg-brand-teal px-5 py-3">
            <h3 className="text-base font-extrabold text-white">{labelByKey[statsType] || item.title}</h3>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white transition hover:bg-white/20"
              aria-label="Close stats modal"
            >
              <X size={18} strokeWidth={3} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-5">{body}</div>
        </div>
      </div>
      <CompletedCancelledAppointmentsModal
        isOpen={Boolean(listModalType)}
        type={listModalType || 'completed'}
        appointments={
          listModalType === 'pending'
            ? pending
            : listModalType === 'cancelled'
            ? cancelled
            : listModalType === 'in_progress'
              ? inProgress
              : listModalType === 'approved'
                ? approved
                : listModalType === 'total'
                  ? monthAppointments
                  : completed
        }
        onClose={() => {
          setListModalType(null);
          onClose?.();
        }}
      />
    </>
    ,
    document.body
  );
}

export default function AppointmentStatBox(props) {
  if (props?.loading) return <AdminStatSkeleton />;
  if (props?.variant === 'modal') return <AppointmentStatsModal {...props} />;
  return <AppointmentStatCard {...props} />;
}
