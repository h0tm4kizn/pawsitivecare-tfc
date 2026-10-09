import { Download, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiFetch } from '../../../api/apiClient';

export default function PaymentProofPreviewModal({ isOpen, appointmentId, bookingId, onClose }) {
  const [proofUrl, setProofUrl] = useState('');
  const [proofType, setProofType] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  useEffect(() => {
    if (!isOpen || !appointmentId) return undefined;
    let active = true;
    let objectUrl = null;
    setIsLoading(true);
    setDownloadError('');
    setProofUrl('');

    apiFetch(`/api/appointments/${encodeURIComponent(appointmentId)}/deposit-proof`, { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load this proof.');
        const blob = await response.blob();
        if (!blob.size) throw new Error('Payment proof is empty.');
        objectUrl = URL.createObjectURL(blob);
        if (active) {
          setProofType(response.headers.get('Content-Type') || blob.type || '');
          setProofUrl(objectUrl);
        }
      })
      .catch(() => {
        if (active) setDownloadError('Unable to load this proof. Please try again.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [appointmentId, isOpen]);

  if (!isOpen) return null;

  const isPdf = proofType.toLowerCase().includes('application/pdf');
  const fileExtension = isPdf ? 'pdf' : proofType.toLowerCase().includes('png') ? 'png' : proofType.toLowerCase().includes('webp') ? 'webp' : 'jpg';
  const downloadProof = () => {
    if (!proofUrl) return;
    const anchor = document.createElement('a');
    anchor.href = proofUrl;
    anchor.download = `hotel-payment-proof-${String(bookingId || 'booking').replace(/[^a-zA-Z0-9_-]/g, '')}.${fileExtension}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  };

  return createPortal(
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-brand-dark/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 border-b border-brand-dark-light px-4 py-3">
          <div>
            <p className="text-sm font-extrabold text-brand-dark">Proof of Payment</p>
            <p className="text-[10px] text-brand-dark-soft">Hotel booking {bookingId || '-'}</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={downloadProof} disabled={!proofUrl} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand-teal px-3 text-[11px] font-bold text-white transition hover:bg-brand-teal-dark disabled:opacity-60">
              <Download size={14} /> Download
            </button>
            <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-brand-dark-light bg-white text-brand-dark transition hover:bg-brand-surface" aria-label="Close payment proof preview" title="Close">
              <X size={16} />
            </button>
          </div>
        </div>
        {isLoading && <p role="status" className="bg-brand-surface px-4 py-2 text-xs font-semibold text-brand-dark-soft">Loading payment proof…</p>}
        {downloadError && <p role="alert" className="bg-red-50 px-4 py-2 text-xs font-semibold text-red-600">{downloadError}</p>}
        <div className="min-h-0 flex-1 overflow-auto bg-brand-surface p-3">
          {!proofUrl ? (
            <p className="py-10 text-center text-xs font-semibold text-brand-dark-soft">{isLoading ? 'Loading proof…' : 'Proof unavailable.'}</p>
          ) : isPdf ? (
            <iframe src={proofUrl} title="Proof of payment" className="h-[75vh] w-full rounded-lg bg-white" />
          ) : (
            <img src={proofUrl} alt="Proof of payment" className="mx-auto max-h-[75vh] max-w-full rounded-lg object-contain shadow" />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
