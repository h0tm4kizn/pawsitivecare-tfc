import { useEffect, useRef, useState } from 'react';
import { Menu, User, X } from 'lucide-react';
import ClientNosePrint from './header/ClientNosePrint';
import ClientNotification from './header/ClientNotification';
import PetAssessmentFormModal from '../../components/modals/PetAssessmentFormModal';
import useBodyScrollLock from '../../hooks/useBodyScrollLock';
import FurClubInfoModal from './sidebar/FurClubInfoModal';
import LogoutConfirmModal from './sidebar/LogoutConfirmModal';
import useAssessmentHistory from './sidebar/useAssessmentHistory';
import ClientAssessmentDropdown from './sidebar/ClientAssessmentDropdown';
import ClientAssessmentHistoryModal from './sidebar/ClientAssessmentHistoryModal';
import ClientProfileDrawer from './sidebar/ClientProfileDrawer';

export default function ClientSidebar({ currentUser, onLogout, onRegisterMobile = null }) {
  const [showFurClub, setShowFurClub] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfilePanelOpen, setIsProfilePanelOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Assessment history state & logic
  const {
    showAssessmentPicker,
    setShowAssessmentPicker,
    tooltip,
    setTooltip,
    assessmentPets,
    assessmentPet,
    setAssessmentPet,
    historyPet,
    setHistoryPet,
    historyForms,
    selectedHistoryForm,
    setSelectedHistoryForm,
    historyLoading,
    petsLoading,
    assessmentPickerRef,
    openAssessment,
    loadHistory,
  } = useAssessmentHistory();

  useBodyScrollLock(
    isProfilePanelOpen ||
    showFurClub ||
    showLogoutConfirm ||
    !!assessmentPet
  );

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 0);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Expose open-profile and open-assessment to the mobile view via registration callback
  const registeredRef = useRef(false);
  useEffect(() => {
    if (!onRegisterMobile || registeredRef.current) return;
    registeredRef.current = true;
    onRegisterMobile({
      openProfile: () => setIsProfilePanelOpen(true),
      openAssessment,
    });
  }, [onRegisterMobile, openAssessment]);

  const displayName = currentUser?.name ||
    [currentUser?.first_name, currentUser?.last_name].filter(Boolean).join(' ') ||
    currentUser?.email || 'Fur Parent';

  const requestLogout = () => setShowLogoutConfirm(true);
  const confirmLogout = () => {
    setShowLogoutConfirm(false);
    setIsProfilePanelOpen(false);
    onLogout?.();
  };

  return (
    <>
      {/* Header is hidden on mobile — the mobile view provides its own header */}
      <header
        className={`hidden lg:block sticky top-0 z-40 px-4 sm:px-6 md:px-8 lg:px-10 py-5 font-poppins backdrop-blur transition-colors overflow-visible ${
          isScrolled
            ? 'bg-white/20'
            : 'bg-transparent'
        }`}
        style={{
          background: isScrolled
            ? 'rgba(255, 255, 255, 0.20)'
            : 'radial-gradient(circle at 85% 12%, rgba(79, 198, 201, 0.18) 0%, rgba(79, 198, 201, 0.10) 36%, #fef9f4 60%)',
        }}
      >
        <div className={`mx-auto grid w-full max-w-[1800px] grid-cols-[auto_1fr] items-center gap-3 border-b md:gap-4 ${
          isScrolled
            ? 'border-brand-teal/30'
            : 'border-transparent'
        }`}>
          <div className="relative group">
            <button
              type="button"
              onClick={() => setShowFurClub(true)}
              className="group inline-flex items-center gap-2"
              aria-label="View The Fur Club details"
            >
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-teal text-white shadow-sm transition-transform group-hover:scale-105">
                <img src="/assets/paw-teal.webp" alt="The Fur Club" className="h-10 w-10 object-contain brightness-0 invert" />
              </span>
              <img src="/assets/furclub_text.webp" alt="Fur Club" className="hidden h-6 w-auto object-contain md:block" />
            </button>
            <div className="pointer-events-none absolute left-0 top-full mt-2 z-[9999] whitespace-nowrap rounded-lg bg-brand-dark px-2 py-1 text-[10px] font-semibold text-white shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              View The Fur Club details
              <div className="absolute -top-1 left-4 w-2 h-2 bg-brand-dark rotate-45" />
            </div>
          </div>

          <div className="ml-auto flex min-w-0 items-center justify-end gap-2 md:gap-3 xl:gap-4">
            <div className="hidden h-14 min-w-[172px] px-3 items-center justify-center overflow-visible rounded-full bg-brand-teal-soft/80 shadow-[inset_0_2px_10px_rgba(23,53,81,0.14)] lg:flex" style={{ overflow: 'visible' }}>
              <div className="relative" onMouseEnter={() => setTooltip('PetID')} onMouseLeave={() => setTooltip('')}>
                <ClientNosePrint />
                {tooltip === 'PetID' && (
                  <span className="absolute left-1/2 -translate-x-1/2 top-12 z-[999] whitespace-nowrap rounded-lg bg-brand-dark px-2 py-1 text-[10px] font-semibold text-white pointer-events-none">
                    Pet Identification
                  </span>
                )}
              </div>
              <span className="h-7 w-px bg-brand-dark/20" />
              <div className="relative" ref={assessmentPickerRef} onMouseEnter={() => setTooltip('Assessment')} onMouseLeave={() => setTooltip('')}>
                <button
                  type="button"
                  onClick={openAssessment}
                  className="flex h-10 w-10 items-center justify-center text-brand-dark/70 hover:text-brand-teal transition-colors"
                >
                  <i className="fa-solid fa-notes-medical text-sm" />
                </button>
                {tooltip === 'Assessment' && (
                  <span className="absolute left-1/2 -translate-x-1/2 top-12 z-[999] whitespace-nowrap rounded-lg bg-brand-dark px-2 py-1 text-[10px] font-semibold text-white pointer-events-none">
                    Assessment History
                  </span>
                )}
                <ClientAssessmentDropdown
                  isOpen={showAssessmentPicker}
                  onClose={() => setShowAssessmentPicker(false)}
                  historyPet={historyPet}
                  setHistoryPet={setHistoryPet}
                  petsLoading={petsLoading}
                  assessmentPets={assessmentPets}
                  loadHistory={loadHistory}
                  selectedHistoryForm={selectedHistoryForm}
                  setSelectedHistoryForm={setSelectedHistoryForm}
                  historyLoading={historyLoading}
                  historyForms={historyForms}
                />
              </div>
              <span className="h-5 w-px bg-brand-dark/20" />
              <div className="relative" onMouseEnter={() => setTooltip('Notifications')} onMouseLeave={() => setTooltip('')}>
                <ClientNotification />
                {tooltip === 'Notifications' && (
                  <span className="absolute left-1/2 -translate-x-1/2 top-12 z-[999] whitespace-nowrap rounded-lg bg-brand-dark px-2 py-1 text-[10px] font-semibold text-white pointer-events-none">
                    Notifications
                  </span>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsProfilePanelOpen(true)}
              className="hidden md:flex h-[60px] w-[60px] items-center justify-center rounded-full bg-brand-teal text-white shadow transition-colors hover:bg-brand-teal-dark"
              aria-label="Open profile panel"
              aria-expanded={isProfilePanelOpen}
            >
              <User size={20} strokeWidth={2.4} />
            </button>

            <button
              type="button"
              onClick={() => setIsMenuOpen((v) => !v)}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-teal-soft/90 text-brand-dark shadow-[inset_0_2px_8px_rgba(23,53,81,0.10)] md:hidden"
              aria-label="Toggle menu"
              aria-expanded={isMenuOpen}
            >
              {isMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {isMenuOpen && (
          <div className="mx-auto mt-4 max-w-7xl rounded-2xl border border-brand-teal/30 bg-white p-2 shadow-lg md:hidden">
            <div className="px-3 pt-3 flex items-center justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-brand-dark">{displayName}</p>
                <p className="truncate text-xs text-brand-dark-soft">{currentUser?.email || ''}</p>
              </div>
              <button
                type="button"
                onClick={requestLogout}
                className="inline-flex items-center gap-2 px-1 py-2 text-sm font-medium text-brand-teal hover:text-brand-teal-dark transition-colors"
              >
                <i className="fa-solid fa-right-from-bracket text-sm" />
                Logout
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Profile Drawer */}
      <ClientProfileDrawer
        isOpen={isProfilePanelOpen}
        onClose={() => setIsProfilePanelOpen(false)}
        currentUser={currentUser}
        onLogoutClick={requestLogout}
      />

      {/* Fur Club Info Modal */}
      <FurClubInfoModal
        isOpen={showFurClub}
        onClose={() => setShowFurClub(false)}
      />

      {/* Logout Confirmation Modal */}
      <LogoutConfirmModal
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={confirmLogout}
      />

      {/* Mobile Assessment History Modal */}
      <ClientAssessmentHistoryModal
        isOpen={showAssessmentPicker}
        onClose={() => setShowAssessmentPicker(false)}
        historyPet={historyPet}
        setHistoryPet={setHistoryPet}
        petsLoading={petsLoading}
        assessmentPets={assessmentPets}
        loadHistory={loadHistory}
        selectedHistoryForm={selectedHistoryForm}
        setSelectedHistoryForm={setSelectedHistoryForm}
        historyLoading={historyLoading}
        historyForms={historyForms}
      />

      {/* Pet Assessment Form Modal */}
      <PetAssessmentFormModal
        isOpen={!!assessmentPet}
        pet={assessmentPet}
        onClose={() => setAssessmentPet(null)}
        onSaved={() => {}}
        apiBase="/api/my-pets"
        theme="pet_owner"
      />
    </>
  );
}
