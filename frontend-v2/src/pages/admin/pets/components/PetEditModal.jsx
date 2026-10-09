import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { apiFetch } from '../../../../api/apiClient';
import { normalizePet, speciesColor, speciesInitial, titleCasePetName, TODAY } from '../petUtils';
import ImageCropModal from '../../../../components/modals/ImageCropModal';
import { notifySuccess } from '../../../../utils/notify';
import { normalizeBreedName } from '../../../../utils/textUtils';
import SelectDropdown from '../../../../components/reusable-ui/SelectDropdown';
import useBodyScrollLock from '../../../../hooks/useBodyScrollLock';

export default function PetEditModal({ pet, speciesList, onClose, onSaved }) {
  useBodyScrollLock(!!pet);
  const [breeds, setBreeds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(pet?.photo_url || '');
  const [cropSrc, setCropSrc] = useState(null);
  const [form, setForm] = useState({
    name: pet?.name || '',
    species_id: pet?.species_id || pet?.species_type?.id || '',
    breed_id: pet?.breed_id || pet?.breed?.id || '',
    sex: pet?.sex || '',
    date_of_birth: pet?.date_of_birth || '',
    medical_notes: pet?.medical_notes || '',
  });

  useEffect(() => {
    setForm({
      name: pet?.name || '',
      species_id: pet?.species_id || pet?.species_type?.id || '',
      breed_id: pet?.breed_id || pet?.breed?.id || '',
      sex: pet?.sex || '',
      date_of_birth: pet?.date_of_birth || '',
      medical_notes: pet?.medical_notes || '',
    });
    setPhotoFile(null);
    setPhotoPreview(pet?.photo_url || '');
    setError('');
  }, [pet]);

  useEffect(() => {
    let cancelled = false;
    const loadBreeds = async () => {
      if (!form.species_id) { setBreeds([]); return; }
      try {
        const response = await apiFetch(`/api/breeds/options?species_id=${form.species_id}`);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error('Failed to load breeds.');
        if (!cancelled) {
          const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
          setBreeds(list);
        }
      } catch {
        if (!cancelled) setBreeds([]);
      }
    };
    loadBreeds();
    return () => { cancelled = true; };
  }, [form.species_id]);

  if (!pet) return null;

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (error) setError('');
  };

  const selectedSpecies = speciesList.find((s) => String(s.id) === String(form.species_id));
  const selectedBreed = breeds.find((b) => String(b.id) === String(form.breed_id));
  const petSpeciesName = selectedSpecies?.name || pet?.species_type?.name || '';
  const petBreedName = normalizeBreedName(selectedBreed?.name || pet?.breed?.name || '');
  const summaryRows = [
    ['Pet Name', form.name.trim() || 'Not set'],
    ['Type', petSpeciesName || 'Not set'],
    ['Breed', petBreedName || 'Not set'],
    ['Sex', form.sex ? form.sex.charAt(0).toUpperCase() + form.sex.slice(1) : 'Not set'],
    ['Birthday', form.date_of_birth || 'Not set'],
  ];

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => setCropSrc(e.target?.result || '');
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) { setError('Pet name is required.'); return; }
    if (!form.species_id || !form.sex) { setError('Type and sex are required.'); return; }

    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name.trim(),
        species_id: form.species_id,
        breed_id: form.breed_id || null,
        sex: form.sex,
        date_of_birth: form.date_of_birth || null,
      };

      const response = await apiFetch(`/api/pets/${pet.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || 'Failed to update pet.');
      const queued = !!data?.queued;
      const updated = queued
        ? normalizePet({ ...(pet || {}), ...payload, updated_at: new Date().toISOString() })
        : normalizePet(data?.data || data);

      if (!queued && photoFile) {
        const formData = new FormData();
        formData.append('photo', photoFile);
        const photoResponse = await apiFetch(`/api/pets/${pet.id}/photo`, { method: 'POST', body: formData });
        const photoData = await photoResponse.json().catch(() => ({}));
        if (!photoResponse.ok) throw new Error(photoData?.message || 'Failed to upload pet photo.');
        updated.photo_url = photoData?.data?.photo_url || photoData?.photo_url || updated.photo_url;
      }

      onSaved(updated);
      notifySuccess(queued ? 'Offline: pet update queued.' : 'Pet updated successfully.', 2000);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update pet.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
    <div className="fixed inset-0 z-[85] flex items-center justify-center p-4 backdrop-blur-sm bg-brand-dark/40 h-[100dvh] min-h-[100dvh] w-screen" onClick={onClose}>
      <div className="flex h-[82vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between bg-brand-teal px-6 py-4">
          <h2 className="text-base font-semibold text-white">Edit Pet</h2>
          <button type="button" onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25">
            <X size={16} strokeWidth={2.8} />
          </button>
        </div>
        <div className="h-1 shrink-0 bg-white" />

        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
            {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

            <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_300px]">
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="min-w-0">
                    <label className="mb-1 block text-xs font-semibold text-brand-dark">Pet Name</label>
                    <input value={form.name} onChange={(e) => setField('name', e.target.value)} className="w-full rounded-xl border border-brand-teal/20 px-3 py-2 text-sm text-brand-dark focus:border-brand-teal focus:outline-none" />
                  </div>
                  <div className="min-w-0">
                    <label className="mb-1 block text-xs font-semibold text-brand-dark">Sex</label>
                    <SelectDropdown
                      value={form.sex}
                      onChange={(v) => setField('sex', v)}
                      options={[{ value: '', label: 'Select sex' }, { value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }]}
                      placeholder="Select sex"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="min-w-0">
                    <label className="mb-1 block text-xs font-semibold text-brand-dark">Type</label>
                    <SelectDropdown
                      value={String(form.species_id)}
                      onChange={(v) => {
                        setForm((prev) => ({ ...prev, species_id: v, breed_id: '' }));
                        if (error) setError('');
                      }}
                      options={[{ value: '', label: 'Select type' }, ...speciesList.map((s) => ({ value: String(s.id), label: s.name }))]}
                      placeholder="Select type"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="mb-1 block text-xs font-semibold text-brand-dark">Breed</label>
                    <SelectDropdown
                      value={String(form.breed_id)}
                      onChange={(v) => setField('breed_id', v)}
                      options={[
                        { value: '', label: 'Select breed' },
                        ...[...breeds]
                          .filter((b) => !String(b?.name || '').toLowerCase().startsWith('other'))
                          .sort((a, b) => String(a.name).localeCompare(String(b.name)))
                          .map((b) => ({ value: String(b.id), label: b.name })),
                      ]}
                      placeholder="Select breed"
                      disabled={!form.species_id}
                      searchable
                      searchPlaceholder="Search breed..."
                      groupByFirstLetter
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-brand-dark">Date of Birth</label>
                    <input type="date" max={TODAY} value={form.date_of_birth || ''} onChange={(e) => setField('date_of_birth', e.target.value)} className="w-full rounded-xl border border-brand-teal/20 px-3 py-2 text-sm text-brand-dark focus:border-brand-teal focus:outline-none" />
                  </div>
                </div>
              </div>

              <aside className="flex border-t border-brand-dark-light pt-5 lg:border-l lg:border-t-0 lg:px-5 lg:py-5 lg:overflow-y-auto">
                <div className="flex h-full w-full flex-col gap-4 pb-10">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-dark-soft">Preview</p>
                  <div className="flex flex-col items-center gap-3 text-center">
                    <div className={`flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full text-xl font-semibold text-white ${speciesColor(petSpeciesName)}`}>
                    {photoPreview
                      ? <img src={photoPreview} alt={pet?.name || 'Pet'} className="h-full w-full object-cover" />
                      : speciesInitial(petSpeciesName)}
                    </div>
                    <div className="min-w-0 max-w-full">
                      <p className="break-words text-base font-semibold text-brand-dark">{titleCasePetName(form.name.trim() || 'Pet')}</p>
                      <p className="text-xs text-brand-dark-soft">{petSpeciesName || 'Pet profile preview'}</p>
                    </div>
                    <label className="inline-flex cursor-pointer items-center rounded-xl bg-brand-teal px-4 py-2 text-xs font-semibold text-white hover:bg-brand-teal-dark">
                      {photoFile ? 'Change Photo' : 'Upload Pet Photo'}
                      <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                    </label>
                    <p className="max-w-[220px] truncate text-[11px] text-brand-dark-soft">
                      {photoFile?.name || (photoPreview ? 'Current pet photo' : 'No pet photo uploaded yet')}
                    </p>
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

          <div className="flex shrink-0 items-center justify-end gap-3 border-t border-brand-dark-light px-6 py-4">
            <button type="button" onClick={onClose} className="rounded-xl border border-brand-dark-light px-5 py-2.5 text-sm font-medium text-brand-dark-soft hover:bg-brand-dark-light transition-colors">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-xl bg-brand-teal px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-teal-dark disabled:opacity-60">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
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
