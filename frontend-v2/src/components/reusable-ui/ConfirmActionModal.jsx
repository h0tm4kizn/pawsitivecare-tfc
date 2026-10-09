import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

export default function ConfirmActionModal({
  isOpen,
  title = 'Confirm Action',
  message = 'Are you sure?',
  confirmText = 'Yes',
  cancelText = 'No',
  onConfirm,
  onCancel,
  confirmTone = 'danger',
  isConfirming = false,
}) {
  if (!isOpen) return null;

  const confirmClass =
    confirmTone === 'danger'
      ? 'bg-rose-500 hover:brightness-95'
      : confirmTone === 'warning'
        ? 'bg-brand-orange hover:bg-brand-orange-dark'
        : 'bg-brand-teal hover:bg-brand-teal-dark';

  return createPortal(
    <div className="fixed inset-0 z-[280] flex items-center justify-center p-4 backdrop-blur-sm bg-brand-dark/40 h-[100dvh] min-h-[100dvh] w-screen">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-brand-teal px-5 py-3.5">
          <h3 className="text-sm font-bold text-white">{title}</h3>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full bg-white/15 p-1.5 text-white hover:bg-white/25"
            aria-label="Close confirmation modal"
          >
            <X size={16} strokeWidth={2.8} />
          </button>
        </div>
        <div className="px-5 py-5">
          <p className="text-sm font-semibold text-brand-dark">{message}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-brand-dark-light px-5 py-4">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-brand-dark-light py-2.5 text-sm font-medium text-brand-dark-soft hover:bg-brand-dark-light transition-colors"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isConfirming}
            className={`rounded-xl py-2.5 text-sm font-bold text-white disabled:opacity-60 ${confirmClass}`}
          >
            {isConfirming ? 'Please wait...' : confirmText}
          </button>
        </div>
      </div>
    </div>
  , document.body);
}
