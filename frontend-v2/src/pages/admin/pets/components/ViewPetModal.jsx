import { useEffect, useState } from 'react';
import { Download, FileText, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { apiFetch, apiGet } from '../../../../api/apiClient';
import { AdminSkeleton } from '../../../../components/admin/AdminLoading';
import { formatReference, formatWeightKg } from '../../../../utils/recordFormatters';
import { normalizeBreedName } from '../../../../utils/textUtils';
import {
  getAppointmentServiceCategory,
  getOrdinaryPaymentReference,
} from '../../../../utils/appointmentServiceType';
import useBodyScrollLock from '../../../../hooks/useBodyScrollLock';
import HotelStayCorrectionHistory from '../../appointment/HotelStayCorrectionHistory';
import { downloadPetAssessmentRecordPdf } from '../../../../utils/petAssessmentBlankPdf';
import {
  fmtDate, formatTime, getInitials, getSpeciesTone,
  ownerName, getAppointmentPackageName, getAppointmentPackageCode,
  isCompletedStatus, extractAppointments, titleCasePetName,
  recognitionStatusLabel, recognitionRegisteredAtLabel,
  getReservationPaymentMode, exportAppointmentPdf,
} from '../petUtils';

function ViewInfoRow({ label, value }) {
  return (
    <div className="py-1.5">
      <p className="text-xs font-medium text-brand-dark break-words">
        <span className="text-brand-dark-soft font-semibold uppercase tracking-wide">{label} :</span>{' '}
        {value || '-'}
      </p>
    </div>
  );
}

function EmptyRecordsFallback({ title, subtitle }) {
  return (
    <div className="rounded-xl border border-brand-teal/20 bg-white px-5 py-8 text-center">
      <FileText size={34} className="mx-auto text-brand-teal/45" />
      <p className="mt-2 text-sm font-bold text-brand-dark">{title}</p>
      <p className="mt-1 text-xs font-medium text-brand-dark-soft">{subtitle}</p>
    </div>
  );
}

export default function ViewPetModal({ pet, onClose, onScheduleAppointment = null }) {
  useBodyScrollLock(!!pet);
  const [petDetail, setPetDetail]               = useState(pet || null);
  const [ownerDetail, setOwnerDetail]           = useState(pet?.owner || null);
  const [appointments, setAppointments]         = useState([]);
  const [appointmentCodes, setAppointmentCodes] = useState({});
  const [aptsLoading, setAptsLoading]           = useState(false);
  const [aptsError, setAptsError]               = useState('');
  const [rightView, setRightView]               = useState('history');
  const [assessRecords, setAssessRecords]       = useState([]);
  const [assessLoading, setAssessLoading]       = useState(false);
  const [assessError, setAssessError]           = useState('');
  const [expandedAptId, setExpandedAptId]       = useState(null);
  const [expandedAssessId, setExpandedAssessId] = useState(null);
  const [previewOpen, setPreviewOpen]           = useState(false);

  useEffect(() => {
    if (!pet) return;
    setPetDetail(pet);
    setOwnerDetail(pet.owner || null);
    setAppointments([]);
    setAppointmentCodes({});
    setAptsError('');
    setAssessRecords([]);
    setAssessError('');
    setRightView('history');
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
        // keep prop pet
      }
    };

    const loadOwner = async () => {
      if (pet.owner || !pet.owner_id) return;
      try {
        const res = await apiFetch(`/api/owners/${pet.owner_id}`);
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok) setOwnerDetail(data?.data || data);
      } catch {
        // keep prop pet.owner
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

    // Execute all background fetches concurrently in parallel
    Promise.all([loadPetDetail(), loadOwner(), loadAppointments(), loadAssessmentHistory()]);

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
        defaultOwnerName: ownerFullName,
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
  const vHuman = (v) => { const t = String(v || '').trim(); return t ? t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : '-'; };
  const vHasSvc = (r) => Boolean(r?.service_id || r?.service?.id || r?.service?.display_id || (r?.service_name && String(r.service_name).trim() !== ''));

  if (!pet) return null;
  const displayPet = petDetail || pet;
  const recognitionPhotos = Array.isArray(displayPet?.recognition_photos) ? displayPet.recognition_photos : [];

  const tone = getSpeciesTone(pet);
  const ownerFullName = ownerName(ownerDetail);

  const modal = (
    <div className="fixed inset-0 z-[220] flex items-center justify-center p-3 sm:p-4 backdrop-blur-sm bg-brand-dark/40 h-[100dvh] min-h-[100dvh] w-screen" onClick={onClose}>
      <div className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] bg-white shadow-2xl ring-1 ring-black/5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between bg-brand-teal px-5 py-3.5 shrink-0">
          <h2 className="text-sm font-bold text-white">View Pet</h2>
          <button type="button" onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25">
            <X size={15} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-[320px_1fr]">
          {/* Left panel */}
          <div className="flex min-h-0 flex-col overflow-hidden border-b border-brand-teal/20 bg-gradient-to-b from-brand-teal/5 to-white text-brand-dark lg:border-b-0 lg:border-r lg:border-brand-teal/20">
            <div className="px-6 pb-4 pt-6 shrink-0">
              <div className="flex flex-col items-center text-center">
                <div className={`flex h-20 w-20 items-center justify-center overflow-hidden rounded-full text-xl font-bold text-white ring-4 ring-white shadow-lg ${tone.mediaBg}`}>
                  {displayPet.photo_url
                    ? <img src={displayPet.photo_url} alt={titleCasePetName(displayPet.name)} className="h-full w-full object-cover" />
                    : getInitials(displayPet.name || 'Pet')}
                </div>
                <p className="mt-3 text-xl font-medium leading-tight text-brand-dark">{titleCasePetName(displayPet.name)}</p>
                <p className="mt-1 text-xs text-brand-dark-soft">Pet ID: {displayPet.pet_id || '-'}</p>
                <div className="mt-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${pet?.is_active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${pet?.is_active !== false ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    {pet?.is_active !== false ? 'Active' : 'Deactivated'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-6 pb-6 no-scrollbar">
              <div className="mb-4 rounded-2xl border border-brand-teal/20 bg-white p-4">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand-teal mb-3">Pet Profile</p>
                <div className="space-y-0 divide-y divide-brand-teal/10">
                  <ViewInfoRow label="Species" value={pet?.species_type?.name || '-'} />
                  <ViewInfoRow label="Breed" value={normalizeBreedName(pet?.breed?.name || pet?.breed || '-')} />
                  <ViewInfoRow label="Sex" value={pet?.sex ? pet.sex.charAt(0).toUpperCase() + pet.sex.slice(1) : '-'} />
                  <ViewInfoRow label="Date of Birth" value={fmtDate(pet?.date_of_birth)} />
                  <ViewInfoRow label="Weight" value={formatWeightKg(pet?.weight_kg)} />
                </div>
              </div>
              <div className="mb-4 rounded-2xl border border-brand-teal/20 bg-white p-4">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand-teal mb-3">Pet Recognition</p>
                <div className="space-y-0 divide-y divide-brand-teal/10">
                  <ViewInfoRow label="Pet Recognition Registered" value={recognitionStatusLabel(displayPet)} />
                  <ViewInfoRow label="Recognition Registered At" value={recognitionRegisteredAtLabel(displayPet)} />
                  <div className="flex items-start justify-between gap-3 py-2">
                    <p className="text-xs font-semibold text-brand-dark-soft uppercase tracking-wide">Recognition Photo</p>
                    {displayPet?.identification_image_url ? (
                      <button
                        type="button"
                        onClick={() => setPreviewOpen(true)}
                        className="group relative h-10 w-10 overflow-hidden rounded border border-brand-teal/30"
                        title="View recognition photo"
                      >
                        <img src={displayPet.identification_image_url} alt="Recognition" className="h-full w-full object-cover" />
                        <span className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/20" />
                      </button>
                    ) : (
                      <p className="text-xs font-medium text-brand-dark">Not saved</p>
                    )}
                  </div>
                  {recognitionPhotos.length > 0 && (
                    <div className="pt-3">
                      <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand-teal">Recognition Photos</p>
                      <div className="mt-2 grid grid-cols-4 gap-2">
                        {recognitionPhotos.map((photo) => (
                          <img key={photo.id || photo.photo_url} src={photo.photo_url} alt="Recognition capture" className="h-16 w-full rounded-lg border border-brand-teal/20 object-cover" />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="mb-4 rounded-2xl border border-brand-teal/20 bg-white p-4">
                <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-brand-teal mb-3">Pet Owner Profile</p>
                <div className="space-y-0 divide-y divide-brand-teal/10">
                  <ViewInfoRow label="Pet Owner" value={ownerFullName || '-'} />
                  <ViewInfoRow label="Pet Owner ID" value={ownerDetail?.display_id || '-'} />
                  <ViewInfoRow label="Email" value={ownerDetail?.email || '-'} />
                  <ViewInfoRow label="Phone" value={ownerDetail?.phone || '-'} />
                  <ViewInfoRow label="Address" value={ownerDetail?.address || '-'} />
                </div>
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
            <div className="border-b border-brand-teal/20 bg-white px-6 py-5 shrink-0">
              <div className="flex items-center justify-between mb-4">
                <div className="min-w-0">
                  <h3 className="text-xl font-extrabold text-brand-dark">Pet Records</h3>
                  <p className="mt-0.5 text-xs text-brand-dark-soft">View appointment history and assessment records</p>
                </div>
                <span className={`rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${tone.speciesBadge}`}>
                  {pet.species_type?.name || '-'}
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => setRightView('history')}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-all ${rightView === 'history' ? 'bg-brand-teal text-white shadow-md' : 'bg-brand-teal/10 text-brand-teal hover:bg-brand-teal/20'}`}>
                  <i className="fa-solid fa-calendar-check" />
                  Appointment History
                  {!aptsLoading && <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${rightView === 'history' ? 'bg-white/20' : 'bg-brand-teal/20'}`}>
                    {appointments.length}
                  </span>}
                </button>
                <button type="button" onClick={() => setRightView('assessment')}
                  className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition-all ${rightView === 'assessment' ? 'bg-brand-teal text-white shadow-md' : 'bg-brand-teal/10 text-brand-teal hover:bg-brand-teal/20'}`}>
                  <i className="fa-solid fa-clipboard-list" />
                  Assessment Records
                  {!assessLoading && <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold ${rightView === 'assessment' ? 'bg-white/20' : 'bg-brand-teal/20'}`}>
                    {assessRecords.length}
                  </span>}
                </button>
                {typeof onScheduleAppointment === 'function' && (
                  <button
                    type="button"
                    onClick={onScheduleAppointment}
                    className="ml-auto flex items-center gap-2 rounded-lg bg-brand-teal px-4 py-2.5 text-sm font-bold text-white transition hover:bg-brand-teal-dark"
                  >
                    <i className="fa-solid fa-calendar-plus" />
                    Schedule an Appointment
                  </button>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3 no-scrollbar">

              {rightView === 'history' && (
                <div className="space-y-2">
                  {aptsLoading && <AdminSkeleton variant="table" label="Loading appointment history" rows={3} />}
                  {!aptsLoading && aptsError && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{aptsError}</p>}
                  {!aptsLoading && !aptsError && appointments.length === 0 && (
                    <EmptyRecordsFallback title="No appointment history yet." subtitle="Once this pet has bookings, the full history will appear here." />
                  )}
                  {!aptsLoading && !aptsError && appointments.map((apt) => {
                    const aptKey = apt.id || apt.dateIso || apt.date;
                    const isExp = expandedAptId === aptKey;
                    return (
                      <div key={aptKey} className="rounded-lg border border-brand-dark-light overflow-hidden">
                        <button type="button" onClick={() => setExpandedAptId(isExp ? null : aptKey)}
                          className="w-full flex items-center justify-between gap-3 px-5 py-3 bg-white hover:bg-brand-dark/5 transition-colors text-left">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-brand-dark truncate">{apt.service || '-'}</p>
                            <p className="text-xs text-brand-dark-soft">{apt.date || '-'}{apt.time ? ` - ${apt.time}` : ''}</p>
                          </div>
                          <i className={`fa-solid fa-chevron-down text-brand-teal text-sm transition-transform shrink-0 ${isExp ? 'rotate-180' : ''}`} />
                        </button>
                        {isExp && (
                          <div className="px-5 py-4 border-t border-brand-dark-light bg-white">
                            <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 text-xs">
                              {[['Service', apt.service], ['Service ID', apt.serviceId], ['Date', apt.date], ['Time', apt.time], ['Handled By', apt.handledBy]].map(([label, value]) => (
                                <div key={label}><p className="text-brand-dark-soft font-semibold mb-1">{label}</p><p className="text-brand-dark font-medium">{value || '-'}</p></div>
                              ))}
                              {apt.isHotel && (
                                <div className="sm:col-span-2"><p className="text-brand-dark-soft font-semibold mb-1">Reservation Channel</p><p className="text-brand-dark font-medium">{apt.reservationPaymentMode || '-'}</p></div>
                              )}
                              <div className="sm:col-span-2"><p className="text-brand-dark-soft font-semibold mb-1">{apt.isHotel ? 'Reservation Reference' : 'Payment Reference'}</p><p className="text-brand-dark font-medium">{formatReference(apt.paymentReference || '-')}</p></div>
                              <div className="sm:col-span-2"><p className="text-brand-dark-soft font-semibold mb-1">Special Instructions</p><p className="text-brand-dark font-medium">{apt.specialInstructions || 'None'}</p></div>
                            </div>
                            {apt.isHotel && String(apt.status || '').toLowerCase() === 'completed' && (
                              <div className="mt-3">
                                <HotelStayCorrectionHistory appointmentId={apt.id} />
                              </div>
                            )}
                            <div className="mt-3 flex justify-end">
                              <button type="button" disabled={!apt.downloadAllowed} onClick={() => handleDownloadAptCsv(apt)}
                                className="rounded-lg border border-brand-teal px-3 py-1.5 text-[11px] font-bold text-brand-teal hover:bg-brand-teal hover:text-white transition-colors">
                                Download PDF
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {rightView === 'assessment' && (
                <div className="space-y-2">
                  {assessLoading && <AdminSkeleton variant="table" label="Loading assessment records" rows={3} />}
                  {!assessLoading && assessError && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">{assessError}</p>}
                  {!assessLoading && !assessError && assessRecords.length === 0 && (
                    <EmptyRecordsFallback title="No assessment records yet." subtitle="Assessment records will appear here once a form is saved for this pet." />
                  )}
                  {!assessLoading && !assessError && [...assessRecords].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).map((record) => {
                    const isExp = expandedAssessId === record.id;
                    const serviceName = record.service_name || record.service?.name || record.appointment?.service || null;
                    const linkedAppointmentCode = appointmentCodes[String(record.appointment_id)];
                    const appointmentIdValue = String(record.appointment_id || '').trim();
                    const appointmentCode = record.appointment_code || record.appointment?.appointment_code || linkedAppointmentCode || appointmentIdValue || null;
                    const serviceCategoryRaw = String(record?.service?.category || record?.service_category || record?.appointment?.service?.category || '').toLowerCase();
                    const serviceBadgeColor = serviceCategoryRaw.includes('groom')
                      ? 'bg-brand-grooming-soft text-brand-grooming'
                      : serviceCategoryRaw.includes('hotel')
                        ? 'bg-brand-hotel-soft text-brand-hotel'
                        : serviceCategoryRaw.includes('day')
                          ? 'bg-brand-daycare-soft text-brand-daycare'
                          : 'bg-brand-teal-light text-brand-teal-dark';
                    return (
                      <div key={record.id} className="rounded-lg border border-brand-dark-light overflow-hidden">
                        <button type="button" onClick={() => setExpandedAssessId(isExp ? null : record.id)}
                          className="w-full flex items-center justify-between gap-3 px-5 py-3 bg-white hover:bg-brand-dark/5 transition-colors text-left">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2 mb-0.5">
                              <p className="text-sm font-bold text-brand-dark truncate">{vFmtDT(record.created_at)}</p>
                              {serviceName && (
                                <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${serviceBadgeColor}`}>
                                  {serviceName}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-brand-dark-soft">
                              {'Vacc: ' + vLabel(record.is_vaccinated) + ' | Ticks/Flea: ' + (vToBool(record.has_ticks) || vToBool(record.has_flea) ? 'Alert' : 'None')}
                              {appointmentCode ? ` | ID: ${appointmentCode}` : ''}
                            </p>
                          </div>
                          <i className={`fa-solid fa-chevron-down text-brand-teal text-sm transition-transform shrink-0 ${isExp ? 'rotate-180' : ''}`} />
                        </button>
                        {isExp && (
                          <div className="px-5 py-4 border-t border-brand-dark-light bg-white">
                            <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 text-xs">
                              {[['Submitted', vFmtDT(record.created_at)], ['Appointment ID', appointmentCode || '-'], ['Service', serviceName || '-'], ['Vaccinated', vLabel(record.is_vaccinated)], ['Vaccine Date', vFmtDS(record.vaccine_date)], ['Friendly', vHuman(record.is_friendly)], ['Treat Preference', vHuman(record.treat_preference)], ['Allergies', record.allergies || '-'], ['Ticks', vLabel(record.has_ticks)], ['Flea', vLabel(record.has_flea)], ['Wound', vLabel(record.has_wound)], ['Mange', vLabel(record.has_mange)]].map(([label, value]) => (
                                <div key={label}><p className="text-brand-dark-soft font-semibold mb-1">{label}</p><p className="text-brand-dark font-medium">{value}</p></div>
                              ))}
                              <div className="sm:col-span-2"><p className="text-brand-dark-soft font-semibold mb-1">Medical Conditions</p><p className="text-brand-dark font-medium">{record.medical_conditions || '-'}</p></div>
                              <div><p className="text-brand-dark-soft font-semibold mb-1">Declaration</p><p className="text-brand-dark font-medium">{vLabel(record.declaration_accepted)}</p></div>
                            </div>
                            <div className="mt-3 flex justify-end">
                              {vHasSvc(record) ? (
                                <button type="button"  onClick={() => handleDownloadAssessPdf(record)}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-brand-teal px-3 py-1.5 text-[11px] font-bold text-brand-teal hover:bg-brand-teal hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                                  <Download size={11} />
                                  Download PDF
                                </button>
                              ) : (
                                <span className="text-[11px] font-semibold text-brand-dark-soft">PDF available once service is linked</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      {previewOpen && displayPet?.identification_image_url && (
        <div
          className="fixed inset-0 z-[210] flex items-center justify-center bg-black/70 p-4"
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
    </div>
  );
  return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal;
}
