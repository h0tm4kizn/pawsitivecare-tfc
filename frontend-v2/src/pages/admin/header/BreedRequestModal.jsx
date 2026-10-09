import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, PawPrint, Check } from 'lucide-react';
import { apiFetch, apiGet } from '../../../api/apiClient';
import SelectDropdown from '../../../components/reusable-ui/SelectDropdown';

export default function BreedRequestModal({ notification, onClose }) {
  const meta    = notification?.raw?.metadata || {};
  const subject = notification?.raw?.subject  || 'Breed Request';

  const [speciesList,    setSpeciesList]    = useState([]);
  const [existingBreeds, setExistingBreeds] = useState([]);
  const [speciesId,      setSpeciesId]      = useState(meta.species_id || '');
  const [breedName,      setBreedName]      = useState(meta.custom_breed || '');
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState('');
  const [done,           setDone]           = useState(false);

  useEffect(() => {
    apiGet('/api/species')
      .then((r) => r.ok ? r.json() : {})
      .then((d) => setSpeciesList(Array.isArray(d?.data) ? d.data : []))
      .catch(() => {});
  }, []);

  // Load existing breeds whenever species changes so we can check for duplicates
  useEffect(() => {
    if (!speciesId) { setExistingBreeds([]); return; }
    apiGet(`/api/breeds/options?species_id=${speciesId}`)
      .then((r) => r.ok ? r.json() : {})
      .then((d) => setExistingBreeds(Array.isArray(d?.data) ? d.data : []))
      .catch(() => {});
  }, [speciesId]);

  const isDuplicate = () =>
    existingBreeds.some(
      (b) => String(b.name).trim().toLowerCase() === breedName.trim().toLowerCase()
    );

  const handleAdd = async () => {
    if (!breedName.trim()) { setError('Breed name is required.'); return; }
    if (!speciesId)        { setError('Species is required.'); return; }
    if (isDuplicate())     { setError(`"${breedName.trim()}" already exists in the breed list.`); return; }
    setSaving(true);
    setError('');
    try {
      const res = await apiFetch('/api/breeds', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name: breedName.trim(), species_id: speciesId, is_active: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.errors ? Object.values(data.errors).flat().join(' ') : data?.message || 'Failed to add breed.';
        throw new Error(msg);
      }
      setDone(true);
    } catch (err) {
      setError(err.message || 'An error occurred.');
    } finally {
      setSaving(false);
    }
  };

  if (!notification) return null;

  const speciesOptions = [
    { value: '', label: 'Select species' },
    ...speciesList.map((s) => ({ value: String(s.id), label: s.name })),
  ];

  const duplicateWarning = breedName.trim() && speciesId && isDuplicate();

  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 backdrop-blur-sm bg-brand-dark/40 h-[100dvh] min-h-[100dvh] w-screen" onClick={onClose}>
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between bg-brand-teal px-5 py-3.5">
          <div className="flex items-center gap-2">
            <PawPrint size={15} className="text-white/80" />
            <h2 className="text-sm font-bold text-white">{subject}</h2>
          </div>
          <button type="button" onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25">
            <X size={14} />
          </button>
        </div>
        <div className="h-1 bg-white" />

        <div className="px-5 py-5 space-y-4">
          {/* Request info */}
          <div className="rounded-xl border border-brand-dark-light bg-[#f6f8fa] px-4 py-3 space-y-1.5">
            {meta.pet_name && (
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-brand-dark-soft">Pet</span>
                <span className="font-bold text-brand-dark">{meta.pet_name}</span>
              </div>
            )}
            {meta.owner_name && (
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-brand-dark-soft">Owner</span>
                <span className="font-bold text-brand-dark">{meta.owner_name}</span>
              </div>
            )}
            {meta.species_name && (
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-brand-dark-soft">Species</span>
                <span className="font-bold text-brand-dark">{meta.species_name}</span>
              </div>
            )}
            <div className="flex justify-between text-xs">
              <span className="font-semibold text-brand-dark-soft">Requested Breed</span>
              <span className="font-bold text-brand-teal-dark">{meta.custom_breed || '—'}</span>
            </div>
          </div>

          {done ? (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-5 text-center">
              <Check size={22} className="text-emerald-600" />
              <p className="text-sm font-bold text-emerald-700">Breed added successfully!</p>
              <p className="text-xs text-brand-dark-soft">
                <span className="font-semibold">{breedName}</span> is now available in the breed list.
              </p>
            </div>
          ) : (
            <>
              {/* Add breed form */}
              <div className="space-y-3">
                <p className="text-xs font-bold text-brand-dark">Add to Breed List</p>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-brand-dark-soft">SPECIES</label>
                  <SelectDropdown
                    value={String(speciesId)}
                    onChange={(v) => { setSpeciesId(v); if (error) setError(''); }}
                    options={speciesOptions}
                    placeholder="Select species"
                    variant="light"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-brand-dark-soft">BREED NAME</label>
                  <input
                    type="text"
                    value={breedName}
                    onChange={(e) => { setBreedName(e.target.value); if (error) setError(''); }}
                    placeholder="Enter breed name"
                    className={`w-full rounded-xl border px-3 py-2 text-sm text-brand-dark focus:outline-none ${
                      duplicateWarning ? 'border-amber-400 focus:border-amber-400' : 'border-brand-dark-light focus:border-brand-teal'
                    }`}
                  />
                  {duplicateWarning && (
                    <p className="mt-1 text-xs text-amber-600 font-medium">
                      This breed already exists in the list.
                    </p>
                  )}
                </div>

                {error && (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>
                )}
              </div>

              <div className="flex gap-2">
                <button type="button" onClick={handleAdd} disabled={saving || !!duplicateWarning}
                  className="flex-1 inline-flex items-center justify-center rounded-xl bg-brand-teal py-2 text-sm font-bold text-white hover:bg-brand-teal-dark disabled:opacity-60 transition-colors">
                  {saving ? 'Adding...' : 'Add Breed'}
                </button>
              </div>
            </>
          )}

          {done && (
            <button type="button" onClick={onClose}
              className="w-full rounded-xl border border-brand-dark-light py-2 text-sm font-medium text-brand-dark-soft hover:bg-brand-dark-light transition-colors">
              Close
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
