import { Download, FileText, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import {
  fmtDateShort,
  fmtDateTime,
  humanize,
  labelFromBool,
  toBool,
} from '../customerViewUtils';

export default function CustomerPetAssessmentView({
  loading,
  error,
  records = [],
  expandedAssessId,
  onToggleExpand,
  onDownloadPdf,
  DetailItem,
}) {
  const [downloadingAssessId, setDownloadingAssessId] = useState(null);
  const [downloadErrors, setDownloadErrors] = useState({});

  const handleDownload = async (record) => {
    if (!record?.id || downloadingAssessId !== null) return;
    setDownloadingAssessId(record.id);
    setDownloadErrors((errors) => ({ ...errors, [record.id]: '' }));
    try {
      await onDownloadPdf(record);
    } catch (error) {
      setDownloadErrors((errors) => ({
        ...errors,
        [record.id]: error?.message || 'Unable to download this assessment PDF. Please try again.',
      }));
    } finally {
      setDownloadingAssessId(null);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2 no-scrollbar">
      {loading && (
        <p className="py-8 text-center text-sm font-semibold text-brand-dark-soft">Loading assessment records...</p>
      )}
      {!loading && error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{error}</p>
      )}
      {!loading && !error && records.length === 0 && (
        <div className="py-12 text-center">
          <FileText size={36} className="mx-auto text-brand-dark-soft/30" />
          <p className="mt-2 text-sm font-semibold text-brand-dark-soft">No saved assessment forms for this pet.</p>
        </div>
      )}
      {!loading && !error && [...records].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map((record) => {
        const isExp = expandedAssessId === record.id;
        const serviceName = record.service_name || record.service?.name || record.appointment?.service || null;
        return (
          <div key={record.id} className="rounded-lg border border-brand-dark-light overflow-hidden">
            <button
              type="button"
              onClick={() => onToggleExpand(isExp ? null : record.id)}
              className="w-full flex items-center justify-between gap-3 px-5 py-3 bg-white hover:bg-brand-dark/5 transition-colors text-left"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-brand-dark truncate">{fmtDateTime(record.created_at)}</p>
                <p className="text-xs text-brand-dark-soft">
                  {serviceName ? `Service: ${serviceName}` : `Vacc: ${labelFromBool(record.is_vaccinated)} | Ticks/Flea: ${toBool(record.has_ticks) || toBool(record.has_flea) ? 'Alert' : 'None'}`}
                </p>
              </div>
              <i className={`fa-solid fa-chevron-down text-brand-teal text-sm transition-transform shrink-0 ${isExp ? 'rotate-180' : ''}`} />
            </button>
            {isExp && (
              <div className="px-5 py-4 border-t border-brand-dark-light bg-white">
                <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 text-xs">
                  <DetailItem label="Submitted"           value={fmtDateTime(record.created_at)} />
                  <DetailItem label="Vaccinated"          value={labelFromBool(record.is_vaccinated)} />
                  <DetailItem label="Vaccine Date"        value={fmtDateShort(record.vaccine_date)} />
                  <DetailItem label="Friendly"            value={humanize(record.is_friendly)} />
                  <DetailItem label="Treat Preference"    value={humanize(record.treat_preference)} />
                  <DetailItem label="Allergies"           value={record.allergies || '-'} />
                  <DetailItem label="Ticks"               value={labelFromBool(record.has_ticks)} />
                  <DetailItem label="Flea"                value={labelFromBool(record.has_flea)} />
                  <DetailItem label="Wound"               value={labelFromBool(record.has_wound)} />
                  <DetailItem label="Mange"               value={labelFromBool(record.has_mange)} />
                  <DetailItem label="Medical Conditions"  value={record.medical_conditions || '-'} span2 />
                  <DetailItem label="Declaration"         value={labelFromBool(record.declaration_accepted)} />
                </div>
                <div className="mt-3 flex flex-col items-end gap-1.5">
                  <button
                    type="button"
                    disabled={!record?.id || downloadingAssessId !== null}
                    onClick={() => handleDownload(record)}
                    aria-busy={downloadingAssessId === record.id}
                    className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-brand-teal px-3 py-2 text-xs font-bold text-brand-teal transition-colors hover:bg-brand-teal hover:text-white disabled:cursor-wait disabled:opacity-60"
                  >
                    {downloadingAssessId === record.id
                      ? <LoaderCircle size={14} className="animate-spin" />
                      : <Download size={14} />}
                    {downloadingAssessId === record.id ? 'Generating PDF...' : 'Download PDF'}
                  </button>
                  {downloadErrors[record.id] && (
                    <p role="alert" className="text-right text-xs font-semibold text-red-600">
                      {downloadErrors[record.id]}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
