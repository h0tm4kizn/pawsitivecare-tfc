import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import useBodyScrollLock from '../../../../hooks/useBodyScrollLock';
import { petInitials } from './mobileDashboardHelpers';

export default function ScannerModal({ isOpen, onClose, pets, petsLoading }) {
  useBodyScrollLock(isOpen);
  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex h-[100dvh] min-h-[100dvh] w-screen items-center justify-center bg-brand-dark/45 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl bg-white shadow-2xl overflow-hidden font-poppins"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between bg-brand-teal px-5 py-3.5">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-paw text-white text-sm" />
            <h3 className="text-sm font-extrabold text-white uppercase tracking-widest">
              Pet Identification
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors"
          >
            <X size={15} strokeWidth={2.5} />
          </button>
        </div>
        <div className="h-1 bg-white" />

        {petsLoading ? (
          <div className="px-4 py-8 text-center text-xs text-brand-dark-soft animate-pulse">
            Pawsing for a happy moment...
          </div>
        ) : pets.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <i className="fa-solid fa-paw text-brand-dark/20 text-2xl mb-2 block" />
            <p className="text-xs text-brand-dark-soft">No pets registered yet.</p>
          </div>
        ) : (
          <div className="max-h-[360px] overflow-y-auto scrollbar-teal">
            {pets.map((pet) => {
              const isCat = String(
                pet?.species_type?.name || pet?.speciesType?.name || '',
              )
                .toLowerCase()
                .includes('cat');
              const bg = isCat ? 'bg-brand-orange' : 'bg-brand-teal';
              const hasNosePrint = Boolean(
                pet.recognition_registered ||
                  pet.identification_hash ||
                  pet.nose_print_hash,
              );
              return (
                <div
                  key={pet.id}
                  className="flex items-center gap-3 px-4 py-3 border-b border-brand-dark-light last:border-b-0"
                >
                  <div className="w-10 h-10 shrink-0 rounded-full overflow-hidden border border-white shadow">
                    {pet.photo_url ? (
                      <img
                        src={pet.photo_url}
                        alt={pet.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className={`w-full h-full ${bg} flex items-center justify-center`}>
                        <span className="text-[10px] font-bold text-white">
                          {petInitials(pet.name)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-brand-dark truncate">
                      {pet.name}
                    </p>
                    <p className="text-[11px] text-brand-dark-soft">
                      {pet.species_type?.name || pet.speciesType?.name || '•'}
                    </p>
                  </div>
                  {hasNosePrint ? (
                    <span className="flex items-center gap-1 rounded-full bg-green-500/15 border border-green-500/30 px-2.5 py-1 text-[10px] font-bold text-green-600 shrink-0">
                      <i className="fa-solid fa-check text-[9px]" />
                      Enrolled
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 rounded-full bg-brand-surface border border-brand-dark-light px-2.5 py-1 text-[10px] font-bold text-brand-dark-soft shrink-0">
                      <i className="fa-solid fa-xmark text-[9px]" />
                      Not Enrolled
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
