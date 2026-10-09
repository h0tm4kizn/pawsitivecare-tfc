import { useEffect, useState } from 'react';
import { apiGet } from '../../../api/apiClient';
import { AdminSkeleton } from '../../../components/admin/AdminLoading';
import { Fingerprint } from 'lucide-react';
import HeaderPopoverPanel from '../../admin/header/shared/HeaderPopoverPanel';

const extractPetsFromResponse = (payload) => {
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.data?.pets)) return payload.data.pets;
  if (Array.isArray(payload?.pets)) return payload.pets;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
};

export default function ClientNosePrint() {
  const [isOpen,    setIsOpen]    = useState(false);
  const [pets,      setPets]      = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const load = () => {
    setIsLoading(true);
    apiGet('/api/my-pets')
      .then((r) => r.ok ? r.json() : { data: [] })
      .catch(() => ({ data: [] }))
      .then((d) => setPets(extractPetsFromResponse(d)))
      .finally(() => setIsLoading(false));
  };

  useEffect(() => {
    if (isOpen) {
      load();
    }
  }, [isOpen]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((p) => !p)}
        className="flex h-10 w-10 items-center justify-center text-brand-dark/70 hover:text-brand-teal transition-colors"
        aria-label="Nose Print"
      >
        <Fingerprint size={16} strokeWidth={2.2} />
      </button>

      <HeaderPopoverPanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title="Pet Identification"
        titleIcon="fa-fingerprint"
        widthClass="w-[calc(100vw-2rem)] max-w-[300px]"
      >
            {isLoading ? (
              <AdminSkeleton variant="table" label="Loading pets" rows={3} />
            ) : pets.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <Fingerprint size={28} strokeWidth={1.9} className="mx-auto mb-2 text-brand-dark/20" />
                <p className="text-xs text-brand-dark-soft">No pets registered yet.</p>
              </div>
            ) : (
              <div className="max-h-[320px] overflow-y-auto scrollbar-teal">
                {pets.map((pet) => {
                  const hasNosePrint = !!(pet.recognition_registered || pet.identification_hash || pet.nose_print_hash);
                  const isCat = String(pet?.species_type?.name || pet?.speciesType?.name || '').toLowerCase().includes('cat');
                  const bg = isCat ? 'bg-brand-orange' : 'bg-brand-teal';
                  return (
                    <div key={pet.id}
                      className="flex items-center gap-3 px-4 py-3 border-b border-brand-dark-light last:border-b-0">

                      <div className="w-9 h-9 shrink-0 rounded-full overflow-hidden border border-white shadow">
                        {pet.photo_url ? (
                          <img src={pet.photo_url} alt={pet.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className={`w-full h-full ${bg} flex items-center justify-center`}>
                            <span className="text-[9px] font-bold text-white">
                              {String(pet.name || '?').slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-brand-dark truncate">{pet.name}</p>
                        <p className="text-[10px] text-brand-dark-soft">
                          {pet.species_type?.name || pet.speciesType?.name || '—'}
                        </p>
                      </div>

                      {hasNosePrint ? (
                        <span className="flex items-center gap-1 rounded-full bg-green-500/20 border border-green-500/40 px-2 py-0.5 text-[9px] font-bold text-green-400 shrink-0">
                          <i className="fa-solid fa-check text-[8px]" />
                          Enrolled
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 rounded-full bg-white/10 border border-brand-dark-light px-2 py-0.5 text-[9px] font-bold text-brand-dark-soft shrink-0">
                          <i className="fa-solid fa-xmark text-[8px]" />
                          Not Enrolled
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

      </HeaderPopoverPanel>
    </div>
  );
}
