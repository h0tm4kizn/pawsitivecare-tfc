import { formatReference } from '../../../../../utils/recordFormatters';

export default function CustomerPetHistoryView({
  loading,
  error,
  history = [],
  expandedAptId,
  onToggleExpand,
  onDownloadPdf,
  DetailItem,
}) {
  return (
    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2 no-scrollbar">
      {loading && (
        <p className="py-8 text-center text-sm font-semibold text-brand-dark-soft">Loading appointment history...</p>
      )}
      {!loading && error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{error}</p>
      )}
      {!loading && !error && history.length === 0 && (
        <p className="rounded-xl border border-brand-dark-light bg-white px-4 py-3 text-sm text-brand-dark-soft">
          No appointment history for this pet yet.
        </p>
      )}
      {!loading && !error && history.map((apt) => {
        const aptKey = apt.id || apt.dateIso || apt.date;
        const isExp = expandedAptId === aptKey;
        return (
          <div key={aptKey} className="rounded-lg border border-brand-dark-light overflow-hidden">
            <button
              type="button"
              onClick={() => onToggleExpand(isExp ? null : aptKey)}
              className="w-full flex items-center justify-between gap-3 px-5 py-3 bg-white hover:bg-brand-dark/5 transition-colors text-left"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-brand-dark truncate">{apt.service || '-'}</p>
                <p className="text-xs text-brand-dark-soft">{apt.date || '-'}{apt.time ? ` | ${apt.time}` : ''}</p>
              </div>
              <i className={`fa-solid fa-chevron-down text-brand-teal text-sm transition-transform shrink-0 ${isExp ? 'rotate-180' : ''}`} />
            </button>
            {isExp && (
              <div className="px-5 py-4 border-t border-brand-dark-light bg-white">
                <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 text-xs">
                  <DetailItem label="Service"              value={apt.service || '-'} />
                  <DetailItem label="Service ID"           value={apt.serviceId || '-'} />
                  <DetailItem label="Date"                 value={apt.date || '-'} />
                  <DetailItem label="Time"                 value={apt.time || '-'} />
                  <DetailItem label="Handled By"           value={apt.handledBy || '-'} />
                  <DetailItem label="Reservation Ref ID"   value={formatReference(apt.paymentReference || '-')} span2 />
                  <DetailItem label="Special Instructions" value={apt.specialInstructions || 'None'} span2 />
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    disabled={!apt.downloadAllowed}
                    onClick={() => onDownloadPdf(apt)}
                    className="rounded-lg border border-brand-teal px-3 py-1.5 text-[11px] font-bold text-brand-teal hover:bg-brand-teal hover:text-white transition-colors"
                  >
                    Download PDF
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
