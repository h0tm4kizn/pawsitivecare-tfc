import { useState } from 'react';
import { X } from 'lucide-react';
import { formatReference, isCompletedOrCancelledStatus } from '../../utils/recordFormatters';
import {
  getAppointmentServiceCategory,
  getOrdinaryPaymentReference,
} from '../../utils/appointmentServiceType';
import { AdminSkeleton } from '../admin/AdminLoading';

export default function AppointmentHistoryModal({
  isOpen,
  petName,
  appointments = [],
  loading = false,
  error = '',
  onClose,
  pet = null,
}) {
  const [expandedId, setExpandedId] = useState(null);

  // Header color fixed to brand teal for consistency
  const headerBg = 'bg-brand-teal';

  const petIsCat = pet ? String(pet?.species_type?.name || pet?.speciesType?.name || '').toLowerCase().includes('cat') : false;

  const formatDateTime = (value) => {
    if (!value) return '—';
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-US', { timeZone: 'Asia/Manila',  month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric' });
  };

  if (!isOpen) return null;

  const historyAppointments = appointments.filter((apt) =>
    isCompletedOrCancelledStatus(apt?.status || apt?._raw?.status),
  );

  const toCsvValue = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const handleDownloadHistory = (apt) => {
    if (!apt) return;
    const raw = apt?._raw || apt;
    const isHotel = getAppointmentServiceCategory(raw) === 'hotel';
    const addons = Array.isArray(raw?.appointmentAddons) ? raw.appointmentAddons : [];
    const addonsTotal = addons.reduce((s, a) => s + Number(a.price_charged || 0), 0);
    const basePrice = Number(raw?.total_price || apt?.amountPaid || 0);
    const grandTotal = basePrice + addonsTotal;
    const headers = [
      'Service',
      'Service ID',
      'Date',
      'Time',
      'Handled By',
      isHotel ? 'Reservation Reference' : 'Payment Reference',
      'Estimated Service Cost',
      'Add-ons',
      'Estimated Total',
      'Completed At',
      'Special Instructions',
    ];
    const addonsText = addons.length
      ? addons.map((a) => `${a.serviceAddon?.name || 'Add-on'} (PHP ${Number(a.price_charged || 0).toFixed(2)})`).join('; ')
      : 'None';
    const rows = [[
      apt?.service || '-',
      apt?.serviceId || '-',
      apt?.date || '-',
      apt?.time || '-',
      apt?.handledBy || '-',
      formatReference(isHotel
        ? (apt?.paymentReference || raw?.reference_number)
        : (getOrdinaryPaymentReference(raw) || apt?.paymentReference)),
      basePrice > 0 ? `PHP ${basePrice.toFixed(2)}` : '-',
      addonsText,
      grandTotal > 0 ? `PHP ${grandTotal.toFixed(2)}` : '-',
      formatDateTime(apt?.completed_at || apt?.completedAt || raw?.completed_at || apt?.completedAtUtc),
      apt?.specialInstructions || raw?.special_instructions || 'None',
    ]];
    const csv = [headers, ...rows].map((row) => row.map(toCsvValue).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `appointment_${String(apt?.serviceId || apt?.id || 'history').toLowerCase().replace(/[^a-z0-9_-]+/g, '_')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-[180] flex items-center justify-center p-4 backdrop-blur-sm bg-brand-dark/45"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`flex items-center justify-between ${headerBg} px-6 py-4`}>
          <div>
            <h3 className="text-base font-bold text-white">
              Appointment History: {petName || 'Pet'}
            </h3>
            <p className="text-xs text-white/85">
              Complete record of scheduled appointments for this pet.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
          >
            <X size={15} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-2 overflow-y-auto p-5 no-scrollbar">
          {loading && (
            <p className="rounded-xl border border-brand-dark-light bg-white px-4 py-3 text-sm text-brand-dark-soft">
              <AdminSkeleton variant="table" label="Loading appointment history" rows={3} />
            </p>
          )}

          {!loading && error && (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
              {error}
            </p>
          )}

          {!loading && !error && historyAppointments.length === 0 && (
            <p className="rounded-xl border border-brand-dark-light bg-white px-4 py-3 text-sm text-brand-dark-soft">
              No appointment history for this pet yet.
            </p>
          )}

          {!loading &&
            !error &&
            historyAppointments.map((apt) => {
              const aptKey = apt.id || apt.dateIso || apt.date;
              return (
                <div
                  key={aptKey}
                  className="rounded-lg border border-brand-dark-light overflow-hidden"
                >
                  {/* Header — always visible, clickable */}
                  <button
                    type="button"
                    onClick={() =>
                      setExpandedId(expandedId === aptKey ? null : aptKey)
                    }
                    className="w-full flex items-center justify-between gap-3 px-5 py-3 bg-white hover:bg-brand-dark/5 transition-colors text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-brand-dark truncate">
                        {apt.service || '—'}
                      </p>
                      <p className="text-xs text-brand-dark-soft">
                        {apt.date || '—'}{' '}
                        {apt.time ? `· ${apt.time}` : ''}
                      </p>
                    </div>
                    <i
                      className={`fa-solid fa-chevron-down text-brand-teal text-sm transition-transform ${
                        expandedId === aptKey ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {/* Expanded details */}
                  {expandedId === aptKey && (() => {
                    const raw = apt?._raw || apt;
                    const addons = Array.isArray(raw?.appointmentAddons) ? raw.appointmentAddons : [];
                    const basePrice = Number(raw?.total_price || 0);
                    const addonsTotal = addons.reduce((s, a) => s + Number(a.price_charged || 0), 0);
                    const grandTotal = basePrice + addonsTotal;
                    return (
                    <div className="px-5 py-3 border-t border-brand-dark-light bg-white">
                      <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 text-xs">
                        <div>
                          <p className="text-brand-dark-soft font-semibold mb-1">Service</p>
                          <p className="text-brand-dark font-medium">{apt.service || '—'}</p>
                        </div>
                        <div>
                          <p className="text-brand-dark-soft font-semibold mb-1">Service ID</p>
                          <p className="text-brand-dark font-medium">{apt.serviceId || '—'}</p>
                        </div>
                        <div>
                          <p className="text-brand-dark-soft font-semibold mb-1">Date</p>
                          <p className="text-brand-dark font-medium">{apt.date || '—'}</p>
                        </div>
                        <div>
                          <p className="text-brand-dark-soft font-semibold mb-1">Time</p>
                          <p className="text-brand-dark font-medium">{apt.time || '—'}</p>
                        </div>
                        <div>
                          <p className="text-brand-dark-soft font-semibold mb-1">Handled by</p>
                          <p className="text-brand-dark font-medium">{apt.handledBy || '—'}</p>
                        </div>
                        <div className="sm:col-span-2">
                          <p className="text-brand-dark-soft font-semibold mb-1">Special Instructions</p>
                          <p className="text-brand-dark">{apt.specialInstructions || raw?.special_instructions || 'None'}</p>
                        </div>
                        <div>
                          <p className="text-brand-dark-soft font-semibold mb-1">
                            {getAppointmentServiceCategory(raw) === 'hotel' ? 'Reservation Reference' : 'Payment Reference'}
                          </p>
                          <p className="text-brand-dark font-medium">
                            {formatReference(getAppointmentServiceCategory(raw) === 'hotel'
                              ? (apt.paymentReference || raw?.reference_number)
                              : (getOrdinaryPaymentReference(raw) || apt.paymentReference))}
                          </p>
                        </div>
                        <div>
                          <p className="text-brand-dark-soft font-semibold mb-1">Estimated Service Cost</p>
                          <p className="text-brand-dark font-medium">
                            {basePrice > 0 ? `PHP ${basePrice.toFixed(2)}` : '—'}
                          </p>
                        </div>
                        {addons.length > 0 && (
                          <div className="sm:col-span-2">
                            <p className="text-brand-dark-soft font-semibold mb-1">Add-ons</p>
                            <div className="space-y-1">
                              {addons.map((a) => (
                                <div key={a.id} className="flex justify-between">
                                  <span className="text-brand-dark">{a.serviceAddon?.name || 'Add-on'}</span>
                                  <span className="font-semibold text-brand-dark">
                                    {a.price_charged != null ? `PHP ${Number(a.price_charged).toFixed(2)}` : '—'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <div>
                          <p className="text-brand-dark-soft font-semibold mb-1">Estimated Total</p>
                          <p className="text-brand-dark font-bold">
                            {grandTotal > 0 ? `PHP ${grandTotal.toFixed(2)}` : '—'}
                          </p>
                        </div>
                        <div>
                          <p className="text-brand-dark-soft font-semibold mb-1">Completed At</p>
                          <p className="text-brand-dark font-medium">{formatDateTime(apt.completed_at || apt.completedAt || raw?.completed_at || apt.completedAtUtc)}</p>
                        </div>
                      </div>
                      <div className="mt-2 flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleDownloadHistory(apt)}
                          className={`rounded-lg border px-3 py-1.5 text-[11px] font-bold ${
                            petIsCat
                              ? 'border-brand-orange text-brand-orange hover:bg-brand-orange hover:text-white'
                              : 'border-brand-teal text-brand-teal hover:bg-brand-teal hover:text-white'
                          }`}
                        >
                          Download History
                        </button>
                      </div>
                    </div>
                    );
                  })()}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
