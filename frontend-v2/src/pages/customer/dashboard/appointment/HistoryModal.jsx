import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import useBodyScrollLock from '../../../../hooks/useBodyScrollLock';
import { apiGet } from '../../../../api/apiClient';
import Loading from '../../../../components/Loading';
import SelectDropdown from '../../../../components/reusable-ui/SelectDropdown';
import { sanitizeText, formatAddressFromOwner } from '../../../../utils/textUtils';
import {
  isCompletedOrCancelledStatus,
  formatHotelCheckInLabel,
  formatHotelCheckOutLabel,
  formatStatusLabel,
} from '../../../../utils/recordFormatters';
import {
  fmtDate,
  fmtTime,
  formatDateTime,
  categoryIconBg,
  isRejected,
  getRejectionReason,
  statusMeta,
  getHandledByName,
} from './appointmentHelpers';
import { serviceIcon } from './appointmentIcons';

export default function HistoryModal({ isOpen, appointments, loading, onClose }) {
  useBodyScrollLock(isOpen);
  const [petFilter, setPetFilter] = useState('all');
  const [owner, setOwner] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    apiGet('/api/my-profile')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setOwner(d?.data ?? d ?? null))
      .catch(() => {});
  }, [isOpen]);

  if (!isOpen) return null;

  const history = [...appointments]
    .filter((a) => isCompletedOrCancelledStatus(a.status))
    .sort((a, b) => new Date(b.appointment_date) - new Date(a.appointment_date));

  // Build unique pet list from history
  const pets = [];
  const seen = new Set();
  history.forEach((a) => {
    const id = a.pet?.id;
    if (id && !seen.has(id)) { seen.add(id); pets.push(a.pet); }
  });

  const filtered = petFilter === 'all' ? history : history.filter((a) => a.pet?.id === petFilter);

  const handleDownloadPdf = async () => {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
      import('jspdf'),
      import('jspdf-autotable'),
    ]);
    const doc = new jsPDF();
    const pageWidth  = doc.internal.pageSize.getWidth();

    const PDF_BLACK  = [0, 0, 0];
    const PDF_BORDER = [0, 0, 0];
    const white      = [255, 255, 255];

    // ── Logo (top-right, teal paw) ──
    try {
      const logoData = await new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth; c.height = img.naturalHeight;
          c.getContext('2d').drawImage(img, 0, 0);
          resolve(c.toDataURL('image/png'));
        };
        img.onerror = reject;
        img.src = '/assets/paw-realteal.webp';
      });
      doc.addImage(logoData, 'PNG', pageWidth - 26, 3, 14, 14);
    } catch { /* skip if logo fails */ }

    // ── Header text ──
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...PDF_BLACK);
    doc.text('PAWSITIVECARE — THE FUR CLUB PET STATION', 14, 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(`Appointment History  |  Generated: ${new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Manila',  month: 'long', day: 'numeric', year: 'numeric' })}`, 14, 18);
    doc.setDrawColor(...PDF_BLACK);
    doc.setLineWidth(0.3);
    doc.line(14, 25, pageWidth - 14, 25);

    let y = 34;

    // ── Owner info ──
    if (owner) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...PDF_BLACK);
      doc.text('OWNER INFORMATION', 14, y);

      const fullName = `${owner.first_name || ''} ${owner.last_name || ''}`.trim();
      autoTable(doc, {
        startY: y + 3,
        body: [
          ['Full Name', fullName || '—'],
          ['Email',     sanitizeText(owner.email)   || '—'],
          ['Phone',     sanitizeText(owner.phone)   || '—'],
          ['Address',   formatAddressFromOwner(owner) || '—'],
        ],
        styles:             { fontSize: 7, cellPadding: 1.5, textColor: PDF_BLACK, lineColor: PDF_BORDER, lineWidth: 0.1 },
        headStyles:         { fillColor: white, textColor: PDF_BLACK, fontStyle: 'bold', lineColor: PDF_BORDER, lineWidth: 0.2 },
        alternateRowStyles: { fillColor: white },
        columnStyles:       { 0: { fontStyle: 'bold', cellWidth: 40 } },
        margin:             { left: 14, right: 14 },
      });
      y = (doc.lastAutoTable?.finalY ?? y + 20) + 8;
    }

    // ── Appointment records ──
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...PDF_BLACK);
    doc.text('APPOINTMENT RECORDS', 14, y);

    autoTable(doc, {
      startY: y + 3,
      head: [['Date', 'Service / Package', 'Pet', 'Time', 'Add-ons', 'Estimated Service Cost', 'Estimated Total', 'Status']],
      body: filtered.map((apt) => {
        const [yr, mo, dy] = String(apt.appointment_date).slice(0, 10).split('-').map(Number);
        const date = new Date(yr, mo - 1, dy).toLocaleDateString('en-US', { timeZone: 'Asia/Manila',  month: 'short', day: 'numeric', year: 'numeric' });
        const cat = String(apt.service?.category || '').toLowerCase();
        let pkg = '—';
        if (cat.includes('hotel')) pkg = apt.hotelSuite?.name || apt.hotel_suite?.name || apt.service?.name || '—';
        else if (cat.includes('daycare') && apt.size_label) pkg = apt.size_label.replace(/\s*-\s*(Small|Medium|Large|XLarge|XXLarge).*/i, '').trim() || apt.size_label;
        else pkg = apt.service?.name || '—';
        const serviceLabel = cat.includes('hotel') ? 'Pet Hotel' : cat.includes('daycare') ? 'Daycare' : cat.includes('groom') ? 'Grooming' : apt.service?.name || '—';
        const addons = Array.isArray(apt.appointmentAddons) ? apt.appointmentAddons : [];
        const basePrice = Number(apt.total_price || 0);
        const addonsTotal = addons.reduce((s, a) => s + Number(a.price_charged || 0), 0);
        const grandTotal = basePrice + addonsTotal;
        const addonsText = addons.length ? addons.map((a) => a.serviceAddon?.name || 'Add-on').join(', ') : '—';
        const statusLabel = formatStatusLabel(apt.status);
        return [
          date,
          `${serviceLabel}\n${pkg}`,
          apt.pet?.name || '—',
          apt.start_time ? fmtTime(apt.start_time) : '—',
          addonsText,
          basePrice > 0 ? `PHP ${basePrice.toFixed(2)}` : '—',
          grandTotal > 0 ? `PHP ${grandTotal.toFixed(2)}` : '—',
          statusLabel,
        ];
      }),
      styles:             { fontSize: 6.5, cellPadding: 1.5, textColor: PDF_BLACK, lineColor: PDF_BORDER, lineWidth: 0.1 },
      headStyles:         { fillColor: white, textColor: PDF_BLACK, fontStyle: 'bold', lineColor: PDF_BORDER, lineWidth: 0.2 },
      alternateRowStyles: { fillColor: white },
      margin:             { left: 14, right: 14 },
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 7) {
          const val = String(data.cell.raw || '').toLowerCase();
          if (val === 'completed') data.cell.styles.textColor = [5, 150, 105];
          else if (val === 'cancelled') data.cell.styles.textColor = [220, 38, 38];
        }
        if (data.section === 'body' && data.column.index === 6 && String(data.cell.raw || '') !== '—') {
          data.cell.styles.fontStyle = 'bold';
        }
      },
    });

    // ── Grand total summary ──
    if (filtered.length > 0) {
      const allAddons = filtered.flatMap((apt) => Array.isArray(apt.appointmentAddons) ? apt.appointmentAddons : []);
      const totalBase = filtered.reduce((s, apt) => s + Number(apt.total_price || 0), 0);
      const totalAddons = allAddons.reduce((s, a) => s + Number(a.price_charged || 0), 0);
      const totalGrand = totalBase + totalAddons;
      const summaryY = (doc.lastAutoTable?.finalY ?? y + 20) + 5;
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...PDF_BLACK);
      doc.text(`Total Appointments: ${filtered.length}   |   Grand Total: PHP ${totalGrand.toFixed(2)}`, 14, summaryY);
    }

    const petName = petFilter !== 'all' ? (pets.find((p) => p.id === petFilter)?.name || 'Pet') : null;
    const filename = petName
      ? `TheFurClub-AppointmentHistory-${petName}-${new Date().toISOString().slice(0,10)}.pdf`
      : `TheFurClub-AppointmentHistory-${new Date().toISOString().slice(0,10)}.pdf`;
    doc.save(filename);
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex h-[100dvh] min-h-[100dvh] w-screen items-center justify-center p-4">
      <div className="absolute inset-0 backdrop-blur-sm bg-brand-dark/40" onClick={onClose} />
      <div className="relative flex w-full max-w-lg max-h-[90dvh] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl font-poppins" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between bg-brand-teal px-6 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-clock-rotate-left text-white text-sm" />
            <h2 className="text-base font-bold text-white">Appointment History</h2>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors">
            <i className="fa-solid fa-xmark text-base" />
          </button>
        </div>
        <div className="h-1 bg-white" />

        {/* Pet filter dropdown — only when multiple pets */}
        {!loading && pets.length > 1 && (
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-brand-dark-light">
            <i className="fa-solid fa-paw text-brand-teal text-xs shrink-0" />
            <span className="text-[11px] font-semibold text-brand-dark-soft shrink-0">Sort by pet:</span>
            <SelectDropdown
              value={petFilter}
              onChange={(v) => setPetFilter(v)}
              options={[{ value: 'all', label: 'All Pets' }, ...pets.map((p) => ({ value: p.id, label: p.name }))]}
              placeholder="All Pets"
              className="min-w-[120px]"
            />
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-teal px-4 py-4 space-y-2 history-scroll">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2">
              <Loading message="Pawsing for a happy moment..." textClassName="text-brand-dark-soft" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <i className="fa-regular fa-calendar-xmark text-3xl text-brand-dark-soft/30 mb-3" />
              <p className="text-sm text-brand-dark-soft">No appointment history yet.</p>
            </div>
          ) : (
            filtered.map((apt) => {
              const isExpanded = expandedId === apt.id;
              const category = apt.service?.category || '';
              const categoryLabel = category.includes('hotel') ? 'Hotel' : category.includes('daycare') ? 'Daycare' : category.includes('groom') ? 'Grooming' : '—';
              const packageName = category.includes('hotel')
                ? (apt.hotelSuite?.name || apt.hotel_suite?.name || apt.service?.name || '—')
                : apt.service?.name || '—';
              const handledBy = getHandledByName(apt);
              return (
                <div key={apt.id} className="rounded-xl border border-brand-dark-light overflow-hidden transition-all">
                  <button type="button"
                    onClick={() => setExpandedId(isExpanded ? null : apt.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-white transition-colors text-left">
                    <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${categoryIconBg(apt)}`}>
                      {serviceIcon(apt.service?.category)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-semibold text-brand-dark truncate">{apt.service?.name || '—'}</p>
                        {apt.size_label && (
                          <span className="text-[10px] font-semibold text-brand-teal bg-brand-teal-light px-1.5 py-0.5 rounded-full shrink-0">
                            {apt.size_label}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-brand-dark-soft mt-0.5">
                        {apt.pet?.name || '—'} • {fmtDate(apt.appointment_date)}
                        {apt.start_time ? ` • ${fmtTime(apt.start_time)}` : ''}
                      </p>
                    </div>
                    <span className={`shrink-0 text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${statusMeta(apt).cls}`}>
                      {statusMeta(apt).label}
                    </span>
                    <i className={`fa-solid fa-chevron-${isExpanded ? 'up' : 'down'} text-[9px] text-brand-dark-soft/60 shrink-0`} />
                  </button>

                  {isExpanded && (() => {
                    const addons = Array.isArray(apt.appointmentAddons) ? apt.appointmentAddons : [];
                    const isHotelApt = category.includes('hotel');
                    const isCompleted = apt.status === 'completed';
                    return (
                      <div className="border-t border-brand-dark-light bg-white px-4 py-3 space-y-2">
                        <p className="text-[9px] font-extrabold uppercase tracking-widest text-brand-dark-soft">Appointment Overview</p>
                        <div className="space-y-1.5">
                          {[
                            { label: 'Booking ID',     value: apt.appointment_code || '—' },
                            { label: 'Package Name',   value: packageName },
                            { label: 'Category',       value: categoryLabel },
                            { label: isHotelApt ? 'Check-in' : 'Date', value: isHotelApt
                              ? formatHotelCheckInLabel({
                                  appointmentDate: apt.appointment_date,
                                  startTime: apt.start_time,
                                  createdAt: apt.created_at,
                                })
                              : (fmtDate(apt.appointment_date) || '—') },
                            ...(isHotelApt && apt.hotel_nights ? [{
                              label: 'Check-out',
                              value: (isCompleted && apt.completed_at)
                                ? formatDateTime(apt.completed_at)
                                : formatHotelCheckOutLabel({
                                    appointmentDate: apt.appointment_date,
                                    startTime: apt.start_time,
                                    createdAt: apt.created_at,
                                    hotelNights: apt.hotel_nights,
                                  }),
                            }] : []),
                            ...(!isHotelApt && apt.start_time ? [{ label: 'Time', value: fmtTime(apt.start_time) }] : []),
                            { label: 'Handled By',     value: handledBy },
                          ].map(({ label, value }) => (
                            <div key={label} className="flex items-start justify-between gap-3">
                              <span className="text-[10px] font-semibold text-brand-dark-soft shrink-0">{label}</span>
                              <span className="text-[10px] font-bold text-brand-dark text-right">{value}</span>
                            </div>
                          ))}
                        </div>

                        {/* Cancellation / Rejection reason banner */}
                        {apt.status === 'cancelled' && apt.cancellation_reason && (
                          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 flex items-start gap-2">
                            <i className="fa-solid fa-circle-xmark text-red-400 text-xs mt-0.5 shrink-0" />
                            <div>
                              <p className="text-[10px] font-bold text-red-600 mb-0.5">
                                {isRejected(apt) ? 'Rejection Reason' : 'Cancellation Reason'}
                              </p>
                              <p className="text-[10px] text-red-500 leading-snug">
                                {getRejectionReason(apt) || 'No reason provided.'}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Add-ons breakdown */}
                        {addons.length > 0 && (
                          <div className="rounded-lg border border-brand-dark-light divide-y divide-brand-dark-light">
                            <p className="px-3 py-1.5 text-[9px] font-extrabold uppercase tracking-widest text-brand-dark-soft">Add-ons</p>
                            {addons.map((a) => (
                              <div key={a.id} className="flex justify-between px-3 py-1.5">
                                <span className="text-[10px] text-brand-dark">{a.serviceAddon?.name || 'Add-on'}</span>
                                <span className="text-[10px] font-semibold text-brand-dark">
                                  {a.price_charged != null ? `PHP ${Number(a.price_charged).toFixed(2)}` : '—'}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              );
            })
          )}
        </div>
        {history.length > 0 && (
          <div className="border-t border-brand-dark-light px-6 py-4 flex justify-center">
            <button type="button" onClick={handleDownloadPdf}
              className="flex items-center gap-2 rounded-lg border border-brand-teal bg-white hover:bg-brand-teal px-4 py-2 text-xs font-semibold text-brand-teal hover:text-white transition-colors">
              <i className="fa-solid fa-download text-xs" />
              Download as PDF
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
