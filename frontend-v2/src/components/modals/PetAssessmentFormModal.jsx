import { X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import { apiGet, apiFetch } from '../../api/apiClient';
import { fmtDate, calcAge } from '../../utils/dateUtils';
import { normalizeBreedName, sanitizeText } from '../../utils/textUtils';
import { SkeletonBlock } from '../admin/AdminLoading';
import HealthConditionsSection from '../assessment/HealthConditionsSection';
import CarePreferencesSection from '../assessment/CarePreferencesSection';
import PoliciesDeclarationSection from '../assessment/PoliciesDeclarationSection';
import {
  CAT_VACCINES,
  DAYCARE_POLICIES,
  DOG_VACCINES,
  EMPTY_FORM,
  GROOMING_ITEMS,
  GROOMING_POLICIES,
  HOTEL_POLICIES,
  PH_MOBILE_REGEX,
  SOCIALIZATION_OPTIONS,
  TODAY,
  TREAT_OPTIONS,
  hasRabiesVaccine,
  normalizeAssessmentWeight,
  normalizeLoadedAssessmentForm,
  normalizePhMobileInput,
  normalizeVaccineList,
  petInitials,
} from './petAssessmentFormHelpers';

export default function PetAssessmentFormModal({
  isOpen,
  onClose,
  pet,
  onSaved,
  apiBase = '/api/pets',
  serviceId = null,
  appointmentId = null,
  theme = 'default',
  serviceCategory = '',
  deferSave = false,
  saveLabel = 'Save',
  initialDraft = null,
  readOnly = false,
  exactMatchOnly = false,
}) {
  useBodyScrollLock(isOpen);
  const svcNorm = String(serviceCategory || '').toLowerCase();
  const isGroomingService = svcNorm.includes('groom');
  const isHotelService = svcNorm.includes('hotel');
  const isDaycareService = svcNorm.includes('day');
  const hasServiceContext = isGroomingService || isHotelService || isDaycareService;

  const formTitle = isGroomingService
    ? 'Grooming Assessment Form'
    : isHotelService
      ? 'Hotel Assessment Form'
      : isDaycareService
        ? 'Daycare Assessment Form'
        : 'Pet Assessment Form';

  const conditionSectionTitle = isGroomingService
    ? 'Grooming Condition Check'
    : 'Physical Condition Check';

  const activePolicies = isGroomingService
    ? GROOMING_POLICIES
    : isDaycareService
      ? DAYCARE_POLICIES
      : HOTEL_POLICIES;

  const policyTitle = isGroomingService
    ? 'Grooming Policies'
    : isDaycareService
      ? 'Daycare Policies'
      : 'Hotel Policies';

  const declarationText = isGroomingService
    ? "I, the undersigned fur parent, have read and understood The Fur Club's Grooming Policies. I certify that my pet is in good health and authorize The Fur Club to perform the requested grooming services."
    : isDaycareService
      ? "I, the undersigned fur parent, have read and understood The Fur Club's Daycare Policies. I agree to the terms above and authorize The Fur Club to provide the best possible care for my pet during their daycare session."
      : "I, the undersigned fur parent, have read and understood The Fur Club's Pet Hotel & Daycare Policies. I agree to the terms above and authorize The Fur Club to provide the best possible care for my pet during their stay.";
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [latestAnsweredWeightKg, setLatestAnsweredWeightKg] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [loadingForm, setLoadingForm] = useState(false);
  const vaccinatedRef = useRef(null);
  const socializationRef = useRef(null);
  const treatRef = useRef(null);
  const declarationRef = useRef(null);
  const loadSeqRef = useRef(0);
  const loadAbortRef = useRef(null);
  const formTouchedRef = useRef(false);
  const formLoadKeyRef = useRef('');
  const isPetOwnerTheme = theme === 'pet_owner';
  const isFormLocked = readOnly && !editMode;

  useEffect(() => {
    if (!isOpen) setEditMode(false);
  }, [isOpen]);

  const petSpeciesCode = useMemo(() => {
    const code = String(
      pet?.speciesType?.code || pet?.species_type?.code || pet?.species?.code || ''
    ).toUpperCase();
    if (code === 'D' || code === 'C') return code;
    const name = String(
      pet?.speciesType?.name || pet?.species_type?.name || pet?.species || ''
    ).toLowerCase();
    if (name.includes('dog') || name.includes('canine')) return 'D';
    if (name.includes('cat') || name.includes('feline')) return 'C';
    return '';
  }, [pet]);

  const vaccineOptions = useMemo(() => {
    if (petSpeciesCode === 'D') return DOG_VACCINES;
    if (petSpeciesCode === 'C') return CAT_VACCINES;
    return [];
  }, [petSpeciesCode]);

  const visibleVaccineOptions = useMemo(() => {
    const selected = normalizeVaccineList(form.vaccines).filter((name) => name !== 'Others');
    return [...new Set([...vaccineOptions, ...selected])];
  }, [vaccineOptions, form.vaccines]);

  useEffect(() => {
    loadAbortRef.current?.abort();

    if (!isOpen) {
      loadSeqRef.current += 1;
      loadAbortRef.current = null;
      formLoadKeyRef.current = '';
      formTouchedRef.current = false;
      setLoadingForm(false);
      setSaving(false);
      setSuccess('');
      setError('');
      setFieldErrors({});
      setLatestAnsweredWeightKg(null);
      setForm({ ...EMPTY_FORM });
      return undefined;
    }

    if (!pet?.id) {
      loadSeqRef.current += 1;
      formTouchedRef.current = false;
      setLoadingForm(false);
      setSuccess('');
      setError('');
      setFieldErrors({});
      setLatestAnsweredWeightKg(null);
      setForm({ ...EMPTY_FORM });
      return undefined;
    }

    const loadSeq = loadSeqRef.current + 1;
    loadSeqRef.current = loadSeq;
    const controller = new AbortController();
    loadAbortRef.current = controller;
    const loadKey = `${pet.id}:${apiBase}:${serviceId || ''}:${appointmentId || ''}`;
    const changedRecord = formLoadKeyRef.current !== loadKey;
    formLoadKeyRef.current = loadKey;
    formTouchedRef.current = false;
    setSuccess('');
    setError('');
    setFieldErrors({});
    setLatestAnsweredWeightKg(null);
    setLoadingForm(true);
    if (changedRecord) setForm({ ...EMPTY_FORM });

    const draftMatchesPet = initialDraft && String(initialDraft.pet_id || '') === String(pet.id || '');
    if (draftMatchesPet) {
      const normalizedDraft = normalizeLoadedAssessmentForm(initialDraft);
      setLoadingForm(false);
      setLatestAnsweredWeightKg(normalizedDraft.weight_kg || null);
      setForm(normalizedDraft);
      return () => controller.abort();
    }

    const params = new URLSearchParams();
    if (serviceId) params.set('service_id', serviceId);
    if (appointmentId) params.set('appointment_id', appointmentId);
    const query = params.toString() ? `?${params.toString()}` : '';

    const shouldIgnore = () => controller.signal.aborted || loadSeqRef.current !== loadSeq || formTouchedRef.current;

    const applyLoadedForm = (formData) => {
      if (shouldIgnore()) return;
      if (!formData) {
        setLatestAnsweredWeightKg(null);
        setForm({ ...EMPTY_FORM });
        return;
      }
      const normalizedForm = normalizeLoadedAssessmentForm(formData, pet?.weight_kg);
      setLatestAnsweredWeightKg(normalizedForm.weight_kg || null);
      setForm(normalizedForm);
    };

    const applyHistoryFallback = () => {
      apiGet(`${apiBase}/${pet.id}/health-form/history`, { signal: controller.signal })
        .then((historyRes) => (historyRes.ok ? historyRes.json() : { data: { forms: [] } }))
        .then((historyData) => {
          if (shouldIgnore()) return;
          const forms = Array.isArray(historyData?.data?.forms) ? historyData.data.forms : [];
          applyLoadedForm(forms[0] || null);
        })
        .catch((err) => {
          if (shouldIgnore() || err?.name === 'AbortError') return;
          setLatestAnsweredWeightKg(null);
          setForm({ ...EMPTY_FORM });
          setError('Unable to load the latest assessment form. You can still enter a new assessment.');
        })
        .finally(() => {
          if (!controller.signal.aborted && loadSeqRef.current === loadSeq) setLoadingForm(false);
        });
    };

    apiGet(`${apiBase}/${pet.id}/health-form${query}`, { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : { data: null }))
      .then((d) => {
        if (shouldIgnore()) return;
        const formData = d.data;
        if (!formData && query && exactMatchOnly) {
          setError('No assessment form is linked to this appointment.');
          setLatestAnsweredWeightKg(null);
          setForm({ ...EMPTY_FORM });
          setLoadingForm(false);
          return;
        }
        if (!formData && query) {
          apiGet(`${apiBase}/${pet.id}/health-form`, { signal: controller.signal })
            .then((fallbackRes) => (fallbackRes.ok ? fallbackRes.json() : { data: null }))
            .then((fallbackData) => {
              if (shouldIgnore()) return;
              if (fallbackData.data) {
                applyLoadedForm(fallbackData.data);
                setLoadingForm(false);
                return;
              }
              applyHistoryFallback();
            })
            .catch((err) => {
              if (shouldIgnore() || err?.name === 'AbortError') return;
              applyHistoryFallback();
            });
          return;
        }
        applyLoadedForm(formData);
        setLoadingForm(false);
      })
      .catch((err) => {
        if (shouldIgnore() || err?.name === 'AbortError') return;
        applyHistoryFallback();
      });

    return () => controller.abort();
  }, [isOpen, pet?.id, pet?.weight_kg, serviceId, appointmentId, apiBase, initialDraft, deferSave, exactMatchOnly]);

  if (!isOpen || !pet) return null;

  const petSexRaw = pet.sex ?? pet.pet_sex ?? pet.gender ?? null;
  const petDobRaw = pet.date_of_birth ?? pet.pet_dob ?? pet.dob ?? pet.birth_date ?? pet.birthdate ?? null;
  const petSexDisplay = petSexRaw ? String(petSexRaw).charAt(0).toUpperCase() + String(petSexRaw).slice(1).toLowerCase() : '-';
  const savedWeight = latestAnsweredWeightKg ?? pet.weight_kg;
  const currentWeightDisplay = savedWeight !== null && savedWeight !== undefined && String(savedWeight).trim() !== '' && Number.isFinite(Number(savedWeight))
    ? `${Number(savedWeight).toFixed(2)} kg`
    : '-';

  const setField = (key, value) => {
    formTouchedRef.current = true;
    setForm((p) => ({ ...p, [key]: value }));
    setSuccess('');
    setError('');
    setFieldErrors((p) => ({ ...p, [key]: '' }));
  };

  const setVaccines = (nextVaccines) => {
    formTouchedRef.current = true;
    setForm((prev) => {
      const normalizedVaccines = normalizeVaccineList(nextVaccines);
      const records = { ...(prev.vaccine_records || {}) };
      Object.keys(records).forEach((key) => {
        if (!normalizedVaccines.includes(key)) delete records[key];
      });
      return { ...prev, vaccines: normalizedVaccines, vaccine_records: records };
    });
    setSuccess('');
    setError('');
    setFieldErrors((prev) => ({ ...prev, vaccines: '', vaccine_records: {} }));
  };

  const setVaccineDate = (vaccineName, date) => {
    formTouchedRef.current = true;
    setForm((prev) => ({
      ...prev,
      vaccine_records: {
        ...(prev.vaccine_records || {}),
        [vaccineName]: date,
      },
    }));
    setSuccess('');
    setError('');
    setFieldErrors((prev) => ({
      ...prev,
      vaccine_records: {
        ...(prev.vaccine_records || {}),
        [vaccineName]: '',
      },
    }));
  };

  const validate = () => {
    const errs = {};
    const weightRaw = String(form.weight_kg ?? '').trim();
    if (!weightRaw) {
      errs.weight_kg = 'Pet weight is required.';
    } else if (!/^\d{1,2}(\.\d{1,2})?$/.test(weightRaw) || Number(weightRaw) > 99.99) {
      errs.weight_kg = 'Weight must be up to 99.99 kg with up to 2 decimals.';
    } else if (Number(weightRaw) <= 0) {
      errs.weight_kg = 'Weight must be greater than 0.';
    }
    const vetContactRaw = String(form.vet_contact_number ?? '').trim();
    if (vetContactRaw) {
      const normalized = vetContactRaw.replace(/[^\d+]/g, '');
      if (!PH_MOBILE_REGEX.test(normalized)) {
        errs.vet_contact_number = 'Enter a valid PH mobile number (09XXXXXXXXX or +639XXXXXXXXX).';
      }
    }
    if (!form.is_vaccinated) errs.is_vaccinated = 'Please indicate if your pet is vaccinated.';
    if (form.is_vaccinated === 'Yes' && visibleVaccineOptions.length && (!Array.isArray(form.vaccines) || !form.vaccines.length)) {
      errs.vaccines = 'Please select the applicable vaccine for your pet.';
    }
    if (form.is_vaccinated === 'Yes' && Array.isArray(form.vaccines) && form.vaccines.length) {
      const vaccineDateErrors = {};
      form.vaccines.forEach((vaccineName) => {
        const date = String(form.vaccine_records?.[vaccineName] || '').slice(0, 10);
        if (!date) {
          vaccineDateErrors[vaccineName] = 'Please add date.';
          return;
        }
        if (date > TODAY) {
          vaccineDateErrors[vaccineName] = 'Date cannot be in the future.';
        }
      });
      if (Object.keys(vaccineDateErrors).length > 0) errs.vaccine_records = vaccineDateErrors;
    }
    if (!form.is_friendly) errs.is_friendly = 'Please choose your pet\'s socialization preference.';
    if (!form.treat_preference) errs.treat_preference = 'Please choose your pet\'s treat preference.';
    if (!form.declaration_accepted) errs.declaration_accepted = 'You must accept the declaration before saving.';
    setFieldErrors(errs);
    if (errs.weight_kg || errs.vet_contact_number) { vaccinatedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return false; }
    if (errs.is_vaccinated) { vaccinatedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return false; }
    if (errs.vaccines || errs.vaccine_records) { vaccinatedRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return false; }
    if (errs.is_friendly) { socializationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return false; }
    if (errs.treat_preference) { treatRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return false; }
    if (errs.declaration_accepted) { declarationRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return false; }
    return true;
  };

  const handleSave = async ({ closeOnSuccess = true } = {}) => {
    if (!validate()) return false;
    setSaving(true);
    setSuccess('');
    setError('');
    try {
      const selectedDates = (Array.isArray(form.vaccines) ? form.vaccines : [])
        .map((name) => String(form.vaccine_records?.[name] || '').slice(0, 10))
        .filter(Boolean)
        .sort();
      const payload = {
        ...form,
        weight_kg: form.weight_kg ? Number(form.weight_kg).toFixed(2) : null,
        vet_contact_number: String(form.vet_contact_number || '').trim(),
        allergies: /^n\/?a$/i.test(String(form.allergies || '').trim()) ? 'None' : form.allergies,
        medical_conditions: /^n\/?a$/i.test(String(form.medical_conditions || '').trim()) ? 'None' : form.medical_conditions,
        vaccine_date: selectedDates[0] || null,
        vaccine_rabies: hasRabiesVaccine(form.vaccines),
        other_vaccine_name: form.vaccines.includes('Others') ? (form.other_vaccine_name || '').trim() : '',
        other_condition_notes: form.has_other_condition ? (form.other_condition_notes || '').trim() : '',
        ...(serviceId ? { service_id: serviceId } : {}),
        ...(appointmentId ? { appointment_id: appointmentId } : {}),
        pet_id: pet.id,
      };
      if (deferSave) {
        setSuccess('Assessment changes will be saved with the booking.');
        await onSaved?.(payload);
        if (closeOnSuccess) onClose();
        return true;
      }
      const res = await apiFetch(`${apiBase}/${pet.id}/health-form`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const apiFieldErrors = data?.errors || {};
        if (apiFieldErrors && typeof apiFieldErrors === 'object') {
          const merged = { ...fieldErrors };
          Object.entries(apiFieldErrors).forEach(([key, value]) => {
            merged[key] = Array.isArray(value) ? String(value[0] || '') : String(value || '');
          });
          setFieldErrors(merged);
        }
        const firstApiError = Object.values(apiFieldErrors || {}).reduce((acc, item) => {
          if (acc) return acc;
          if (Array.isArray(item)) return item[0] || '';
          return String(item || '');
        }, '');
        setError(firstApiError || data?.message || 'Failed to save.');
        return false;
      }
      setSuccess('Safety form saved successfully.');
      onSaved?.();
      if (closeOnSuccess) onClose();
      return true;
    } catch {
      setError('Network error. Please try again.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[320] flex h-[100dvh] min-h-[100dvh] w-screen items-center justify-center p-4"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute inset-0 bg-brand-dark/40 backdrop-blur-sm"
        aria-label="Close"
      />

      <div
        className="relative z-10 flex h-[88dvh] min-h-0 w-full max-w-5xl overflow-hidden rounded-2xl border-0 shadow-2xl flex-col sm:flex-row"
        onClick={(e) => e.stopPropagation()}
      >

        <div className={`hidden sm:flex w-72 shrink-0 flex-col bg-white border-r ${petSpeciesCode === 'C' ? 'border-brand-orange/30' : 'border-brand-teal/30'}`}>
          <div className="relative">
            {pet.photo_url ? (
              <img src={pet.photo_url} alt={pet.name} className="h-52 w-full object-cover" />
            ) : (
              <div className={`flex h-52 w-full items-center justify-center bg-gray-100`}>
                <span className={`text-5xl font-extrabold ${petSpeciesCode === 'C' ? 'text-brand-orange/30' : 'text-brand-teal/30'}`}>{petInitials(pet.name)}</span>
              </div>
            )}
            <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/70 to-transparent px-4 pb-3 pt-10">
              <p className={`text-white text-xl uppercase leading-tight ${isPetOwnerTheme ? 'font-bauhaus font-bold' : 'font-extrabold'}`}>{pet.name}</p>
              <p className={`font-semibold uppercase tracking-widest ${isPetOwnerTheme ? 'text-[11px] text-white/60' : 'text-[10px] text-white/50'}`}>{pet.pet_id || '-'}</p>
            </div>
            {isPetOwnerTheme && <div className={`absolute bottom-3 right-3 h-3.5 w-3.5 rounded-full border-2 border-white shadow ${petSpeciesCode === 'C' ? 'bg-brand-orange' : 'bg-brand-teal'}`} />}
          </div>

          {isPetOwnerTheme ? (
            <div className={`mx-4 mt-4 rounded-xl border overflow-hidden ${petSpeciesCode === 'C' ? 'border-brand-orange/30' : 'border-brand-teal/30'}`}>
              <div className={`flex items-center justify-between px-4 py-2.5 border-b ${petSpeciesCode === 'C' ? 'border-brand-orange/30' : 'border-brand-teal/30'} bg-white`}>
                <span className={`text-[10px] font-extrabold uppercase tracking-widest ${petSpeciesCode === 'C' ? 'text-brand-orange' : 'text-brand-teal'}`}>Pet Profile</span>
              </div>
              <div className={`divide-y ${petSpeciesCode === 'C' ? 'divide-brand-orange/20' : 'divide-brand-teal/20'}`}>
                {[
                  { label: 'Pet ID', value: sanitizeText(pet.pet_id || '-') },
                  { label: 'Species', value: sanitizeText(pet.species || pet.species_type?.name || pet.speciesType?.name || '-') },
                  { label: 'Breed', value: normalizeBreedName(pet.breed?.name || (typeof pet.breed === 'string' ? pet.breed : null) || '-', pet) },
                  { label: 'Sex', value: petSexDisplay },
                  { label: 'Date of Birth', value: fmtDate(petDobRaw) },
                  { label: 'Age', value: calcAge(petDobRaw) },
                  { label: 'Current Weight', value: currentWeightDisplay },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs font-semibold text-brand-dark">{label}:</span>
                    <span className="text-xs text-brand-dark-soft">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className={`mx-4 mt-4 rounded-2xl border px-5 py-4 ${petSpeciesCode === 'C' ? 'border-brand-orange/30' : 'border-brand-teal/30'} bg-white`}>
              <p className={`mb-3 text-[11px] font-bold uppercase tracking-widest ${petSpeciesCode === 'C' ? 'text-brand-orange' : 'text-brand-teal'}`}>Pet Profile</p>
              <div className={`mb-4 h-px ${petSpeciesCode === 'C' ? 'bg-brand-orange/20' : 'bg-brand-teal/20'}`} />
              <div className="space-y-4 text-xs">
                {[
                  { label: 'Pet ID', value: pet.pet_id || '-' },
                  { label: 'Species', value: pet.species || pet.species_type?.name || pet.speciesType?.name || '-' },
                  { label: 'Breed', value: normalizeBreedName(pet.breed?.name || (typeof pet.breed === 'string' ? pet.breed : null) || '-', pet) },
                  { label: 'Sex', value: petSexDisplay },
                  { label: 'Date of Birth', value: fmtDate(petDobRaw) },
                  { label: 'Age', value: calcAge(petDobRaw) },
                  { label: 'Current Weight', value: currentWeightDisplay },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">{label}</p>
                    <p className="text-brand-dark">{value}</p>
                    <div className="mt-2 h-px bg-brand-dark-light/50" />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="px-4 py-4" />
        </div>

        <div className="flex min-h-0 flex-1 flex-col bg-brand-surface">
          <div className="flex items-center justify-between bg-brand-teal px-5 py-4">
            <div className="flex items-center gap-2 min-w-0">
              <i className="fa-solid fa-notes-medical text-white text-base sm:text-lg shrink-0" />
              <div className="min-w-0">
                <h2 className="text-base sm:text-xl font-extrabold text-white leading-tight">{formTitle}</h2>
                {/* Pet name shown on mobile since left sidebar is hidden */}
                <p className="sm:hidden text-xs text-white/70 font-semibold truncate mt-0.5">{pet.name}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="ml-3 shrink-0 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
              aria-label="Close assessment form"
            >
              <X size={16} strokeWidth={2.8} />
            </button>
          </div>
          <div className="h-1 bg-white" />

          <fieldset
            disabled={isFormLocked || loadingForm}
            className="min-h-0 flex-1 space-y-6 overflow-y-auto no-scrollbar px-6 py-5 pr-4 scroll-smooth overscroll-contain disabled:opacity-100 [scrollbar-width:thin] [scrollbar-color:#4FC6C980_transparent] [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-brand-teal/50 hover:[&::-webkit-scrollbar-thumb]:bg-brand-teal/70"
          >
            {loadingForm && (
              <div role="status" aria-label="Loading assessment form" className="space-y-6">
                <span className="sr-only">Loading assessment form</span>
                {[0, 1, 2].map((section) => (
                  <div key={section} className="space-y-3">
                    <div className="border-b border-brand-dark-light pb-2">
                      <SkeletonBlock className={`h-3 ${section === 0 ? 'w-40' : section === 1 ? 'w-48' : 'w-36'}`} />
                    </div>
                    {section === 0 && (
                      <div className="space-y-2">
                        <SkeletonBlock className="h-3 w-24" />
                        <div className="flex gap-3">
                          <SkeletonBlock className="h-10 w-20 rounded-xl" />
                          <SkeletonBlock className="h-10 w-20 rounded-xl" />
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {Array.from({ length: section === 2 ? 4 : 2 }, (_, index) => (
                        <div key={index} className="space-y-2">
                          <SkeletonBlock className={`h-3 ${index % 2 === 0 ? 'w-28' : 'w-36'}`} />
                          <SkeletonBlock className="h-10 w-full rounded-xl" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="rounded-xl border border-brand-teal/20 bg-white p-4">
                  <div className="flex items-start gap-3">
                    <SkeletonBlock className="h-5 w-5 shrink-0" />
                    <div className="flex-1 space-y-2">
                      <SkeletonBlock className="h-3 w-full" />
                      <SkeletonBlock className="h-3 w-4/5" />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!loadingForm && (
            <>
            <div>
              <p className="mb-3 border-b border-brand-dark-light pb-1 text-[11px] font-extrabold uppercase tracking-widest text-brand-dark">
                Veterinary Information
              </p>

              <div ref={vaccinatedRef} className="space-y-3">
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-brand-dark">
                    Vaccinated? <span className="text-red-500">*</span>
                  </label>
                  <div className="flex gap-3">
                    {['Yes', 'No'].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => {
                          setField('is_vaccinated', opt);
                          if (opt === 'No') setForm((p) => ({
                            ...p,
                            is_vaccinated: 'No',
                            vaccines: [],
                            vaccine_records: {},
                            vet_clinic_name: '',
                            vet_contact_number: '',
                          }));
                        }}
                        className={`rounded-xl border px-5 py-2 text-sm font-semibold transition-colors ${
                          form.is_vaccinated === opt
                            ? 'border-brand-teal bg-brand-teal text-white'
                            : 'border-brand-dark-light bg-white text-brand-dark hover:border-brand-teal'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                  {fieldErrors.is_vaccinated && (
                    <p className="mt-1 text-xs text-red-500">{fieldErrors.is_vaccinated}</p>
                  )}
                </div>

                {form.is_vaccinated === 'Yes' && (
                  <div className="space-y-3">
                    {visibleVaccineOptions.length > 0 ? (
                      <div className="space-y-2 rounded-xl border border-brand-dark-light bg-white px-3 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">
                          Vaccines - {petSpeciesCode === 'C' ? 'Cat (Feline)' : 'Dog (Canine)'}
                        </p>
                        <div className="grid gap-2">
                          {visibleVaccineOptions.map((vLabel) => (
                            <div key={vLabel} className="rounded-lg border border-brand-dark-light/70 px-2.5 py-2">
                              <div className="flex items-start gap-2">
                                <input
                                  type="checkbox"
                                  checked={Array.isArray(form.vaccines) && form.vaccines.includes(vLabel)}
                                  onChange={(e) => {
                                    const current = Array.isArray(form.vaccines) ? form.vaccines : [];
                                    const next = e.target.checked
                                      ? [...new Set([...current, vLabel])]
                                      : current.filter((item) => item !== vLabel);
                                    setVaccines(next);
                                  }}
                                  className="mt-0.5 h-4 w-4 accent-brand-teal"
                                  style={{ appearance: 'checkbox' }}
                                />
                                <div className="min-w-0 flex-1">
                                  <p className="leading-snug text-sm text-brand-dark">{vLabel}</p>
                                  {form.vaccines.includes(vLabel) && (
                                    <div className="mt-1.5 max-w-[220px]">
                                      <input
                                        type="date"
                                        value={String(form.vaccine_records?.[vLabel] || '')}
                                        max={TODAY}
                                        onChange={(e) => setVaccineDate(vLabel, e.target.value)}
                                        className="w-full rounded-lg border border-brand-dark-light px-2.5 py-1.5 text-xs text-brand-dark focus:border-brand-teal focus:outline-none"
                                      />
                                      {fieldErrors?.vaccine_records?.[vLabel] && (
                                        <p className="mt-1 text-[11px] text-red-500">{fieldErrors.vaccine_records[vLabel]}</p>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}

                          {/* Others vaccine */}
                          <div className="rounded-lg border border-brand-dark-light/70 px-2.5 py-2">
                            <div className="flex items-start gap-2">
                              <input
                                type="checkbox"
                                checked={Array.isArray(form.vaccines) && form.vaccines.includes('Others')}
                                onChange={(e) => {
                                  const current = Array.isArray(form.vaccines) ? form.vaccines : [];
                                  const next = e.target.checked
                                    ? [...new Set([...current, 'Others'])]
                                    : current.filter((item) => item !== 'Others');
                                  setVaccines(next);
                                  if (!e.target.checked) setField('other_vaccine_name', '');
                                }}
                                className="mt-0.5 h-4 w-4 accent-brand-teal"
                                style={{ appearance: 'checkbox' }}
                              />
                              <div className="min-w-0 flex-1">
                                <p className="leading-snug text-sm text-brand-dark">Others</p>
                                {form.vaccines.includes('Others') && (
                                  <div className="mt-1.5 space-y-1.5">
                                    <input
                                      type="text"
                                      value={form.other_vaccine_name}
                                      onChange={(e) => setField('other_vaccine_name', e.target.value)}
                                      placeholder="Please specify vaccine name"
                                      className="w-full rounded-lg border border-brand-dark-light px-2.5 py-1.5 text-xs text-brand-dark focus:border-brand-teal focus:outline-none"
                                    />
                                    <input
                                      type="date"
                                      value={String(form.vaccine_records?.['Others'] || '')}
                                      max={TODAY}
                                      onChange={(e) => setVaccineDate('Others', e.target.value)}
                                      className="w-full max-w-[220px] rounded-lg border border-brand-dark-light px-2.5 py-1.5 text-xs text-brand-dark focus:border-brand-teal focus:outline-none"
                                    />
                                    {fieldErrors?.vaccine_records?.['Others'] && (
                                      <p className="mt-1 text-[11px] text-red-500">{fieldErrors.vaccine_records['Others']}</p>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                        {fieldErrors.vaccines && (
                          <p className="text-xs text-red-500">{fieldErrors.vaccines}</p>
                        )}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed border-brand-dark-light bg-white px-3 py-3 text-xs text-brand-dark-soft">
                        Vaccines are shown only for dogs and cats.
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">
                    Current Weight (kg) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.weight_kg}
                    onChange={(e) => setField('weight_kg', normalizeAssessmentWeight(e.target.value))}
                    onBlur={(e) => {
                      const raw = String(e.target.value || '').trim();
                      if (!raw || Number.isNaN(Number(raw))) return;
                      setField('weight_kg', Number(raw).toFixed(2));
                    }}
                    placeholder="e.g. 10.00"
                    className="w-full rounded-xl border border-brand-dark-light px-3 py-2 text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
                  />
                  {fieldErrors.weight_kg && <p className="mt-1 text-xs text-red-500">{fieldErrors.weight_kg}</p>}
                </div>

                {form.is_vaccinated === 'Yes' && (
                  <>
                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">
                        Vet Clinic Name
                      </label>
                      <input
                        type="text"
                        value={form.vet_clinic_name}
                        onChange={(e) => setField('vet_clinic_name', e.target.value)}
                        placeholder="e.g. Happy Paws Veterinary Clinic"
                        className="w-full rounded-xl border border-brand-dark-light px-3 py-2 text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">
                        Vet Contact Number
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={11}
                        value={form.vet_contact_number}
                        onChange={(e) => setField('vet_contact_number', normalizePhMobileInput(e.target.value))}
                        placeholder="e.g. 09171234567"
                        className="w-full rounded-xl border border-brand-dark-light px-3 py-2 text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
                      />
                      {fieldErrors.vet_contact_number && <p className="mt-1 text-xs text-red-500">{fieldErrors.vet_contact_number}</p>}
                    </div>
                  </>
                )}

                <div>
                  <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">
                    Medical Notes / Special Needs
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Type None if none"
                    value={form.medical_conditions}
                    onChange={(e) => setField('medical_conditions', e.target.value)}
                    className="w-full resize-none rounded-xl border border-brand-dark-light px-3 py-2.5 text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <HealthConditionsSection
              conditionSectionTitle={conditionSectionTitle}
              groomingItems={GROOMING_ITEMS}
              form={form}
              setField={setField}
            />

            <CarePreferencesSection
              form={form}
              setField={setField}
              socializationRef={socializationRef}
              treatRef={treatRef}
              fieldErrors={fieldErrors}
              socializationOptions={SOCIALIZATION_OPTIONS}
              treatOptions={TREAT_OPTIONS}
            />

            <PoliciesDeclarationSection
              hasServiceContext={hasServiceContext}
              policyTitle={policyTitle}
              activePolicies={activePolicies}
              declarationRef={declarationRef}
              fieldErrors={fieldErrors}
              form={form}
              setField={setField}
              declarationText={declarationText}
            />

            {success && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {success}
              </div>
            )}
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                {error}
              </div>
            )}
            </>
            )}
          </fieldset>

          <div className="shrink-0 border-t border-brand-dark-light px-5 py-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center sm:justify-end gap-2.5">
              {isFormLocked ? (
                <button
                  type="button"
                  onClick={() => setEditMode(true)}
                  disabled={loadingForm}
                  className="w-full rounded-xl bg-brand-teal px-6 py-3 text-base font-bold text-white transition-colors hover:bg-brand-teal-dark sm:w-auto"
                >
                  {loadingForm ? 'Loading...' : 'Edit Assessment Form'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  aria-busy={saving}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-teal px-6 py-3 text-base font-bold text-white shadow-sm transition-all duration-200 hover:bg-brand-teal-dark hover:shadow-md focus:outline-none focus:ring-2 focus:ring-brand-teal/40 focus:ring-offset-2 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {saving && (
                    <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" aria-hidden="true" />
                  )}
                  <span>{saving ? 'Saving...' : saveLabel}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
