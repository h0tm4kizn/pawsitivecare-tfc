import { useState } from 'react';
import { Download, FileText, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { apiFetch } from '../../../api/apiClient';

export default function AssessmentFormTemplateDownload() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const download = async (type) => {
    setLoading(true);
    setError('');
    try {
      const { downloadBlankPetAssessmentPdf, downloadGroomingAssessmentPdf } = await import('../../../utils/petAssessmentBlankPdf');
      if (type === 'grooming') {
        let services = [];
        for (const endpoint of ['/api/admin/services', '/api/services', '/api/services/catalog']) {
          const response = await apiFetch(endpoint);
          if (!response.ok) continue;
          const json = await response.json().catch(() => ({}));
          services = Array.isArray(json?.data?.data)
            ? json.data.data
            : Array.isArray(json?.data)
              ? json.data
              : Array.isArray(json?.services) ? json.services : [];
          if (services.length) break;
        }
        const groomingPackages = services.filter((service) => String(service?.category || '').toLowerCase().includes('groom'));
        await downloadGroomingAssessmentPdf({ groomingPackages });
      } else {
        await downloadBlankPetAssessmentPdf();
      }
      setOpen(false);
    } catch (downloadError) {
      setError(downloadError?.message || 'Unable to download the assessment form.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-brand-teal/30 bg-brand-teal/10 px-4 py-3 text-sm font-bold text-brand-teal-dark transition-colors hover:bg-brand-teal hover:text-white">
        <FileText size={16} aria-hidden="true" />
        Download Assessment Form
      </button>
      {open && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[320] flex h-[100dvh] min-h-[100dvh] w-screen items-center justify-center bg-brand-dark/40 p-4 backdrop-blur-sm" onClick={() => !loading && setOpen(false)}>
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div><h2 className="text-lg font-extrabold text-brand-dark">Select Assessment Form</h2><p className="mt-1 text-sm text-brand-dark-soft">Choose the service template to download.</p></div>
              <button type="button" disabled={loading} onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-brand-dark-soft hover:bg-brand-dark-light/40 disabled:opacity-50" aria-label="Close"><X size={18} /></button>
            </div>
            {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</p>}
            <div className="mt-5 grid gap-3">
              <button type="button" disabled={loading} onClick={() => download('daycare-hotel')} className="rounded-xl border border-brand-orange/45 bg-white px-4 py-4 text-left transition-colors hover:bg-brand-orange/5 disabled:cursor-wait disabled:opacity-60"><p className="font-extrabold text-brand-orange">Daycare &amp; Hotel</p><p className="mt-1 text-xs text-brand-dark-soft">Vaccines, health checks, policies, and stay details.</p></button>
              <button type="button" disabled={loading} onClick={() => download('grooming')} className="rounded-xl border border-brand-grooming/45 bg-white px-4 py-4 text-left transition-colors hover:bg-brand-grooming/5 disabled:cursor-wait disabled:opacity-60"><p className="font-extrabold text-brand-grooming">Grooming</p><p className="mt-1 text-xs text-brand-dark-soft">Grooming packages and the physical grooming assessment.</p></button>
            </div>
            {loading && <p className="mt-4 flex items-center justify-center gap-2 text-xs font-semibold text-brand-dark-soft"><Download size={14} className="animate-bounce" /> Preparing form…</p>}
          </div>
        </div>, document.body,
      )}
    </>
  );
}
