import { X } from 'lucide-react';

export default function DeletePackageModal({ pkg, onClose, onConfirm, isDeleting }) {
  if (!pkg) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 backdrop-blur-sm bg-brand-dark/40 h-[100dvh] min-h-[100dvh] w-screen"
      onClick={() => !isDeleting && onClose()}
    >
      <div
        className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between bg-red-500 px-5 py-3.5">
          <h2 className="text-sm font-bold text-white">Delete Package</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 disabled:opacity-50"
          >
            <X size={15} strokeWidth={2.8} />
          </button>
        </div>
        <div className="h-1 bg-white" />
        <div className="px-5 py-5">
          <p className="text-sm text-brand-dark">
            Permanently delete <strong>{pkg.name}</strong>? This cannot be undone.
          </p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="flex-1 rounded-xl border border-brand-dark-light py-2 text-sm font-medium text-brand-dark-soft hover:bg-brand-dark-light transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 rounded-xl bg-red-500 py-2 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-50"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
