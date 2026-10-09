import { Pencil } from 'lucide-react';

const scheduleGroups = [
  {
    title: 'Weekdays',
    days: [
      { key: 'mon', label: 'Mon' },
      { key: 'tue', label: 'Tue' },
      { key: 'wed', label: 'Wed' },
      { key: 'thu', label: 'Thu' },
      { key: 'fri', label: 'Fri' },
    ],
  },
  {
    title: 'Weekends',
    days: [
      { key: 'sat', label: 'Sat' },
      { key: 'sun', label: 'Sun' },
    ],
  },
];

export default function ShopSchedulePanel({ schedule, scheduleEdit, onOpenManageHours }) {
  const summarizeGroup = (days) => {
    const rows = days.map(({ key }) => ({
      key,
      ...(scheduleEdit?.[key] || { open: '09:00', close: '17:00', closed: true }),
    }));
    const signatures = new Set(rows.map((row) => (row.closed ? 'closed' : `${row.open}-${row.close}`)));
    const isUniform = signatures.size === 1;
    const allClosed = rows.every((row) => row.closed);

    if (allClosed) return { status: 'Closed', hours: 'Closed' };
    if (!isUniform) return { status: 'Mixed', hours: 'Varied hours' };

    const first = rows[0];
    return {
      status: first.closed ? 'Closed' : 'Open',
      hours: schedule?.shop_hours?.[first.key] || `${first.open} - ${first.close}`,
    };
  };

  return (
    <aside className="space-y-3 rounded-xl border border-brand-teal/20 bg-white p-4 shadow-[0_6px_12px_rgba(23,53,81,0.08)]">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-extrabold uppercase tracking-wide text-brand-dark">Shop Operations</h3>
        {typeof onOpenManageHours === 'function' && (
          <button
            type="button"
            onClick={onOpenManageHours}
            title="Manage Shop Operations"
            className="inline-flex items-center justify-center text-brand-teal transition hover:text-brand-teal-dark"
          >
            <Pencil size={15} strokeWidth={2.8} />
          </button>
        )}
      </div>

      {scheduleGroups.map((group) => {
        const summary = summarizeGroup(group.days);
        return (
          <div key={group.title} className="rounded-lg border border-brand-teal/20 bg-brand-teal-light/25 px-3 py-2">
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-xs font-semibold text-brand-dark">{group.title}</p>
              <p className="text-[10px] font-medium text-brand-dark-soft">{summary.status}</p>
            </div>
            <p className="text-xs font-normal text-brand-dark-soft">{summary.hours}</p>
          </div>
        );
      })}
    </aside>
  );
}
