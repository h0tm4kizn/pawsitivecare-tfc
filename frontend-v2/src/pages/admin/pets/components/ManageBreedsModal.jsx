import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Search, Trash2, X, Edit2 } from 'lucide-react';
import { apiFetch } from '../../../../api/apiClient';
import AddBreedModal from './AddBreedModal';
import useBodyScrollLock from '../../../../hooks/useBodyScrollLock';

export default function ManageBreedsModal({ speciesList, onClose, onChanged }) {
  useBodyScrollLock(true);
  const [selectedSpeciesId, setSelectedSpeciesId] = useState(speciesList[0]?.id ?? '');
  const [breeds, setBreeds]         = useState([]);
  const [loadingBreeds, setLoadingBreeds] = useState(false);
  const [search, setSearch]         = useState('');
  const [showAdd, setShowAdd]       = useState(false);
  const [editingBreed, setEditingBreed] = useState(null);

  // Confirm delete state
  const [confirmBreed, setConfirmBreed] = useState(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteError, setDeleteError]   = useState('');
  const [deleting, setDeleting]         = useState(false);

  const loadBreeds = async (speciesId) => {
    if (!speciesId) return;
    setLoadingBreeds(true);
    setBreeds([]);
    try {
      const res  = await apiFetch(`/api/breeds/options?species_id=${speciesId}`);
      const data = await res.json().catch(() => ({}));
      const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      setBreeds(list.sort((a, b) => String(a.name).localeCompare(String(b.name))));
    } catch {
      setBreeds([]);
    } finally {
      setLoadingBreeds(false);
    }
  };

  useEffect(() => {
    loadBreeds(selectedSpeciesId);
    setSearch('');
  }, [selectedSpeciesId]);

  const handleConfirmDelete = async () => {
    if (!deleteReason.trim()) { setDeleteError('Please provide a reason for deletion.'); return; }
    setDeleting(true);
    setDeleteError('');
    try {
      const res = await apiFetch(`/api/breeds/${confirmBreed.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: deleteReason.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setDeleteError(data?.message || 'Failed to delete breed.');
        return;
      }
      const name = confirmBreed.name;
      setConfirmBreed(null);
      setDeleteReason('');
      await loadBreeds(selectedSpeciesId);
      onChanged?.(`Breed "${name}" removed.`);
    } catch {
      setDeleteError('Network error. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const filteredBreeds = breeds.filter((b) =>
    String(b.name).toLowerCase().startsWith(search.trim().toLowerCase())
  );

  return createPortal(
    <>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 backdrop-blur-sm bg-brand-dark/40">
        <div className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl max-h-[90vh]">

          {/* Header */}
          <div className="shrink-0 bg-brand-teal px-6 py-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-white">Manage Breeds</h2>
              <p className="text-[11px] text-white/70 mt-0.5">Add or remove breeds per species</p>
            </div>
            <button type="button" onClick={onClose}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25">
              <X size={17} strokeWidth={2.5} />
            </button>
          </div>

          <div className="flex flex-col gap-4 overflow-y-auto px-6 py-5 no-scrollbar flex-1">

            {/* Species tabs + Add Breed */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 flex-wrap">
                {speciesList.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => { setSelectedSpeciesId(s.id); setDeleteError(''); setConfirmBreed(null); setDeleteReason(''); }}
                    className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                      selectedSpeciesId === s.id
                        ? 'bg-brand-teal text-white'
                        : 'border border-brand-dark-light text-brand-dark-soft hover:bg-brand-dark-light'
                    }`}
                  >
                    {s.name}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowAdd(true)}
                className="shrink-0 flex items-center gap-1.5 rounded-full border border-brand-teal bg-white px-4 py-1.5 text-sm font-semibold text-brand-teal hover:bg-brand-teal hover:text-white transition-colors"
              >
                <Plus size={13} />
                Add Breed
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-dark-soft" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search breeds…"
                className="w-full rounded-xl border border-brand-dark-light pl-8 pr-3 py-2 text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
              />
            </div>

            {/* Breed list */}
            <div className="rounded-xl border border-brand-dark-light overflow-hidden">
              {loadingBreeds ? (
                <p className="px-4 py-6 text-center text-xs text-brand-dark-soft">Loading breeds…</p>
              ) : filteredBreeds.length === 0 ? (
                <p className="px-4 py-6 text-center text-xs text-brand-dark-soft">
                  {search ? 'No breeds match your search.' : 'No breeds registered for this species yet.'}
                </p>
              ) : (
                <ul className="divide-y divide-brand-dark-light max-h-52 overflow-y-auto no-scrollbar">
                  {filteredBreeds.map((breed) => (
                    <li key={breed.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                      <span className="text-sm text-brand-dark truncate">{breed.name}</span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => { setEditingBreed(breed); setShowAdd(true); setDeleteError(''); setConfirmBreed(null); }}
                          className="shrink-0 rounded-lg p-1.5 text-brand-dark-soft hover:bg-brand-dark-light hover:text-brand-teal transition-colors"
                          title="Edit breed"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => { setConfirmBreed(breed); setDeleteReason(''); setDeleteError(''); }}
                          className="shrink-0 rounded-lg p-1.5 text-brand-dark-soft transition-colors hover:bg-brand-dark-light"
                          title="Delete breed"
                        >
                          <Trash2 size={13} className="text-red-500" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Inline delete confirmation */}
            {confirmBreed && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 space-y-2">
                <p className="text-xs font-bold text-red-600">
                  Remove &ldquo;{confirmBreed.name}&rdquo;?
                </p>
                <textarea
                  value={deleteReason}
                  onChange={(e) => { setDeleteReason(e.target.value); setDeleteError(''); }}
                  placeholder="Reason for deletion (required)…"
                  rows={2}
                  className="w-full resize-none rounded-xl border border-red-200 bg-white px-3 py-2 text-xs text-brand-dark focus:border-red-400 focus:outline-none"
                />
                {deleteError && <p className="text-[11px] font-semibold text-red-500">{deleteError}</p>}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setConfirmBreed(null); setDeleteReason(''); setDeleteError(''); }}
                    className="flex-1 rounded-xl border border-brand-dark-light py-1.5 text-xs font-medium text-brand-dark-soft hover:bg-brand-dark-light transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDelete}
                    disabled={deleting}
                    className="flex-1 rounded-xl bg-red-500 py-1.5 text-xs font-bold text-white hover:bg-red-600 disabled:opacity-60 transition-colors"
                  >
                    {deleting ? 'Removing…' : 'Confirm Remove'}
                  </button>
                </div>
              </div>
            )}

          </div>


        </div>
      </div>

      {showAdd && (
        <AddBreedModal
          speciesList={speciesList}
          editBreed={editingBreed}
          onClose={() => { setShowAdd(false); setEditingBreed(null); }}
          onSaved={(name, action) => {
            setShowAdd(false);
            const verb = action === 'updated' ? 'updated' : 'added';
            setEditingBreed(null);
            loadBreeds(selectedSpeciesId);
            onChanged?.(`Breed "${name}" ${verb}.`);
          }}
        />
      )}
    </>,
    document.body
  );
}
