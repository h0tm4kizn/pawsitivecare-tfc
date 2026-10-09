import { EyeOff, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { DEACTIVATION_REASONS, DELETION_REASONS } from '../../../../constants/staffActionReasons';
import SelectDropdown from '../../../../components/reusable-ui/SelectDropdown';

export default function ActionConfirmModal({ staff, action, onClose, onConfirm }) {
  const isDelete = action === 'delete';
  const actionLabel = isDelete ? 'Delete' : 'Deactivate';

  return (
    <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 backdrop-blur-sm bg-brand-dark/40 h-[100dvh] min-h-[100dvh] w-screen" onClick={onClose}>
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between bg-brand-teal px-5 py-3.5">
          <h2 className="text-sm font-bold text-white">{isDelete ? 'Delete Staff' : 'Deactivate Staff'}</h2>
          <button type="button" onClick={onClose} className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25">
            <X size={14} />
          </button>
        </div>
        <div className="h-1 bg-white" />
        <ActionReasonForm
          staff={staff}
          isDelete={isDelete}
          actionLabel={actionLabel}
          onClose={onClose}
          onConfirm={(reason) => onConfirm({ reason, action })}
        />
      </div>
    </div>
  );
}

function ActionReasonForm({ staff, isDelete, actionLabel, onClose, onConfirm }) {
  const [processing, setProcessing] = useState(false);
  const [reason, setReason] = useState('');
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    const chosen = selected || reason.trim();
    if (!chosen) {
      setError(`Reason is required to ${actionLabel.toLowerCase()} this staff.`);
      return;
    }
    setProcessing(true);
    setError('');
    try {
      // If a preset option was chosen, send its human label; otherwise send freeform text
      let payloadReason = chosen;
      if (selected && selected !== 'other') {
        const list = isDelete ? DELETION_REASONS : DEACTIVATION_REASONS;
        const found = list.find((o) => o.value === selected);
        payloadReason = found ? found.label : selected;
      } else if (selected === 'other') {
        payloadReason = reason.trim();
      }
      await onConfirm(payloadReason);
    } catch (e) {
      setError(e?.message || `Failed to ${actionLabel.toLowerCase()} staff.`);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="px-5 py-5">
      <div className={`mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full ${isDelete ? 'bg-red-100 text-red-500' : 'bg-white text-brand-teal-dark'}`}>
        {isDelete ? <Trash2 size={22} /> : <EyeOff size={22} />}
      </div>
      <p className="text-center text-sm font-bold text-brand-dark">
        {isDelete ? `Remove ${staff?.name}?` : `Deactivate ${staff?.name}?`}
      </p>
      <p className="mt-1 text-center text-xs text-brand-dark-soft">
        {isDelete ? 'This will permanently delete the account. This cannot be undone.' : 'Staff account access will be disabled until reactivated.'}
      </p>

      <div className="mt-4">
        <label className="mb-1 block text-xs font-bold text-brand-dark">
          Reason <span className="text-red-500">*</span>
        </label>
        <SelectDropdown
          value={selected}
          onChange={(v) => { setSelected(v); if (error) setError(''); }}
          options={[{ value: '', label: 'Select reason' }, ...(isDelete ? DELETION_REASONS : DEACTIVATION_REASONS)]}
          placeholder="Select reason"
        />

        {(selected === 'other') && (
          <textarea
            value={reason}
            onChange={(event) => { setReason(event.target.value); if (error) setError(''); }}
            rows={3}
            placeholder={`Write reason for ${actionLabel.toLowerCase()}...`}
            className="mt-3 w-full resize-none rounded-xl border border-brand-teal/30 bg-white px-3 py-2 text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
          />
        )}
        {error && <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
      </div>

      <div className="mt-5 flex gap-3">
        <button type="button" onClick={onClose} className="w-full rounded-xl border border-brand-dark-light px-4 py-2 text-sm font-medium text-brand-dark-soft hover:bg-brand-dark-light transition-colors">
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={processing}
          className={`w-full rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-60 ${isDelete ? 'bg-red-500 hover:bg-red-600' : 'bg-brand-teal hover:bg-brand-teal-dark'}`}
        >
          {processing ? `${actionLabel}...` : actionLabel}
        </button>
      </div>
    </div>
  );
}
