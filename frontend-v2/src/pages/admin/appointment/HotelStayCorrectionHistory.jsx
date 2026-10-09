import { useEffect, useState } from 'react';
import { apiFetch } from '../../../api/apiClient';

const formatTimestamp = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
};

export default function HotelStayCorrectionHistory({ appointmentId }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (!appointmentId) {
      setEntries([]);
      setLoading(false);
      return () => { active = false; };
    }

    setLoading(true);
    setError('');
    apiFetch(`/api/appointments/${appointmentId}/history`)
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.message || 'Unable to load appointment history.');
        const rows = Array.isArray(payload?.data) ? payload.data : [];
        if (active) setEntries(rows);
      })
      .catch((fetchError) => {
        if (active) setError(fetchError?.message || 'Unable to load appointment history.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [appointmentId]);

  if (loading) return <p className="text-xs text-brand-dark-soft">Loading appointment history...</p>;
  if (error) return <p role="alert" className="text-xs font-semibold text-red-700">{error}</p>;
  if (!entries.length) return null;

  return (
    <section aria-label="Appointment history" className="rounded-xl border border-brand-teal/20 bg-white p-4">
      <h3 className="mb-3 text-sm font-bold text-brand-teal-dark">Appointment History</h3>
      <div className="space-y-4">
        {entries.map((entry) => {
          const details = entry?.metadata || {};
          const isCorrection = entry.action === 'hotel_missed_checkin_completed';
          const isExtension = entry.action === 'hotel_extension_paid';
          return (
            <article key={entry.id} className="rounded-lg border border-brand-dark-light bg-brand-surface/40 p-3">
              <h4 className="text-xs font-extrabold text-brand-dark">
                {details.description || (isCorrection ? 'Hotel Stay Completed — Missed Check-In Correction' : 'Hotel Stay Checked Out')}
              </h4>
              <dl className="mt-3 grid gap-x-4 gap-y-2 text-xs sm:grid-cols-2">
                <div><dt className="font-semibold text-brand-dark-soft">Appointment ID</dt><dd className="mt-0.5 break-all text-brand-dark">{details.appointment_code || details.appointment_id || '-'}</dd></div>
                {!isExtension && <div><dt className="font-semibold text-brand-dark-soft">Status</dt><dd className="mt-0.5 text-brand-dark">{details.previous_status || '-'} → {details.new_status || '-'}</dd></div>}
                {isCorrection && <div><dt className="font-semibold text-brand-dark-soft">Scheduled Check-In</dt><dd className="mt-0.5 text-brand-dark">{formatTimestamp(details.scheduled_check_in_at)}</dd></div>}
                <div><dt className="font-semibold text-brand-dark-soft">Scheduled Check-Out</dt><dd className="mt-0.5 text-brand-dark">{formatTimestamp(details.scheduled_check_out_at)}</dd></div>
                {isCorrection && <div><dt className="font-semibold text-brand-dark-soft">Recorded Actual Check-In</dt><dd className="mt-0.5 text-brand-dark">{formatTimestamp(details.actual_check_in_at)}</dd></div>}
                <div><dt className="font-semibold text-brand-dark-soft">Recorded Actual Check-Out</dt><dd className="mt-0.5 text-brand-dark">{formatTimestamp(details.actual_check_out_at)}</dd></div>
                {isCorrection && <div className="sm:col-span-2"><dt className="font-semibold text-brand-dark-soft">Reason for Missed Check-In</dt><dd className="mt-0.5 whitespace-pre-wrap text-brand-dark">{details.correction_reason || '-'}</dd></div>}
                <div><dt className="font-semibold text-brand-dark-soft">Handled By</dt><dd className="mt-0.5 text-brand-dark">{details.handled_by_name || '-'}{details.handled_by_display_id ? ` (${details.handled_by_display_id})` : ''} — {details.handled_by_role || 'Staff'}</dd></div>
                <div><dt className="font-semibold text-brand-dark-soft">Recorded By</dt><dd className="mt-0.5 text-brand-dark">{details.recorded_by_name || entry.actor_name || '-'} — {details.recorded_by_role || '-'}</dd></div>
                <div><dt className="font-semibold text-brand-dark-soft">Recorded At</dt><dd className="mt-0.5 text-brand-dark">{formatTimestamp(details.recorded_at || entry.created_at)}</dd></div>
                {isExtension && <>
                  <div><dt className="font-semibold text-brand-dark-soft">Extra Time</dt><dd>{details.extra_minutes} minute(s)</dd></div>
                  <div><dt className="font-semibold text-brand-dark-soft">Billable Hours</dt><dd>{details.billable_hours}</dd></div>
                  <div><dt className="font-semibold text-brand-dark-soft">Pet Size</dt><dd>{details.pet_size}</dd></div>
                  <div><dt className="font-semibold text-brand-dark-soft">Daycare Hourly Rate</dt><dd>PHP {Number(details.hourly_rate || 0).toFixed(2)}</dd></div>
                  <div><dt className="font-semibold text-brand-dark-soft">Extension Charge</dt><dd>PHP {Number(details.extension_charge || 0).toFixed(2)}</dd></div>
                  <div><dt className="font-semibold text-brand-dark-soft">Payment</dt><dd>{details.payment_method} · {details.payment_status}</dd></div>
                </>}
              </dl>
            </article>
          );
        })}
      </div>
    </section>
  );
}
