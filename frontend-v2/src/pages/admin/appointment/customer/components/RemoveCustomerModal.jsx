import { X } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import SelectDropdown from '../../../../../components/reusable-ui/SelectDropdown';

const CUSTOMER_REASONS = [
  { value: 'no_activity', label: 'No Activity / Inactive Account' },
  { value: 'duplicate_account', label: 'Duplicate Account' },
  { value: 'customer_request', label: 'Customer Request' },
  { value: 'privacy_request', label: 'Privacy / Data Request' },
  { value: 'policy_violation', label: 'Policy Violation' },
  { value: 'other', label: 'Other (specify)' },
];

export default function RemoveCustomerModal({ owner, onClose, onDeactivate, onDelete, action }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState('');
  const [reason, setReason] = useState('');

  const wrap = async (callback) => {
    const finalReason = selected === 'other' ? reason.trim() : (selected ? CUSTOMER_REASONS.find((o) => o.value === selected)?.label : '');
    if (!finalReason) {
      setError(selected === 'other' ? 'Please specify the reason.' : 'Reason is required.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      await callback(finalReason);
    } catch (exception) {
      setError(exception.message || 'An error occurred.');
    } finally {
      setBusy(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 backdrop-blur-sm bg-brand-dark/40 h-[100dvh] min-h-[100dvh] w-screen" onClick={onClose}>
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between bg-brand-teal px-5 py-3.5">
          <h2 className="text-sm font-bold text-white">Remove Customer</h2>
          <button type="button" onClick={onClose} className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25">
            <X size={14} />
          </button>
        </div>
        <div className="h-1 bg-white" />

        <div className="space-y-3 p-5">
          <p className="text-sm font-semibold text-brand-dark">
            What would you like to do with <span className="text-brand-teal-dark">{owner?.fullName}</span>?
          </p>
          <p className="text-xs text-brand-dark-soft">
            <span className="font-semibold text-brand-dark">Deactivate</span> - disables the account but keeps all records.
            <br />
            <span className="font-semibold text-brand-teal-dark">Delete</span> - permanently removes the customer and all their data.
          </p>

          <div>
            <label className="mb-1 block text-xs font-bold text-brand-dark">
              Reason <span className="text-red-500">*</span>
            </label>
            <SelectDropdown
              value={selected}
              onChange={(v) => { setSelected(v); setReason(''); if (error) setError(''); }}
              options={[{ value: '', label: 'Select reason' }, ...CUSTOMER_REASONS]}
              placeholder="Select reason"
            />
            {selected === 'other' && (
              <textarea
                value={reason}
                onChange={(e) => { setReason(e.target.value); if (error) setError(''); }}
                rows={3}
                placeholder="Please specify..."
                className="mt-2 w-full resize-none rounded-xl border border-brand-teal/30 bg-white px-3 py-2 text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
              />
            )}
          </div>

          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex gap-2 border-t border-brand-dark-light px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="flex-1 rounded-xl border border-brand-dark-light py-2 text-sm font-medium text-brand-dark-soft hover:bg-brand-dark-light transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          {(!action || action === 'deactivate') && (
            <button
              type="button"
              disabled={busy}
              onClick={() => wrap(onDeactivate)}
              className="flex-1 rounded-xl bg-brand-teal-dark px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy ? '...' : 'Deactivate'}
            </button>
          )}
          {(!action || action === 'delete') && (
            <button
              type="button"
              disabled={busy}
              onClick={() => wrap(onDelete)}
              className="flex-1 rounded-xl bg-red-500 px-4 py-2 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60"
            >
              {busy ? '...' : 'Delete'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
