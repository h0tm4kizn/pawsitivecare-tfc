import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import useBodyScrollLock from '../../../hooks/useBodyScrollLock';

export default function LogoutConfirmModal({ isOpen, onClose, onConfirm }) {
  useBodyScrollLock(isOpen);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[260] flex items-center justify-center p-4 backdrop-blur-sm bg-brand-dark/40 h-[100dvh] min-h-[100dvh] w-screen">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between bg-brand-teal px-5 py-3.5">
          <h3 className="text-sm font-bold text-white">Confirm Logout</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white/15 p-1.5 text-white hover:bg-white/25"
            aria-label="Close logout confirmation"
          >
            <X size={16} strokeWidth={2.8} />
          </button>
        </div>
        <div className="px-5 py-5">
          <p className="text-sm font-semibold text-brand-dark">Are you sure you want to log out?</p>
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-brand-dark-light px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-brand-dark-light py-2.5 text-sm font-medium text-brand-dark-soft hover:bg-brand-dark-light transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="rounded-xl bg-red-500 py-2.5 text-sm font-bold text-white hover:bg-red-600"
          >
            Logout
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
