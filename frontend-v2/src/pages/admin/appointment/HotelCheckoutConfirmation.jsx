import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { apiFetch } from '../../../api/apiClient';

const money = (value) => `PHP ${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateTime = (value) => value ? new Intl.DateTimeFormat('en-PH', {
  timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short',
}).format(new Date(value)) : '-';

export default function HotelCheckoutConfirmation({ appointmentId, actualCheckin, actualCheckout, initialPetSize, species, onCancel, onConfirm, saving = false }) {
  const [petSize, setPetSize] = useState(initialPetSize || '');
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [method, setMethod] = useState('');
  const [reference, setReference] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const cat = /cat|feline/i.test(String(species || ''));
  const sizeOptions = cat ? ['CAT', 'KITTEN'] : ['Small', 'Medium', 'Large', 'XLarge'];

  useEffect(() => {
    let active = true;
    setLoading(true);
    setPreview(null);
    setError('');
    apiFetch(`/api/appointments/${appointmentId}/hotel-checkout-preview`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actual_check_out_at: actualCheckout, ...(actualCheckin ? { actual_check_in_at: actualCheckin } : {}), ...(petSize ? { pet_size: petSize } : {}) }),
    }).then(async (response) => {
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || 'Unable to calculate checkout.');
      if (active) setPreview(payload.data);
    }).catch((cause) => { if (active) setError(cause?.message || 'Unable to calculate checkout.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [appointmentId, actualCheckin, actualCheckout, petSize]);

  const submit = async () => {
    if (!preview || submitting || saving) return;
    if (preview.amount > 0 && (!method || !confirmed || (method !== 'cash' && !reference.trim()))) {
      setError('Confirm the received payment, method, and electronic reference before checkout.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      if (petSize && petSize !== initialPetSize) {
        const response = await apiFetch(`/api/appointments/${appointmentId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pet_size: petSize }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.message || 'Unable to save the confirmed pet size.');
      }
      const result = await onConfirm({
        ...(preview.amount > 0 ? {
          extension_payment_method: method,
          extension_payment_amount: preview.amount,
          extension_payment_reference: reference.trim() || undefined,
          extension_payment_confirmed: confirmed,
        } : {}),
      });
      if (result === false) throw new Error('Unable to complete Hotel Suite checkout.');
    } catch (cause) {
      setError(cause?.message || 'Unable to complete Hotel Suite checkout.');
    } finally {
      setSubmitting(false);
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-brand-dark/45 p-3" onClick={() => !submitting && onCancel()}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between bg-brand-teal px-5 py-4 text-white">
          <h3 className="text-sm font-bold">Hotel Suite Checkout</h3>
          <button type="button" onClick={onCancel} disabled={submitting} aria-label="Close checkout summary" className="rounded-full p-1 hover:bg-white/20"><X size={18} /></button>
        </div>
        <div className="max-h-[70vh] space-y-3 overflow-y-auto p-5 text-sm text-brand-dark">
          {!sizeOptions.includes(initialPetSize) && <label className="block text-xs font-semibold">Confirm Pet Size
            <select value={petSize} onChange={(event) => setPetSize(event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-brand-dark-light px-3 text-sm">
              <option value="">Select size</option>
              {sizeOptions.map((size) => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>}
          {loading ? <p>Calculating extension charge...</p> : preview && <>
            <div className="grid grid-cols-2 gap-2 rounded-xl border border-brand-dark-light p-3 text-xs">
              <span>Pet</span><strong className="text-right">{preview.pet_name || '-'}</strong>
              <span>Pet Size</span><strong className="text-right">{preview.pet_size || '-'}</strong>
              <span>Scheduled Checkout</span><strong className="text-right">{dateTime(preview.scheduled_checkout_at)}</strong>
              <span>Actual Checkout</span><strong className="text-right">{dateTime(preview.actual_checkout_at)}</strong>
              <span>Extra Time</span><strong className="text-right">{preview.extra_minutes} minute(s)</strong>
              <span>Billable Hours</span><strong className="text-right">{preview.billable_hours}</strong>
              <span>Daycare Hourly Rate</span><strong className="text-right">{money(preview.hourly_rate)}</strong>
              <span>Extension Charge</span><strong className="text-right">{money(preview.amount)}</strong>
              <span>Original Hotel Balance</span><strong className="text-right">{money(preview.original_hotel_balance)}</strong>
              <span className="border-t pt-2 font-semibold">Total Amount Due</span><strong className="border-t pt-2 text-right text-brand-teal-dark">{money(preview.total_amount_due)}</strong>
            </div>
            {preview.amount > 0 ? <div className="space-y-3 rounded-xl border border-brand-teal/20 p-3">
              <p className="text-xs font-semibold">Extension payment received: {money(preview.amount)}</p>
              <select value={method} onChange={(event) => { setMethod(event.target.value); setReference(''); }} aria-label="Extension payment method" className="h-10 w-full rounded-lg border border-brand-dark-light px-3 text-sm">
                <option value="">Select payment method</option><option value="cash">Cash</option><option value="e_wallet">E-Wallet</option><option value="bank_transfer">Bank Transfer</option>
              </select>
              {method && method !== 'cash' && <input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Payment reference" aria-label="Extension payment reference" maxLength={100} className="h-10 w-full rounded-lg border border-brand-dark-light px-3 text-sm" />}
              <label className="flex items-start gap-2 text-xs"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} className="mt-0.5 accent-brand-teal" />I confirm the extension payment was received and recorded.</label>
            </div> : <p className="rounded-lg bg-brand-surface px-3 py-2 text-xs font-semibold">No extension charge.</p>}
          </>}
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 border-t border-brand-dark-light px-5 py-3">
          <button type="button" onClick={onCancel} disabled={submitting} className="rounded-lg border px-4 py-2 text-sm">Cancel</button>
          <button type="button" onClick={submit} disabled={loading || !preview || submitting || saving} className="rounded-lg bg-brand-teal px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{submitting ? 'Saving...' : 'Confirm Checkout'}</button>
        </div>
      </div>
    </div>, document.body
  );
}
