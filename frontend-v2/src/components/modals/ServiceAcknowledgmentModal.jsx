import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import html2canvas from 'html2canvas';
import { apiFetch } from '../../api/apiClient';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import { AdminSkeleton } from '../admin/AdminLoading';

const fmtDate = (d) => {
  if (!d) return '—';
  const [year, month, day] = String(d).slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { timeZone: 'Asia/Manila',
    month: 'short', day: 'numeric', year: 'numeric',
  });
};

const fmtTime = (t) => {
  if (!t) return '';
  const [h, m] = String(t).split(':');
  const hour = parseInt(h, 10);
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
};

const formatDateTime = (value) => {
  if (!value) return '—';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', { timeZone: 'Asia/Manila',  month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: 'numeric' });
};

export default function ServiceAcknowledgmentModal({ isOpen, appointmentId, onClose }) {
  useBodyScrollLock(isOpen);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const receiptRef = useRef(null);

  useEffect(() => {
    if (isOpen && appointmentId) {
      fetchData();
    }
  }, [isOpen, appointmentId]);

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiFetch(`/api/my-appointments/${appointmentId}/service-acknowledgment`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || 'Failed to load data.');
      setData(json.data);
    } catch (err) {
      setError(err.message || 'Could not load service acknowledgment.');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format = 'webp') => {
    if (!receiptRef.current) return;
    setExporting(true);
    try {
      // Temporarily remove max-height and overflow to capture full content
      const contentDiv = receiptRef.current.querySelector('.overflow-y-auto');
      const originalMaxHeight = contentDiv?.style.maxHeight;
      const originalOverflow = contentDiv?.style.overflow;

      if (contentDiv) {
        contentDiv.style.maxHeight = 'none';
        contentDiv.style.overflow = 'visible';
      }

      const canvas = await html2canvas(receiptRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true,
      });

      // Restore original styles
      if (contentDiv) {
        contentDiv.style.maxHeight = originalMaxHeight;
        contentDiv.style.overflow = originalOverflow;
      }

      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `ServiceAcknowledgment-${data?.appointment?.appointment_code || 'receipt'}.${format}`;
        link.click();
        URL.revokeObjectURL(url);
        setExporting(false);
      }, `image/${format}`, 0.95);
    } catch (err) {
      console.error('Export failed:', err);
      setExporting(false);
    }
  };

  if (!isOpen) return null;

  const apt = data?.appointment;
  const service = data?.service;
  const pet = data?.pet;
  const owner = data?.owner;
  const handledBy = data?.handled_by;
  const addons = data?.addons || [];
  const hotelSuite = data?.hotel_suite;
  const petPhotoUrl = pet?.photo_url || pet?.profile_photo || pet?.photo || '';
  const resolvedPetPhotoUrl = petPhotoUrl && !/^https?:\/\//i.test(petPhotoUrl)
    ? `${window.location.origin}${petPhotoUrl.startsWith('/') ? '' : '/'}${petPhotoUrl}`
    : petPhotoUrl;

  const isHotel = service?.category === 'Pet Hotel';
  const checkoutDate = apt?.hotel_nights
    ? (() => {
        const [y, m, d] = String(apt.appointment_date).slice(0, 10).split('-').map(Number);
        return new Date(y, m - 1, d + apt.hotel_nights)
          .toLocaleDateString('en-US', { timeZone: 'Asia/Manila',  month: 'short', day: 'numeric', year: 'numeric' });
      })()
    : null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-brand-dark/40 h-[100dvh] min-h-[100dvh] w-screen" onClick={onClose}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl font-poppins" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="relative bg-brand-teal px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors"
            aria-label="Close"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
          <h2 className="text-base font-bold text-white">Service Acknowledgment</h2>
          <p className="text-xs text-white/80 mt-0.5">Official Records</p>
        </div>
        <div className="h-1 bg-white" />

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-teal" />
            <AdminSkeleton variant="table" label="Loading service acknowledgment" rows={3} />
          </div>
        ) : error ? (
          <div className="px-6 py-8">
            <p className="text-sm text-red-600 text-center">{error}</p>
          </div>
        ) : data ? (
          <>
            {/* Receipt Content */}
            <div ref={receiptRef} className="bg-white">
              {/* Business Header with Background */}
              <div className="relative pt-5 pb-4 px-6" style={{
                backgroundImage: 'url(/assets/landing_bg.webp)',
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}>
                {/* Dark overlay for text visibility */}
                <div className="absolute inset-0 bg-gradient-to-br from-brand-teal/80 via-brand-dark/70 to-brand-teal-dark/80" />
                <div className="relative z-10 flex items-start justify-between gap-4">
                  {/* Left: Logo and Name */}
                  <div className="flex items-center gap-2">
                    <i className="fa-solid fa-paw text-white text-xl drop-shadow-lg" />
                    <div className="text-left">
                      <h2 className="text-lg font-extrabold text-white uppercase tracking-wide drop-shadow-lg leading-tight">The Fur Club</h2>
                      <p className="text-[10px] text-white/95 drop-shadow">Pet Station · San Juan City</p>
                    </div>
                  </div>

                  {/* Right: Contact Info */}
                  <div className="space-y-0.5 text-white/90 text-[9px] drop-shadow text-right">
                    <p className="flex items-center justify-end gap-1">
                      <i className="fa-solid fa-phone text-[8px]" />
                      <span>0976 065 8031</span>
                    </p>
                    <p className="flex items-center justify-end gap-1">
                      <i className="fa-solid fa-envelope text-[8px]" />
                      <span>connect.thefurclub@gmail.com</span>
                    </p>
                    <p className="flex items-center justify-end gap-1">
                      <i className="fa-solid fa-location-dot text-[8px]" />
                      <span>207 F. Blumentritt St.</span>
                    </p>
                  </div>
                </div>
              </div>

              <div className="px-6 py-6 space-y-5 max-h-[50vh] overflow-y-auto no-scrollbar">
                {/* Pet Profile Photo */}
                <div className="flex justify-center">
                  <div className="relative">
                    {resolvedPetPhotoUrl ? (
                      <img
                        src={resolvedPetPhotoUrl}
                        alt={pet.name}
                        className="h-20 w-20 rounded-full object-cover border-4 border-brand-teal shadow-lg"
                        crossOrigin="anonymous"
                      />
                    ) : (
                      <div className="h-20 w-20 rounded-full bg-brand-teal/10 border-4 border-brand-teal flex items-center justify-center shadow-lg">
                        <i className="fa-solid fa-paw text-brand-teal text-2xl" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Thank You Message */}
                <div className="text-center space-y-3 py-2">
                  <h3 className="text-lg font-bold text-brand-dark">
                    Thank You for Trusting Us!
                  </h3>
                  <p className="text-sm text-brand-dark leading-relaxed px-2">
                    {pet?.name} was an absolute joy to care for! We hope {pet?.species === 'Dog' ? 'he' : pet?.species === 'Cat' ? 'she' : 'they'} had a pawsome time with us.
                  </p>
                  <p className="text-sm font-semibold text-brand-teal">
                    We can't wait to see {pet?.name} again!
                  </p>
                </div>

                {/* Divider */}
                <div className="border-t-2 border-dashed border-brand-dark-light" />

                {/* Service Summary */}
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl shrink-0 bg-brand-teal text-white">
                      <i className="fa-solid fa-scissors text-lg" />
                    </div>
                    <div className="flex-1">
                      <p className="text-base font-bold text-brand-dark">{service?.category || '—'}</p>
                      <p className="text-sm text-brand-dark-soft">
                        for <span className="font-bold text-brand-teal">{pet?.name}</span> · {pet?.breed || '—'}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="text-center p-3 bg-brand-surface rounded-lg">
                      <p className="text-[10px] uppercase tracking-wider text-brand-dark-soft mb-1">Date</p>
                      <p className="text-sm font-bold text-brand-dark">{fmtDate(apt?.appointment_date)}</p>
                    </div>
                    {!isHotel && apt?.start_time && (
                      <div className="text-center p-3 bg-brand-surface rounded-lg">
                        <p className="text-[10px] uppercase tracking-wider text-brand-dark-soft mb-1">Time</p>
                        <p className="text-sm font-bold text-brand-dark">{fmtTime(apt.start_time)}</p>
                      </div>
                    )}
                    {isHotel && checkoutDate && (
                      <div className="text-center p-3 bg-brand-surface rounded-lg">
                        <p className="text-[10px] uppercase tracking-wider text-brand-dark-soft mb-1">Nights</p>
                        <p className="text-sm font-bold text-brand-dark">{apt.hotel_nights}</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Add-ons */}
                {addons.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-brand-dark-soft">Add-ons Included</p>
                    <div className="space-y-1.5">
                      {addons.map((addon, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm text-brand-dark">
                          <i className="fa-solid fa-check text-brand-teal text-xs" />
                          <span>{addon.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Handled By */}
                {handledBy?.name && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-brand-dark-soft">Handled By</p>
                    <div className="flex items-center gap-2">
                      <i className="fa-solid fa-user text-brand-teal text-sm" />
                      <span className="text-sm font-semibold text-brand-dark">{handledBy.name}</span>
                    </div>
                  </div>
                )}

                {/* Notes */}
                {apt?.notes && (
                  <div className="space-y-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-brand-dark-soft">Notes</p>
                    <div className="bg-brand-surface rounded-lg p-3">
                      <p className="text-sm text-brand-dark leading-relaxed whitespace-pre-wrap">{apt.notes}</p>
                    </div>
                  </div>
                )}

                {/* Divider */}
                <div className="border-t-2 border-dashed border-brand-dark-light" />

                {/* Total */}
                <div className="rounded-xl bg-gradient-to-br from-brand-teal/10 to-brand-teal/5 border-2 border-brand-teal/30 p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-bold text-brand-dark">Total Paid</span>
                    <span className="text-2xl font-extrabold text-brand-teal">PHP {(apt?.grand_total || 0).toFixed(2)}</span>
                  </div>
                </div>

                {/* Footer */}
                <div className="text-center pt-3 space-y-1">
                  <p className="text-xs text-brand-dark-soft">
                    Share your experience with us!
                  </p>
                  <p className="text-[10px] text-brand-dark-soft/70">
                    Generated on {new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Manila',  month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="border-t-2 border-dashed border-brand-dark-light px-6 py-4 bg-brand-surface">
              <button
                type="button"
                onClick={() => handleExport('png')}
                disabled={exporting}
                className="w-full rounded-xl bg-brand-teal py-2.5 text-xs font-bold text-white hover:brightness-95 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-download text-xs" />
                {exporting ? 'Exporting...' : 'Save as Image'}
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>,
    document.body
  );
}
