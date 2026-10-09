import { Camera, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../../api/apiClient';
import { notifySuccess } from '../../../utils/notify';
import SelectDropdown from '../../../components/reusable-ui/SelectDropdown';
import DateDropdown from '../../../components/reusable-ui/DateDropdown';
import { sanitizeText } from '../../../utils/textUtils';
import useBodyScrollLock from '../../../hooks/useBodyScrollLock';
import {
  calcAgeVerbose,
  EMPTY_PET,
  fmtDate,
  isOtherBreed,
  isValidListedBreed,
  TODAY,
} from './petUtils';

export default function PetRegistration({ isOpen, ownerForm, onBack, onClose, onRegistered }) {
  useBodyScrollLock(isOpen);
  const [petForm, setPetForm] = useState(EMPTY_PET);
  const [petErrors, setPetErrors] = useState({});
  const [petApiError, setPetApiError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isSavingPet, setIsSavingPet] = useState(false);
  const [petPhotoFile, setPetPhotoFile] = useState(null);
  const [petPhotoPreview, setPetPhotoPreview] = useState(null);
  const [speciesList, setSpeciesList] = useState([]);
  const [breedsList, setBreedsList] = useState([]);
  const [otherBreed, setOtherBreed] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const loadSpecies = async () => {
      const endpoints = ['/api/species-types', '/api/species'];
      for (const endpoint of endpoints) {
        try {
          const response = await apiFetch(endpoint);
          const data = await response.json().catch(() => ({}));
          if (!response.ok) continue;
          const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
          if (list.length > 0) {
            setSpeciesList(list);
            return;
          }
        } catch {
          // Try next endpoint.
        }
      }
      setSpeciesList([]);
    };
    loadSpecies();
  }, [isOpen]);

  useEffect(() => {
    if (!petForm.speciesId) {
      setBreedsList([]);
      return;
    }
    apiFetch(`/api/breeds/options?species_id=${petForm.speciesId}`)
      .then((response) => (response.ok ? response.json() : {}))
      .then((data) => setBreedsList(Array.isArray(data?.data) ? data.data : []))
      .catch(() => {});
  }, [petForm.speciesId]);

  useEffect(() => {
    setOtherBreed('');
  }, [petForm.speciesId]);

  const setPet = (field) => (event) => {
    setPetForm((prev) => ({ ...prev, [field]: event.target.value }));
    setPetErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const validatePet = () => {
    const nextErrors = {};
    if (!petForm.name.trim()) nextErrors.name = 'Pet name is required.';
    if (!petForm.speciesId) nextErrors.speciesId = 'Pet species is required.';
    if (!petForm.breedId) nextErrors.breedId = 'Breed is required.';
    if (String(petForm.breedId) === '__other__' && !otherBreed.trim()) nextErrors.otherBreed = 'Please specify the breed.';
    if (!petForm.sex) nextErrors.sex = 'Sex is required.';
    if (petForm.dateOfBirth && petForm.dateOfBirth > TODAY) nextErrors.dateOfBirth = 'Birthday cannot be in the future.';
    return nextErrors;
  };

  const handleSavePet = async () => {
    const nextErrors = validatePet();
    if (Object.keys(nextErrors).length) {
      setPetErrors(nextErrors);
      return;
    }

    setIsSavingPet(true);
    setPetApiError('');
    setSuccessMsg('');
    try {
      const payload = {
        first_name: ownerForm.first_name.trim(),
        last_name: ownerForm.last_name.trim(),
        email: ownerForm.email.trim(),
        phone: ownerForm.phone.trim().replace(/[-\s]/g, ''),
        password: ownerForm.password,
        preferred_contact: ownerForm.preferred_contact,
        address: ownerForm.address?.trim() || null,
        address_unit_floor: ownerForm.address_unit_floor?.trim() || null,
        address_street: ownerForm.address_street?.trim() || null,
        address_barangay: ownerForm.address_barangay?.trim() || null,
        address_city: ownerForm.address_city?.trim() || null,
        address_province: ownerForm.address_province?.trim() || null,
        address_postal_code: ownerForm.address_postal_code?.trim() || null,
        address_country: 'PH',
        pet_name: petForm.name.trim(),
        species_id: petForm.speciesId,
        breed_id: petForm.breedId === '__other__'
          ? (breedsList.find(isOtherBreed)?.id || '')
          : petForm.breedId,
        pet_sex: petForm.sex,
        pet_dob: petForm.dateOfBirth || null,
        medical_notes: petForm.breedId === '__other__' && otherBreed.trim() ? `Other Breed: ${otherBreed.trim()}` : null,
      };

      if (ownerForm.ec_first_name?.trim()) payload.ec_first_name = ownerForm.ec_first_name.trim();
      if (ownerForm.ec_last_name?.trim()) payload.ec_last_name = ownerForm.ec_last_name.trim();
      if (ownerForm.ec_email?.trim()) payload.ec_email = ownerForm.ec_email.trim();
      if (ownerForm.ec_phone?.trim()) payload.ec_phone = ownerForm.ec_phone.trim();

      const response = await apiFetch('/api/admin/owners-with-pet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const message = data?.errors ? Object.values(data.errors).flat().join(' ') : data?.message || 'Failed to register customer with pet.';
        throw new Error(message);
      }

      const petId = data?.data?.pet?.id || data?.pet?.id;
      if (petId && petPhotoFile) {
        const formData = new FormData();
        formData.append('photo', petPhotoFile);
        await apiFetch(`/api/pets/${petId}/photo`, {
          method: 'POST',
          body: formData,
        }).catch(() => {});
      }

      const petName = payload.pet_name || 'Your pet';
      setSuccessMsg(`Wags & Purrs!\n${petName} is officially part of the family! Their profile is ready for some PawsitiveCare.`);
      onRegistered?.('Customer and pet registered successfully.');
      setTimeout(() => onClose?.(), 1100);
    } catch (error) {
      setPetApiError(error?.message || 'An error occurred.');
    } finally {
      setIsSavingPet(false);
    }
  };

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setPetPhotoFile(file);
    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      setPetPhotoPreview(loadEvent.target.result);
      notifySuccess('Photo uploaded successfully.', 2000);
    };
    reader.readAsDataURL(file);
  };

  const petInputClass = (field) =>
    `mt-1 w-full rounded-xl border px-3 py-2 text-sm text-brand-dark focus:outline-none ${
      petErrors[field] ? 'border-red-400 focus:border-red-400' : 'border-brand-teal/20 focus:border-brand-teal'
    }`;

  const previewSpecies = useMemo(() => speciesList.find((item) => item.id === petForm.speciesId), [speciesList, petForm.speciesId]);
  const previewBreed = useMemo(() => breedsList.find((item) => item.id === petForm.breedId), [breedsList, petForm.breedId]);
  const breedOptions = useMemo(
    () => [
      { value: '', label: '- SELECT PET BREED -' },
      ...[...breedsList].filter(isValidListedBreed).sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || ''))).map((item) => ({ value: item.id, label: item.name })),
      { value: '__other__', label: 'Others' },
    ],
    [breedsList]
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[130] flex h-[100dvh] min-h-[100dvh] w-screen items-center justify-center p-4">
      <button type="button" onClick={onClose} className="absolute inset-0 backdrop-blur-sm bg-brand-dark/40" aria-label="Close" />

      <div className="relative z-10 flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between bg-brand-teal px-5 py-3">
          <h2 className="text-base font-bold text-brand-white">Pet Registration</h2>
          <button type="button" onClick={onClose} disabled={isSavingPet} className="text-2xl leading-none text-brand-white hover:opacity-70 disabled:opacity-40">
            <X size={18} />
          </button>
        </div>

        <div className="flex bg-white">
          <div className="flex-1 overflow-y-auto px-6 py-5" style={{ maxHeight: '75vh' }}>
            {petApiError && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-600">{petApiError}</div>}
            {successMsg && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
                <i className="fa-solid fa-paw text-green-600" />
                <span className="whitespace-pre-line">{successMsg}</span>
              </div>
            )}

            <div className="mb-3 rounded-xl border border-brand-teal/20 bg-white px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-wide text-brand-dark-soft">Owner</p>
              <p className="text-sm font-semibold text-brand-dark">{`${ownerForm.first_name} ${ownerForm.last_name}`.trim() || '-'}</p>
              <p className="text-xs text-brand-dark-soft">{ownerForm.email || '-'}</p>
            </div>

            <div className="mb-4">
              <label className="text-xs font-bold uppercase tracking-wider text-brand-dark">Pet Name <span className="text-red-500">*</span></label>
              <input value={petForm.name} onChange={setPet('name')} placeholder="Enter pet name" className={petInputClass('name')} />
              {petErrors.name && <p className="mt-0.5 text-[10px] text-red-500">{petErrors.name}</p>}
            </div>

            <div className="mb-4 grid grid-cols-2 gap-4">
              <div className="min-w-0">
                <label className="text-xs font-bold uppercase tracking-wider text-brand-dark">Pet Species <span className="text-red-500">*</span></label>
                <SelectDropdown
                  value={petForm.speciesId}
                  onChange={(value) => {
                      setPet('speciesId')({ target: { value } });
                      setPetForm((prev) => ({ ...prev, breedId: '' }));
                      setOtherBreed('');
                      setPetErrors((prev) => ({ ...prev, speciesId: '', breedId: '', otherBreed: '' }));
                  }}
                  options={[{ value: '', label: '- SELECT PET SPECIES -' }, ...speciesList.map((item) => ({ value: item.id, label: item.name }))]}
                  buttonClassName={petInputClass('speciesId')}
                  textClassName="min-w-0 truncate"
                />
                {petErrors.speciesId && <p className="mt-0.5 text-[10px] text-red-500">{petErrors.speciesId}</p>}
              </div>
              <div className="min-w-0">
                <label className="text-xs font-bold uppercase tracking-wider text-brand-dark">Pet Breed <span className="text-red-500">*</span></label>
                <SelectDropdown
                  value={petForm.breedId}
                  onChange={(v) => setPet('breedId')({ target: { value: v } })}
                  options={breedOptions}
                  placeholder="- SELECT PET BREED -"
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
                      onChange={(event) => { setOtherBreed(event.target.value); setPetErrors((prev) => ({ ...prev, otherBreed: '' })); }}
                      placeholder="Please specify breed"
                      className={petInputClass('otherBreed')}
                    />
                    {petErrors.otherBreed && <p className="mt-0.5 text-[10px] text-red-500">{petErrors.otherBreed}</p>}
                  </>
                )}
              </div>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-brand-dark">Birthdate</label>
                <DateDropdown value={petForm.dateOfBirth} onChange={(value) => setPet('dateOfBirth')({ target: { value } })} max={TODAY} buttonClassName={petInputClass('dateOfBirth')} />
                {petErrors.dateOfBirth && <p className="mt-0.5 text-[10px] text-red-500">{petErrors.dateOfBirth}</p>}
              </div>
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-brand-dark">Pet Sex <span className="text-red-500">*</span></label>
                <SelectDropdown
                  value={petForm.sex}
                  onChange={(value) => setPet('sex')({ target: { value } })}
                  options={[{ value: '', label: '- SELECT -' }, { value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]}
                  buttonClassName={petInputClass('sex')}
                />
                {petErrors.sex && <p className="mt-0.5 text-[10px] text-red-500">{petErrors.sex}</p>}
              </div>
            </div>

            <div className="mb-4">
              <label className="text-xs font-bold uppercase tracking-wider text-brand-dark">Pet Photo</label>
              <label className="mt-1 flex h-32 w-full cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed border-brand-teal/40 bg-white hover:border-brand-teal">
                {petPhotoPreview ? (
                  <img src={petPhotoPreview} alt="Pet preview" className="h-full w-full object-cover" />
                ) : (
                  <div className="text-center text-brand-dark-soft">
                    <Camera className="mx-auto h-6 w-6" />
                    <p className="mt-1 text-xs font-medium">Click to add photo</p>
                  </div>
                )}
                <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
              </label>
            </div>

          </div>

          <div className="w-72 shrink-0 overflow-y-auto border-l border-brand-teal/20 px-5 py-5" style={{ maxHeight: '75vh' }}>
            <p className="mb-3 text-sm font-semibold text-brand-dark">Preview</p>
            <div className="space-y-3">
              <div className="overflow-hidden rounded-xl border border-brand-teal/20 bg-white">
                <div className="border-b border-brand-teal/15 px-3 py-2.5">
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-teal-dark">Owner Information</p>
                </div>
                <div className="space-y-2.5 p-3 text-xs">
                  {[
                    ['Name', `${ownerForm.first_name || ''} ${ownerForm.last_name || ''}`.trim() || '-'],
                    ['Email', ownerForm.email || '-'],
                    ['Phone', ownerForm.phone || '-'],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-dark-soft">{label}</p>
                      <p className={`mt-0.5 min-w-0 font-semibold leading-snug text-brand-dark ${label === 'Email' ? 'break-all' : 'break-words'}`}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-brand-teal/20 bg-white">
                <div className="border-b border-brand-teal/15 px-3 py-2.5">
                  <p className="text-xs font-bold uppercase tracking-wider text-brand-teal-dark">Pet Profile</p>
                </div>
                <div className="space-y-2 p-3 text-xs">
                  {[
                    ['Name', petForm.name || '-'],
                    ['Species', previewSpecies?.name || '-'],
                    ['Breed', petForm.breedId === '__other__' ? (sanitizeText(otherBreed)?.trim() ? `Other: ${sanitizeText(otherBreed).trim()}` : 'Other') : (sanitizeText(previewBreed?.name || '-'))],
                    ['Birthdate', petForm.dateOfBirth ? fmtDate(petForm.dateOfBirth) : '-'],
                    ['Age', calcAgeVerbose(petForm.dateOfBirth) || '-'],
                    ['Sex', petForm.sex ? `${petForm.sex[0].toUpperCase()}${petForm.sex.slice(1)}` : '-'],
                    ['Photo', petPhotoFile?.name || '-'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-start gap-2">
                      <span className="w-20 shrink-0 text-brand-dark-soft">{label}:</span>
                      <span className="min-w-0 break-words font-semibold text-brand-dark">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-brand-teal/20 bg-white px-6 py-3">
          <button type="button" onClick={onBack} disabled={isSavingPet} className="rounded-xl border border-brand-teal/30 px-4 py-2 text-sm font-semibold text-brand-dark disabled:opacity-60 hover:bg-brand-teal/5">
            Back
          </button>
          <button type="button" onClick={handleSavePet} disabled={isSavingPet} className="rounded-xl bg-brand-teal px-5 py-2 text-sm font-semibold text-white disabled:opacity-60 hover:bg-brand-teal-dark">
            {isSavingPet ? 'Saving...' : 'Register'}
          </button>
        </div>
      </div>
    </div>
  );
}
