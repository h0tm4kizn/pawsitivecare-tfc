import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import useBodyScrollLock from '../../../../hooks/useBodyScrollLock';
import AddPetModal from '../AddPetModal';
import { formatBreedName } from '../../../../utils/textUtils';
import {
  calcAge,
  calcBirthdayCountdown,
  fmtBirthday,
  fmtDate,
  petBg,
  petInitials,
} from './mobileDashboardHelpers';

function BirthdayBanner({ pet }) {
  if (!pet?.date_of_birth) return null;
  const days = calcBirthdayCountdown(pet.date_of_birth);
  if (days === null) return null;

  const isToday = days === 0;
  const isSoon = days <= 7;

  const bg = isToday ? 'bg-brand-orange' : isSoon ? 'bg-amber-50' : 'bg-brand-surface';
  const text = isToday ? 'text-white' : isSoon ? 'text-amber-700' : 'text-brand-dark';
  const sub = isToday ? 'text-white/80' : isSoon ? 'text-amber-500' : 'text-brand-dark-soft';
  const numClass = isToday ? 'text-white' : isSoon ? 'text-amber-600' : 'text-brand-dark';
  const icon = isToday ? 'fa-cake-candles' : 'fa-gift';
  const iconClass = isToday ? 'text-white/90' : isSoon ? 'text-amber-500' : 'text-brand-dark-soft';

  return (
    <div className={`mx-4 mt-4 rounded-2xl overflow-hidden ${bg}`}>
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div className="shrink-0 flex flex-col items-center justify-center w-12 h-12 rounded-xl bg-white/20">
          {isToday ? (
            <i className={`fa-solid ${icon} text-xl ${iconClass}`} />
          ) : (
            <>
              <span className={`text-xl font-extrabold leading-none ${numClass}`}>{days}</span>
              <span className={`text-[9px] font-bold uppercase tracking-wider ${sub}`}>days</span>
            </>
          )}
        </div>
        <div className="min-w-0">
          <p className={`text-[10px] font-bold uppercase tracking-widest ${sub}`}>Birthday</p>
          {isToday ? (
            <p className={`text-sm font-extrabold ${text}`}>Happy Birthday, {pet.name}! 🎂</p>
          ) : isSoon ? (
            <p className={`text-sm font-extrabold ${text}`}>
              {days === 1 ? 'Birthday tomorrow!' : `Only ${days} days away!`}
            </p>
          ) : (
            <p className={`text-sm font-extrabold ${text}`}>{pet.name}'s Birthday</p>
          )}
          <p className={`text-xs mt-0.5 ${sub}`}>{fmtBirthday(pet.date_of_birth)}</p>
        </div>
      </div>
    </div>
  );
}

export default function PetProfileModal({ pet, onClose, onPetAdded }) {
  useBodyScrollLock(Boolean(pet));
  const [showEdit, setShowEdit] = useState(false);

  if (!pet) return null;

  const bg = petBg(pet);
  const isCat = String(pet?.species_type?.name || pet?.speciesType?.name || '')
    .toLowerCase()
    .includes('cat');
  const cardBg = isCat ? 'bg-orange-50/70' : 'bg-brand-teal-light/30';
  const cardBorder = isCat ? 'border-brand-orange/25' : 'border-brand-teal/20';
  const photoBorder = isCat ? 'border-brand-orange/35' : 'border-brand-teal/30';
  const codeColor = isCat ? 'text-brand-orange' : 'text-brand-teal';
  const speciesColor = isCat ? 'text-brand-orange/60' : 'text-brand-teal-dark/70';

  const rows = [
    { label: 'Species', value: pet.species_type?.name || pet.speciesType?.name || '•' },
    { label: 'Breed', value: formatBreedName(pet.breed?.name) || '•' },
    { label: 'Sex', value: pet.sex ? pet.sex.charAt(0).toUpperCase() + pet.sex.slice(1) : '•' },
    { label: 'Date of Birth', value: fmtDate(pet.date_of_birth) || '•' },
    { label: 'Age', value: calcAge(pet.date_of_birth) || '•' },
  ];

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex h-[100dvh] min-h-[100dvh] w-screen items-center justify-center bg-brand-dark/45 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md flex flex-col max-h-[92dvh] rounded-3xl overflow-hidden bg-white shadow-2xl font-poppins"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between bg-brand-teal px-5 py-4 shrink-0">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-paw text-white text-sm" />
            <h2 className="text-sm font-bold text-white uppercase tracking-widest">Pet Profile</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors"
            aria-label="Close"
          >
            <X size={15} strokeWidth={2.5} />
          </button>
        </div>
        <div className="h-1 bg-brand-teal-light shrink-0" />

        <div className="overflow-y-auto scrollbar-teal flex-1">
          <BirthdayBanner pet={pet} />

          <div className={`flex items-center gap-4 mx-4 mt-4 rounded-2xl p-4 border ${cardBg} ${cardBorder}`}>
            <div className={`w-20 h-20 rounded-xl overflow-hidden shrink-0 border-2 shadow-sm ${photoBorder}`}>
              {pet.photo_url ? (
                <img src={pet.photo_url} alt={pet.name} className="w-full h-full object-cover" />
              ) : (
                <div className={`w-full h-full ${bg} flex items-center justify-center`}>
                  <span className="text-xl font-extrabold text-white">{petInitials(pet.name)}</span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bauhaus font-bold text-xl uppercase leading-tight text-brand-dark truncate">{pet.name}</p>
              {pet.pet_id && (
                <p className={`text-[11px] font-semibold uppercase tracking-widest mt-1 ${codeColor}`}>{pet.pet_id}</p>
              )}
              <p className={`text-[10px] mt-1 ${speciesColor}`}>
                {pet.species_type?.name || pet.speciesType?.name || ''}
                {formatBreedName(pet.breed?.name) ? ` • ${formatBreedName(pet.breed.name)}` : ''}
              </p>
            </div>
          </div>

          <div className={`mx-4 mt-4 mb-4 rounded-xl border overflow-hidden ${cardBorder}`}>
            <div className={`flex items-center justify-between px-4 py-2.5 border-b ${cardBorder} ${cardBg}`}>
              <span className={`text-[10px] font-extrabold uppercase tracking-widest ${codeColor}`}>Details</span>
            </div>
            <div className="divide-y divide-brand-dark-light/60">
              {rows.map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between px-4 py-2.5">
                  <span className={`text-xs font-semibold ${codeColor}`}>{label}</span>
                  <span className="text-xs text-brand-dark font-medium text-right">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="shrink-0 border-t border-brand-dark-light px-4 py-4 bg-white">
          <button
            type="button"
            onClick={() => setShowEdit(true)}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand-dark/10 py-3 text-sm font-bold text-brand-dark hover:bg-brand-dark/15 transition-colors"
          >
            <i className="fa-solid fa-pen text-xs" />
            Edit Pet
          </button>
        </div>
      </div>

      <AddPetModal
        isOpen={showEdit}
        onClose={() => setShowEdit(false)}
        onSaved={(petData) => {
          setShowEdit(false);
          onClose();
          onPetAdded?.(petData);
        }}
        editPet={pet}
      />
    </div>,
    document.body,
  );
}
