import { AlertTriangle, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import InventoryProductImage from './InventoryProductImage';

export default function InventoryDeleteModal({ item, deleting = false, error = '', onClose, onConfirm }) {
  if (!item) return null;

  const modal = (
    <div className="fixed inset-0 z-[85] flex h-[100dvh] min-h-[100dvh] w-screen items-center justify-center bg-brand-dark/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between bg-red-500 px-6 py-4">
          <h2 className="text-base font-extrabold text-white">Delete Supply</h2>
          <button type="button" onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25">
            <X size={16} strokeWidth={2.8} />
          </button>
        </div>
        <div className="h-1 bg-white" />

        <div className="space-y-4 px-6 py-5">
          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

          <div className="flex items-start gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
              <AlertTriangle size={18} strokeWidth={2.6} />
            </div>
            <div>
              <p className="text-sm font-extrabold text-brand-dark">This will remove the product from supplies.</p>
              <p className="mt-1 text-xs leading-relaxed text-brand-dark-soft">The product image will also be removed from supply storage when possible.</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-brand-teal/15 bg-white p-3">
            <InventoryProductImage item={item} />
            <div className="min-w-0">
              <p className="truncate text-sm font-extrabold text-brand-dark">{item.item_name}</p>
              <p className="mt-0.5 text-[11px] font-bold text-brand-teal-dark">{item.item_id}</p>
              <p className="mt-1 text-xs text-brand-dark-soft">{item.category}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-brand-dark-light px-6 py-4">
          <button type="button" onClick={onClose} disabled={deleting} className="rounded-xl border border-brand-dark-light px-5 py-2.5 text-sm font-medium text-brand-dark-soft transition-colors hover:bg-brand-dark-light disabled:opacity-60">
            Cancel
          </button>
          <button type="button" onClick={() => onConfirm?.(item)} disabled={deleting} className="rounded-xl bg-red-500 px-6 py-2.5 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-60">
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
  return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal;
}
