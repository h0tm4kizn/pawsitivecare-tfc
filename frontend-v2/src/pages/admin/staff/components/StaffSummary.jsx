import StaffQRCode from './StaffQRCode';

export default function StaffSummary({ title = 'Preview', name = 'Staff', subtitle = 'Staff account preview', rows = [], staffId = '', staffUuid = '' }) {
  return (
    <div className="hidden border-l border-brand-dark-light px-5 py-5 lg:flex lg:overflow-y-auto">
      <div className="flex h-full w-full flex-col gap-4 pb-10">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-dark-soft">{title}</p>
        <div className="flex min-w-0 flex-col items-center gap-3 text-center">
          <StaffQRCode staffId={staffId} staffName={name} staffUuid={staffUuid} />
          <div className="min-w-0 max-w-full">
            <p className="text-xs text-brand-dark-soft">{subtitle}</p>
          </div>
        </div>
        <div className="space-y-3 text-xs">
          {rows.map(([label, value]) => (
            <div key={label}>
              <p className="font-semibold text-brand-dark-soft">{label}</p>
              <p className={`mt-0.5 break-words font-semibold leading-snug text-brand-dark ${label.toLowerCase().includes('email') ? 'break-all' : ''}`}>
                {String(value || '').trim() || '-'}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
