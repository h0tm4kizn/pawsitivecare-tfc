import { Download, FileText, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiGet } from '../../api/apiClient';
import { normalizeBreedName, sanitizeText, formatAddressFromOwner } from '../../utils/textUtils';
import { downloadPetAssessmentRecordPdf } from '../../utils/petAssessmentBlankPdf';
import { AdminSkeleton } from '../admin/AdminLoading';

const getArray = (payload, keys = []) => {
  if (
    payload?.data
    && typeof payload.data === 'object'
    && !Array.isArray(payload.data)
    && Array.isArray(payload.data.data)
  ) return payload.data.data;
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
    if (Array.isArray(payload?.data?.[key])) return payload.data[key];
  }
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
};

const fmtDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-US', { timeZone: 'Asia/Manila',
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

const toBool = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  const normalized = String(value || '').trim().toLowerCase();
  if (['yes', 'true', '1', 'y'].includes(normalized)) return true;
  if (['no', 'false', '0', 'n', ''].includes(normalized)) return false;
  return Boolean(value);
};

const labelFromBool = (value) => (toBool(value) ? 'Yes' : 'No');

const fmtDate = (value) => {
  if (!value) return '-';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-US', { timeZone: 'Asia/Manila',  year: 'numeric', month: 'short', day: 'numeric' });
};

const humanize = (value) => {
  const text = String(value || '').trim();
  if (!text) return '-';
  return text.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

const hasLinkedService = (record) =>
  Boolean(
    record?.service_id
    || record?.service?.id
    || record?.service?.display_id
    || (record?.service_name && String(record.service_name).trim() !== ''),
  );

export default function PetAssessmentRecordsModal({ isOpen, onClose, pet, owner: ownerProp = null }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [records, setRecords] = useState([]);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    if (!isOpen || !pet?.id) return;
    setLoading(true);
    setError('');
    setRecords([]);
    setExpandedId(null);

    apiGet(`/api/pets/${pet.id}/health-form/history`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || 'Failed to load assessment records.');
        return getArray(data, ['forms']);
      })
      .then((forms) => setRecords(forms))
      .catch((err) => setError(err.message || 'Failed to load assessment records.'))
      .finally(() => setLoading(false));
  }, [isOpen, pet?.id]);

  const handleDownloadPdf = async (record) => {
    try {
      await downloadPetAssessmentRecordPdf({ record, pet, owner: ownerProp || pet?.owner });
    } catch {
      setError('Failed to generate PDF for this form.');
    }
  };

  if (!isOpen || !pet) return null;

  const ownerData = ownerProp || pet?.owner || null;
  const ownerName = [ownerData?.first_name, ownerData?.last_name].filter(Boolean).join(' ').trim() || ownerData?.name || '-';
  const petProfileId = pet?.pet_id || '-';
  const petType = sanitizeText(pet?.species_type?.name || pet?.speciesType?.name || pet?.species?.name || pet?.species || '-');
  const petBreed = normalizeBreedName(pet?.breed?.name || pet?.breed || '-', pet);
  const petAge = (() => {
    const dob = pet?.date_of_birth;
    if (!dob) return null;
    const birth = new Date(String(dob).slice(0, 10) + 'T00:00:00');
    const today = new Date();
    const totalMonths =
      (today.getFullYear() - birth.getFullYear()) * 12 + (today.getMonth() - birth.getMonth());
    if (totalMonths < 1) return 'Under 1 month';
    if (totalMonths < 12) return `${totalMonths} mo`;
    const years = Math.floor(totalMonths / 12);
    const months = totalMonths % 12;
    return months > 0 ? `${years} yr ${months} mo` : `${years} yr`;
  })();

  const hasEmergencyContact =
    ownerData?.ec_first_name || ownerData?.ec_last_name ||
    ownerData?.ec_phone || ownerData?.ec_email;

  const modal = (
    <div className="fixed inset-0 z-[320] flex items-center justify-center p-4 backdrop-blur-sm bg-brand-dark/40 h-[100dvh] min-h-[100dvh] w-screen">
      <div className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-lg">

        {/* Header */}
        <div className="flex items-center justify-between bg-brand-teal px-6 py-4 shrink-0">
          <div>
            <h2 className="text-base font-extrabold text-white">Pet Assessment Records</h2>
            <p className="text-[11px] font-semibold text-white/80">{pet?.name || 'Pet'} | ID: {petProfileId}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
            aria-label="Close"
          >
            <X size={16} strokeWidth={2.8} />
          </button>
        </div>

        {/* Body - left sticky, right scrollable */}
        <div className="min-h-0 flex-1 overflow-hidden lg:grid lg:grid-cols-[260px_1fr]">

          {/* Left panel (sticky) */}
          <div className="hidden lg:flex flex-col h-full overflow-y-auto border-r border-brand-teal/15 bg-white px-4 py-4 space-y-3 no-scrollbar">

            {/* Pet Profile */}
            <section className="rounded-xl border border-brand-teal/20 bg-white overflow-hidden shrink-0">
              <div className="px-4 py-2.5 border-b border-brand-teal/15 bg-brand-teal/5">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-brand-teal">Pet Profile</p>
              </div>
              <div className="px-4 py-3 space-y-2 text-xs text-brand-dark">
                <SideRow label="Name" value={pet?.name || '-'} />
                <SideRow label="Pet ID" value={petProfileId} />
                <SideRow label="Species" value={petType} />
                <SideRow label="Breed" value={petBreed} />
                <SideRow label="Sex" value={pet?.sex ? (pet.sex.charAt(0).toUpperCase() + pet.sex.slice(1)) : '-'} />
                {pet?.date_of_birth && <SideRow label="Date of Birth" value={fmtDate(pet.date_of_birth)} />}
                {petAge && <SideRow label="Age" value={petAge} />}
                {pet?.weight_kg !== null && pet?.weight_kg !== undefined && String(pet?.weight_kg) !== '' && (
                  <SideRow label="Weight" value={`${pet.weight_kg} kg`} />
                )}
              </div>
            </section>

            {/* Owner Profile */}
            <section className="rounded-xl border border-brand-teal/20 bg-white overflow-hidden shrink-0">
              <div className="px-4 py-2.5 border-b border-brand-teal/15 bg-brand-teal/5">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-brand-teal">Owner Profile</p>
              </div>
              <div className="px-4 py-3 space-y-2 text-xs text-brand-dark">
                {ownerData ? (
                  <>
                    <SideRow label="Name" value={ownerName} />
                    {ownerData?.email && <SideRow label="Email" value={ownerData.email} />}
                    {ownerData?.phone && <SideRow label="Phone" value={ownerData.phone} />}
                    <SideRow label="Address" value={formatAddressFromOwner(ownerData) || '-'} />
                  </>
                ) : (
                  <p className="text-brand-dark-soft">No owner data available.</p>
                )}
              </div>
            </section>

            {/* Emergency Contact */}
            <section className="rounded-xl border border-brand-teal/20 bg-white overflow-hidden shrink-0">
              <div className="px-4 py-2.5 border-b border-brand-teal/15 bg-brand-teal/5">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-brand-teal">Emergency Contact</p>
              </div>
              <div className="px-4 py-3 space-y-2 text-xs text-brand-dark">
                {hasEmergencyContact ? (
                  <>
                    <SideRow
                      label="Name"
                      value={[ownerData.ec_first_name, ownerData.ec_last_name].filter(Boolean).join(' ') || '-'}
                    />
                    {ownerData.ec_phone && <SideRow label="Phone" value={ownerData.ec_phone} />}
                    {ownerData.ec_email && <SideRow label="Email" value={ownerData.ec_email} />}
                  </>
                ) : (
                  <p className="text-brand-dark-soft">No emergency contact on file.</p>
                )}
              </div>
            </section>
          </div>

          {/* Right panel (scrollable) */}
          <div className="flex min-h-0 h-full flex-col overflow-hidden">
            <div className="shrink-0 border-b border-brand-teal/15 bg-white px-5 py-3">
              <p className="text-sm font-bold text-brand-dark">Assessment Forms</p>
              <p className="text-[11px] text-brand-dark-soft">
                {records.length > 0 ? `${records.length} record${records.length === 1 ? '' : 's'} on file` : 'No records yet'}
              </p>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2 no-scrollbar">
              {loading && (
                <p className="py-8 text-center text-sm font-semibold text-brand-dark-soft">
                  <AdminSkeleton variant="table" label="Loading assessment records" rows={3} />
                </p>
              )}
              {!loading && error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600">
                  {error}
                </p>
              )}
              {!loading && !error && records.length === 0 && (
                <div className="py-12 text-center">
                  <FileText size={36} className="mx-auto text-brand-dark-soft/30" />
                  <p className="mt-2 text-sm font-semibold text-brand-dark-soft">
                    No saved assessment forms for this pet.
                  </p>
                </div>
              )}
              {!loading && !error && records.map((record) => {
                const isExpanded = expandedId === record.id;
                const appointmentIdValue = String(record?.appointment_id || '').trim();
                const appointmentIdDisplay =
                  record?.appointment_code
                  || record?.appointment?.appointment_code
                  || appointmentIdValue
                  || '-';
                const serviceNameDisplay =
                  record?.service_name
                  || record?.service?.name
                  || null;
                const serviceCategoryRaw = String(
                  record?.service?.category
                  || record?.service_category
                  || record?.appointment?.service?.category
                  || ''
                ).toLowerCase();
                const serviceBadgeColor = serviceCategoryRaw.includes('groom')
                  ? 'bg-brand-grooming-soft text-brand-grooming'
                  : serviceCategoryRaw.includes('hotel')
                    ? 'bg-brand-hotel-soft text-brand-hotel'
                    : serviceCategoryRaw.includes('day')
                      ? 'bg-brand-daycare-soft text-brand-daycare'
                      : 'bg-brand-teal-light text-brand-teal-dark';
                return (
                  <div key={record.id} className="rounded-lg border border-brand-dark-light overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : record.id)}
                      className="w-full flex items-center justify-between gap-3 px-5 py-3 bg-white hover:bg-brand-dark/5 transition-colors text-left"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-0.5">
                          <p className="text-sm font-bold text-brand-dark truncate">
                            {fmtDateTime(record.created_at)}
                          </p>
                          {serviceNameDisplay && (
                            <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${serviceBadgeColor}`}>
                              {serviceNameDisplay}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-brand-dark-soft">
                          Vaccinated: {labelFromBool(record.is_vaccinated)}
                          {' | '}
                          {toBool(record.has_ticks) || toBool(record.has_flea) ? 'Ticks/Flea: Alert' : 'Ticks/Flea: None'}
                        </p>
                      </div>
                      <i
                        className={`fa-solid fa-chevron-down text-brand-teal text-sm transition-transform shrink-0 ${
                          isExpanded ? 'rotate-180' : ''
                        }`}
                      />
                    </button>

                    {isExpanded && (
                      <div className="px-5 py-4 border-t border-brand-dark-light bg-white">
                        <div className="grid grid-cols-1 gap-x-4 gap-y-2 sm:grid-cols-2 text-xs">
                          <DetailItem label="Submitted" value={fmtDateTime(record.created_at)} />
                          <DetailItem label="Appointment ID" value={appointmentIdDisplay} />
                          <DetailItem label="Service" value={serviceNameDisplay || '-'} />
                          {record.weight_kg != null && (
                            <DetailItem label="Weight" value={`${record.weight_kg} kg`} />
                          )}
                          <DetailItem label="Vaccinated" value={humanize(record.is_vaccinated)} />
                          {Array.isArray(record.vaccines) && record.vaccines.length > 0 && (
                            <DetailItem label="Vaccines" value={record.vaccines.join(', ')} span2 />
                          )}
                          {record.vaccine_records && typeof record.vaccine_records === 'object' && Object.keys(record.vaccine_records).length > 0 && (
                            <div className="sm:col-span-2">
                              <p className="text-brand-dark-soft font-semibold mb-1">Vaccine Dates</p>
                              <div className="space-y-0.5">
                                {Object.entries(record.vaccine_records).map(([name, date]) => (
                                  <p key={name} className="text-brand-dark font-medium">
                                    {name}: <span className="text-brand-dark-soft">{fmtDate(date)}</span>
                                  </p>
                                ))}
                              </div>
                            </div>
                          )}
                          {!record.vaccine_records && record.vaccine_date && (
                            <DetailItem label="Vaccine Date" value={fmtDate(record.vaccine_date)} />
                          )}
                          {record.vet_clinic_name && (
                            <DetailItem label="Vet Clinic" value={record.vet_clinic_name} />
                          )}
                          {record.vet_contact_number && (
                            <DetailItem label="Vet Contact" value={record.vet_contact_number} />
                          )}
                          <DetailItem label="Socialization" value={humanize(record.is_friendly)} />
                          <DetailItem label="Treat Preference" value={humanize(record.treat_preference)} />
                          <DetailItem label="Allergies" value={record.allergies || '-'} />
                          <DetailItem label="Medical Notes" value={record.medical_conditions || '-'} span2 />
                          <div className="sm:col-span-2">
                            <p className="text-brand-dark-soft font-semibold mb-1">Grooming Assessment</p>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1">
                              {[
                                ['Ticks', record.has_ticks],
                                ['Flea', record.has_flea],
                                ['Wound', record.has_wound],
                                ['Mange', record.has_mange],
                                ['Bald Spot', record.has_bald_spot],
                                ['Skin Problem', record.has_skin_problem],
                                ['Lameness', record.has_lameness],
                                ['Eye Discharge', record.has_eye_discharge],
                                ['Nasal Discharge', record.has_nasal_discharge],
                                ['Ear Discharge', record.has_ear_discharge],
                              ].map(([label, val]) => (
                                <div key={label} className="flex items-center justify-between gap-2">
                                  <span className="text-brand-dark-soft">{label}</span>
                                  <span className={`font-semibold ${toBool(val) ? 'text-red-500' : 'text-brand-dark'}`}>
                                    {toBool(val) ? 'Yes' : 'No'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                          <DetailItem label="Declaration Accepted" value={labelFromBool(record.declaration_accepted)} />
                        </div>
                        <div className="mt-3 flex justify-end">
                          {hasLinkedService(record) ? (
                            <button
                              type="button"

                              onClick={() => handleDownloadPdf(record)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-teal px-3 py-1.5 text-[11px] font-bold text-brand-teal hover:bg-brand-teal hover:text-white transition-colors"
                            >
                              <Download size={11} />
                              Download PDF
                            </button>
                          ) : (
                            <span className="text-[11px] font-semibold text-brand-dark-soft">
                              PDF available once service is linked
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

function SideRow({ label, value }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="font-semibold text-brand-dark-soft shrink-0">{label}:</span>
      <span className="text-right text-brand-dark break-all">{value}</span>
    </div>
  );
}

function DetailItem({ label, value, span2 = false }) {
  return (
    <div className={span2 ? 'sm:col-span-2' : ''}>
      <p className="text-brand-dark-soft font-semibold mb-1">{label}</p>
      <p className="text-brand-dark font-medium">{value}</p>
    </div>
  );
}
