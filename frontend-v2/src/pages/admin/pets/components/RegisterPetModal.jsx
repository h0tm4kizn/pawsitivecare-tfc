import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { apiFetch } from '../../../../api/apiClient';
import {
  EMPTY_PET,
  TODAY,
  isOtherBreed,
  isValidListedBreed,
  ownerName,
  speciesColor,
  speciesInitial,
} from '../petUtils';
import SelectDropdown from '../../../../components/reusable-ui/SelectDropdown';
import ImageCropModal from '../../../../components/modals/ImageCropModal';
import { notifySuccess } from '../../../../utils/notify';
import useBodyScrollLock from '../../../../hooks/useBodyScrollLock';

export default function RegisterPetModal({ speciesList, onClose, onSaved }) {
  useBodyScrollLock(true);
  const [step, setStep]                   = useState(1);
  const [ownerSearch, setOwnerSearch]       = useState('');
  const [ownerResults, setOwnerResults]     = useState([]);
  const [ownerSearching, setOwnerSearching] = useState(false);
  const [ownerSearchErr, setOwnerSearchErr] = useState('');
  const [selectedOwner, setSelectedOwner]   = useState(null);
  const searchTimer        = useRef(null);
  const abortRef           = useRef(null);
  const searchCacheRef     = useRef(new Map());
  const [petForm, setPetForm]             = useState(EMPTY_PET);
  const [otherBreed, setOtherBreed]       = useState('');
  const [petErrors, setPetErrors]         = useState({});
  const [apiError, setApiError]           = useState('');
  const [successMsg, setSuccessMsg]       = useState('');
  const [isSaving, setIsSaving]           = useState(false);
  const [addBreeds, setAddBreeds]         = useState([]);
  const [photoFile, setPhotoFile]         = useState(null);
  const [photoPreview, setPhotoPreview]   = useState('');
  const [cropSrc, setCropSrc]             = useState(null);

  const pickOwnerRows = (data) => {
    if (Array.isArray(data?.owners)) return data.owners;
    if (Array.isArray(data?.data?.owners)) return data.data.owners;
    if (Array.isArray(data?.data?.data)) return data.data.data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data)) return data;
    return [];
  };

  useEffect(() => {
    if (!petForm.speciesId) { setAddBreeds([]); return; }
    apiFetch(`/api/breeds/options?species_id=${petForm.speciesId}`)
      .then((r) => r.ok ? r.json() : {})
      .then((d) => setAddBreeds(Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : []))
      .catch(() => {});
  }, [petForm.speciesId]);

  useEffect(() => {
    setOtherBreed('');
  }, [petForm.speciesId]);

  useEffect(() => () => {
    clearTimeout(searchTimer.current);
    abortRef.current?.abort();
  }, []);

  const doOwnerSearch = async (query) => {
    const normalized = query.trim().toLowerCase();
    if (normalized.length < 2) { setOwnerResults([]); return; }
    if (searchCacheRef.current.has(normalized)) {
      setOwnerResults(searchCacheRef.current.get(normalized));
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setOwnerSearching(true);
    setOwnerSearchErr('');
    try {
      const q = encodeURIComponent(normalized);
      let list = [];

      let res = await apiFetch(`/api/booking/owners?search=${q}`, { signal: controller.signal });
      if (res.ok) {
        const d = await res.json().catch(() => ({}));
        list = pickOwnerRows(d);
      }

      if (list.length === 0) {
        const fallbackCandidates = [`/api/owners?search=${q}`, `/api/admin/owners?search=${q}`, `/api/owners?q=${q}`];
        for (const path of fallbackCandidates) {
          res = await apiFetch(path, { signal: controller.signal });
          if (!res.ok) continue;
          const d = await res.json().catch(() => ({}));
          const rows = pickOwnerRows(d);
          if (rows.length > 0) { list = rows; break; }
        }
      }
      const result = list.slice(0, 8);
      searchCacheRef.current.set(normalized, result);
      setOwnerResults(result);
    } catch (err) {
      if (err?.name !== 'AbortError') setOwnerSearchErr('Search failed. Please try again.');
    } finally {
      setOwnerSearching(false);
    }
  };

  const handleOwnerSearchChange = (value) => {
    setOwnerSearch(value);
    setOwnerSearchErr('');
    clearTimeout(searchTimer.current);
    const q = value.trim();
    if (!q || q.length < 2) {
      setOwnerResults([]);
      setOwnerSearching(false);
      return;
    }
    const cached = searchCacheRef.current.get(q.toLowerCase());
    if (cached) {
      setOwnerResults(cached);
      setOwnerSearching(false);
      return;
    }
    setOwnerSearching(true);
    searchTimer.current = setTimeout(() => doOwnerSearch(value), 150);
  };

  const setPetField = (field) => (e) => {
    setPetForm((p) => ({ ...p, [field]: e.target.value }));
    setPetErrors((p) => ({ ...p, [field]: '' }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCropSrc(ev.target?.result || '');
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const validate = () => {
    const e = {};
    if (!petForm.name.trim()) e.name      = 'Pet name is required.';
    if (!petForm.speciesId)   e.speciesId = 'Type is required.';
    if (String(petForm.breedId) === '__other__' && !otherBreed.trim()) e.otherBreed = 'Please specify the breed.';
    if (!petForm.sex)         e.sex       = 'Sex is required.';
    if (petForm.dateOfBirth && petForm.dateOfBirth > TODAY) e.dateOfBirth = 'Birthday cannot be in the future.';
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) { setPetErrors(e); return; }
    setIsSaving(true);
    setApiError('');
    setSuccessMsg('');
    try {
      const name = petForm.name.trim();
      const body = {
        owner_id:      selectedOwner.id,
        name:          name.charAt(0).toUpperCase() + name.slice(1),
        species_id:    petForm.speciesId,
        breed_id:      petForm.breedId === '__other__'
          ? (addBreeds.find(isOtherBreed)?.id || null)
          : (petForm.breedId || null),
        sex:           petForm.sex,
        date_of_birth: petForm.dateOfBirth || null,
        medical_notes: petForm.breedId === '__other__' && otherBreed.trim() ? `Other Breed: ${otherBreed.trim()}` : null,
      };
      const res = await apiFetch('/api/pets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.errors ? Object.values(d.errors).flat().join(' ') : d?.message || 'Failed to register pet.');
      }
      const saved = await res.json().catch(() => ({}));
      const petData = saved?.data || saved;

      if (photoFile && petData?.id) {
        const formData = new FormData();
        formData.append('photo', photoFile);
        const photoRes = await apiFetch(`/api/pets/${petData.id}/photo`, { method: 'POST', body: formData });
        const photoData = await photoRes.json().catch(() => ({}));
        if (photoRes.ok) {
          petData.photo_url = photoData?.data?.photo_url || photoData?.photo_url || petData.photo_url;
        }
      }

      onSaved(petData);
      const savedPetName = petData?.name || body.name || 'Your pet';
      setSuccessMsg(`Wags & Purrs!\n${savedPetName} is officially part of the family! Their profile is ready for some PawsitiveCare.`);
      setTimeout(() => onClose(), 1100);
    } catch (err) {
      setApiError(err.message || 'An error occurred.');
    } finally {
      setIsSaving(false);
    }
  };

  const ic = (field) =>
    `mt-1 w-full rounded-xl border px-3 py-2 text-sm text-brand-dark focus:outline-none ${
      petErrors[field] ? 'border-red-400 focus:border-red-400' : 'border-brand-teal/20 focus:border-brand-teal'
    }`;

  const speciesOptions = [
    { value: '', label: 'Select type' },
    ...speciesList.map((s) => ({ value: s.id, label: s.name })),
  ];
  const breedOptions = [
    { value: '', label: 'Select breed' },
    ...[...addBreeds].filter(isValidListedBreed).sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''))).map((b) => ({ value: b.id, label: b.name })),
    { value: '__other__', label: 'Others' },
  ];
  const sexOptions = [
    { value: '', label: 'Select sex' },
    { value: 'male', label: 'Male' },
    { value: 'female', label: 'Female' },
  ];
  const selectedSpecies = speciesList.find((s) => String(s.id) === String(petForm.speciesId));
  const selectedBreed = breedOptions.find((option) => String(option.value) === String(petForm.breedId));
  const summaryRows = [
    ['Owner', ownerName(selectedOwner)],
    ['Pet Name', petForm.name.trim() || 'Not set'],
    ['Type', selectedSpecies?.name || 'Not set'],
    ['Breed', petForm.breedId === '__other__' ? (otherBreed.trim() || 'Other') : (selectedBreed?.value ? selectedBreed.label : 'Not set')],
    ['Sex', petForm.sex ? petForm.sex.charAt(0).toUpperCase() + petForm.sex.slice(1) : 'Not set'],
    ['Birthday', petForm.dateOfBirth || 'Not set'],
  ];

  return (
    <>
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 backdrop-blur-sm bg-brand-dark/40 h-[100dvh] min-h-[100dvh] w-screen">
      <div className="flex h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between bg-brand-teal px-6 py-4">
          <div className="flex items-center gap-4">
            <div>
              <h2 className="text-base font-semibold text-white">Register New Pet</h2>
              <p className="text-[11px] text-white/60">
                {step === 1 ? 'Step 1 of 2 — Find Customer' : 'Step 2 of 2 — Pet Information'}
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full transition-colors ${step >= 1 ? 'bg-white' : 'bg-white/30'}`} />
              <span className="text-[9px] text-white/40">—</span>
              <span className={`h-2 w-2 rounded-full transition-colors ${step >= 2 ? 'bg-white' : 'bg-white/30'}`} />
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25">
            <X size={17} strokeWidth={2.5} />
          </button>
        </div>
        <div className="h-1 shrink-0 bg-white" />

        {step === 1 && (
          <div className="flex flex-1 flex-col overflow-y-auto px-6 py-6">
            <p className="mb-4 text-sm text-brand-dark-soft">Search for the customer to link this pet to.</p>
            <div className="relative mb-3">
              <input value={ownerSearch} onChange={(e) => handleOwnerSearchChange(e.target.value)}
                placeholder="Search by name or email…"
                className="w-full rounded-xl border border-brand-teal/20 px-3 py-2.5 pr-24 text-sm text-brand-dark focus:border-brand-teal focus:outline-none" />
              {ownerSearching && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-brand-dark-soft">Searching...</span>
              )}
            </div>
            {!ownerSearching && ownerSearch.trim().length >= 2 && ownerResults.length === 0 && (
              <p className="mb-2 rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-brand-dark-soft">No customers found. Try a different name or email.</p>
            )}
            {ownerSearchErr && (
              <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-500">{ownerSearchErr}</p>
            )}
            {ownerResults.length > 0 && (
              <div className="max-h-64 overflow-y-auto rounded-xl border border-brand-teal/20 divide-y divide-brand-teal/10">
                {ownerResults.map((o) => (
                  <button key={o.id} type="button"
                    onClick={() => { setSelectedOwner(o); setPetForm(EMPTY_PET); setPetErrors({}); setApiError(''); setStep(2); }}
                    className="w-full px-4 py-3 text-left hover:bg-brand-teal/5 transition-colors">
                    <p className="text-sm font-semibold text-brand-dark">{ownerName(o)}</p>
                    <p className="text-xs text-brand-dark-soft">{o.email || '—'}</p>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <>
            <div className="flex flex-1 flex-col overflow-y-auto px-6 py-5">
              <div className="flex items-center justify-between rounded-xl bg-brand-teal/8 border border-brand-teal/20 px-4 py-2.5">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-dark-soft">Owner</p>
                  <p className="text-sm font-semibold text-brand-dark">{ownerName(selectedOwner)}</p>
                </div>
                <button type="button" onClick={() => setStep(1)} className="text-xs font-semibold text-brand-teal hover:underline">Change</button>
              </div>

              {apiError && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{apiError}</p>}
              {successMsg && (
                <div className="rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 flex items-center gap-2">
                  <i className="fa-solid fa-paw text-green-600" />
                  <span className="whitespace-pre-line">{successMsg}</span>
                </div>
              )}

              <div className="mt-4 grid flex-1 gap-5 lg:grid-cols-[1fr_300px]">
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold text-brand-dark">Pet Name <span className="text-red-500">*</span></label>
                    <input value={petForm.name} onChange={setPetField('name')} placeholder="e.g. Buddy" className={ic('name')} />
                    {petErrors.name && <p className="mt-0.5 text-[10px] text-red-500">{petErrors.name}</p>}
                  </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="min-w-0">
                  <label className="text-xs font-semibold text-brand-dark">Type <span className="text-red-500">*</span></label>
                  <SelectDropdown
                    value={petForm.speciesId}
                    onChange={(value) => {
                      setPetForm((prev) => ({ ...prev, speciesId: value, breedId: '' }));
                      setOtherBreed('');
                      setPetErrors((prev) => ({ ...prev, speciesId: '', breedId: '', otherBreed: '' }));
                    }}
                    options={speciesOptions}
                    placeholder="Select type"
                    hasError={!!petErrors.speciesId}
                    className="mt-1"
                  />
                  {petErrors.speciesId && <p className="mt-0.5 text-[10px] text-red-500">{petErrors.speciesId}</p>}
                </div>
                <div className="min-w-0">
                  <label className="text-xs font-semibold text-brand-dark">Breed</label>
                  <SelectDropdown
                    value={petForm.breedId}
                    onChange={(v) => setPetField('breedId')({ target: { value: v } })}
                    options={breedOptions}
                    placeholder="Select breed"
                    disabled={!petForm.speciesId}
                    hasError={!!petErrors.breedId}
                    className="mt-1"
                    searchable
                    searchPlaceholder="Search breed..."
                    groupByFirstLetter
                  />
                  {petErrors.breedId && <p className="mt-0.5 text-[10px] text-red-500">{petErrors.breedId}</p>}
                  {petForm.breedId === '__other__' && (
                    <>
                      <input
                        value={otherBreed}
                        onChange={(e) => { setOtherBreed(e.target.value); setPetErrors((p) => ({ ...p, otherBreed: '' })); }}
                        placeholder="Please specify breed"
                        className={ic('otherBreed')}
                      />
                      {petErrors.otherBreed && <p className="mt-0.5 text-[10px] text-red-500">{petErrors.otherBreed}</p>}
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-brand-dark">Sex <span className="text-red-500">*</span></label>
                  <SelectDropdown
                    value={petForm.sex}
                    onChange={(value) => setPetField('sex')({ target: { value } })}
                    options={sexOptions}
                    placeholder="Select sex"
                    hasError={!!petErrors.sex}
                    className="mt-1"
                  />
                  {petErrors.sex && <p className="mt-0.5 text-[10px] text-red-500">{petErrors.sex}</p>}
                </div>
              </div>

                  <div>
                    <label className="text-xs font-semibold text-brand-dark">Date of Birth</label>
                    <input type="date" value={petForm.dateOfBirth} onChange={setPetField('dateOfBirth')} max={TODAY} className={ic('dateOfBirth')} />
                    {petErrors.dateOfBirth && <p className="mt-0.5 text-[10px] text-red-500">{petErrors.dateOfBirth}</p>}
                  </div>
                </div>

                <aside className="flex border-t border-brand-dark-light pt-5 lg:border-l lg:border-t-0 lg:px-5 lg:py-5 lg:overflow-y-auto">
                  <div className="flex h-full w-full flex-col gap-4 pb-10">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-dark-soft">Preview</p>
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div className={`flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full text-xl font-semibold text-white ${speciesColor(selectedSpecies?.name || '')}`}>
                      {photoPreview
                        ? <img src={photoPreview} alt="Pet" className="h-full w-full object-cover" />
                        : speciesInitial(selectedSpecies?.name || '')}
                      </div>
                      <div className="min-w-0 max-w-full">
                        <p className="break-words text-base font-semibold text-brand-dark">{petForm.name.trim() || 'New Pet'}</p>
                        <p className="text-xs text-brand-dark-soft">{selectedSpecies?.name || 'Pet profile preview'}</p>
                      </div>
                      <label className="inline-flex cursor-pointer items-center rounded-xl bg-brand-teal px-4 py-2 text-xs font-semibold text-white hover:bg-brand-teal-dark">
                        {photoFile ? 'Change Photo' : 'Upload Pet Photo'}
                        <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                      </label>
                      {photoFile ? (
                        <div>
                          <p className="max-w-[220px] truncate text-[11px] text-brand-dark-soft">{photoFile.name}</p>
                          <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(''); }} className="mt-1 text-[11px] font-semibold text-red-500 hover:underline">Remove photo</button>
                        </div>
                      ) : (
                        <p className="text-[11px] text-brand-dark-soft">No pet photo uploaded yet</p>
                      )}
                    </div>
                    <div className="space-y-3 text-xs">
                      {summaryRows.map(([label, value]) => (
                        <div key={label}>
                          <p className="font-semibold text-brand-dark-soft">{label}</p>
                          <p className="mt-0.5 break-words font-semibold leading-snug text-brand-dark">{String(value || '').trim() || '-'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </aside>
              </div>
            </div>

            <div className="shrink-0 flex gap-2 border-t border-brand-teal/15 bg-white px-6 py-4">
              <button type="button" onClick={() => setStep(1)} disabled={isSaving}
                className="rounded-xl border border-brand-teal/20 px-5 py-2.5 text-sm text-brand-dark hover:bg-gray-50 disabled:opacity-50">
                Back
              </button>
              <button type="button" onClick={handleSave} disabled={isSaving}
                className="flex-1 rounded-xl bg-brand-teal py-2.5 text-sm font-semibold text-white hover:bg-brand-teal-dark disabled:opacity-50">
                {isSaving ? 'Saving…' : 'Register Pet'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>

    {cropSrc && (
      <ImageCropModal
        imageSrc={cropSrc}
        onDone={(file, preview) => { setPhotoFile(file); setPhotoPreview(preview); setCropSrc(null); notifySuccess('Photo uploaded successfully.', 2000); }}
        onCancel={() => setCropSrc(null)}
      />
    )}
    </>
  );
}
