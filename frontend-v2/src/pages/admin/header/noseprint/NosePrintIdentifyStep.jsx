import React from 'react';

export default function NosePrintIdentifyStep({
  fallbackQuery,
  setFallbackQuery,
  fallbackSearching,
  fallbackError,
  fallbackResults,
  onSelectPet,
}) {
  return (
    <div className="border-t border-brand-dark-light pt-3 space-y-2">
      <p className="text-center text-[10px] font-bold uppercase tracking-widest text-brand-dark-soft">
        Or search manually
      </p>
      <div className="relative">
        <input
          type="text"
          value={fallbackQuery}
          onChange={(e) => setFallbackQuery(e.target.value)}
          placeholder="Pet ID, name, owner name or phone..."
          className="w-full rounded-xl border border-brand-teal bg-white px-3 py-3 text-base font-semibold text-brand-dark placeholder:text-brand-dark-soft/40 focus:border-brand-teal focus:outline-none focus:ring-2 focus:ring-brand-teal/20 pr-20"
        />
        {fallbackSearching && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-brand-dark-soft animate-pulse">
            Searching...
          </span>
        )}
      </div>
      {fallbackError && (
        <p className="text-xs font-semibold text-rose-500 px-1">{fallbackError}</p>
      )}
      {fallbackResults.length > 0 && (
        <div className="max-h-[160px] overflow-y-auto rounded-xl border border-brand-dark-light bg-white no-scrollbar">
          {fallbackResults.map((pet) => (
            <button
              key={pet.id}
              type="button"
              onClick={() => onSelectPet(pet)}
              className="flex w-full items-center gap-2.5 border-b border-brand-dark-light px-3 py-2 text-left last:border-b-0 hover:bg-brand-teal-soft/30 transition-colors"
            >
              <div className="h-7 w-7 shrink-0 overflow-hidden rounded-full border border-brand-dark-light bg-brand-teal-soft/30">
                {pet?.photo_url ? (
                  <img src={pet.photo_url} alt={pet.name} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <span className="text-[8px] font-bold text-brand-teal-dark">
                      {String(pet.name || '?').slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-bold text-brand-dark">{pet.name}</p>
                <p className="truncate text-[10px] text-brand-dark-soft">
                  {pet.pet_id}
                  {pet?.species_type?.name ? ` · ${pet.species_type.name}` : ''}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
