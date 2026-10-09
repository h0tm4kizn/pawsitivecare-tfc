import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiGet, apiFetch } from '../../../api/apiClient';
import ImageCropModal from '../../../components/modals/ImageCropModal';
import SelectDropdown from '../../../components/reusable-ui/SelectDropdown';
import { notifySuccess } from '../../../utils/notify';
import { db } from '../../../utils/powersync/db';
import useBodyScrollLock from '../../../hooks/useBodyScrollLock';
import { safeStorageGet } from '../../../utils/browserStorage';

const TODAY = new Date().toISOString().split('T')[0];

const EMPTY = {
  name: '', speciesId: '', breedId: '', sex: '',
  dateOfBirth: '',
  otherBreed: '',
};

const inputCls = (err) =>
  `mt-1 w-full rounded-xl border px-3 py-2 text-sm text-brand-dark focus:outline-none ${
    err ? 'border-red-400 focus:border-red-400' : 'border-brand-dark-light focus:border-brand-teal'
  }`;

const getCurrentOwnerId = () => {
  try {
    const raw = safeStorageGet(window.localStorage, 'auth_user') || safeStorageGet(window.sessionStorage, 'auth_user');
    if (!raw) return null;
    const user = JSON.parse(raw);
    return user?.owner?.id || user?.ownerId || null;
  } catch {
    return null;
  }
};

export default function AddPetModal({ isOpen, onClose, onSaved, editPet = null }) {
  const isEdit = !!editPet;

  const [form,         setForm]         = useState(EMPTY);
  const [errors,       setErrors]       = useState({});
  const [apiError,     setApiError]     = useState('');
  const [successMsg,   setSuccessMsg]   = useState('');
  const [isSaving,     setIsSaving]     = useState(false);
  const [speciesList,  setSpeciesList]  = useState([]);
  const [breedsList,   setBreedsList]   = useState([]);
  const [photoFile,    setPhotoFile]    = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [cropSrc,      setCropSrc]      = useState(null);
  useBodyScrollLock(isOpen || !!cropSrc);

  useEffect(() => {
    if (!isOpen) return;
    apiGet('/api/species')
      .then((r) => r.ok ? r.json() : {})
      .then((d) => setSpeciesList(Array.isArray(d?.data) ? d.data : []))
      .catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    setErrors({});
    setApiError('');
    setSuccessMsg('');
    setPhotoFile(null);
    setCropSrc(null);
    if (isEdit && editPet) {
      setForm({
        name:         editPet.name          || '',
        speciesId:    String(editPet.species_id    ?? editPet.speciesType?.id ?? ''),
        breedId:      String(editPet.breed_id      ?? editPet.breed?.id       ?? ''),
        sex:          editPet.sex           || '',
        dateOfBirth:  editPet.date_of_birth ? String(editPet.date_of_birth).slice(0, 10) : '',
        otherBreed:   '',
      });
      setPhotoPreview(editPet.photo_url || null);
    } else {
      setForm(EMPTY);
      setPhotoPreview(null);
    }
  }, [isOpen, isEdit, editPet]);

  useEffect(() => {
    if (!form.speciesId) { setBreedsList([]); return; }
    apiGet(`/api/breeds/options?species_id=${form.speciesId}`)
      .then((r) => r.ok ? r.json() : {})
      .then((d) => setBreedsList(Array.isArray(d?.data) ? d.data : []))
      .catch(() => {});
  }, [form.speciesId]);

  const set = (field) => (e) => {
    setForm((p) => ({ ...p, [field]: e.target.value }));
    setErrors((p) => ({ ...p, [field]: '' }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name      = 'Pet name is required.';
    if (!form.speciesId)   e.speciesId = 'Type is required.';
    if (String(form.breedId) === '__other__' && !form.otherBreed.trim()) {
      e.otherBreed = 'Please specify the breed.';
    }
    if (!form.sex)         e.sex       = 'Sex is required.';
    if (form.dateOfBirth && form.dateOfBirth > TODAY) e.dateOfBirth = 'Birthday cannot be in the future.';
    return e;
  };

  const handleSave = async () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setIsSaving(true);
    setApiError('');
    try {
      const capitalizedName = form.name.trim().charAt(0).toUpperCase() + form.name.trim().slice(1);
      const body = {
        name:          capitalizedName,
        species_id:    form.speciesId,
        breed_id:      form.breedId === '__other__'
          ? (breedsList.find((b) => /^others?(?:\s*\(.*\))?$/i.test(String(b?.name || '').trim()))?.id || null)
          : (form.breedId || null),
        sex:           form.sex,
        date_of_birth: form.dateOfBirth || null,
        medical_notes: form.breedId === '__other__' && form.otherBreed.trim()
          ? `Other Breed: ${form.otherBreed.trim()}`
          : null,
      };

      const offline = typeof window !== 'undefined' && navigator.onLine === false;
      if (offline) {
        const nowIso = new Date().toISOString();
        if (isEdit) {
          await db.execute(
           `UPDATE pets
             SET name = ?, species_id = ?, breed_id = ?, sex = ?, date_of_birth = ?, medical_notes = ?, updated_at = ?
             WHERE id = ?`,
            [
              body.name,
              body.species_id,
              body.breed_id,
              body.sex,
              body.date_of_birth,
              body.medical_notes,
              nowIso,
              editPet.id,
            ]
          );
          onSaved?.({ ...(editPet || {}), ...body, id: editPet.id, updated_at: nowIso, photo_url: photoPreview || editPet?.photo_url || null });
          setSuccessMsg(`Wags & Purrs!\n${body.name} is officially part of the family! Their profile is ready for some PawsitiveCare.`);
          setTimeout(() => onClose(), 1100);
          return;
        }

        const ownerId = getCurrentOwnerId();
        if (!ownerId) {
          throw new Error('Offline pet creation needs owner session data. Please reconnect and try again.');
        }
        const newId = globalThis.crypto?.randomUUID?.() || `pet_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await db.execute(
          `INSERT INTO pets (
            id, owner_id, species_id, breed_id, pet_id, name, sex, date_of_birth,
            medical_notes, photo_url, identification_hash, identification_image_url, is_active, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newId,
            ownerId,
            body.species_id,
            body.breed_id,
            `OFF-${String(Date.now()).slice(-6)}`,
            body.name,
            body.sex,
            body.date_of_birth,
            body.medical_notes,
            photoPreview || null,
            null,
            null,
            1,
            nowIso,
            nowIso,
          ]
        );
        onSaved?.({ id: newId, owner_id: ownerId, ...body, photo_url: photoPreview || null, is_active: 1, created_at: nowIso, updated_at: nowIso });
        setSuccessMsg(`Wags & Purrs!\n${body.name} is officially part of the family! Their profile is ready for some PawsitiveCare.`);
        setTimeout(() => onClose(), 1100);
        return;
      }

      let res;
      if (isEdit) {
        res = await apiFetch(`/api/my-pets/${editPet.id}`, {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(body),
        });
      } else {
        res = await apiFetch('/api/my-pets', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(body),
        });
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.errors
          ? Object.values(data.errors).flat().join(' ')
          : data?.message || (isEdit ? 'Failed to update pet.' : 'Failed to register pet.');
        throw new Error(msg);
      }

      let petData = data.data ?? null;

      if (photoFile && petData?.id) {
        const fd = new FormData();
        fd.append('photo', photoFile, photoFile.name || 'pet-photo.jpg');
        const photoRes  = await apiFetch(`/api/my-pets/${petData.id}/photo`, { method: 'POST', body: fd });
        const photoData = await photoRes.json().catch(() => ({}));
        if (!photoRes.ok) {
          const message = photoData?.errors
            ? Object.values(photoData.errors).flat().join(' ')
            : photoData?.message;
          throw new Error(message || 'The pet was saved, but its profile photo could not be uploaded. Please try again.');
        }
        if (!photoData?.data?.photo_url) {
          throw new Error('The pet was saved, but the server did not return its profile photo. Please try again.');
        }
        petData = { ...petData, photo_url: photoData.data.photo_url };
      }

      onSaved?.(petData);
      const savedPetName = petData?.name || body.name || 'Your pet';
      setSuccessMsg(`Wags & Purrs!\n${savedPetName} is officially part of the family! Their profile is ready for some PawsitiveCare.`);
      setTimeout(() => onClose(), 1100);
    } catch (err) {
      setApiError(err.message || 'An error occurred.');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCropSrc(ev.target.result);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  if (!isOpen) return null;

  const breedOptions = [
    { value: '', label: 'Select breed' },
    ...[...breedsList]
      .filter((b) => {
        const name = String(b?.name || '').trim();
        return Boolean(name) && !/^\d+$/.test(name) && !/^others?(?:\s*\(.*\))?$/i.test(name);
      })
      .sort((a, b) => String(a?.name || '').localeCompare(String(b?.name || '')))
      .map((b) => ({ value: b.id, label: b.name })),
    { value: '__other__', label: 'Others' },
  ];

  return createPortal(
    <>
      {cropSrc && (
        <ImageCropModal
          imageSrc={cropSrc}
          onDone={(file, preview) => { setPhotoFile(file); setPhotoPreview(preview); setCropSrc(null); notifySuccess('Photo ready. Save the pet profile to upload it.', 2400); }}
          onCancel={() => setCropSrc(null)}
        />
      )}
      <div className="fixed inset-0 z-[260] flex h-[100dvh] min-h-[100dvh] w-screen items-center justify-center p-4 overscroll-none">
        <button type="button" onClick={onClose} className="absolute inset-0 backdrop-blur-sm bg-brand-dark/40" />

        <div className="relative z-10 flex flex-col w-full md:max-w-2xl rounded-2xl overflow-hidden shadow-2xl bg-brand-surface border-0">
        <div className="flex items-center justify-between bg-brand-teal px-5 py-3">
          <h2 className="text-base font-bold text-white">
            {isEdit ? `Edit ${editPet?.name || 'Pet'}` : 'Register New Pet'}
          </h2>
          <button type="button" onClick={onClose} disabled={isSaving}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors disabled:opacity-60">
            <i className="fa-solid fa-xmark text-lg" />
          </button>
        </div>
        <div className="h-1 bg-white" />

          <div className="flex max-h-[80vh] md:max-h-[75vh] overflow-y-auto scrollbar-teal overscroll-contain">

            <div className="flex-1 px-4 md:px-6 py-5">
              {apiError && (
                <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{apiError}</div>
              )}
              {successMsg && (
                <div className="mb-4 flex items-center gap-2 rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-sm font-medium text-green-700">
                  <i className="fa-solid fa-paw text-green-600" />
                  <span className="whitespace-pre-line">{successMsg}</span>
                </div>
              )}

              <div className="mb-4">
                <label className="text-xs font-bold uppercase tracking-wider text-brand-dark">Pet Name <span className="text-red-500">*</span></label>
                <input value={form.name} onChange={set('name')} placeholder="Enter pet name" className={inputCls(errors.name)} />
                {errors.name && <p className="mt-0.5 text-[10px] text-red-500">{errors.name}</p>}
              </div>

              <div className="mb-4 grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-brand-dark">Type <span className="text-red-500">*</span></label>
                  {isEdit ? (
                    <div className="mt-1 flex items-center gap-2 rounded-xl border border-brand-dark-light bg-gray-50 px-3 py-2 text-sm text-brand-dark">
                      <i className="fa-solid fa-lock text-[10px] text-brand-dark-soft shrink-0" />
                      <span>{speciesList.find((s) => String(s.id) === String(form.speciesId))?.name || editPet?.speciesType?.name || editPet?.species_type?.name || '—'}</span>
                    </div>
                  ) : (
                    <>
                      <SelectDropdown
                        value={form.speciesId}
                        onChange={(v) => { set('speciesId')({ target: { value: v } }); setForm((p) => ({ ...p, breedId: '', otherBreed: '' })); }}
                        options={[{ value: '', label: 'Select type' }, ...speciesList.map((s) => ({ value: s.id, label: s.name }))]}
                        placeholder="Select type"
                        hasError={!!errors.speciesId}
                        className="mt-1"
                      />
                      {errors.speciesId && <p className="mt-0.5 text-[10px] text-red-500">{errors.speciesId}</p>}
                    </>
                  )}
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-brand-dark">Breed</label>
                  {isEdit ? (
                    <div className="mt-1 flex items-center gap-2 rounded-xl border border-brand-dark-light bg-gray-50 px-3 py-2 text-sm text-brand-dark">
                      <i className="fa-solid fa-lock text-[10px] text-brand-dark-soft shrink-0" />
                      <span>{breedsList.find((b) => String(b.id) === String(form.breedId))?.name || editPet?.breed?.name || '—'}</span>
                    </div>
                  ) : (
                    <>
                      <SelectDropdown
                        value={form.breedId}
                        onChange={(v) => set('breedId')({ target: { value: v } })}
                        options={breedOptions}
                        placeholder="Select breed"
                        disabled={!form.speciesId}
                        hasError={!!errors.breedId}
                        className="mt-1"
                        searchable
                        searchPlaceholder="Search breed..."
                        groupByFirstLetter
                      />
                      {errors.breedId && <p className="mt-0.5 text-[10px] text-red-500">{errors.breedId}</p>}
                      {form.breedId === '__other__' && (
                        <>
                          <input
                            value={form.otherBreed}
                            onChange={set('otherBreed')}
                            placeholder="Please specify breed"
                            className={inputCls(errors.otherBreed)}
                          />
                          {errors.otherBreed && <p className="mt-0.5 text-[10px] text-red-500">{errors.otherBreed}</p>}
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
              {isEdit && (
                <p className="mb-3 -mt-2 text-[11px] text-brand-dark-soft">
                  <i className="fa-solid fa-circle-info mr-1" />
                  To change your pet's type or breed, please contact the shop.
                </p>
              )}

              <div className="mb-4 grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-brand-dark">Date of Birth</label>
                  <input type="date" value={form.dateOfBirth} onChange={set('dateOfBirth')} max={TODAY}
                    className={inputCls(errors.dateOfBirth)} />
                  {errors.dateOfBirth && <p className="mt-0.5 text-[10px] text-red-500">{errors.dateOfBirth}</p>}
                </div>
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-brand-dark">Sex <span className="text-red-500">*</span></label>
                  <SelectDropdown
                    value={form.sex}
                    onChange={(v) => set('sex')({ target: { value: v } })}
                    options={[{ value: '', label: 'Select sex' }, { value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]}
                    placeholder="Select sex"
                    hasError={!!errors.sex}
                    className="mt-1"
                  />
                  {errors.sex && <p className="mt-0.5 text-[10px] text-red-500">{errors.sex}</p>}
                </div>
              </div>

              <div className="mb-4">
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-brand-dark">Profile Photo</p>
                <label className="inline-flex cursor-pointer items-center gap-3 rounded-xl border border-brand-dark-light bg-white p-2 transition-colors hover:border-brand-teal/45">
                  <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-dashed border-brand-dark-light bg-brand-surface">
                    {photoPreview
                      ? <img src={photoPreview} alt="Pet preview" className="h-full w-full object-cover" />
                      : <i className="fa-solid fa-camera text-xl text-brand-dark-soft" />}
                  </div>
                  <div className="min-w-0 pr-2">
                    <p className="text-sm font-bold text-brand-dark">{photoPreview ? 'Change Photo' : 'Add Profile Photo'}</p>
                    <p className="mt-0.5 text-[11px] text-brand-dark-soft">JPG, PNG, or WEBP</p>
                  </div>
                  <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                </label>
              </div>

              <div className="rounded-xl border border-brand-teal/25 bg-white px-4 py-3 flex items-start gap-2">
                <i className="fa-solid fa-paw text-brand-teal text-sm mt-0.5 shrink-0" />
                <p className="text-xs text-brand-dark leading-relaxed">
                  Register your <strong>dog's nose print</strong> or <strong>cat's facial geometry</strong> at <strong>The Fur Club Pet Station</strong> for secure pet identification.
                </p>
              </div>
            </div>

          </div>

          <div className="border-t border-brand-dark-light px-5 py-4 flex justify-end">
            <button type="button" onClick={handleSave} disabled={isSaving}
              className="rounded-full bg-brand-teal px-6 py-3 text-sm font-bold text-white hover:brightness-95 transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
              {isSaving ? 'Saving...' : isEdit ? 'Update Pet' : 'Save Pet'}
            </button>
          </div>
        </div>
      </div>
    </>
  , document.body);
}
