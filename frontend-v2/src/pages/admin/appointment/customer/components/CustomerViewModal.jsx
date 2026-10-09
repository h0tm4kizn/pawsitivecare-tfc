import { ChevronLeft, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch, apiGet } from '../../../../../api/apiClient';
import { AdminSkeleton } from '../../../../../components/admin/AdminLoading';
import RELATIONSHIP_OPTIONS from '../../../../../constants/emergencyRelationships';
import {
  formatReference,
  formatWeightKg,
} from '../../../../../utils/recordFormatters';
import {
  calcAge,
  extractAppointments,
  formatDate,
  formatTime,
  getAppointmentPackageCode,
  getAppointmentPackageName,
  getArray,
  getInitials,
  getPetRecognitionRegisteredAt,
  getPetRecognitionStatus,
  getSpeciesTone,
  isCompletedStatus,
} from '../customerViewUtils';
import { normalizeBreedName } from '../../../../../utils/textUtils';
import CustomerPetAssessmentView from './CustomerPetAssessmentView';
import CustomerPetHistoryView from './CustomerPetHistoryView';

// component

export default function CustomerViewModal({ owner, initialPetId = null, onClose }) {
  const [detail, setDetail]       = useState(owner);
  const [loading, setLoading]     = useState(false);
  const [loadError, setLoadError] = useState('');

  // appointments (grouped by pet)
  const [appointments, setAppointments]             = useState([]);
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [appointmentsError, setAppointmentsError]   = useState('');

    // pets list
  const [rightView, setRightView] = useState(null);
  const [expandedPetId, setExpandedPetId] = useState(null);

    // assessment records
  const [assessRecords, setAssessRecords]     = useState([]);
  const [assessLoading, setAssessLoading]     = useState(false);
  const [assessError, setAssessError]         = useState('');
  const [expandedAssessId, setExpandedAssessId] = useState(null);

  // history accordion
  const [expandedAptId, setExpandedAptId] = useState(null);
  const [recognitionPreview, setRecognitionPreview] = useState(null);

  // fetch owner detail + appointments
  useEffect(() => {
    let cancelled = false;

    const loadAppointments = async (ownerId) => {
      if (!ownerId) { setAppointments([]); return; }
      setAppointmentsLoading(true);
      setAppointmentsError('');
      try {
        let page = 1, lastPage = 1;
        const allRows = [];
        do {
          const res  = await apiFetch(`/api/appointments?per_page=100&page=${page}`);
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data?.message || 'Failed to load appointment history.');
          const rows = extractAppointments(data).filter((row) => {
            const bookedBy   = row?.booked_by_owner_id;
            const petOwnerId = row?.pet?.owner?.id;
            const ownerMatch = String(bookedBy || petOwnerId || '') === String(ownerId);
            return ownerMatch && isCompletedStatus(row?.status);
          });
          allRows.push(...rows);
          lastPage = Number(data?.data?.last_page || 1);
          page += 1;
        } while (page <= lastPage);

        const normalized = allRows.map((row) => {
          return {
            id: row?.id || '',
            petId: row?.pet_id || row?.pet?.id || '',
            service: getAppointmentPackageName(row),
            serviceId: row?.appointment_code || getAppointmentPackageCode(row),
            date: formatDate(row?.appointment_date || row?.date || null),
            dateIso: String(row?.appointment_date || row?.date || '').slice(0, 10),
            time: formatTime(row?.start_time || row?.time || ''),
            handledBy: row?.handledBy?.name || row?.handled_by?.name || row?.handled_by_name || '-',
            specialInstructions: row?.special_instructions || row?.notes || 'None',
            paymentReference: row?.reference_number || '-',
            ownerName: row?.pet?.owner ? `${row.pet.owner.first_name || ''} ${row.pet.owner.last_name || ''}`.trim() : '-',
            ownerPhone: row?.pet?.owner?.phone || '-',
            ownerEmail: row?.pet?.owner?.email || '-',
            ownerAddress: row?.pet?.owner?.address || '-',
            petName: row?.pet?.name || '-',
            petCode: row?.pet?.pet_id || '-',
            status: String(row?.status || '').replace(/_/g, ' '),
            completedAt: row?.completed_at ? new Date(row.completed_at).toLocaleString('en-US', { timeZone: 'Asia/Manila',  month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-',
            downloadAllowed: isCompletedStatus(row?.status),
          };
        }).sort((a, b) => String(b.dateIso || '').localeCompare(String(a.dateIso || '')));

        if (!cancelled) setAppointments(normalized);
      } catch (err) {
        if (!cancelled) setAppointmentsError(err?.message || 'Failed to load appointment history.');
      } finally {
        if (!cancelled) setAppointmentsLoading(false);
      }
    };

    const load = async () => {
      if (!owner?.id) return;
      setLoading(true);
      setLoadError('');
      try {
        const res  = await apiFetch(`/api/owners/${owner.id}`);
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || 'Failed to load customer details.');
        const row = data?.data || data;
        if (!cancelled) {
          setDetail({
            ...owner, ...row,
            fullName: [row?.first_name, row?.last_name].filter(Boolean).join(' ').trim() || owner?.fullName || '-',
            pets: Array.isArray(row?.pets) ? row.pets : owner?.pets || [],
          });
          loadAppointments(row?.id || owner?.id);
        }
      } catch (err) {
        if (!cancelled) setLoadError(err?.message || 'Failed to load customer details.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    setDetail(owner);
    setAppointments([]);
    setAppointmentsError('');
    setRightView(null);
    setExpandedPetId(null);
    load();
    return () => { cancelled = true; };
  }, [owner]);

    // assessment records
  useEffect(() => {
    if (rightView?.type !== 'assessment' || !rightView?.pet?.id) return;
    let cancelled = false;
    setAssessLoading(true);
    setAssessError('');
    setAssessRecords([]);
    setExpandedAssessId(null);

    apiGet(`/api/pets/${rightView.pet.id}/health-form/history`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || 'Failed to load assessment records.');
        return getArray(data, ['forms']);
      })
      .then((forms) => { if (!cancelled) setAssessRecords(forms); })
      .catch((err) => { if (!cancelled) setAssessError(err.message || 'Failed to load assessment records.'); })
      .finally(() => { if (!cancelled) setAssessLoading(false); });

    return () => { cancelled = true; };
  }, [rightView]);

  const pets = useMemo(() => (Array.isArray(detail?.pets) ? detail.pets : []), [detail]);
  const fullName = detail?.fullName || [detail?.first_name, detail?.last_name].filter(Boolean).join(' ').trim() || '-';

  useEffect(() => {
    if (rightView || expandedPetId || pets.length === 0) return;
    const targetPet = initialPetId
      ? pets.find((pet) => String(pet?.id) === String(initialPetId))
      : pets[0];
    setExpandedPetId(String(targetPet?.id || pets[0]?.id || 0));
  }, [rightView, expandedPetId, pets, initialPetId]);

  const appointmentHistoryByPet = useMemo(() => {
    const grouped = {};
    appointments.forEach((a) => {
      const key = String(a?.petId || '').trim();
      if (!key) return;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(a);
    });
    return grouped;
  }, [appointments]);

  const activePetHistory = useMemo(() => {
    if (rightView?.type !== 'history' || !rightView?.pet?.id) return [];
    return appointmentHistoryByPet[String(rightView.pet.id)] || [];
  }, [rightView, appointmentHistoryByPet]);

  const goBack = () => {
    setRightView(null);
    setExpandedAptId(null);
    setExpandedAssessId(null);
  };

  const handleDownloadAptCsv = async (apt) => {
    if (!apt?.downloadAllowed) return;
    const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    let y = 14;
    const line = (label, value) => {
      doc.setFont('helvetica', 'bold');
      doc.text(`${label}:`, 14, y);
      doc.setFont('helvetica', 'normal');
      doc.text(String(value || '-'), 62, y);
      y += 6;
    };
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('Appointment Record', 14, y);
    y += 8;
    doc.setFontSize(10);
    line('Appointment ID', apt?.serviceId || '-');
    line('Status', apt?.status || '-');
    line('Service', apt?.service || '-');
    line('Date', apt?.date || '-');
    line('Time', apt?.time || '-');
    line('Completed Time', apt?.completedAt || '-');
    line('Handled By', apt?.handledBy || '-');
    line('Pet Name', apt?.petName || '-');
    line('Pet ID', apt?.petCode || '-');
    line('Owner', apt?.ownerName || '-');
    line('Contact', apt?.ownerPhone || '-');
    line('Email', apt?.ownerEmail || '-');
    line('Address', apt?.ownerAddress || '-');
    line('Reference', formatReference(apt?.paymentReference || '-'));
    line('Special Instructions', apt?.specialInstructions || 'None');
    const safeId = String(apt?.serviceId || apt?.id || 'appointment').toLowerCase().replace(/[^a-z0-9_-]+/g, '-');
    const safeDate = new Date().toISOString().slice(0, 10);
    doc.save(`appointment-${safeId}-${safeDate}.pdf`);
  };

  const handleDownloadAssessPdf = async (record) => {
    const petId = rightView?.pet?.id;
    if (!petId || !record?.id) {
      throw new Error('This assessment record could not be identified. Refresh the records and try again.');
    }

    const query = new URLSearchParams({ form_id: String(record.id) });
    const response = await apiFetch(
      `/api/pets/${encodeURIComponent(petId)}/health-form/pdf?${query.toString()}`,
      { headers: { Accept: 'application/pdf, application/json' } },
    );

    if (!response.ok) {
      const contentType = response.headers.get('content-type') || '';
      const payload = contentType.includes('application/json')
        ? await response.json().catch(() => ({}))
        : {};
      throw new Error(payload?.message || 'Unable to download this assessment PDF. Please try again.');
    }

    const pdf = await response.blob();
    if (!pdf.size) throw new Error('The assessment PDF was empty. Please try again.');

    const downloadUrl = URL.createObjectURL(pdf);
    const link = document.createElement('a');
    const petCode = String(rightView.pet.pet_id || rightView.pet.name || 'pet')
      .trim()
      .replace(/[^a-z0-9_-]+/gi, '-');
    link.href = downloadUrl;
    link.download = `pet-assessment-${petCode}-${record.id}.pdf`;
    document.body.appendChild(link);
    try {
      link.click();
    } finally {
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
    }
  };

  // right panel
  const renderRightHeader = () => {
    if (!rightView) {
      return (
        <div className="flex items-center justify-between border-b border-brand-teal/20 bg-white px-6 py-4">
          <div>
            <h3 className="text-lg font-extrabold text-brand-dark">Registered Pets</h3>
            <p className="mt-0.5 text-sm text-brand-dark-soft">View each pet profile and details.</p>
          </div>
          <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-brand-teal/10 px-2.5 text-xs font-bold text-brand-teal-dark">
            {pets.length}
          </span>
        </div>
      );
    }
    const title = rightView.type === 'history' ? 'Appointment History' : 'Assessment Records';
    return (
      <div className="flex items-center gap-2.5 border-b border-brand-teal/20 bg-white px-5 py-3.5">
        <button
          type="button"
          onClick={goBack}
          aria-label="Back"
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-brand-teal hover:bg-brand-teal/10 transition-colors"
        >
          <ChevronLeft size={16} strokeWidth={2.6} />
        </button>
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-brand-dark">{title}</p>
          <p className="text-[11px] text-brand-dark-soft truncate">{rightView.pet?.name || 'Pet'}</p>
        </div>
      </div>
    );
  };

  const renderRightContent = () => {
    // pets list
    if (!rightView) {
      return (
        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4 no-scrollbar">
          {loading && <AdminSkeleton variant="cards" label="Loading customer details" />}
          {loadError && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{loadError}</p>}
          {!loading && !loadError && pets.length === 0 && (
            <p className="py-10 text-center text-sm text-brand-dark-soft">No pets registered yet.</p>
          )}
          {!loading && !loadError && pets.map((pet, index) => {
            const tone = getSpeciesTone(pet);
            const petKey = String(pet?.id || index);
            const petAppointments = appointmentHistoryByPet[petKey] || [];
            const isExpanded = expandedPetId === petKey;
            return (
              <div key={pet?.id || index} className="mb-3 overflow-hidden rounded-xl border border-brand-dark-light bg-white shadow-sm">
                <button
                  type="button"
                  onClick={() => setExpandedPetId(isExpanded ? null : petKey)}
                  className="w-full flex items-center justify-between gap-3 px-5 py-3 bg-white text-left transition-colors hover:bg-brand-dark/5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-bold text-white ${tone.mediaBg}`}>
                      {pet?.photo_url || pet?.photo
                        ? <img src={pet?.photo_url || pet?.photo} alt={pet?.name || `Pet ${index + 1}`} className="h-full w-full object-cover" />
                        : getInitials(pet?.name || `Pet ${index + 1}`)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-brand-dark">{pet?.name || `Pet ${index + 1}`}</p>
                      <p className="text-sm text-brand-dark-soft">
                        {pet?.pet_id ? `${pet.pet_id} - ` : ''}{pet?.species_type?.name || pet?.speciesType?.name || '-'}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {(appointmentsLoading || petAppointments.length > 0) && (
                      <span className={`hidden rounded-full px-2.5 py-1 text-xs font-semibold sm:inline-flex ${tone.speciesBadge}`}>
                        {appointmentsLoading ? 'Loading' : `${petAppointments.length} appointment${petAppointments.length === 1 ? '' : 's'}`}
                      </span>
                    )}
                    <i className={`fa-solid fa-chevron-down text-brand-teal text-sm transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-brand-dark-light bg-brand-surface/30 px-5 py-4">
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="divide-y divide-brand-dark-light overflow-hidden rounded-lg border border-brand-dark-light bg-white">
                          <DetailItem label="Pet ID" value={pet?.pet_id || '-'} inline />
                          <DetailItem label="Species" value={pet?.species_type?.name || pet?.speciesType?.name || '-'} inline />
                          <DetailItem label="Breed" value={normalizeBreedName(pet?.breed?.name || pet?.breed || '-', pet)} inline />
                          <DetailItem label="Sex" value={pet?.sex ? pet.sex.charAt(0).toUpperCase() + pet.sex.slice(1) : '-'} inline />
                          <DetailItem label="Age" value={calcAge(pet?.date_of_birth)} inline />
                          <DetailItem label="Date of Birth" value={formatDate(pet?.date_of_birth)} inline />
                          <DetailItem label="Weight" value={formatWeightKg(pet?.weight_kg)} inline />
                      </div>

                      <div className="divide-y divide-brand-dark-light overflow-hidden rounded-lg border border-brand-dark-light bg-white">
                          {(appointmentsLoading || petAppointments.length > 0) && (
                            <DetailItem
                              label="Appointments"
                              value={appointmentsLoading ? 'Loading...' : `${petAppointments.length} completed paid appointment${petAppointments.length === 1 ? '' : 's'}`}
                              inline
                            />
                          )}
                          <DetailItem label="Recognition" value={getPetRecognitionStatus(pet)} inline />
                          <div className="px-3 py-2.5">
                            <div className="space-y-2">
                              <div className="flex items-start justify-between gap-3 text-sm">
                                <span className="font-semibold text-brand-dark-soft">Registered At</span>
                                <span className="text-right font-medium text-brand-dark">{getPetRecognitionRegisteredAt(pet)}</span>
                              </div>
                              <div className="flex items-center justify-between gap-3 text-sm">
                                <span className="font-semibold text-brand-dark-soft">Recognition Photo</span>
                            {pet?.identification_image_url ? (
                              <button
                                type="button"
                                onClick={() => setRecognitionPreview({ url: pet.identification_image_url, petId: pet?.pet_id || '-' })}
                                className="rounded-md border border-brand-teal/40 px-2.5 py-1 text-xs font-bold text-brand-teal hover:bg-brand-teal/10"
                              >
                                View Photo
                              </button>
                              ) : <span className="font-medium text-brand-dark">Not saved</span>}
                              </div>
                            </div>
                          </div>
                      </div>
                    </div>
                    {pet?.medical_notes && (
                      <div className="mt-4 rounded-lg border border-brand-dark-light bg-white px-3 py-3">
                        <DetailItem label="Notes" value={pet.medical_notes} />
                      </div>
                    )}

                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setRightView({ type: 'history', pet })}
                        className="rounded-lg border border-brand-teal px-3 py-1.5 text-xs font-bold text-brand-teal transition-colors hover:bg-brand-teal hover:text-white"
                      >
                        Appointment History
                      </button>
                      <button
                        type="button"
                        onClick={() => setRightView({ type: 'assessment', pet })}
                        className="rounded-lg border border-brand-teal px-3 py-1.5 text-xs font-bold text-brand-teal transition-colors hover:bg-brand-teal hover:text-white"
                      >
                        Assessment Records
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    // appointment history
    if (rightView.type === 'history') {
      return (
        <CustomerPetHistoryView
          loading={appointmentsLoading}
          error={appointmentsError}
          history={activePetHistory}
          expandedAptId={expandedAptId}
          onToggleExpand={setExpandedAptId}
          onDownloadPdf={handleDownloadAptCsv}
          DetailItem={DetailItem}
        />
      );
    }

    // assessment records
    return (
      <CustomerPetAssessmentView
        loading={assessLoading}
        error={assessError}
        records={assessRecords}
        expandedAssessId={expandedAssessId}
        onToggleExpand={setExpandedAssessId}
        onDownloadPdf={handleDownloadAssessPdf}
        DetailItem={DetailItem}
      />
    );
  };

  // render

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 backdrop-blur-sm bg-brand-dark/40 h-[100dvh] min-h-[100dvh] w-screen" onClick={onClose}>
      <div
        className="flex h-[86vh] max-h-[760px] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between bg-brand-teal px-5 py-3.5 shrink-0">
          <h2 className="text-base font-bold text-white">View Customer</h2>
          <button type="button" onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25">
            <X size={15} />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 overflow-hidden lg:grid-cols-[320px_1fr]">

          {/* Left panel (fixed/sticky) */}
          <div className="flex min-h-0 flex-col overflow-hidden border-b border-brand-teal/20 bg-gradient-to-b from-brand-teal/5 to-white text-brand-dark lg:border-b-0 lg:border-r lg:border-brand-teal/20">
            <div className="shrink-0 px-5 pb-4 pt-5">
              <div className="flex flex-col items-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-teal/85 text-base font-bold text-white ring-4 ring-white shadow-md">
                  {getInitials(fullName)}
                </div>
                <p className="mt-3 text-lg font-extrabold leading-tight text-brand-dark">{fullName}</p>
                <p className="mt-1 text-sm text-brand-dark-soft">Customer ID: {detail?.display_id || '-'}</p>
                <span className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${detail?.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${detail?.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  {detail?.is_active ? 'Active' : 'Deactivated'}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 pb-5 no-scrollbar">
              <div className="mb-4 rounded-xl border border-brand-teal/20 bg-white p-4">
                <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.2em] text-brand-teal">Customer Profile</p>
                {loading && <AdminSkeleton variant="table" label="Loading customer details" rows={3} />}
                {loadError && <p className="py-3 text-center text-xs text-red-500">{loadError}</p>}
                {!loading && !loadError && (
                  <div className="divide-y divide-brand-dark-light">
                    <CustomerInfoRow label="Email"   value={detail?.email || '-'} />
                    <CustomerInfoRow label="Phone"   value={detail?.phone || '-'} />
                    <CustomerInfoRow label="Address" value={detail?.address || '-'} />
                    <CustomerInfoRow label="Created" value={formatDate(detail?.created_at)} />
                  </div>
                )}
              </div>

              {(detail?.ec_first_name || detail?.ec_last_name || detail?.ec_email || detail?.ec_phone) && (
                <div className="mt-4 rounded-xl border border-brand-teal/20 bg-white p-4">
                  <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.2em] text-brand-teal">Emergency Contact</p>
                  <div className="divide-y divide-brand-dark-light">
                    <CustomerInfoRow
                      label="Name"
                      value={[detail?.ec_first_name, detail?.ec_last_name].filter(Boolean).join(' ') || '-'}
                    />
                    <CustomerInfoRow label="Phone" value={detail?.ec_phone || '-'} />
                    <CustomerInfoRow label="Email" value={detail?.ec_email || '-'} />
                    <CustomerInfoRow
                      label="Relationship"
                      value={(RELATIONSHIP_OPTIONS.find((o) => o.value === detail?.ec_relationship)?.label) || detail?.ec_relationship || '-'}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right panel */}
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
            {renderRightHeader()}
            {renderRightContent()}
          </div>

        </div>
      </div>
      {recognitionPreview?.url && (
        <div
          className="fixed inset-0 z-[210] flex items-center justify-center bg-black/70 p-4"
          onClick={() => setRecognitionPreview(null)}
        >
          <div className="relative max-h-[90vh] max-w-[90vw] rounded-2xl bg-white p-2 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setRecognitionPreview(null)}
              className="absolute -right-3 -top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-brand-dark shadow-lg ring-1 ring-black/10 transition hover:bg-brand-surface"
              aria-label="Close recognition photo"
            >
              <X size={17} />
            </button>
            <img src={recognitionPreview.url} alt="Recognition preview" className="max-h-[80vh] max-w-[86vw] rounded-xl object-contain" />
            <p className="truncate px-2 pb-1 pt-2 text-center text-xs font-semibold text-brand-dark-soft">
              Pet ID: {recognitionPreview.petId}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function CustomerInfoRow({ label, value }) {
  const displayValue = value || '-';

  return (
    <div className="grid grid-cols-[68px_minmax(0,1fr)] items-start gap-2 py-2.5">
      <p className="text-xs font-medium text-brand-teal-dark">{label}:</p>
      <p className="min-w-0 break-words text-left text-xs font-normal leading-relaxed text-brand-dark [overflow-wrap:anywhere]">
        {displayValue}
      </p>
    </div>
  );
}

function DetailItem({ label, value, span2 = false, inline = false }) {
  if (inline) {
    return (
      <div className={`${span2 ? 'sm:col-span-2 ' : ''}flex items-start justify-between gap-3 px-3 py-2.5`}>
        <span className="text-sm font-semibold text-brand-dark-soft">{label}</span>
        <span className="text-right text-sm font-medium text-brand-dark">{value}</span>
      </div>
    );
  }
  return (
    <div className={span2 ? 'sm:col-span-2' : ''}>
      <p className="mb-1 text-sm font-semibold text-brand-dark-soft">{label}</p>
      <p className="text-sm font-medium text-brand-dark">{value}</p>
    </div>
  );
}
