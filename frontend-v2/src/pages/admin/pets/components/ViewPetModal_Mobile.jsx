import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, X } from 'lucide-react';
import { apiFetch, apiGet } from '../../../../api/apiClient';
import { AdminSkeleton } from '../../../../components/admin/AdminLoading';
import { formatReference, formatWeightKg } from '../../../../utils/recordFormatters';
import { normalizeBreedName, sanitizeText } from '../../../../utils/textUtils';
import {
  getAppointmentServiceCategory,
  getOrdinaryPaymentReference,
} from '../../../../utils/appointmentServiceType';
import { downloadPetAssessmentRecordPdf } from '../../../../utils/petAssessmentBlankPdf';
import useBodyScrollLock from '../../../../hooks/useBodyScrollLock';
import HotelStayCorrectionHistory from '../../appointment/HotelStayCorrectionHistory';
import {
  fmtDate, formatTime,
  ownerName, getAppointmentPackageName, getAppointmentPackageCode,
  isCompletedStatus, extractAppointments, titleCasePetName,
  recognitionStatusLabel, recognitionRegisteredAtLabel,
  getReservationPaymentMode, exportAppointmentPdf,
} from '../petUtils';

export default function ViewPetModal_Mobile({ pet, onClose, onScheduleAppointment = null }) {
  useBodyScrollLock(!!pet);
  const [petDetail, setPetDetail] = useState(pet || null);
  const [tab, setTab] = useState('history');
  const [appointments, setAppointments] = useState([]);
  const [appointmentCodes, setAppointmentCodes] = useState({});
  const [aptsLoading, setAptsLoading] = useState(false);
  const [aptsError, setAptsError] = useState('');
  const [assessRecords, setAssessRecords] = useState([]);
  const [assessLoading, setAssessLoading] = useState(false);
  const [assessError, setAssessError] = useState('');
  const [expandedAptId, setExpandedAptId] = useState(null);
  const [expandedAssessId, setExpandedAssessId] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const completedAssessRecords = assessRecords.filter((record) => isCompletedStatus(record?.appointment?.status));

  useEffect(() => {
    if (!pet) return;
    setPetDetail(pet);
    setAppointments([]);
    setAppointmentCodes({});
    setAptsError('');
    setAssessRecords([]);
    setAssessError('');
    setTab('history');
    setExpandedAptId(null);
    setExpandedAssessId(null);
    let cancelled = false;

    const loadPetDetail = async () => {
      if (!pet?.id) return;
      try {
        const res = await apiFetch(`/api/pets/${pet.id}`);
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok) setPetDetail(data?.data || data || pet);
      } catch {
        // Keep the list record when the detail request is unavailable.
      }
    };

    const loadAppointments = async () => {
      if (!pet?.id) return;
      setAptsLoading(true);
      setAptsError('');
      try {
        const res = await apiFetch(`/api/appointments?per_page=100&page=1&pet_id=${encodeURIComponent(pet.id)}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || 'Failed to load appointments.');

        let all = extractAppointments(data).filter(
          (r) => String(r?.pet_id || r?.pet?.id || '') === String(pet.id),
        );
        const lastPage = Number(data?.data?.last_page || 1);

        if (lastPage > 1) {
          const pagePromises = [];
          for (let p = 2; p <= lastPage; p += 1) {
            pagePromises.push(
              apiFetch(`/api/appointments?per_page=100&page=${p}&pet_id=${encodeURIComponent(pet.id)}`)
                .then((r) => r.json().catch(() => ({})))
            );
          }
          const pageResults = await Promise.all(pagePromises);
          pageResults.forEach((pageData) => {
            const rows = extractAppointments(pageData).filter(
              (r) => String(r?.pet_id || r?.pet?.id || '') === String(pet.id),
            );
            all.push(...rows);
          });
        }

        if (!cancelled) {
          setAppointmentCodes(Object.fromEntries(all.map((row) => [String(row?.id || ''), row?.appointment_code]).filter(([id, code]) => id && code)));
        }

        const normalized = all
          .filter((r) => isCompletedStatus(r?.status))
          .map((r) => {
            const isHotel = getAppointmentServiceCategory(r) === 'hotel';
            return {
              id: r?.id || '',
              service: getAppointmentPackageName(r),
              serviceId: r?.appointment_code || getAppointmentPackageCode(r),
              date: fmtDate(r?.appointment_date || r?.date || null),
              dateIso: String(r?.appointment_date || r?.date || '').slice(0, 10),
              time: formatTime(r?.start_time || r?.time || ''),
              handledBy: r?.handledBy?.name || r?.handled_by?.name || r?.handled_by_name || '-',
              specialInstructions: r?.special_instructions || r?.notes || 'None',
              isHotel,
              reservationPaymentMode: getReservationPaymentMode(r),
              paymentReference: isHotel ? (r?.reference_number || '-') : (getOrdinaryPaymentReference(r) || '-'),
              ownerName: r?.pet?.owner ? `${r.pet.owner.first_name || ''} ${r.pet.owner.last_name || ''}`.trim() : '-',
              ownerPhone: r?.pet?.owner?.phone || '-',
              ownerEmail: r?.pet?.owner?.email || '-',
              ownerAddress: r?.pet?.owner?.address || '-',
              petName: r?.pet?.name || pet?.name || '-',
              petCode: r?.pet?.pet_id || pet?.pet_id || '-',
              status: String(r?.status || '').replace(/_/g, ' '),
              completedAt: r?.completed_at ? new Date(r.completed_at).toLocaleString('en-US', { timeZone: 'Asia/Manila',  month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-',
              downloadAllowed: isCompletedStatus(r?.status),
            };
          })
          .sort((a, b) => String(b.dateIso).localeCompare(String(a.dateIso)));

        if (!cancelled) setAppointments(normalized);
      } catch (err) {
        if (!cancelled) setAptsError(err?.message || 'Failed to load appointments.');
      } finally {
        if (!cancelled) setAptsLoading(false);
      }
    };

    const loadAssessmentHistory = async () => {
      if (!pet?.id) return;
      setAssessLoading(true);
      setAssessError('');
      try {
        const res = await apiGet(`/api/pets/${pet.id}/health-form/history`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || 'Failed to load assessment records.');
        let forms = [];
        if (Array.isArray(data?.data?.forms)) forms = data.data.forms;
        else if (data?.data && !Array.isArray(data.data) && Array.isArray(data.data.data)) forms = data.data.data;
        else if (Array.isArray(data?.forms)) forms = data.forms;
        else if (Array.isArray(data?.data)) forms = data.data;
        else if (Array.isArray(data)) forms = data;
        if (!cancelled) setAssessRecords(forms);
      } catch (err) {
        if (!cancelled) setAssessError(err.message || 'Failed to load assessment records.');
      } finally {
        if (!cancelled) setAssessLoading(false);
      }
    };

    // Execute concurrently in parallel
    Promise.all([loadPetDetail(), loadAppointments(), loadAssessmentHistory()]);

    return () => { cancelled = true; };
  }, [pet]);

  const handleDownloadAptCsv = async (apt) => {
    if (!apt?.downloadAllowed) {
      setAptsError('Appointment PDF is only available for completed records.');
      return;
    }
    try {
      await exportAppointmentPdf(apt, {
        defaultPetName: pet?.name,
        defaultPetCode: pet?.pet_id,
        defaultOwnerName: '-',
      });
    } catch {
      setAptsError('Failed to generate PDF.');
    }
  };

  const handleDownloadAssessPdf = async (record) => {
    try {
      await downloadPetAssessmentRecordPdf({ record, pet, owner: pet?.owner });
    } catch {
      setAssessError('Failed to generate PDF.');
    }
  };

  const vToBool = (v) => {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'number') return v === 1;
    return ['yes', 'true', '1', 'y'].includes(String(v || '').trim().toLowerCase());
  };
  const vLabel = (v) => (vToBool(v) ? 'Yes' : 'No');
  const vFmtDT = (value) => { if (!value) return '-'; const d = new Date(String(value)); return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('en-US', { timeZone: 'Asia/Manila',  year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); };
  const vFmtDS = (value) => { if (!value) return '-'; const d = new Date(String(value)); return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-US', { timeZone: 'Asia/Manila',  year: 'numeric', month: 'short', day: 'numeric' }); };
  const vHasSvc = (r) => Boolean(r?.service_id || r?.service?.id || r?.service?.display_id || (r?.service_name && String(r.service_name).trim() !== ''));

  if (!pet) return null;
  const displayPet = petDetail || pet;

  const petInitials = String(pet.name || '?').slice(0, 2).toUpperCase();

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 h-[100dvh] min-h-[100dvh] w-screen p-3 sm:p-4" onClick={onClose}>
      <div className="w-full max-w-md min-h-0 flex flex-col max-h-[92dvh] rounded-2xl overflow-hidden bg-white shadow-2xl font-poppins" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between bg-brand-teal px-5 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-paw text-white text-sm" />
            <h2 className="text-sm font-bold text-white uppercase tracking-widest">Pet Records</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors"
            aria-label="Close"
          >
            <X size={15} strokeWidth={2.5} />
          </button>
        </div>
        <div className="h-1 bg-brand-teal-light shrink-0" />

        {/* Pet Profile Section */}
        <div className="px-4 pt-4 pb-3 min-h-0 max-h-[38dvh] overflow-y-auto">
          <div className="flex items-center gap-4 rounded-2xl p-4 border bg-brand-teal-light/30 border-brand-teal/20">
            <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0 border-2 shadow-sm border-brand-teal/30">
              {pet.photo_url ? (
                <img src={pet.photo_url} alt={titleCasePetName(pet.name)} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-brand-teal flex items-center justify-center">
                  <span className="text-lg font-semibold text-white">{petInitials}</span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="truncate text-lg font-medium uppercase leading-tight text-brand-dark">
                {titleCasePetName(pet.name)}
              </p>
              {pet.pet_id && (
                <p className="text-[10px] font-semibold uppercase tracking-widest mt-0.5 text-brand-teal">
                  {pet.pet_id}
                </p>
              )}
              <p className="text-[10px] mt-0.5 text-brand-teal-dark/70">
                {sanitizeText(pet.species_type?.name || '')}
                {pet.breed?.name ? ` | ${sanitizeText(pet.breed.name)}` : ''}
              </p>
            </div>
          </div>
          <div className="mt-3 rounded-xl border border-brand-teal/20 bg-white p-3">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-brand-teal mb-2">Pet Profile</p>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between gap-2"><span className="text-brand-dark-soft font-semibold">Species</span><span className="text-brand-dark font-medium">{sanitizeText(pet?.species_type?.name || '-')}</span></div>
              <div className="flex items-center justify-between gap-2"><span className="text-brand-dark-soft font-semibold">Breed</span><span className="text-brand-dark font-medium">{normalizeBreedName(pet?.breed?.name || pet?.breed || '-')}</span></div>
              <div className="flex items-center justify-between gap-2"><span className="text-brand-dark-soft font-semibold">Sex</span><span className="text-brand-dark font-medium">{pet?.sex ? pet.sex.charAt(0).toUpperCase() + pet.sex.slice(1) : '-'}</span></div>
              <div className="flex items-center justify-between gap-2"><span className="text-brand-dark-soft font-semibold">Date of Birth</span><span className="text-brand-dark font-medium">{fmtDate(pet?.date_of_birth) || '-'}</span></div>
              <div className="flex items-center justify-between gap-2"><span className="text-brand-dark-soft font-semibold">Weight</span><span className="text-brand-dark font-medium">{formatWeightKg(pet?.weight_kg)}</span></div>
            </div>
          </div>
          <div className="mt-3 rounded-xl border border-brand-teal/20 bg-white p-3">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-brand-teal mb-2">Pet Recognition</p>
            <div className="space-y-2 text-[11px]">
              <div className="flex items-center justify-between gap-2">
                <span className="text-brand-dark-soft font-semibold">Pet Recognition Registered</span>
                <span className="text-brand-dark font-semibold">{recognitionStatusLabel(displayPet)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-brand-dark-soft font-semibold">Recognition Registered At</span>
                <span className="text-brand-dark text-right">{recognitionRegisteredAtLabel(displayPet)}</span>
              </div>
              <div className="pt-1">
                <span className="text-brand-dark-soft font-semibold">Recognition Photo</span>
                {displayPet?.identification_image_url ? (
                  <button
                    type="button"
                    onClick={() => setPreviewOpen(true)}
                    className="mt-1 block h-12 w-12 overflow-hidden rounded-lg border border-brand-teal/30"
                    title="View recognition photo"
                  >
                    <img src={displayPet.identification_image_url} alt="Recognition" className="h-full w-full object-cover" />
                  </button>
                ) : (
                  <span className="mt-1 block text-brand-dark">Not saved</span>
                )}
              </div>
            </div>
          </div>
          <div className="mt-3 rounded-xl border border-brand-teal/20 bg-white p-3">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-brand-teal mb-2">Pet Owner Profile</p>
            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between gap-2"><span className="text-brand-dark-soft font-semibold">Pet Owner</span><span className="text-brand-dark text-right font-medium">{ownerName(pet?.owner) || '-'}</span></div>
              <div className="flex items-center justify-between gap-2"><span className="text-brand-dark-soft font-semibold">Pet Owner ID</span><span className="text-brand-dark font-medium">{pet?.owner?.display_id || '-'}</span></div>
              <div className="flex items-start justify-between gap-2"><span className="text-brand-dark-soft font-semibold">Email</span><span className="text-brand-dark text-right font-medium break-all">{pet?.owner?.email || '-'}</span></div>
              <div className="flex items-center justify-between gap-2"><span className="text-brand-dark-soft font-semibold">Phone</span><span className="text-brand-dark font-medium">{pet?.owner?.phone || '-'}</span></div>
              <div className="flex items-start justify-between gap-2"><span className="text-brand-dark-soft font-semibold">Address</span><span className="text-brand-dark text-right font-medium">{pet?.owner?.address || '-'}</span></div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-brand-teal/20 shrink-0">
          <button
            type="button"
            onClick={() => setTab('history')}
            className={`flex-1 py-3 text-xs font-bold transition-colors ${
              tab === 'history' ? 'bg-brand-teal text-white' : 'text-brand-teal hover:bg-brand-teal/10'
            }`}
          >
            <i className="fa-solid fa-calendar-check mr-1.5" />
            History
            {!aptsLoading && <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-extrabold ${tab === 'history' ? 'bg-white/20' : 'bg-brand-teal/20'}`}>
              {appointments.length}
            </span>}
          </button>
          <button
            type="button"
            onClick={() => setTab('assessment')}
            className={`flex-1 py-3 text-xs font-bold transition-colors ${
              tab === 'assessment' ? 'bg-brand-teal text-white' : 'text-brand-teal hover:bg-brand-teal/10'
            }`}
          >
            <i className="fa-solid fa-clipboard-list mr-1.5" />
            Assessment
            {!assessLoading && <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[9px] font-extrabold ${tab === 'assessment' ? 'bg-white/20' : 'bg-brand-teal/20'}`}>
              {completedAssessRecords.length}
            </span>}
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-4 space-y-2">
          {tab === 'history' && (
            <>
              {aptsLoading && <AdminSkeleton variant="table" label="Loading appointment history" rows={2} />}
              {!aptsLoading && aptsError && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{aptsError}</p>}
              {!aptsLoading && !aptsError && appointments.length === 0 && (
                <div className="rounded-xl border border-brand-teal/20 bg-white px-4 py-8 text-center">
                  <i className="fa-solid fa-calendar text-brand-teal/45 text-2xl mb-2 block" />
                  <p className="text-xs font-bold text-brand-dark">No appointment history yet.</p>
                  <p className="text-[10px] font-medium text-brand-dark-soft mt-1">History will appear here once bookings are completed.</p>
                </div>
              )}
              {!aptsLoading && !aptsError && appointments.map((apt) => {
                const aptKey = apt.id || apt.dateIso || apt.date;
                const isExp = expandedAptId === aptKey;
                return (
                  <div key={aptKey} className="rounded-lg border border-brand-dark-light overflow-hidden">
                    <button type="button" onClick={() => setExpandedAptId(isExp ? null : aptKey)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-white hover:bg-brand-dark/5 transition-colors text-left">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-brand-dark truncate">{apt.service || '-'}</p>
                        <p className="text-[10px] text-brand-dark-soft">{apt.date || '-'}{apt.time ? ` - ${apt.time}` : ''}</p>
                      </div>
                      <i className={`fa-solid fa-chevron-down text-brand-teal text-xs transition-transform shrink-0 ${isExp ? 'rotate-180' : ''}`} />
                    </button>
                    {isExp && (
                      <div className="px-4 py-3 border-t border-brand-dark-light bg-white">
                        <div className="space-y-2.5 text-[11px]">
                          <div className="flex items-start gap-3">
                            <span className="text-brand-dark-soft font-semibold w-24 shrink-0">Service</span>
                            <span className="text-brand-dark font-medium flex-1">{apt.service || '-'}</span>
                          </div>
                          <div className="flex items-start gap-3">
                            <span className="text-brand-dark-soft font-semibold w-24 shrink-0">Service ID</span>
                            <span className="text-brand-dark font-medium flex-1">{apt.serviceId || '-'}</span>
                          </div>
                          <div className="flex items-start gap-3">
                            <span className="text-brand-dark-soft font-semibold w-24 shrink-0">Date</span>
                            <span className="text-brand-dark font-medium flex-1">{apt.date || '-'}</span>
                          </div>
                          <div className="flex items-start gap-3">
                            <span className="text-brand-dark-soft font-semibold w-24 shrink-0">Time</span>
                            <span className="text-brand-dark font-medium flex-1">{apt.time || '-'}</span>
                          </div>
                          <div className="flex items-start gap-3">
                            <span className="text-brand-dark-soft font-semibold w-24 shrink-0">Handled By</span>
                            <span className="text-brand-dark font-medium flex-1">{apt.handledBy || '-'}</span>
                          </div>
                          {apt.isHotel && (
                            <div className="flex items-start gap-3">
                              <span className="text-brand-dark-soft font-semibold w-24 shrink-0">Reservation Mode</span>
                              <span className="text-brand-dark font-medium flex-1">{apt.reservationPaymentMode || '-'}</span>
                            </div>
                          )}
                          <div className="flex items-start gap-3">
                            <span className="text-brand-dark-soft font-semibold w-24 shrink-0">{apt.isHotel ? 'Reservation Reference' : 'Payment Reference'}</span>
                            <span className="text-brand-dark font-medium flex-1 break-all">{formatReference(apt.paymentReference || '-')}</span>
                          </div>
                          <div className="flex items-start gap-3">
                            <span className="text-brand-dark-soft font-semibold w-24 shrink-0">Instructions</span>
                            <span className="text-brand-dark font-medium flex-1">{apt.specialInstructions || 'None'}</span>
                          </div>
                        </div>
                        {apt.isHotel && String(apt.status || '').toLowerCase() === 'completed' && (
                          <div className="mt-3">
                            <HotelStayCorrectionHistory appointmentId={apt.id} />
                          </div>
                        )}
                        <div className="mt-3 flex justify-end">
                          <button type="button" disabled={!apt.downloadAllowed} onClick={() => handleDownloadAptCsv(apt)}
                            className="rounded-lg border border-brand-teal px-2.5 py-1.5 text-[10px] font-bold text-brand-teal hover:bg-brand-teal hover:text-white transition-colors">
                            Download PDF
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}

          {tab === 'assessment' && (
            <>
              {assessLoading && <AdminSkeleton variant="table" label="Loading assessment records" rows={2} />}
              {!assessLoading && assessError && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{assessError}</p>}
              {!assessLoading && !assessError && completedAssessRecords.length === 0 && (
                <div className="rounded-xl border border-brand-teal/20 bg-white px-4 py-8 text-center">
                  <i className="fa-solid fa-clipboard-list text-brand-teal/45 text-2xl mb-2 block" />
                  <p className="text-xs font-bold text-brand-dark">No completed assessment records yet.</p>
                  <p className="text-[10px] font-medium text-brand-dark-soft mt-1">Assessment records will appear once the linked appointment is completed.</p>
                </div>
              )}
              {!assessLoading && !assessError && [...completedAssessRecords].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map((record) => {
                const isExp = expandedAssessId === record.id;
                const serviceName = record.service_name || record.service?.name || record.appointment?.service || null;
                const linkedAppointmentCode = appointmentCodes[String(record.appointment_id)];
                const appointmentIdValue = String(record.appointment_id || '').trim();
                const appointmentCode = record.appointment_code || record.appointment?.appointment_code || linkedAppointmentCode || appointmentIdValue || null;
                return (
                  <div key={record.id} className="rounded-lg border border-brand-dark-light overflow-hidden">
                    <button type="button" onClick={() => setExpandedAssessId(isExp ? null : record.id)}
                      className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-white hover:bg-brand-dark/5 transition-colors text-left">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-brand-dark truncate">{vFmtDT(record.created_at)}</p>
                        <p className="text-[10px] text-brand-dark-soft">
                          {serviceName ? `Service: ${serviceName}` : 'Vacc: ' + vLabel(record.is_vaccinated) + ' | Ticks/Flea: ' + (vToBool(record.has_ticks) || vToBool(record.has_flea) ? 'Alert' : 'None')}
                        </p>
                      </div>
                      <i className={`fa-solid fa-chevron-down text-brand-teal text-xs transition-transform shrink-0 ${isExp ? 'rotate-180' : ''}`} />
                    </button>
                    {isExp && (
                      <div className="px-4 py-3 border-t border-brand-dark-light bg-white">
                        <div className="space-y-2.5 text-[11px]">
                          <div className="flex items-start gap-3">
                            <span className="text-brand-dark-soft font-semibold w-28 shrink-0">Submitted</span>
                            <span className="text-brand-dark font-medium flex-1">{vFmtDT(record.created_at)}</span>
                          </div>
                          <div className="flex items-start gap-3">
                            <span className="text-brand-dark-soft font-semibold w-28 shrink-0">Appointment ID</span>
                            <span className="text-brand-dark font-medium flex-1">{appointmentCode || '-'}</span>
                          </div>
                          <div className="flex items-start gap-3">
                            <span className="text-brand-dark-soft font-semibold w-28 shrink-0">Service</span>
                            <span className="text-brand-dark font-medium flex-1">{serviceName || '-'}</span>
                          </div>
                          <div className="flex items-start gap-3">
                            <span className="text-brand-dark-soft font-semibold w-28 shrink-0">Vaccinated</span>
                            <span className="text-brand-dark font-medium flex-1">{vLabel(record.is_vaccinated)}</span>
                          </div>
                          <div className="flex items-start gap-3">
                            <span className="text-brand-dark-soft font-semibold w-28 shrink-0">Vaccine Date</span>
                            <span className="text-brand-dark font-medium flex-1">{vFmtDS(record.vaccine_date)}</span>
                          </div>
                          <div className="flex items-start gap-3">
                            <span className="text-brand-dark-soft font-semibold w-28 shrink-0">Friendly</span>
                            <span className="text-brand-dark font-medium flex-1">{record.is_friendly || '-'}</span>
                          </div>
                          <div className="flex items-start gap-3">
                            <span className="text-brand-dark-soft font-semibold w-28 shrink-0">Treat Preference</span>
                            <span className="text-brand-dark font-medium flex-1">{record.treat_preference || '-'}</span>
                          </div>
                          <div className="flex items-start gap-3">
                            <span className="text-brand-dark-soft font-semibold w-28 shrink-0">Allergies</span>
                            <span className="text-brand-dark font-medium flex-1">{record.allergies || '-'}</span>
                          </div>
                          <div className="flex items-start gap-3">
                            <span className="text-brand-dark-soft font-semibold w-28 shrink-0">Ticks</span>
                            <span className="text-brand-dark font-medium flex-1">{vLabel(record.has_ticks)}</span>
                          </div>
                          <div className="flex items-start gap-3">
                            <span className="text-brand-dark-soft font-semibold w-28 shrink-0">Flea</span>
                            <span className="text-brand-dark font-medium flex-1">{vLabel(record.has_flea)}</span>
                          </div>
                          <div className="flex items-start gap-3">
                            <span className="text-brand-dark-soft font-semibold w-28 shrink-0">Wound</span>
                            <span className="text-brand-dark font-medium flex-1">{vLabel(record.has_wound)}</span>
                          </div>
                          <div className="flex items-start gap-3">
                            <span className="text-brand-dark-soft font-semibold w-28 shrink-0">Mange</span>
                            <span className="text-brand-dark font-medium flex-1">{vLabel(record.has_mange)}</span>
                          </div>
                          <div className="flex items-start gap-3">
                            <span className="text-brand-dark-soft font-semibold w-28 shrink-0">Medical</span>
                            <span className="text-brand-dark font-medium flex-1">{record.medical_conditions || '-'}</span>
                          </div>
                          <div className="flex items-start gap-3">
                            <span className="text-brand-dark-soft font-semibold w-28 shrink-0">Declaration</span>
                            <span className="text-brand-dark font-medium flex-1">{vLabel(record.declaration_accepted)}</span>
                          </div>
                        </div>
                        <div className="mt-3 flex justify-end">
                          {vHasSvc(record) ? (
                            <button type="button" disabled={String(record?.appointment?.status || '').toLowerCase() !== 'completed'} onClick={() => handleDownloadAssessPdf(record)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-teal px-2.5 py-1.5 text-[10px] font-bold text-brand-teal hover:bg-brand-teal hover:text-white transition-colors">
                              <Download size={10} />
                              Download PDF
                            </button>
                          ) : (
                            <span className="text-[10px] font-semibold text-brand-dark-soft">PDF available once service is linked</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </>
          )}
        </div>
        {typeof onScheduleAppointment === 'function' && (
          <div className="sticky bottom-0 z-10 shrink-0 border-t border-brand-teal/20 bg-white/95 backdrop-blur-sm px-4 py-3">
            <button
              type="button"
              onClick={onScheduleAppointment}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-teal px-4 py-3 text-sm font-bold text-white transition hover:bg-brand-teal-dark"
            >
              <i className="fa-solid fa-calendar-plus" />
              Schedule an Appointment
            </button>
          </div>
        )}
      </div>
      {previewOpen && displayPet?.identification_image_url && (
        <div
          className="fixed inset-0 z-[220] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreviewOpen(false)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw] rounded-2xl bg-white p-2 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              className="absolute -right-3 -top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-brand-dark shadow-lg ring-1 ring-black/10 transition hover:bg-brand-surface"
              aria-label="Close recognition photo"
            >
              <X size={17} />
            </button>
            <img src={displayPet.identification_image_url} alt="Recognition preview" className="max-h-[86vh] max-w-[86vw] rounded-xl object-contain" />
            <p className="truncate px-2 pb-1 pt-2 text-center text-xs font-semibold text-brand-dark-soft">
              Pet ID: {displayPet.pet_id || '-'}
            </p>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
}
