import { X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import SelectDropdown from '../reusable-ui/SelectDropdown';

export default function CancellationReasonModal({
  isOpen,
  loading = false,
  title = 'Cancel Appointment',
  description = 'Please provide a reason for cancellation.',
  subject = '',
  reasonOptions = [],
  confirmText = 'Confirm Cancel',
  loadingText = 'Cancelling...',
  confirmClassName = 'rounded-xl bg-brand-teal px-4 py-2.5 text-xs font-medium text-white transition hover:bg-brand-teal-dark focus:outline-none focus:ring-2 focus:ring-brand-teal/40 focus:ring-offset-2 active:scale-[0.98] disabled:opacity-60',
  onClose,
  onConfirm,
}) {
  const [reason, setReason] = useState('');
  const [otherReason, setOtherReason] = useState('');
  const hasReasonOptions = Array.isArray(reasonOptions) && reasonOptions.length > 0;
  const isOtherReason = reason === '__other__';
  const finalReason = isOtherReason ? otherReason.trim() : reason.trim();

  const canSubmit = useMemo(() => finalReason.length > 0 && !loading, [finalReason, loading]);

  if (!isOpen) return null;

  const handleClose = () => {
    if (loading) return;
    setReason('');
    setOtherReason('');
    onClose?.();
  };

  const handleConfirm = () => {
    const normalized = finalReason;
    if (!normalized || loading) return;
    onConfirm?.(normalized);
    setReason('');
    setOtherReason('');
  };

  return createPortal(
    <div className="fixed inset-0 z-[82] flex items-center justify-center p-4 backdrop-blur-sm bg-brand-dark/40 h-[100dvh] min-h-[100dvh] w-screen" onClick={handleClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between bg-brand-teal px-5 py-3.5">
          <div className="min-w-0">
            <h2 className="truncate text-sm font-bold text-white">{title}</h2>
            {subject ? <p className="truncate text-[11px] font-semibold text-white/80">{subject}</p> : null}
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={loading}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 disabled:opacity-60"
            aria-label="Close cancellation modal"
          >
            <X size={16} strokeWidth={2.8} />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4">
          <p className="text-sm font-medium text-brand-dark-soft">{description}</p>
          {hasReasonOptions ? (
            <SelectDropdown
              value={reason}
              onChange={(value) => {
                setReason(value);
                if (value !== '__other__') setOtherReason('');
              }}
              options={[{ value: '', label: 'Select cancellation reason' }, ...reasonOptions]}
              placeholder="Select cancellation reason"
              menuPlacement="up"
            />
          ) : (
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
              placeholder="Type cancellation reason..."
              className="w-full resize-none rounded-xl border border-brand-teal/30 bg-white px-3 py-2 text-sm text-brand-dark outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20"
            />
          )}
          {hasReasonOptions && isOtherReason && (
            <textarea
              value={otherReason}
              onChange={(event) => setOtherReason(event.target.value)}
              rows={3}
              maxLength={500}
              placeholder="Please specify the cancellation reason..."
              autoFocus
              className="w-full resize-none rounded-xl border border-brand-teal/30 bg-white px-3 py-2 text-sm text-brand-dark outline-none transition focus:border-brand-teal focus:ring-2 focus:ring-brand-teal/20"
            />
          )}
        </div>

        <div className="flex justify-end border-t border-brand-teal/20 px-5 py-4">
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canSubmit}
            className={confirmClassName}
          >
            {loading ? loadingText : confirmText}
          </button>
        </div>
      </div>
    </div>
  , document.body);
}
