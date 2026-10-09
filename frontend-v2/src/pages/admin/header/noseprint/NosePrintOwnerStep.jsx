import React, { useRef, useEffect } from 'react';
import { ownerName } from './noseprintUtils';

export default function NosePrintOwnerStep({
  ownerQuery,
  setOwnerQuery,
  setSelectedOwner,
  setSelectedPet,
  ownerPool,
  ownerResults,
  setOwnerResults,
  ownerSearching,
  showOwnerDropdown,
  setShowOwnerDropdown,
  ownerSearchError,
  selectedOwner,
  ownerPets,
  onSelectOwner,
  onNext,
}) {
  const ownerBoxRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ownerBoxRef.current && !ownerBoxRef.current.contains(e.target)) {
        setShowOwnerDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [setShowOwnerDropdown]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-brand-dark-light p-4">
        <label className="mb-2 block text-sm font-bold text-brand-dark">
          Search Owner
        </label>
          <div className="relative" ref={ownerBoxRef}>
            <input
              type="text"
              value={ownerQuery}
              onChange={(e) => {
                setOwnerQuery(e.target.value);
                setSelectedOwner(null);
                setSelectedPet(null);
              }}
              onFocus={() => {
                if (ownerPool.length > 0) {
                  setOwnerResults(ownerPool.slice(0, 20));
                  setShowOwnerDropdown(true);
                }
              }}
              placeholder="Search by name, email, or phone..."
              className="w-full rounded-xl border border-brand-dark-light px-3 py-2.5 text-sm text-brand-dark focus:border-brand-teal focus:outline-none pr-20"
            />
            {ownerSearching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-brand-teal animate-pulse">
                Searching...
              </span>
            )}
            {showOwnerDropdown && (ownerSearching || ownerQuery.trim().length > 0) && (
              <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-brand-dark-light bg-white shadow-lg">
                {ownerQuery.trim().length === 0 && ownerResults.length > 0 && (
                  <li className="px-3 py-2 text-xs font-medium text-brand-dark-soft">Recent customers</li>
                )}
                {ownerSearching && ownerResults.length === 0 && (
                  <li className="px-3 py-2 text-[11px] font-medium text-brand-teal animate-pulse">Searching...</li>
                )}
                {!ownerSearching && ownerQuery.trim().length >= 2 && ownerResults.length === 0 && (
                  <li className="px-3 py-2.5 text-xs font-medium text-brand-dark-soft">No customers found</li>
                )}
                {ownerResults.map((o) => (
                  <li key={o.id}>
                    <button
                      type="button"
                      onClick={() => onSelectOwner(o)}
                      className="w-full px-3 py-2.5 text-left transition hover:bg-brand-teal-soft/30"
                    >
                      <p className="text-sm font-semibold text-brand-dark">{ownerName(o)}</p>
                      <p className="text-[11px] text-brand-dark-soft">
                        {o.email || ''}
                        {o.phone ? ` | ${o.phone}` : ''}
                      </p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        {!selectedOwner && ownerSearchError && (
          <p className="mt-2 text-xs font-semibold text-rose-500">{ownerSearchError}</p>
        )}

        {selectedOwner && (
          <div className="mt-3 rounded-xl border border-brand-dark-light bg-[#f8fafc] p-3">
            <p className="text-sm font-bold text-brand-dark">{ownerName(selectedOwner)}</p>
            <div className="mt-1 space-y-0.5">
              {selectedOwner.email && (
                <p className="flex items-center gap-2 text-xs text-brand-dark-soft">
                  <i className="fa-solid fa-envelope text-[10px] text-brand-teal" />
                  {selectedOwner.email}
                </p>
              )}
              {(selectedOwner.phone || selectedOwner.contact_number) && (
                <p className="flex items-center gap-2 text-xs text-brand-dark-soft">
                  <i className="fa-solid fa-phone text-[10px] text-brand-teal" />
                  {selectedOwner.phone || selectedOwner.contact_number}
                </p>
              )}
              <p className="mt-1 text-[11px] text-brand-dark-soft">
                {ownerPets.length} pet{ownerPets.length !== 1 ? 's' : ''} registered
              </p>
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        disabled={!selectedOwner}
        onClick={onNext}
        className="w-full rounded-xl bg-brand-teal py-2.5 text-sm font-bold text-white disabled:opacity-40"
      >
        Next — Select Pet
      </button>
    </div>
  );
}
