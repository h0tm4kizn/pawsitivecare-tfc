import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { apiFetch } from '../../../../api/apiClient';
import SelectDropdown from '../../../../components/reusable-ui/SelectDropdown';
import useBodyScrollLock from '../../../../hooks/useBodyScrollLock';

export default function AddBreedModal({ speciesList, onClose, onSaved, editBreed = null }) {
  useBodyScrollLock(true);
  const [speciesId, setSpeciesId] = useState('');
  const [name, setName]           = useState('');
  const [error, setError]         = useState('');
  const [saving, setSaving]       = useState(false);

  useEffect(() => {
    if (editBreed) {
      setSpeciesId(editBreed.species_id ?? editBreed.species_id?.toString?.() ?? '');
      setName(editBreed.name || '');
    } else {
      setSpeciesId('');
      setName('');
    }
    setError('');
  }, [editBreed]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!speciesId) { setError('Please select a species.'); return; }
    if (!name.trim()) { setError('Breed name is required.'); return; }
    setSaving(true);
    try {
      const payload = { species_id: speciesId, name: name.trim() };
      const res = editBreed
        ? await apiFetch(`/api/breeds/${editBreed.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await apiFetch('/api/breeds', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data?.errors ? Object.values(data.errors).flat().join(' ') : data?.message || 'Failed to add breed.';
        setError(msg);
        return;
      }
      onSaved(name.trim(), editBreed ? 'updated' : 'added');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 backdrop-blur-sm bg-brand-dark/40">
      <div className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between bg-brand-teal px-6 py-4">
          <h2 className="text-base font-extrabold text-white">{editBreed ? 'Edit Breed' : 'Add New Breed'}</h2>
          <button type="button" onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25">
            <X size={17} strokeWidth={2.5} />
          </button>
        </div>
        <div className="h-1 shrink-0 bg-white" />

        <form onSubmit={handleSubmit} className="px-6 py-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-brand-dark">Species <span className="text-red-500">*</span></label>
            <SelectDropdown
              value={speciesId}
              onChange={(val) => setSpeciesId(val)}
              placeholder="Select species"
              options={speciesList.map((s) => ({ value: s.id, label: s.name }))}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold text-brand-dark">Breed Name <span className="text-red-500">*</span></label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Shih Tzu" maxLength={50}
              className="w-full rounded-xl border border-brand-teal/30 bg-white px-3 py-2.5 text-sm text-brand-dark focus:border-brand-teal focus:outline-none" />
          </div>

          {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

            <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-xl border border-brand-teal/30 py-2.5 text-sm font-bold text-brand-dark hover:bg-brand-dark/5 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving}
                className="flex-1 rounded-xl bg-brand-teal py-2.5 text-sm font-bold text-white hover:bg-brand-teal-dark disabled:opacity-60 transition-colors">
              {saving ? 'Saving...' : (editBreed ? 'Save Changes' : 'Add Breed')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
