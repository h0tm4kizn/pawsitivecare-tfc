export function ReportKpiCard({ label, value, note, tone = 'text-brand-teal-dark' }) {
  return (
    <div className="rounded-xl border border-brand-dark-light/70 bg-white px-4 py-3 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-wide text-brand-dark-soft">{label}</p>
      <p className={`mt-1 text-2xl font-extrabold leading-none ${tone}`}>{value}</p>
      {note && <p className="mt-2 text-[11px] font-medium text-brand-dark-soft">{note}</p>}
    </div>
  );
}

export function LineTrendChart({ data = [], valueKey, label = 'Trend', color = '#24777a', onPointClick, compact = false }) {
  const values = data.map((item) => Number(item[valueKey] || 0));
  const maximum = Math.max(...values, 1);
  const left = data.length ? 50 / data.length : 50;
  const right = 100 - left;
  const top = 7;
  const bottom = 40;
  const points = values.map((value, index) => {
    const x = values.length <= 1 ? 50 : left + ((right - left) * index) / (values.length - 1);
    const y = bottom - ((bottom - top) * value) / maximum;
    return { x, y, value, item: data[index] };
  });
  const polyline = points.map(({ x, y }) => `${x},${y}`).join(' ');
  const area = points.length ? `${left},${bottom} ${polyline} ${right},${bottom}` : '';

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-3">
        {label ? <h4 className={`${compact ? 'text-[10px]' : 'text-xs'} font-bold uppercase tracking-wide text-brand-dark-soft`}>{label}</h4> : <span />}
        <span className="text-[10px] font-semibold text-brand-dark-soft">Peak: {Math.max(...values, 0)}</span>
      </div>
      <div className="rounded-xl border border-brand-dark-light/70 bg-slate-50/60 px-3 pt-3">
        <div className={`relative ${compact ? 'h-28' : 'h-40'} w-full`} role="img" aria-label={label}>
          <svg viewBox="0 0 100 45" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
          {[top, (top + bottom) / 2].map((y) => <line key={y} x1={left} x2={right} y1={y} y2={y} stroke="#dce7e7" strokeWidth="0.35" vectorEffect="non-scaling-stroke" strokeDasharray="4 5" />)}
          <line x1={left} x2={right} y1={bottom} y2={bottom} stroke="#9fb4b5" strokeWidth="0.65" vectorEffect="non-scaling-stroke" />
          {area && <polygon points={area} fill={color} opacity="0.1" />}
          {points.length > 1 && <polyline points={polyline} fill="none" stroke={color} strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />}
          </svg>
          <span className="absolute left-0 -translate-y-1/2 text-[10px] font-bold text-brand-dark-soft" style={{ top: `${(top / 45) * 100}%` }}>{maximum}</span>
          <span className="absolute left-0 -translate-y-1/2 text-[10px] font-bold text-brand-dark-soft" style={{ top: `${(((top + bottom) / 2) / 45) * 100}%` }}>{Math.round(maximum / 2)}</span>
          <span className="absolute left-0 -translate-y-1/2 text-[10px] font-extrabold text-brand-dark-soft" style={{ top: `${(bottom / 45) * 100}%` }}>0</span>
          {points.map(({ x, y, value, item }, index) => (
            <button
              key={item.period || index}
              type="button"
              onClick={() => onPointClick?.(item.period)}
              className="group absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${x}%`, top: `${(y / 45) * 100}%` }}
              aria-label={`${item.period || index + 1}: ${value}`}
            >
              <span className="absolute bottom-full left-1/2 mb-1 -translate-x-1/2 text-[10px] font-extrabold text-brand-dark">{value}</span>
              <span className="block h-4 w-4 rounded-full border-[3px] bg-white shadow-sm transition group-hover:scale-110" style={{ borderColor: color }} />
            </button>
          ))}
        </div>
        <div className="grid pb-2" style={{ gridTemplateColumns: `repeat(${Math.max(data.length, 1)}, minmax(0, 1fr))` }}>
          {data.map((item, index) => (
            <button key={item.period || index} type="button" onClick={() => onPointClick?.(item.period)} className="truncate text-center text-[10px] font-bold text-brand-dark-soft hover:text-brand-teal">
              {compact ? String(item.period || '').replace('Week ', 'W') : item.period}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function HorizontalRankingChart({ data = [], labelKey = 'label', valueKey = 'value', limit = 6, color = 'bg-brand-teal', valueFormatter = (value) => value, emptyText = 'No data for this period.' }) {
  const rows = [...data]
    .map((item) => ({ ...item, __value: Number(item[valueKey] || 0) }))
    .sort((a, b) => b.__value - a.__value)
    .slice(0, limit);
  const maximum = Math.max(...rows.map((item) => item.__value), 1);

  if (!rows.length) return <p className="py-5 text-center text-xs text-brand-dark-soft">{emptyText}</p>;

  return (
    <div className="space-y-3">
      {rows.map((item, index) => (
        <div key={`${item[labelKey]}-${index}`} className="grid grid-cols-[minmax(100px,1fr)_minmax(130px,2fr)_auto] items-center gap-3">
          <span className="truncate text-xs font-semibold text-brand-dark" title={item[labelKey]}>{item[labelKey]}</span>
          <span className="h-2.5 overflow-hidden rounded-full bg-brand-dark-light/70">
            <span className={`block h-full rounded-full ${item.color || color}`} style={{ width: `${(item.__value / maximum) * 100}%` }} />
          </span>
          <span className="min-w-[44px] text-right text-xs font-extrabold text-brand-dark">{valueFormatter(item.__value, item)}</span>
        </div>
      ))}
    </div>
  );
}

export function StatusSummary({ items = [], total = 0, compact = false }) {
  return (
    <div className={`grid gap-2 ${compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'}`}>
      {items.map((item) => {
        const value = Number(item.value || 0);
        const percent = total > 0 ? Math.round((value / total) * 100) : 0;
        return (
          <div key={item.label} className="rounded-lg border border-brand-dark-light/70 bg-white px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-[10px] font-bold uppercase text-brand-dark-soft">{item.label}</span>
              <span className={`h-2 w-2 shrink-0 rounded-full ${item.color}`} />
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-lg font-extrabold text-brand-dark">{value}</span>
              <span className="text-[10px] font-semibold text-brand-dark-soft">{percent}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DonutBreakdownChart({ items = [], centerLabel = 'Total', compact = false }) {
  const normalizedItems = items.map((item) => ({ ...item, value: Number(item.value || 0) }));
  const total = normalizedItems.reduce((sum, item) => sum + item.value, 0);
  let cursor = 0;
  const segments = normalizedItems.map((item) => {
    const start = total > 0 ? (cursor / total) * 100 : 0;
    cursor += item.value;
    const end = total > 0 ? (cursor / total) * 100 : 0;
    return `${item.color} ${start}% ${end}%`;
  });
  const background = total > 0 ? `conic-gradient(${segments.join(', ')})` : '#e5eeee';

  return (
    <div className={`grid items-center gap-5 ${compact ? 'grid-cols-[120px_minmax(0,1fr)]' : 'grid-cols-[180px_minmax(0,1fr)]'}`}>
      <div className={`relative mx-auto rounded-full ${compact ? 'h-28 w-28' : 'h-40 w-40'}`} style={{ background }} role="img" aria-label={`${centerLabel}: ${total}`}>
        <div className="absolute inset-[22%] flex flex-col items-center justify-center rounded-full bg-white shadow-inner">
          <span className={`${compact ? 'text-xl' : 'text-3xl'} font-extrabold text-brand-dark`}>{total}</span>
          <span className="text-[9px] font-bold uppercase tracking-wide text-brand-dark-soft">{centerLabel}</span>
        </div>
      </div>
      <div className="space-y-3">
        {normalizedItems.map((item) => {
          const percent = total > 0 ? Math.round((item.value / total) * 100) : 0;
          return (
            <div key={item.label} className="flex items-center justify-between gap-3 border-b border-brand-dark-light/60 pb-2 last:border-b-0 last:pb-0">
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: item.color }} />
                <span className="truncate text-xs font-semibold text-brand-dark">{item.label}</span>
              </span>
              <span className="shrink-0 text-xs font-extrabold text-brand-dark">{item.value} <span className="font-semibold text-brand-dark-soft">({percent}%)</span></span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function StaffPerformanceChart({ data = [], compact = false }) {
  if (!data.length) return <p className="py-5 text-center text-xs text-brand-dark-soft">No staff activity for this period.</p>;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-semibold text-brand-dark-soft">
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />Completed</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-red-400" />Cancelled</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-200" />Remaining</span>
        </div>
        {!compact && <span className="text-[10px] font-semibold text-brand-dark-soft">Rate · Assigned</span>}
      </div>
      <div className="space-y-3">
        {data.map((staff) => {
          const total = Number(staff.total || 0);
          const completed = Number(staff.completed || 0);
          const cancelled = Number(staff.cancelled || 0);
          const remaining = Math.max(total - completed - cancelled, 0);
          const completedPct = total > 0 ? (completed / total) * 100 : 0;
          const cancelledPct = total > 0 ? (cancelled / total) * 100 : 0;
          const remainingPct = total > 0 ? (remaining / total) * 100 : 100;
          const rate = total > 0 ? Math.round(completedPct) : 0;

          return (
            <div key={staff.id || staff.email || staff.name} className={`grid items-center gap-3 ${compact ? 'grid-cols-[90px_minmax(100px,1fr)_42px]' : 'grid-cols-[minmax(140px,220px)_minmax(180px,1fr)_90px]'}`}>
              <div className="min-w-0">
                <p className="truncate text-xs font-bold text-brand-dark" title={staff.name}>{staff.name}</p>
                {!compact && <p className="truncate text-[10px] font-medium text-brand-dark-soft">{staff.staff_type === 'front_desk' ? 'Front Desk' : staff.staff_type === 'groomer' ? 'Groomer' : 'Staff'}</p>}
              </div>
              <div className="flex h-4 overflow-hidden rounded-full bg-slate-200" title={`${completed} completed, ${cancelled} cancelled, ${remaining} remaining`}>
                {completed > 0 && <span className="h-full bg-emerald-500" style={{ width: `${completedPct}%` }} />}
                {cancelled > 0 && <span className="h-full bg-red-400" style={{ width: `${cancelledPct}%` }} />}
                {remainingPct > 0 && <span className="h-full bg-slate-200" style={{ width: `${remainingPct}%` }} />}
              </div>
              <div className="text-right">
                <span className="text-xs font-extrabold text-emerald-600">{rate}%</span>
                {!compact && <span className="ml-1 text-[10px] font-semibold text-brand-dark-soft">· {total}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
