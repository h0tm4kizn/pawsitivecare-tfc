import React, { useCallback, useEffect, useState } from 'react';
import { Camera, Dog, Fingerprint, PawPrint, RefreshCw } from 'lucide-react';
import { apiGet } from '../../../api/apiClient';
import { useAuthStore } from '../../../stores/authStore';
import ViewPetModal from '../pets/components/ViewPetModal';
import ViewPetModal_Mobile from '../pets/components/ViewPetModal_Mobile';
import HeaderIconButton from './shared/HeaderIconButton';
import HeaderModalShell from './shared/HeaderModalShell';

import { extractArray, ownerName, isCatPet, isDogPet, getLiveHint, AUTO_SCAN_THRESHOLD, MIN_CENTER_SCORE, MIN_BRIGHTNESS, MAX_BRIGHTNESS, rankManualPetResults } from './noseprint/noseprintUtils';

import { useNosePrintScanner } from './noseprint/useNosePrintScanner';
import StepIndicator from './noseprint/StepIndicator';
import ScanOverlay from './noseprint/ScanOverlay';
import CameraAlertOverlay from './noseprint/CameraAlertOverlay';
import NosePrintOwnerStep from './noseprint/NosePrintOwnerStep';
import NosePrintPetStep from './noseprint/NosePrintPetStep';
import NosePrintIdentifyStep from './noseprint/NosePrintIdentifyStep';

export default function HeaderNosePrint({ onNavigate }) {
  const role = useAuthStore((state) => state.role());
  const canUse = role === 'admin' || role === 'staff';

  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState(-1); // -1 = mode pick, 0 = owner, 1 = pet, 2 = capture
  const [flowMode, setFlowMode] = useState(null); // register | identify

  // Owner search
  const [ownerQuery, setOwnerQuery] = useState('');
  const [ownerPool, setOwnerPool] = useState([]);
  const [ownerResults, setOwnerResults] = useState([]);
  const [ownerSearching, setOwnerSearching] = useState(false);
  const [ownerSearchError, setOwnerSearchError] = useState('');
  const [showOwnerDropdown, setShowOwnerDropdown] = useState(false);
  const [selectedOwner, setSelectedOwner] = useState(null);
  const [ownerPetsLoading, setOwnerPetsLoading] = useState(false);

  // Pet selection & target
  const [selectedPet, setSelectedPet] = useState(null);
  const [fallbackQuery, setFallbackQuery] = useState('');
  const [fallbackResults, setFallbackResults] = useState([]);
  const [fallbackSearching, setFallbackSearching] = useState(false);
  const [fallbackError, setFallbackError] = useState('');

  const [viewPetModalOpen, setViewPetModalOpen] = useState(false);
  const [viewPetTarget, setViewPetTarget] = useState(null);
  const [isMobileViewport, setIsMobileViewport] = useState(
    typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches,
  );

  const fetchOwnersRemote = useCallback(async (queryText) => {
    const q = String(queryText || '').trim();
    if (!q) return [];
    try {
      const res = await apiGet(`/api/booking/owners?search=${encodeURIComponent(q)}&per_page=20`);
      const json = await res.json().catch(() => ({}));
      if (res.ok) return extractArray(json);
    } catch {
      // fallback below
    }
    const fallback = await apiGet(`/api/owners?search=${encodeURIComponent(q)}&per_page=20`);
    const fbJson = await fallback.json().catch(() => ({}));
    return extractArray(fbJson);
  }, []);

  const fetchOwnerPets = useCallback(async (ownerId) => {
    if (!ownerId) return [];
    try {
      const res = await apiGet(`/api/booking/owners/${ownerId}/pets`);
      if (res.ok) {
        const json = await res.json().catch(() => ({}));
        return extractArray(json);
      }
    } catch {
      // Fall through to fallback below
    }

    try {
      const fallback = await apiGet(`/api/pets?owner_id=${encodeURIComponent(ownerId)}&per_page=200`);
      if (fallback.ok) {
        const fallbackJson = await fallback.json().catch(() => ({}));
        return extractArray(fallbackJson);
      }
      return [];
    } catch {
      return [];
    }
  }, []);

  const handleIdentifySuccess = useCallback((pet) => {
    setViewPetTarget(pet);
    setIsOpen(false);
    setViewPetModalOpen(true);
  }, []);

  const { videoRef, ...scanner } = useNosePrintScanner({
    step,
    flowMode,
    selectedPet,
    isOpen,
    onIdentifySuccess: handleIdentifySuccess,
  });

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia('(max-width: 1023px)');
    const onChange = (event) => setIsMobileViewport(event.matches);
    setIsMobileViewport(mq.matches);
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }
    mq.addListener(onChange);
    return () => mq.removeListener(onChange);
  }, []);

  // Pre-fetch recent owners on modal open
  useEffect(() => {
    if (!isOpen) return;
    apiGet('/api/booking/owners?per_page=50')
      .then((r) => r.json().catch(() => ({})))
      .then((json) => setOwnerPool(extractArray(json)))
      .catch(() => {});
  }, [isOpen]);

  // Debounced owner search query — instant local filter + background remote fetch
  useEffect(() => {
    const q = ownerQuery.trim().toLowerCase();
    setOwnerSearchError('');

    if (q.length === 0) {
      setOwnerSearching(false);
      if (ownerPool.length > 0) {
        setOwnerResults(ownerPool.slice(0, 20));
        setShowOwnerDropdown(true);
      }
      return;
    }

    const localHits = ownerPool.filter((o) => {
      const blob = [ownerName(o), o.email, o.phone, o.contact_number].filter(Boolean).join(' ').toLowerCase();
      return blob.includes(q);
    });

    if (localHits.length > 0) {
      setOwnerResults(localHits);
      setShowOwnerDropdown(true);
      setOwnerSearching(false);
    } else if (q.length >= 2) {
      setOwnerSearching(true);
      setShowOwnerDropdown(true);
    }

    if (q.length < 2) {
      setOwnerSearching(false);
      return undefined;
    }

    const timer = setTimeout(async () => {
      if (localHits.length === 0) {
        setOwnerSearching(true);
      }
      try {
        const rows = await fetchOwnersRemote(q);
        if (rows.length > 0) {
          setOwnerResults(rows);
          setOwnerPool((prev) => {
            const ids = new Set(prev.map((o) => o.id));
            const newRows = rows.filter((o) => !ids.has(o.id));
            return newRows.length > 0 ? [...prev, ...newRows] : prev;
          });
        } else if (localHits.length === 0) {
          setOwnerResults([]);
        }
        setShowOwnerDropdown(true);
      } catch {
        // no-op
      } finally {
        setOwnerSearching(false);
      }
    }, 180);
    return () => clearTimeout(timer);
  }, [ownerQuery, fetchOwnersRemote]);

  // Debounced manual fallback search in identify mode
  useEffect(() => {
    const q = fallbackQuery.trim();
    if (q.length < 2) {
      setFallbackResults([]);
      setFallbackError('');
      return;
    }
    setFallbackError('');
    const timer = setTimeout(async () => {
      setFallbackSearching(true);
      try {
        let pets = [];
        try {
          const petRes = await apiGet(`/api/pets?search=${encodeURIComponent(q)}&per_page=20`);
          const petJson = await petRes.json().catch(() => ({}));
          pets = extractArray(petJson);
        } catch {
          // Manual lookup must remain available when the recognition service
          // or the filtered endpoint is unavailable.
        }

        if (pets.length > 0) {
          setFallbackResults(rankManualPetResults(q, pets));
          setFallbackError('');
          return;
        }

        // Some deployments do not apply the search query consistently across
        // pet endpoints. Load the regular staff/admin list and rank locally so
        // Pet ID and name lookup still work without ML.
        try {
          const allPetsRes = await apiGet('/api/pets?per_page=200');
          const allPetsJson = await allPetsRes.json().catch(() => ({}));
          const rankedAllPets = rankManualPetResults(q, extractArray(allPetsJson));
          if (rankedAllPets.length > 0) {
            setFallbackResults(rankedAllPets);
            setFallbackError('');
            return;
          }
        } catch {
          // Continue with owner-based lookup below.
        }

        const ownerRows = await fetchOwnersRemote(q);
        if (ownerRows.length > 0) {
          const petLists = await Promise.all(ownerRows.slice(0, 5).map((o) => fetchOwnerPets(o.id)));
          const allPets = petLists.flat();
          const ranked = rankManualPetResults(q, allPets);
          setFallbackResults(ranked);
          if (ranked.length === 0) setFallbackError('Owner found but has no registered pets.');
        } else {
          setFallbackResults([]);
          setFallbackError('No pets found. Try a different search term.');
        }
      } catch {
        setFallbackError('Search failed. Check API connection.');
      } finally {
        setFallbackSearching(false);
      }
    }, 150);
    return () => clearTimeout(timer);
  }, [fallbackQuery, fetchOwnersRemote, fetchOwnerPets]);

  const handleSelectOwner = async (owner) => {
    const existingPets = Array.isArray(owner?.pets) ? owner.pets : [];
    setSelectedOwner({ ...owner, pets: existingPets });
    setOwnerQuery(ownerName(owner));
    setOwnerResults([]);
    setShowOwnerDropdown(false);
    setOwnerSearchError('');
    setSelectedPet(null);
    setStep(1);

    if (existingPets.length > 0) {
      setOwnerPetsLoading(false);
      return;
    }

    setOwnerPetsLoading(true);
    const pets = await fetchOwnerPets(owner?.id);
    setSelectedOwner((prev) => ({ ...(prev || owner), pets }));
    setOwnerPetsLoading(false);
  };

  const resetResults = () => {
    scanner.resetResults();
    setFallbackQuery('');
    setFallbackResults([]);
    setFallbackError('');
    setViewPetModalOpen(false);
    setViewPetTarget(null);
  };

  const closeModal = () => {
    scanner.stopCamera();
    setIsOpen(false);
    setStep(-1);
    setFlowMode(null);
    setOwnerQuery('');
    setOwnerResults([]);
    setOwnerPool([]);
    setSelectedOwner(null);
    setSelectedPet(null);
    setViewPetModalOpen(false);
    setViewPetTarget(null);
    resetResults();
  };

  const minCleanFrames = 1;
  const canCaptureNow =
    scanner.isScanning &&
    !scanner.isCapturing &&
    !scanner.cameraAlert &&
    !scanner.dismissCooldown &&
    scanner.petFrameValid &&
    scanner.cleanFrameCount >= minCleanFrames;

  const ownerPets = selectedOwner?.pets || [];
  const activePet = scanner.matchedPet || selectedPet;
  const canNavigate = typeof onNavigate === 'function';
  const currentSpecies = scanner.detectedSpecies || (selectedPet ? (isCatPet(selectedPet) ? 'cat' : isDogPet(selectedPet) ? 'dog' : null) : null);
  const overlayQuality = scanner.petFrameValid ? scanner.quality : Math.min(scanner.quality, 24);
  const liveHintBase = getLiveHint(overlayQuality, scanner.brightness, scanner.centerScore, currentSpecies);
  const liveHint = !scanner.petFrameValid
    ? 'No dog/cat detected — point the camera to the pet'
    : (!scanner.frameStable && scanner.isScanning ? 'Playful pet detected — gently hold pet steady for capture' : liveHintBase);
  const readyForOverlay =
    scanner.petFrameValid &&
    scanner.quality >= AUTO_SCAN_THRESHOLD &&
    scanner.centerScore >= MIN_CENTER_SCORE &&
    scanner.brightness >= MIN_BRIGHTNESS &&
    scanner.brightness <= MAX_BRIGHTNESS &&
    scanner.frameStable;

  if (!canUse) return null;

  return (
    <div className="relative">
      <HeaderIconButton icon={Fingerprint} label="Pet Identification" onClick={() => setIsOpen(true)} roundedHover testId="icon-scanner" />

      {isOpen && (
        <HeaderModalShell
          isOpen={isOpen}
          onClose={closeModal}
          title="Pet Recognition"
          subtitle="Pet Enrollment & Identification"
          className="w-full max-w-md"
        >
          <div className="max-h-[700px] space-y-4 overflow-y-auto px-5 py-4">
            {flowMode === 'register' && <StepIndicator step={step} />}

            {/* Mode selection screen */}
            {!flowMode && (
              <div className="space-y-3">
                <p className="text-center text-xs font-semibold uppercase tracking-wide text-brand-dark-soft">
                  Choose Action
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      resetResults();
                      setFlowMode('register');
                      setStep(0);
                    }}
                    className="group rounded-2xl border border-brand-teal/40 bg-brand-teal-soft/20 p-4 text-center transition hover:-translate-y-0.5 hover:border-brand-teal hover:bg-brand-teal-soft/30"
                  >
                    <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand-teal text-white shadow-sm">
                      <Dog size={18} />
                    </div>
                    <p className="text-sm font-extrabold text-brand-dark">Enroll Pet</p>
                    <p className="mt-1 text-[11px] leading-4 text-brand-dark-soft">
                      Search owner, select pet, then capture for recognition.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      resetResults();
                      setSelectedOwner(null);
                      setSelectedPet(null);
                      setOwnerQuery('');
                      setFlowMode('identify');
                      setStep(2);
                    }}
                    className="group rounded-2xl border border-brand-teal/40 bg-white p-4 text-center transition hover:-translate-y-0.5 hover:border-brand-teal hover:bg-brand-teal-soft/10"
                  >
                    <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand-teal text-white shadow-sm">
                      <PawPrint size={18} />
                    </div>
                    <p className="text-sm font-extrabold text-brand-dark">Identify Pet</p>
                    <p className="mt-1 text-[11px] leading-4 text-brand-dark-soft">
                      Open camera and find matching pet profile.
                    </p>
                  </button>
                </div>
              </div>
            )}

            {/* Step 0: Search Owner */}
            {flowMode === 'register' && step === 0 && (
              <NosePrintOwnerStep
                ownerQuery={ownerQuery}
                setOwnerQuery={setOwnerQuery}
                setSelectedOwner={setSelectedOwner}
                setSelectedPet={setSelectedPet}
                ownerPool={ownerPool}
                ownerResults={ownerResults}
                setOwnerResults={setOwnerResults}
                ownerSearching={ownerSearching}
                showOwnerDropdown={showOwnerDropdown}
                setShowOwnerDropdown={setShowOwnerDropdown}
                ownerSearchError={ownerSearchError}
                selectedOwner={selectedOwner}
                ownerPets={ownerPets}
                onSelectOwner={handleSelectOwner}
                onNext={() => setStep(1)}
              />
            )}

            {/* Step 1: Select Pet */}
            {flowMode === 'register' && step === 1 && (
              <NosePrintPetStep
                selectedOwner={selectedOwner}
                ownerPets={ownerPets}
                ownerPetsLoading={ownerPetsLoading}
                selectedPet={selectedPet}
                setSelectedPet={setSelectedPet}
                onChangeOwner={() => {
                  setStep(0);
                  setSelectedOwner(null);
                  setOwnerQuery('');
                  setSelectedPet(null);
                }}
                onBack={() => setStep(0)}
                onNext={() => {
                  resetResults();
                  setStep(2);
                }}
              />
            )}

            {/* Step 2: Camera Capture */}
            {step === 2 && (
              <div className="space-y-4">
                {flowMode === 'register' && (
                  <div className="flex items-center justify-between rounded-xl border border-brand-dark-light bg-[#f8fafc] px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-brand-dark-light bg-brand-teal-soft/30">
                        {selectedPet?.photo_url ? (
                          <img src={selectedPet.photo_url} alt={selectedPet.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center">
                            <span className="text-[9px] font-bold text-brand-teal-dark">
                              {String(selectedPet?.name || '?').slice(0, 2).toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-xs font-bold text-brand-dark">{selectedPet?.name}</p>
                        <p className="text-[10px] text-brand-dark-soft">
                          {selectedPet?.pet_id} &bull; {ownerName(selectedOwner)}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        scanner.stopCamera();
                        setStep(1);
                        resetResults();
                      }}
                      className="rounded-lg border border-brand-dark-light px-2.5 py-1 text-[11px] font-semibold text-brand-dark-soft hover:border-brand-teal hover:text-brand-teal"
                    >
                      Change
                    </button>
                  </div>
                )}

                {/* Camera Feed */}
                <div className="relative h-[260px] w-full overflow-hidden rounded-2xl bg-black">
                  <video
                    ref={videoRef}
                    className={`h-full w-full ${isMobileViewport ? 'object-contain' : 'object-cover'}`}
                    style={{ transform: scanner.cameraMirrored ? 'scaleX(-1)' : 'none' }}
                    muted
                    playsInline
                  />
                  {scanner.isScanning && !scanner.cameraAlert && (
                    <ScanOverlay
                      quality={overlayQuality}
                      ready={readyForOverlay}
                      isCapturing={scanner.isCapturing}
                      mode={flowMode === 'identify' ? 'identify' : 'enroll'}
                      liveHint={liveHint}
                      autoCapturePending={scanner.autoCapturePending}
                      species={currentSpecies}
                      petFrameValid={scanner.petFrameValid}
                      roiBox={scanner.roiBox}
                    />
                  )}
                  {!scanner.isScanning && !scanner.error && (
                    <div className="absolute inset-0 flex items-center justify-center text-sm text-white/60">
                      Starting camera...
                    </div>
                  )}
                  {scanner.isCapturing && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60">
                      <div className="h-9 w-9 animate-spin rounded-full border-4 border-brand-teal border-t-transparent" />
                      <p className="text-xs font-bold text-white">Processing...</p>
                    </div>
                  )}

                  {/* Camera Warning / Alert Overlay */}
                  <CameraAlertOverlay
                    cameraAlert={scanner.cameraAlert}
                    onDismiss={scanner.dismissCameraAlert}
                  />
                </div>

                {/* Enrollment Action */}
                {flowMode === 'register' && (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={scanner.captureEnroll}
                      disabled={!canCaptureNow || !selectedPet}
                      className="w-full rounded-xl bg-brand-teal py-2.5 text-sm font-bold text-white disabled:opacity-40"
                    >
                      Capture &amp; Register
                    </button>
                    {scanner.enrollStatus && (
                      <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700">
                        {scanner.enrollStatus}
                      </p>
                    )}
                  </div>
                )}

                {/* Identification Action */}
                {flowMode === 'identify' && (
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={scanner.captureIdentify}
                      disabled={!canCaptureNow}
                      className="w-full rounded-xl bg-brand-teal py-2.5 text-sm font-bold text-white disabled:opacity-40"
                    >
                      Capture &amp; Identify
                    </button>
                    {scanner.bioResult && (
                      <div className="rounded-xl border border-brand-teal/30 bg-brand-teal-soft/20 px-3 py-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">Scan Result</p>
                        <p className="text-sm font-bold text-brand-dark">
                          {scanner.bioResult?.best_match?.name || 'Unknown'}{' '}
                          <span className="text-brand-teal">
                            ({Math.round(Number(scanner.bioResult?.best_match?.similarity_score || 0) * 100)}% match)
                          </span>
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Error Banner */}
                {scanner.error && (
                  <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                    {scanner.error}
                  </p>
                )}

                {/* Camera Controls */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={resetResults}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-brand-dark-light py-2 text-xs font-semibold text-brand-dark hover:border-brand-teal hover:text-brand-teal"
                  >
                    <RefreshCw size={13} />
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={scanner.isScanning ? scanner.stopCamera : scanner.startCamera}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-brand-dark-light py-2 text-xs font-semibold text-brand-dark hover:border-brand-teal hover:text-brand-teal"
                  >
                    <Camera size={13} />
                    {scanner.isScanning ? 'Stop Camera' : 'Start Camera'}
                  </button>
                </div>

                {/* Manual Identify Search */}
                {flowMode === 'identify' && (
                  <NosePrintIdentifyStep
                    fallbackQuery={fallbackQuery}
                    setFallbackQuery={setFallbackQuery}
                    fallbackSearching={fallbackSearching}
                    fallbackError={fallbackError}
                    fallbackResults={fallbackResults}
                    onSelectPet={(pet) => {
                      scanner.setMatchedPet(pet);
                      setViewPetTarget(pet);
                      scanner.setError('');
                      setFallbackQuery('');
                      setFallbackResults([]);
                      scanner.stopCamera();
                      setIsOpen(false);
                      setViewPetModalOpen(true);
                    }}
                  />
                )}
              </div>
            )}
          </div>
        </HeaderModalShell>
      )}

      {isMobileViewport ? (
        <ViewPetModal_Mobile
          pet={viewPetModalOpen ? (viewPetTarget || activePet) : null}
          onClose={() => { setViewPetModalOpen(false); setViewPetTarget(null); }}
          onScheduleAppointment={() => {
            const petToBook = viewPetTarget || activePet;
            setViewPetModalOpen(false);
            setViewPetTarget(null);
            if (canNavigate && petToBook) onNavigate('appointment', { pet: petToBook });
          }}
        />
      ) : (
        <ViewPetModal
          pet={viewPetModalOpen ? (viewPetTarget || activePet) : null}
          onClose={() => { setViewPetModalOpen(false); setViewPetTarget(null); }}
          onScheduleAppointment={() => {
            const petToBook = viewPetTarget || activePet;
            setViewPetModalOpen(false);
            setViewPetTarget(null);
            if (canNavigate && petToBook) onNavigate('appointment', { pet: petToBook });
          }}
        />
      )}
    </div>
  );
}
