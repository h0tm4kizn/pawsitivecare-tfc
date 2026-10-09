import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import AddPetModal from './AddPetModal';
import PetFamilyTree from '../mypets/PetFamilyTree';
import useBodyScrollLock from '../../../hooks/useBodyScrollLock';
import { formatBreedName } from '../../../utils/textUtils';

const fmtDate = (d) =>
  d
    ? new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString('en-US', { timeZone: 'Asia/Manila',
        month: 'long', day: 'numeric', year: 'numeric',
      })
    : null;

const calcAge = (dob) => {
  if (!dob) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const birth = new Date(String(dob).slice(0, 10) + 'T00:00:00');
  const totalMonths =
    (today.getFullYear() - birth.getFullYear()) * 12 +
    (today.getMonth() - birth.getMonth());
  if (totalMonths < 1)  return 'Under 1 month';
  if (totalMonths < 12) return `${totalMonths} month${totalMonths !== 1 ? 's' : ''}`;
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  return months > 0 ? `${years} yr${years !== 1 ? 's' : ''} ${months} mo` : `${years} yr${years !== 1 ? 's' : ''}`;
};

const petInitials = (name) => String(name || '?').slice(0, 2).toUpperCase();
const petSpeciesTone = (pet) => {
  const species = String(pet?.species_type?.name || pet?.speciesType?.name || '').toLowerCase();
  return species.includes('cat') ? 'text-brand-orange' : 'text-brand-teal';
};
const petSpeciesDot = (pet) => {
  const species = String(pet?.species_type?.name || pet?.speciesType?.name || '').toLowerCase();
  return species.includes('cat') ? 'bg-brand-orange' : 'bg-brand-teal';
};
const petSpeciesBorder = (pet) => {
  const species = String(pet?.species_type?.name || pet?.speciesType?.name || '').toLowerCase();
  return species.includes('cat') ? 'border-brand-orange' : 'border-brand-teal';
};

const manilaTodayParts = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(new Date());
  return Object.fromEntries(parts.filter(({ type }) => type !== 'literal').map(({ type, value }) => [type, Number(value)]));
};

const birthdayParts = (dob) => {
  const match = String(dob || '').slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) } : null;
};

const birthdayDateForYear = (parts, year) => {
  const isLeapDay = parts.month === 2 && parts.day === 29;
  const day = isLeapDay && !((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) ? 28 : parts.day;
  return Date.UTC(year, parts.month - 1, day);
};

const calcBirthdayCountdown = (dob) => {
  const birth = birthdayParts(dob);
  if (!birth) return null;
  const today = manilaTodayParts();
  const todayUtc = Date.UTC(today.year, today.month - 1, today.day);
  let next = birthdayDateForYear(birth, today.year);
  if (next < todayUtc) next = birthdayDateForYear(birth, today.year + 1);
  return Math.round((next - todayUtc) / (1000 * 60 * 60 * 24));
};

const fmtBirthday = (dob) => {
  const birth = birthdayParts(dob);
  if (!birth) return '';
  const today = manilaTodayParts();
  const todayUtc = Date.UTC(today.year, today.month - 1, today.day);
  let next = birthdayDateForYear(birth, today.year);
  if (next < todayUtc) next = birthdayDateForYear(birth, today.year + 1);
  return new Date(next).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric' });
};

function BirthdayCountdown({ pet }) {
  if (!pet?.date_of_birth) return null;
  const days = calcBirthdayCountdown(pet.date_of_birth);
  if (days === null) return null;
  const isToday    = days === 0;
  const isTomorrow = days === 1;
  const isSoon     = days > 1 && days <= 7;
  const title = isToday
    ? `${pet.name}'s birthday is today`
    : isTomorrow
      ? 'Birthday tomorrow'
      : isSoon
        ? `${days} days away`
        : `${pet.name}'s birthday`;

  return (
    <div className="mx-4 mb-3 mt-2 overflow-hidden rounded-xl border border-brand-dark-light bg-white">
      <div className="flex items-stretch">
        <div className="flex w-16 shrink-0 flex-col items-center justify-center border-r border-brand-dark-light bg-brand-surface px-2 py-3">
          {isToday ? (
            <i className={`fa-solid fa-cake-candles text-2xl ${petSpeciesTone(pet)}`} aria-label="Birthday today" />
          ) : (
            <>
              <span className="text-2xl font-extrabold leading-none text-brand-dark">{days}</span>
              <span className="mt-1 text-[9px] font-bold uppercase tracking-wider text-brand-dark-soft">days</span>
            </>
          )}
        </div>
        <div className="min-w-0 flex-1 px-3 py-3">
          <p className="text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">Birthday</p>
          <p className="mt-0.5 truncate text-sm font-extrabold leading-tight text-brand-dark">{title}</p>
          <p className="mt-1 text-xs font-medium text-brand-dark-soft">{fmtBirthday(pet.date_of_birth)}</p>
        </div>
      </div>
    </div>
  );
}


function PetSidebarSkeleton() {
  return (
    <div className="flex flex-1 flex-col" aria-hidden="true">
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center gap-2 py-1 px-1">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-brand-surface" />
          ))}
        </div>
        <div className="mt-3 border-b border-brand-dark-light/70" />
      </div>
      <div className="h-44 animate-pulse bg-brand-surface" />
      <div className="mx-4 mt-4 space-y-3 rounded-xl border border-brand-dark-light p-4">
        <div className="h-3 w-24 animate-pulse rounded-full bg-brand-surface" />
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="flex items-center justify-between gap-4">
            <div className="h-3 w-20 animate-pulse rounded-full bg-brand-surface" />
            <div className="h-3 w-28 animate-pulse rounded-full bg-brand-surface" />
          </div>
        ))}
      </div>
      <div className="mx-4 mt-4 h-24 animate-pulse rounded-xl bg-brand-surface" />
    </div>
  );
}
export default function PetSidebar({ pets = [], loading = false, onPetAdded, onPetSelect, hideBirthdayCountdown = false, onAddPetTrigger = null, onFamilyTreeTrigger = null, className = '' }) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [showAddPet,  setShowAddPet]  = useState(false);
  const [showFamilyTree, setShowFamilyTree] = useState(false);
  const [addPetFromTree, setAddPetFromTree] = useState(false);

  useEffect(() => {
    if (onAddPetTrigger) onAddPetTrigger(() => setShowAddPet(true));
  }, [onAddPetTrigger]);
  useEffect(() => {
    if (onFamilyTreeTrigger) onFamilyTreeTrigger(() => setShowFamilyTree(true));
  }, [onFamilyTreeTrigger]);
  const [editPet,     setEditPet]     = useState(null);
  useBodyScrollLock(showFamilyTree || showAddPet || !!editPet);
  const [scrollLeft,  setScrollLeft]  = useState(0);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollRef = useRef(null);

  const AVATAR_SIZE = 36;
  const AVATAR_GAP  = 8;

  const updateScrollMetrics = () => {
    const el = scrollRef.current;
    setScrollLeft(el ? el.scrollLeft : 0);
    setCanScrollRight(el ? el.scrollWidth > el.clientWidth + el.scrollLeft + 1 : false);
  };

  const handleScroll = () => {
    updateScrollMetrics();
  };

  const scrollBy = (dir) => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollBy({ left: dir * (AVATAR_SIZE + AVATAR_GAP) * 3, behavior: 'smooth' });
  };

  useEffect(() => {
    updateScrollMetrics();
  }, [pets.length]);

  const canScrollLeft = scrollLeft > 0;

  const pet = pets[selectedIdx] || null;

  const selectPet = (idx) => {
    setSelectedIdx(idx);
    onPetSelect?.(pets[idx] ?? null);
  };

  return (
    <>
      <div className={`rounded-2xl bg-white border border-brand-dark-light shadow-sm overflow-hidden flex flex-col ${className}`}>

        {/* ── Avatar switcher ── */}
          <div className="px-4 py-3">

          <div className="relative">
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1 px-1"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              <style>{`div::-webkit-scrollbar { display: none; }`}</style>
              {pets.map((p, idx) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectPet(idx)}
                  className={`w-[36px] h-[36px] rounded-full overflow-hidden border-2 transition-all shrink-0 ${
                    selectedIdx === idx
                      ? `${petSpeciesBorder(p)} ${
                          String(p?.species_type?.name || p?.speciesType?.name || '').toLowerCase().includes('cat')
                            ? 'shadow-[0_0_0_3px_rgba(254,126,77,0.35)] animate-pulse'
                            : 'shadow-[0_0_0_3px_rgba(79,198,201,0.35)] animate-pulse'
                        }`
                      : `border-brand-dark-light hover:${petSpeciesBorder(p)}/50`
                  }`}
                >
                  {p.photo_url ? (
                    <img src={p.photo_url} alt={p.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className={`w-full h-full flex items-center justify-center ${petSpeciesDot(p)}`}>
                      <span className="text-[9px] font-bold text-white">{petInitials(p.name)}</span>
                    </div>
                  )}
                </button>
              ))}
            </div>

            {canScrollLeft && (
              <button type="button" onClick={() => scrollBy(-1)}
                className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 w-5 h-5 flex items-center justify-center rounded-full bg-white shadow border border-gray-200 text-brand-dark-soft hover:text-brand-teal transition-colors">
                <i className="fa-solid fa-chevron-left text-[8px]" />
              </button>
            )}
            {canScrollRight && (
              <button type="button" onClick={() => scrollBy(1)}
                className="absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-5 h-5 flex items-center justify-center rounded-full bg-white shadow border border-gray-200 text-brand-dark-soft hover:text-brand-teal transition-colors">
                <i className="fa-solid fa-chevron-right text-[8px]" />
              </button>
            )}
          </div>
        </div>

        {loading && !pet ? (
          <PetSidebarSkeleton />
        ) : pet ? (
          <div className="overflow-y-auto scrollbar-teal flex-1">
            {/* ── Pet photo with name overlay ── */}
            <div className="relative border-t border-brand-dark-light/70">
              {pet.photo_url ? (
                  <img src={pet.photo_url} alt={pet.name} className="h-44 w-full object-cover" />
                ) : (
                  <div className={`flex h-44 w-full items-center justify-center ${petSpeciesDot(pet)} bg-opacity-10`}>
                    <span className={`text-4xl font-extrabold ${petSpeciesTone(pet)} opacity-30`}>{petInitials(pet.name)}</span>
                  </div>
                )}
              <div className="absolute bottom-0 left-0 w-full bg-gradient-to-t from-black/75 to-transparent px-4 pb-3 pt-8">
                <p className="font-bauhaus text-lg font-bold uppercase leading-tight text-white">{pet.name}</p>
                <p className={`text-[11px] font-semibold uppercase tracking-widest ${petSpeciesTone(pet)} opacity-75`}>
                  {pet.pet_id || '—'}
                </p>
              </div>
              <div className={`absolute bottom-2 right-2 h-3 w-3 rounded-full ${petSpeciesDot(pet)} border-2 border-white shadow`} />
            </div>

            {/* ── Pet Profile table ── */}
            <div className="mx-4 mt-3 overflow-hidden rounded-xl border border-brand-dark-light">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-brand-dark-light">
                <span className={`text-[10px] font-extrabold uppercase tracking-widest ${petSpeciesTone(pet)}`}>Pet Profile</span>
                <button
                  type="button"
                  onClick={() => setEditPet(pet)}
                  className={`flex items-center gap-1 ${petSpeciesTone(pet)} hover:brightness-75 transition-colors`}
                  aria-label="Edit pet"
                >
                  <i className="fa-solid fa-pen text-xs" />
                </button>
              </div>
              <div className="divide-y divide-brand-dark-light">
                {[
                  { label: 'Species',       value: pet.species_type?.name || pet.speciesType?.name || '—' },
                  { label: 'Breed',         value: formatBreedName(pet.breed?.name) || '—' },
                  { label: 'Sex',           value: pet.sex ? pet.sex.charAt(0).toUpperCase() + pet.sex.slice(1) : '—' },
                  { label: 'Date of Birth', value: fmtDate(pet.date_of_birth) || '—' },
                  { label: 'Age',           value: calcAge(pet.date_of_birth) || '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)] items-center gap-3 px-4 py-2">
                    <span className="text-[11px] font-semibold text-brand-dark">{label}:</span>
                    <span className="truncate text-right text-[11px] text-brand-dark-soft" title={String(value)}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Birthday Countdown ── */}
            {!hideBirthdayCountdown && <BirthdayCountdown pet={pet} />}
          </div>
        ) : (
          <div className="px-5 py-10 text-center">
            <i className="fa-solid fa-paw text-brand-dark-soft/30 text-3xl mb-2 block" />
            <p className="text-xs text-brand-dark-soft mb-3">No pets registered yet.</p>
            <button type="button" onClick={() => setShowAddPet(true)}
              className="rounded-xl bg-brand-teal px-4 py-2 text-xs font-bold text-white hover:brightness-95">
              Register Your First Pet
            </button>
          </div>
        )}
      </div>

      {createPortal(
        <>
          <AddPetModal
            isOpen={showAddPet || !!editPet}
            onClose={() => { setShowAddPet(false); setEditPet(null); setAddPetFromTree(false); }}
            onSaved={(petData) => { setShowAddPet(false); setEditPet(null); if (addPetFromTree) { setAddPetFromTree(false); setShowFamilyTree(true); } onPetAdded?.(petData); }}
            editPet={editPet}
          />
          {showFamilyTree && (
            <div
              className="fixed inset-0 z-[200] h-[100dvh] min-h-[100dvh] w-screen flex flex-col"
              style={{ backgroundColor: 'rgba(10, 30, 20, 0.92)' }}
            >
              {/* Close button */}
              <button type="button" onClick={() => setShowFamilyTree(false)}
                className="absolute top-4 right-4 z-10 w-9 h-9 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white/80 hover:bg-white/20 hover:text-white transition-colors">
                <X size={18} />
              </button>

              {/* Title */}
              <div className="shrink-0 flex items-center justify-center pt-4 pb-2">
                <div className="flex items-center gap-2">
                  <i className="fa-solid fa-sitemap text-white/70 text-sm" />
                  <h2 className="text-sm font-bold text-white/90 uppercase tracking-widest font-poppins">Pawmily Tree</h2>
                </div>
              </div>

              {/* Tree — takes full remaining space, grass anchored to bottom */}
              <div className="flex-1 relative overflow-hidden">
                <PetFamilyTree
                  pets={pets}
                  onPetClick={(p) => {
                    const idx = pets.findIndex((x) => x.id === p.id);
                    if (idx !== -1) { selectPet(idx); setShowFamilyTree(false); }
                  }}
                  onAddPet={() => { setShowFamilyTree(false); setAddPetFromTree(true); setShowAddPet(true); }}
                />
              </div>
            </div>
          )}
        </>,
        document.body
      )}
    </>
  );
}
