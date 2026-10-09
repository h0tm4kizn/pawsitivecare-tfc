import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Menu, User, FileText, CalendarPlus, PawPrint } from 'lucide-react';
import { X } from 'lucide-react';
import AppointmentSection from '../AppointmentSection';
import ServiceSection from '../ServiceSection';
import AddPetModal from '../AddPetModal';
import Loading from '../../../../components/Loading';
import { AdminSkeleton } from '../../../../components/admin/AdminLoading';
import ScannerModal from './ScannerModal';
import NotificationsModal from './NotificationsModal';
import PetProfileModal from './PetProfileModal';
import { calcBirthdayCountdown, petBg, petCardGradient, petInitials } from './mobileDashboardHelpers';
import { formatBreedName } from '../../../../utils/textUtils';

// â”€â”€ Pet helpers (mirrored from PetSidebar) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function CustomerDashboard_MobileView({
  user,
  firstName,
  pets,
  petsLoading,
  appointments,
  appointmentsLoading,
  onLogout,
  onBook,
  onRefresh,
  onPetAdded,
  onPetSelect,
  selectedPet,
  calendarFocusDate = null,
  onOpenProfile    = null,
  onOpenAssessment = null,
  style = undefined,
}) {
  const [menuOpen,          setMenuOpen]          = useState(false);
  const [showAddPet,        setShowAddPet]        = useState(false);
  const [profilePet,        setProfilePet]        = useState(null);
  const [showScanner,       setShowScanner]       = useState(false);
  const [showNotif,         setShowNotif]         = useState(false);

  const displayName = user?.name || user?.email || 'Fur Parent';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || 'F';

  const openPetProfile = (pet) => {
    onPetSelect?.(pet);
    setProfilePet(pet);
  };

  return (
    <div className="flex flex-col min-h-screen bg-transparent font-poppins" style={style}>

      {/* â”€â”€ Mobile Header â”€â”€ */}
      <header className="sticky top-0 z-40 px-4 py-2.5 bg-transparent backdrop-blur border-b border-transparent">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-teal shadow-sm">
              <img src="/assets/paw-teal.webp" alt="The Fur Club" className="h-7 w-7 object-contain brightness-0 invert" />
            </span>
            <img src="/assets/furclub_text.webp" alt="Fur Club" className="h-4 w-auto object-contain" />
          </div>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-dark/8 text-brand-dark shadow-[inset_0_2px_8px_rgba(23,53,81,0.10)]"
            aria-label="Open menu"
          >
            <Menu size={18} />
          </button>
        </div>
      </header>

      {/* â”€â”€ Hamburger Drawer â”€â”€ */}
      {typeof document !== 'undefined' && createPortal(
        <>
          <div
            className={`fixed inset-0 z-[140] bg-brand-dark/25 backdrop-blur-[2px] transition-opacity duration-300 ${
              menuOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
            onClick={() => setMenuOpen(false)}
          />
          <aside
            className={`fixed inset-y-0 right-0 z-[150] flex h-screen w-[min(85vw,300px)] flex-col bg-white shadow-2xl transition-transform duration-300 ${
              menuOpen ? 'translate-x-0' : 'pointer-events-none translate-x-full'
            }`}
          >
            <div className="bg-brand-teal px-5 py-5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm font-bold text-white">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">{displayName}</p>
                  <p className="text-[11px] text-white/75 truncate mt-0.5">{user?.email || ''}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="ml-2 shrink-0 text-white/75 hover:text-white"
                aria-label="Close menu"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-teal p-4 space-y-3">

              {/* Tools */}
              <div className="rounded-xl border border-brand-dark-light bg-white px-4 py-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-dark-soft mb-3">Tools</p>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); setShowScanner(true); }}
                    className="flex flex-col items-center gap-1.5 flex-1"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-teal/10 text-brand-teal hover:bg-brand-teal/20 transition-colors">
                      <i className="fa-solid fa-paw text-base" />
                    </div>
                    <span className="text-[10px] font-semibold text-brand-dark-soft">Scanner</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => { setMenuOpen(false); setShowNotif(true); }}
                    className="flex flex-col items-center gap-1.5 flex-1"
                  >
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-teal/10 text-brand-teal hover:bg-brand-teal/20 transition-colors">
                      <i className="fa-solid fa-bell text-base" />
                    </div>
                    <span className="text-[10px] font-semibold text-brand-dark-soft">Notifications</span>
                  </button>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="rounded-xl border border-brand-dark-light bg-white px-4 py-3 space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-brand-dark-soft mb-2">Quick Actions</p>

                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); onOpenProfile?.(); }}
                  className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-brand-dark transition-colors hover:bg-brand-teal/8 text-left"
                >
                  <User size={16} className="shrink-0 text-brand-teal" />
                  Edit Profile
                </button>

                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); onOpenAssessment?.(); }}
                  className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-brand-dark transition-colors hover:bg-brand-teal/8 text-left"
                >
                  <FileText size={16} className="shrink-0 text-brand-teal" />
                  Assessment History
                </button>

                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); onBook?.(null, ''); }}
                  className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-brand-dark transition-colors hover:bg-brand-teal/8 text-left"
                >
                  <CalendarPlus size={16} className="shrink-0 text-brand-teal" />
                  Book Appointment
                </button>

                <button
                  type="button"
                  onClick={() => { setMenuOpen(false); setShowAddPet(true); }}
                  className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-brand-dark transition-colors hover:bg-brand-teal/8 text-left"
                >
                  <PawPrint size={16} className="shrink-0 text-brand-teal" />
                  Register a Pet
                </button>
              </div>
            </div>

            <div className="border-t border-brand-dark-light px-4 py-4 shrink-0">
              <button
                type="button"
                onClick={() => { setMenuOpen(false); onLogout?.(); }}
                className="w-full flex items-center justify-end gap-2 px-1 py-3 text-sm font-medium text-red-600 transition-colors hover:text-red-700"
              >
                <i className="fa-solid fa-right-from-bracket text-sm" />
                Logout
              </button>
            </div>
          </aside>
        </>,
        document.body
      )}

      {/* â”€â”€ Main Content â”€â”€ */}
      <main className="flex-1 space-y-5 px-4 pb-10 pt-3.5">

        <section className="pt-1">
          <h1 className="font-poppins text-2xl font-semibold leading-tight text-brand-dark">
            {greeting}, {firstName}!
          </h1>
          <p className="mt-1 text-sm text-brand-dark-soft">Ready for some Pawsitive Care?</p>
        </section>

        {/* â”€â”€ SERVICES â”€â”€ */}
        <section>
          <ServiceSection onBook={onBook} />
        </section>

        {/* â”€â”€ YOUR PETS â”€â”€ */}
        <section>
          <div className="mb-3 flex min-h-9 items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-brand-dark-soft">Your Pets</p>
              <p className="mt-0.5 text-[10px] text-brand-dark-soft">Tap a pet to view their profile</p>
            </div>
            <button
              type="button"
              onClick={() => setShowAddPet(true)}
              className="flex items-center gap-1.5 rounded-full bg-brand-teal px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition-colors hover:bg-brand-teal-dark"
            >
              <PawPrint size={13} />
              Register Pet
            </button>
          </div>

          {petsLoading ? (
            <AdminSkeleton variant="cards" rows={3} label="Loading pets" />
          ) : pets.length === 0 ? (
            <div className="rounded-2xl bg-white border border-brand-dark-light px-4 py-10 text-center">
              <i className="fa-solid fa-paw text-brand-dark-soft/30 text-3xl mb-2 block" />
              <p className="text-xs text-brand-dark-soft mb-3">No pets registered yet.</p>
              <button
                type="button"
                onClick={() => setShowAddPet(true)}
                className="rounded-xl bg-brand-teal px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-brand-teal-dark"
              >
                Register Your First Pet
              </button>
            </div>
          ) : (
            <div className="space-y-2 rounded-2xl border border-brand-dark-light bg-white p-2 shadow-sm">
              {pets.map((pet) => {
                const bg           = petBg(pet);
                const cardGradient = petCardGradient(pet);
                const isSelected   = selectedPet?.id === pet.id;
                const days         = calcBirthdayCountdown(pet.date_of_birth);
                const hasBirthday  = days !== null && days <= 7;

                return (
                  <button
                    key={pet.id}
                    type="button"
                    onClick={() => openPetProfile(pet)}
                    className={`w-full flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all ${cardGradient} ${
                      isSelected
                        ? 'border-brand-teal/40 shadow-sm'
                        : 'border-brand-dark-light hover:border-brand-teal/30'
                    }`}
                  >
                    {/* Pet Photo */}
                    <div className="relative w-11 h-11 shrink-0">
                      <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-white shadow-sm">
                        {pet.photo_url ? (
                          <img src={pet.photo_url} alt={pet.name} className="w-full h-full object-cover" />
                        ) : (
                          <div className={`w-full h-full ${bg} flex items-center justify-center`}>
                            <span className="text-[11px] font-bold text-white">{petInitials(pet.name)}</span>
                          </div>
                        )}
                      </div>
                      {/* Birthday indicator dot */}
                      {hasBirthday && (
                        <span className="absolute -top-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-brand-orange border-2 border-white">
                          <i className="fa-solid fa-cake-candles text-white" style={{ fontSize: '6px' }} />
                        </span>
                      )}
                    </div>

                    {/* Name + species */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold text-brand-dark truncate">{pet.name}</p>
                        {hasBirthday && (
                          <span className="shrink-0 text-[9px] font-bold text-brand-orange bg-orange-50 px-1.5 py-0.5 rounded-full border border-brand-orange/30">
                            {days === 0 ? 'Today!' : days === 1 ? 'Tomorrow' : `${days}d`}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-brand-dark-soft truncate">
                        {pet.species_type?.name || pet.speciesType?.name || ''}
                        {formatBreedName(pet.breed?.name) ? ` â€¢ ${formatBreedName(pet.breed.name)}` : ''}
                      </p>
                    </div>

                    <i className="fa-solid fa-chevron-right text-brand-dark-soft/40 text-[10px] shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* â”€â”€ APPOINTMENTS â”€â”€ */}
        <section>
          <div className="mb-3 flex min-h-9 items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-brand-dark-soft">Appointments</p>
              <p className="mt-0.5 text-[10px] text-brand-dark-soft">Your upcoming visits</p>
            </div>
            <button
              type="button"
              onClick={() => onBook?.(null, '')}
              className="flex items-center gap-1.5 rounded-full bg-brand-teal px-3 py-1.5 text-[11px] font-bold text-white shadow-sm transition-colors hover:bg-brand-teal-dark"
            >
              <CalendarPlus size={13} />
              Book Now
            </button>
          </div>
          <AppointmentSection
            appointments={appointments}
            loading={appointmentsLoading}
            onBook={onBook}
            onRefresh={onRefresh}
            selectedPet={selectedPet}
            focusDate={calendarFocusDate}
          />
        </section>

      </main>

      {/* â”€â”€ Pet Profile Modal â”€â”€ */}
      <PetProfileModal
        pet={profilePet}
        onClose={() => setProfilePet(null)}
        onPetAdded={(petData) => { setProfilePet(null); onPetAdded?.(petData); }}
      />

      {/* â”€â”€ Add Pet Modal â”€â”€ */}
      {typeof document !== 'undefined' && createPortal(
        <AddPetModal
          isOpen={showAddPet}
          onClose={() => setShowAddPet(false)}
          onSaved={(petData) => { setShowAddPet(false); onPetAdded?.(petData); }}
        />,
        document.body
      )}

      {/* â”€â”€ Scanner Modal â”€â”€ */}
      <ScannerModal
        isOpen={showScanner}
        onClose={() => setShowScanner(false)}
        pets={pets}
        petsLoading={petsLoading}
      />

      {/* â”€â”€ Notifications Modal â”€â”€ */}
      <NotificationsModal
        isOpen={showNotif}
        onClose={() => setShowNotif(false)}
      />
    </div>
  );
}


