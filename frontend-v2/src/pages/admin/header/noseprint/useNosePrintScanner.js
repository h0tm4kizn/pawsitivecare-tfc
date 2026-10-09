import { useCallback, useEffect, useRef, useState } from 'react';
import { apiFetch, apiGet } from '../../../../api/apiClient';
import { DOG_URL, CAT_URL, QUALITY_INTERVAL_MS, AUTO_SCAN_THRESHOLD, CAPTURE_SIZE, MIN_CENTER_SCORE, MIN_BRIGHTNESS, MAX_BRIGHTNESS, CAMERA_MIRROR_MODE, CAMERA_FACING_MODE, CAPTURE_ACTION_COOLDOWN_MS, SYNC_RETRY_ATTEMPTS, SYNC_RETRY_DELAY_MS, ENROLL_SAME_PET_COOLDOWN_MS, ENROLL_DUPLICATE_BLOCK_THRESHOLD, IDENTIFY_AMBIGUITY_MARGIN, readRecognitionSyncQueue, writeRecognitionSyncQueue, tuneVideoTrackForPets, extractArray, normalizePetId, toSha256Hex, parseEngineError, isHumanErrorMessage, isCatPet, isDogPet, analyzeFrame, drawCenterCropToCanvas, buildEngineEndpoint } from './noseprintUtils';
import { getCachedPet, getCachedAllPets, cachePetList, cachePetRecord } from '../../pets/petDataCache';

export function useNosePrintScanner({
  step,
  flowMode,
  selectedPet,
  isOpen,
  onIdentifySuccess,
}) {
  const [isScanning, setIsScanning] = useState(false);
  const [quality, setQuality] = useState(0);
  const [brightness, setBrightness] = useState(128);
  const [centerScore, setCenterScore] = useState(0);
  const [frameStable, setFrameStable] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState('');
  const [cameraAlert, setCameraAlert] = useState(null);
  const [petFrameValid, setPetFrameValid] = useState(false);
  const [detectedSpecies, setDetectedSpecies] = useState(null);
  const [roiBox, setRoiBox] = useState(null);

  const [enrollStatus, setEnrollStatus] = useState('');
  const [verifyStatus, setVerifyStatus] = useState('');
  const [bioResult, setBioResult] = useState(null);
  const [matchedPet, setMatchedPet] = useState(null);

  const [autoCapturePending, setAutoCapturePending] = useState(false);
  const [cameraMirrored, setCameraMirrored] = useState(false);
  const [dismissCooldown, setDismissCooldown] = useState(false);
  const [cleanFrameCount, setCleanFrameCount] = useState(0);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const autoCheckTimerRef = useRef(null);
  const autoCheckLockRef = useRef(false);
  const scanningLockRef = useRef(false);
  const autoCaptureFiredRef = useRef(false);
  const faceDetectorRef = useRef(null);
  const humanDetectedRef = useRef(false);
  const dismissCooldownTimerRef = useRef(null);
  const lastActionAtRef = useRef(0);
  const petEnrollCooldownRef = useRef(new Map());
  const prevFrameMetricsRef = useRef({ quality: 0, centerScore: 0, brightness: 128, hasPrev: false });

  const resolveMirrorForStream = useCallback((stream) => {
    const track = stream?.getVideoTracks?.()[0];
    const settings = track?.getSettings?.() || {};
    const facing = String(settings.facingMode || '').toLowerCase();
    const label = String(track?.label || '').toLowerCase();
    const isFrontCamera =
      facing === 'user' ||
      facing === 'front' ||
      label.includes('front') ||
      label.includes('facetime');
    const isRearCamera =
      facing === 'environment' ||
      facing === 'rear' ||
      label.includes('back') ||
      label.includes('rear') ||
      label.includes('environment');

    if (isRearCamera) return false;
    if (CAMERA_MIRROR_MODE === 'false') return false;
    if (CAMERA_MIRROR_MODE === 'true') return isFrontCamera;
    if (CAMERA_MIRROR_MODE === 'auto') return isFrontCamera;
    return false;
  }, []);

  const stopCamera = useCallback(() => {
    clearInterval(timerRef.current);
    clearInterval(autoCheckTimerRef.current);
    clearTimeout(dismissCooldownTimerRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
    setQuality(0);
    setBrightness(128);
    setCenterScore(0);
    setFrameStable(false);
    setCameraMirrored(false);
    setDismissCooldown(false);
    setCleanFrameCount(0);
    humanDetectedRef.current = false;
    faceDetectorRef.current = null;
    setPetFrameValid(false);
    setDetectedSpecies(null);
    setRoiBox(null);
    prevFrameMetricsRef.current = { quality: 0, centerScore: 0, brightness: 128, hasPrev: false };
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setError('');
      let stream = null;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: CAMERA_FACING_MODE, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      }
      streamRef.current = stream;
      await tuneVideoTrackForPets(stream);
      setCameraMirrored(resolveMirrorForStream(stream));
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsScanning(true);

      if ('FaceDetector' in window) {
        try {
          faceDetectorRef.current = new window.FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
        } catch {
          faceDetectorRef.current = null;
        }
      }
      timerRef.current = setInterval(() => {
        if (!videoRef.current || videoRef.current.readyState < 2) return;
        const { quality: q, brightness: b, centerScore: c } = analyzeFrame(videoRef.current);

        if (faceDetectorRef.current) {
          faceDetectorRef.current.detect(videoRef.current)
            .then((faces) => {
              const detected = faces.length > 0;
              humanDetectedRef.current = detected;
              if (detected) {
                setPetFrameValid(false);
                setCameraAlert((current) => current || {
                  type: 'human',
                  text: 'Human detected — this system is for dogs and cats only.',
                });
              }
            })
            .catch(() => {});
        }

        if (humanDetectedRef.current) return;

        const prev = prevFrameMetricsRef.current;
        let stable = true;
        if (prev.hasPrev) {
          const qDelta = Math.abs(q - prev.quality);
          const cDelta = Math.abs(c - prev.centerScore);
          const bDelta = Math.abs(b - prev.brightness);
          stable = qDelta <= 14 && cDelta <= 14 && bDelta <= 25;
        }
        setFrameStable(stable);
        prevFrameMetricsRef.current = { quality: q, centerScore: c, brightness: b, hasPrev: true };

        setQuality(q);
        setBrightness(b);
        setCenterScore(c);
      }, QUALITY_INTERVAL_MS);

    } catch {
      setError('Camera not accessible. Check browser permission.');
    }
  }, [resolveMirrorForStream]);

  useEffect(() => {
    if (step === 2) {
      if (!isScanning) startCamera();
    } else {
      stopCamera();
    }
  }, [step, isScanning, startCamera, stopCamera]);

  useEffect(() => {
    if (!isOpen) stopCamera();
    return () => stopCamera();
  }, [isOpen, stopCamera]);

  useEffect(() => {
    if (!isScanning || cameraAlert || dismissCooldown) {
      setCleanFrameCount(0);
      return;
    }
    if (quality >= AUTO_SCAN_THRESHOLD && centerScore >= MIN_CENTER_SCORE && brightness >= MIN_BRIGHTNESS && brightness <= MAX_BRIGHTNESS && frameStable) {
      setCleanFrameCount((prev) => Math.min(prev + 1, 10));
    } else {
      setCleanFrameCount(0);
    }
  }, [isScanning, cameraAlert, dismissCooldown, quality, centerScore, brightness, frameStable]);

  // Auto species/human check — immediate + fast polling
  useEffect(() => {
    if (!isScanning || cameraAlert || enrollStatus) {
      clearInterval(autoCheckTimerRef.current);
      return;
    }
    const runAutoCheck = async () => {
      if (autoCheckLockRef.current || scanningLockRef.current) return;
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;
      autoCheckLockRef.current = true;
      try {
        const c = document.createElement('canvas');
        drawCenterCropToCanvas(video, c, CAPTURE_SIZE, cameraMirrored);
        const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.82));

        const dogForm = new FormData();
        dogForm.append('file', blob, 'check.jpg');
        const catForm = new FormData();
        catForm.append('file', blob, 'check.jpg');

        const [dogSettled, catSettled] = await Promise.allSettled([
          fetch(buildEngineEndpoint(DOG_URL, 'scanning'), { method: 'POST', body: dogForm }),
          fetch(buildEngineEndpoint(CAT_URL, 'scanning'), { method: 'POST', body: catForm }),
        ]);

        const dogRes = dogSettled.status === 'fulfilled' ? dogSettled.value : null;
        const catRes = catSettled.status === 'fulfilled' ? catSettled.value : null;

        const dogJson = dogRes ? await dogRes.json().catch(() => ({})) : {};
        const catJson = catRes ? await catRes.json().catch(() => ({})) : {};

        const dogErr = String(dogJson?.error || '').toLowerCase();
        const catErr = String(catJson?.error || '').toLowerCase();

        // 1. Human detection check
        if (dogErr.includes('human detected') || catErr.includes('human detected')) {
          setPetFrameValid(false);
          setCameraAlert({ type: 'human', text: 'Human detected — this system is for dogs and cats only.' });
          return;
        }

        // 2. Evaluate species signals & ROI bounding box
        const catRoiMode = catJson?.preprocessing?.mode;
        const dogRoiMode = dogJson?.preprocessing?.mode;
        const catRoiConf = Number(catJson?.preprocessing?.confidence || 0);
        const dogRoiConf = Number(dogJson?.preprocessing?.confidence || 0);

        const activeRoi =
          catRoiMode === 'roi' && (dogRoiMode !== 'roi' || catRoiConf >= dogRoiConf)
            ? catJson.preprocessing
            : dogRoiMode === 'roi'
            ? dogJson.preprocessing
            : null;

        if (activeRoi?.box && activeRoi?.frame_size) {
          setRoiBox({ box: activeRoi.box, frameSize: activeRoi.frame_size });
        } else {
          setRoiBox(null);
        }

        const isCatDetected =
          dogErr.includes('cat image detected') ||
          catErr.includes('use the cat facial') ||
          (catRoiMode === 'roi' && dogRoiMode !== 'roi') ||
          (catRoiMode === 'roi' && catRoiConf > dogRoiConf + 0.05);

        const isDogDetected =
          catErr.includes('dog image detected') ||
          dogErr.includes('use the dog') ||
          (dogRoiMode === 'roi' && catRoiMode !== 'roi') ||
          (dogRoiMode === 'roi' && dogRoiConf > catRoiConf + 0.05);

        // 3. Species validation in Register mode
        if (flowMode === 'register' && selectedPet) {
          if (isDogPet(selectedPet) && isCatDetected) {
            setPetFrameValid(false);
            setCameraAlert({ type: 'species', text: 'This looks like a cat — the selected pet is a dog.' });
            return;
          }
          if (isCatPet(selectedPet) && isDogDetected) {
            setPetFrameValid(false);
            setCameraAlert({ type: 'species', text: 'This looks like a dog — the selected pet is a cat.' });
            return;
          }
        }

        // 4. Species setting in Identify mode
        if (flowMode === 'identify') {
          const nonPetMarkers = ['human detected', 'roi detection failed', 'roi detection required', 'species ambiguous'];
          const dogNonPet = nonPetMarkers.some((marker) => dogErr.includes(marker));
          const catNonPet = nonPetMarkers.some((marker) => catErr.includes(marker));

          if (dogNonPet && catNonPet && !dogJson?.best_match && !catJson?.best_match) {
            setPetFrameValid(false);
            setCameraAlert({ type: 'human', text: 'No dog/cat detected — align the pet in the frame.' });
            return;
          }

          if (isCatDetected) {
            setDetectedSpecies('cat');
          } else if (isDogDetected) {
            setDetectedSpecies('dog');
          } else if (catJson?.best_match && !dogJson?.best_match) {
            setDetectedSpecies('cat');
          } else if (dogJson?.best_match && !catJson?.best_match) {
            setDetectedSpecies('dog');
          }
        }

        setPetFrameValid(true);
      } catch { /* engines offline — skip */ } finally {
        autoCheckLockRef.current = false;
      }
    };
    runAutoCheck();
    autoCheckTimerRef.current = setInterval(runAutoCheck, 350);
    return () => clearInterval(autoCheckTimerRef.current);
  }, [isScanning, cameraAlert, enrollStatus, flowMode, selectedPet, cameraMirrored]);

  const snapshotBlob = async () => {
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    drawCenterCropToCanvas(video, canvas, CAPTURE_SIZE, cameraMirrored);
    return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.98));
  };

  const postEnroll = async (engineUrl, petId, blob) => {
    const form = new FormData();
    form.append('file', blob, 'capture.jpg');
    form.append('name', petId);
    form.append('pet_id', petId);
    try {
      const res = await fetch(buildEngineEndpoint(engineUrl, 'reg'), { method: 'POST', body: form });
      return await res.json().catch(() => ({ error: `Enroll HTTP ${res.status}` }));
    } catch {
      return { error: 'Enrollment engine unavailable. Please make sure the pet engine is running.' };
    }
  };

  const postScan = async (engineUrl, blob) => {
    const form = new FormData();
    form.append('file', blob, 'capture.jpg');
    try {
      const res = await fetch(buildEngineEndpoint(engineUrl, 'scanning'), { method: 'POST', body: form });
      return { ok: res.ok, data: await res.json().catch(() => ({ error: `Scan HTTP ${res.status}` })) };
    } catch {
      return { ok: false, data: { error: 'Scan engine unavailable. Please make sure the pet engine is running.' } };
    }
  };

  const persistRecognitionPhoto = useCallback(async (petId, blob) => {
    const form = new FormData();
    form.append('image', blob, `recognition-${petId || 'pet'}.jpg`);
    const response = await apiFetch(`/api/pets/${petId}/recognition-photo`, {
      method: 'POST',
      body: form,
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      throw new Error(payload?.message || 'Recognition matched, but the photo could not be saved.');
    }
    return response.json().catch(() => ({}));
  }, []);

  const waitMs = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const enqueueRecognitionSync = useCallback((payload) => {
    const queue = readRecognitionSyncQueue();
    queue.push({
      petId: payload.petId,
      identificationHash: payload.identificationHash,
      recognitionRegisteredAt: payload.recognitionRegisteredAt || new Date().toISOString(),
      queuedAt: Date.now(),
    });
    return writeRecognitionSyncQueue(queue);
  }, []);

  const syncRecognitionEnrollWithRetry = useCallback(async ({ petId, identificationHash, blob }) => {
    let lastError = '';
    for (let attempt = 1; attempt <= SYNC_RETRY_ATTEMPTS; attempt += 1) {
      const syncForm = new FormData();
      syncForm.append('identification_hash', identificationHash);
      syncForm.append('recognition_registered', '1');
      syncForm.append('recognition_registered_at', new Date().toISOString());
      syncForm.append('identification_image', blob, `recognition-${petId || 'pet'}.jpg`);

      const syncRes = await apiFetch(`/api/pets/${petId}/recognition-enroll`, {
        method: 'POST',
        body: syncForm,
      });

      if (syncRes.ok) {
        return { ok: true, attempts: attempt };
      }

      const syncJson = await syncRes.json().catch(() => ({}));
      lastError = syncJson?.message || `Sync failed (attempt ${attempt}).`;
      if (attempt < SYNC_RETRY_ATTEMPTS) {
        await waitMs(SYNC_RETRY_DELAY_MS * attempt);
      }
    }
    return { ok: false, error: lastError };
  }, []);

  const preflightCapture = useCallback(async ({ mode, pet }) => {
    const blockingPrecheckTypes = new Set(['human', 'quality', 'position', 'species', 'system']);
    const applyPreflightError = (rawMsg) => {
      const parsed = parseEngineError(rawMsg);
      if (!parsed) return;
      if (blockingPrecheckTypes.has(parsed.type)) {
        setCameraAlert(parsed);
        setError('');
      } else {
        setError(parsed.text);
        setCameraAlert(null);
      }
    };

    if (quality < 20 || centerScore < 14 || brightness < 25 || brightness > 235 || !frameStable) {
      setCameraAlert({ type: 'quality', text: 'Playful pet motion detected. Gently hold pet steady for clear capture.' });
    }

    const blob = await snapshotBlob();

    if (mode === 'register' && pet) {
      return { ok: true, blob };
    }

    let check = await postScan(DOG_URL, blob).catch(() => ({ ok: false, data: {} }));
    if (!check.ok && !check?.data) {
      check = await postScan(CAT_URL, blob).catch(() => ({ ok: false, data: {} }));
    }
    const raw = String(check?.data?.error || '').toLowerCase();
    if (raw.includes('human detected')) {
      applyPreflightError('Human detected. This system is for dogs and cats only.');
      return { ok: false, blob: null };
    }

    return { ok: true, blob };
  }, [quality, centerScore, brightness, frameStable, snapshotBlob]);

  const lookupPetById = useCallback(async (petIdOrName) => {
    const rawStr = String(petIdOrName || '').trim();
    if (!rawStr) return null;
    const cached = getCachedPet(rawStr);
    if (cached) return cached;

    const normalized = normalizePetId(rawStr);
    const queryLower = rawStr.toLowerCase();

    // Check cached list
    const cachedAll = getCachedAllPets();
    if (cachedAll) {
      const match = cachedAll.find(
        (r) => normalizePetId(r?.pet_id) === normalized || String(r?.name || '').trim().toLowerCase() === queryLower
      );
      if (match) {
        cachePetRecord(match);
        return match;
      }
    }

    try {
      const res = await apiGet(`/api/pets?search=${encodeURIComponent(rawStr)}&per_page=50`);
      const json = await res.json().catch(() => ({}));
      const rows = extractArray(json);
      rows.forEach(cachePetRecord);
      let match = rows.find((r) => normalizePetId(r?.pet_id) === normalized);
      if (match) return match;
      match = rows.find((r) => String(r?.name || '').trim().toLowerCase() === queryLower);
      if (match) return match;
    } catch { /* fallback below */ }

    try {
      const res = await apiGet('/api/pets?per_page=200');
      const json = await res.json().catch(() => ({}));
      const rows = extractArray(json);
      cachePetList(rows);
      let match = rows.find((r) => normalizePetId(r?.pet_id) === normalized);
      if (match) return match;
      return rows.find((r) => String(r?.name || '').trim().toLowerCase() === queryLower) || null;
    } catch {
      return null;
    }
  }, []);

  const findPetByIdentificationHash = useCallback(async (hashHex) => {
    const hash = String(hashHex || '').trim().toLowerCase();
    if (!hash) return null;
    const cachedAll = getCachedAllPets();
    if (cachedAll) {
      const match = cachedAll.find((r) => String(r?.identification_hash || '').trim().toLowerCase() === hash);
      if (match) return match;
    }
    const res = await apiGet('/api/pets?per_page=200');
    const json = await res.json().catch(() => ({}));
    const rows = extractArray(json);
    cachePetList(rows);
    return rows.find((r) => String(r?.identification_hash || '').trim().toLowerCase() === hash) || null;
  }, []);

  const withLock = useCallback(async (fn) => {
    if (scanningLockRef.current || !videoRef.current) return;
    const now = Date.now();
    if (now - lastActionAtRef.current < CAPTURE_ACTION_COOLDOWN_MS) return;
    lastActionAtRef.current = now;
    scanningLockRef.current = true;
    setIsCapturing(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e?.message || 'Operation failed.');
    } finally {
      scanningLockRef.current = false;
      setIsCapturing(false);
    }
  }, []);

  const handleEngineError = (rawMsg) => {
    const parsed = parseEngineError(rawMsg);
    if (!parsed) return;
    const cameraTypes = new Set(['human', 'quality', 'position', 'species', 'system']);
    if (cameraTypes.has(parsed.type)) {
      setCameraAlert(parsed);
      setError('');
    } else {
      setError(parsed.text);
      setCameraAlert(null);
    }
  };

  const captureEnroll = useCallback(() =>
    withLock(async () => {
      setEnrollStatus('');
      setError('');
      const petKey = String(selectedPet?.pet_id || '').trim().toLowerCase();
      if (petKey) {
        const now = Date.now();
        const last = petEnrollCooldownRef.current.get(petKey) || 0;
        if (now - last < ENROLL_SAME_PET_COOLDOWN_MS) {
          const waitSec = Math.ceil((ENROLL_SAME_PET_COOLDOWN_MS - (now - last)) / 1000);
          setError(`Enroll already in progress for this pet. Please wait ${waitSec}s before trying again.`);
          return;
        }
        petEnrollCooldownRef.current.set(petKey, now);
      }
      const guard = await preflightCapture({ mode: 'register', pet: selectedPet });
      if (!guard.ok) return;
      const blob = guard.blob;
      const url = isCatPet(selectedPet) ? CAT_URL : DOG_URL;

      const captureHash = await toSha256Hex(blob);
      const existingByHash = await findPetByIdentificationHash(captureHash).catch(() => null);
      if (existingByHash && normalizePetId(existingByHash?.pet_id) !== normalizePetId(selectedPet?.pet_id)) {
        setCameraAlert({
          type: 'system',
          text: `This capture is already enrolled under ${existingByHash?.pet_id || 'another pet'}.`,
        });
        setError(`Duplicate protection: this image already belongs to ${existingByHash?.pet_id || 'another pet'}.`);
        return;
      }

      const duplicateCheck = await postScan(url, blob);
      const dupErr = String(duplicateCheck?.data?.error || '').toLowerCase();
      const best = duplicateCheck?.data?.best_match;
      const bestId = String(best?.name || '').trim();
      const bestScore = Number(best?.similarity_score || 0);
      const selectedIdNorm = normalizePetId(selectedPet?.pet_id);
      const bestIdNorm = normalizePetId(bestId);
      const noRegistryYet =
        dupErr.includes('no dogs registered') ||
        dupErr.includes('no cats registered') ||
        dupErr.includes('no pets enrolled');
      if (!noRegistryYet && bestIdNorm && selectedIdNorm && bestIdNorm !== selectedIdNorm && bestScore >= ENROLL_DUPLICATE_BLOCK_THRESHOLD) {
        setCameraAlert({ type: 'system', text: `This looks like an already enrolled pet (${bestId}). Please select the correct pet profile.` });
        setError(`Duplicate protection: matched ${bestId} at ${(bestScore * 100).toFixed(1)}%. Enrollment blocked.`);
        return;
      }

      const result = await postEnroll(url, selectedPet.pet_id, blob);
      if (result?.error) handleEngineError(result.error);
      else {
        let syncError = '';
        let photoError = '';
        const identificationHash = captureHash;
        if (selectedPet?.id) {
          const registeredAt = new Date().toISOString();
          const syncState = await syncRecognitionEnrollWithRetry({
            petId: selectedPet.id,
            identificationHash,
            blob,
          });
          if (!syncState.ok) {
            const queuedForRetry = enqueueRecognitionSync({
              petId: selectedPet.id,
              identificationHash,
              recognitionRegisteredAt: registeredAt,
            });
            syncError = queuedForRetry
              ? `${syncState.error || 'Profile sync failed.'} Retry data was saved for this browser.`
              : 'Profile sync failed and could not be saved for retry because browser storage is full or unavailable. Please retry the profile sync before closing this page.';
          }

          // Keep enrollment captures in the persistent recognition gallery.
          // The backend selects local or Supabase storage by environment.
          try {
            await persistRecognitionPhoto(selectedPet.id, blob);
          } catch (photoSaveError) {
            photoError = photoSaveError?.message || 'Enrollment saved, but the recognition photo could not be stored.';
          }
        }
        setCameraAlert(null);
        setError([syncError, photoError].filter(Boolean).join(' '));
        setEnrollStatus(
          syncError || photoError
            ? `Enrolled ${selectedPet.pet_id}, but some profile data is still syncing.`
            : `Enrolled ${selectedPet.pet_id} successfully.`
        );
      }
    }), [withLock, selectedPet, preflightCapture, findPetByIdentificationHash, syncRecognitionEnrollWithRetry, enqueueRecognitionSync, persistRecognitionPhoto]);

  const captureVerify = useCallback(() =>
    withLock(async () => {
      setVerifyStatus('');
      const guard = await preflightCapture({ mode: 'register', pet: selectedPet });
      if (!guard.ok) return;
      const blob = guard.blob;
      const url = isCatPet(selectedPet) ? CAT_URL : DOG_URL;
      const scan = await postScan(url, blob);
      if (!scan.ok || scan?.data?.error) {
        handleEngineError(scan?.data?.error || 'Verification failed.');
      } else {
        const foundId = String(scan?.data?.best_match?.name || '').trim();
        if (normalizePetId(foundId) === normalizePetId(selectedPet.pet_id))
          setVerifyStatus(`Verified: ${selectedPet.pet_id} matched.`);
        else setVerifyStatus(`Not matched. Detected: ${foundId || 'unknown'}`);
      }
    }), [withLock, selectedPet, preflightCapture]);

  const captureIdentify = useCallback(() =>
    withLock(async () => {
      setBioResult(null);
      setMatchedPet(null);
      const guard = await preflightCapture({ mode: 'identify' });
      if (!guard.ok) return;
      const blob = guard.blob;

      const [dogSettled, catSettled] = await Promise.allSettled([
        postScan(DOG_URL, blob),
        postScan(CAT_URL, blob),
      ]);

      const dogRes = dogSettled.status === 'fulfilled' ? dogSettled.value : { ok: false, data: {} };
      const catRes = catSettled.status === 'fulfilled' ? catSettled.value : { ok: false, data: {} };

      const dogErr = String(dogRes?.data?.error || '').toLowerCase();
      const catErr = String(catRes?.data?.error || '').toLowerCase();

      const dogRejectedAsCat = dogErr.includes('cat image detected');
      const catRejectedAsDog = catErr.includes('dog image detected');

      const isCatActive = detectedSpecies === 'cat' || dogRejectedAsCat;
      const isDogActive = detectedSpecies === 'dog' || catRejectedAsDog;

      // Evaluate candidate matches
      const dogScore = Number(dogRes?.data?.best_match?.similarity_score || 0);
      const catScore = Number(catRes?.data?.best_match?.similarity_score || 0);
      const dogThreshold = Number(dogRes?.data?.threshold);
      const catThreshold = Number(catRes?.data?.threshold);

      const dogOk =
        dogRes.ok &&
        Number.isFinite(dogThreshold) &&
        !dogRes.data?.error &&
        dogRes.data?.best_match?.name &&
        dogScore >= dogThreshold;

      const catOk =
        catRes.ok &&
        Number.isFinite(catThreshold) &&
        !catRes.data?.error &&
        catRes.data?.best_match?.name &&
        catScore >= catThreshold;

      let winner = null;
      if (dogOk && catOk) {
        const scoreGap = Math.abs(dogScore - catScore);
        if (scoreGap < IDENTIFY_AMBIGUITY_MARGIN) {
          setError(
            `Ambiguous match detected (dog ${(dogScore * 100).toFixed(1)}% vs cat ${(catScore * 100).toFixed(1)}%). Please recapture with clearer framing.`
          );
          setCameraAlert({ type: 'position', text: 'Possible similar match — recapture from a clearer frontal angle.' });
          return;
        }
        winner = dogScore >= catScore ? dogRes.data : catRes.data;
      } else if (dogOk) {
        winner = dogRes.data;
      } else if (catOk) {
        winner = catRes.data;
      }

      if (!winner) {
        const bothDown = dogSettled.status === 'rejected' && catSettled.status === 'rejected';
        if (bothDown) {
          setError('Recognition engines are offline.');
          return;
        }
        if (isHumanErrorMessage(dogErr) || isHumanErrorMessage(catErr)) {
          handleEngineError(dogErr || catErr);
          return;
        }

        const activeTargetErr = isCatActive ? catErr : isDogActive ? dogErr : (dogErr || catErr);
        if (activeTargetErr && !activeTargetErr.includes('no dogs registered') && !activeTargetErr.includes('no cats registered')) {
          handleEngineError(activeTargetErr);
          return;
        }

        const activeScore = isCatActive ? catScore : isDogActive ? dogScore : Math.max(dogScore, catScore);
        const observedThreshold = Number(
          isCatActive ? catRes?.data?.threshold : isDogActive ? dogRes?.data?.threshold : (dogRes?.data?.threshold ?? catRes?.data?.threshold)
        );
        const scoreHint = Number.isFinite(observedThreshold)
          ? (activeScore > 0 ? `Top score: ${(activeScore * 100).toFixed(1)}% (threshold ${(observedThreshold * 100).toFixed(0)}%).` : `(threshold ${(observedThreshold * 100).toFixed(0)}%).`)
          : 'The recognition engine did not return a valid threshold.';
        setError(`No confident match found. ${scoreHint}`);
        return;
      }
      setBioResult(winner);
      const pet = await lookupPetById(winner.best_match.name);
      if (pet) {
        try {
          await persistRecognitionPhoto(pet.id, blob);
        } catch (photoError) {
          setError(photoError.message || 'Recognition matched, but the photo could not be saved.');
        }
        setMatchedPet(pet);
        stopCamera();
        if (typeof onIdentifySuccess === 'function') {
          onIdentifySuccess(pet);
        }
      }
      else setError(`Matched "${winner.best_match.name}" but pet record not found.`);
    }), [withLock, lookupPetById, persistRecognitionPhoto, preflightCapture, stopCamera, onIdentifySuccess, detectedSpecies]);

  // Auto-capture: fires after quality reaches threshold
  useEffect(() => {
    if (!isScanning || isCapturing || cameraAlert || autoCaptureFiredRef.current) {
      setAutoCapturePending(false);
      return;
    }
    const minCleanFrames = 1;
    if (dismissCooldown || cleanFrameCount < minCleanFrames) {
      setAutoCapturePending(false);
      return;
    }
    if (quality < AUTO_SCAN_THRESHOLD) {
      setAutoCapturePending(false);
      return;
    }
    setAutoCapturePending(true);
    const timer = setTimeout(() => {
      if (autoCaptureFiredRef.current || scanningLockRef.current) return;
      autoCaptureFiredRef.current = true;
      setAutoCapturePending(false);
      if (flowMode === 'register') captureEnroll();
      else if (flowMode === 'identify') captureIdentify();
    }, 600);
    return () => {
      clearTimeout(timer);
      setAutoCapturePending(false);
    };
  }, [quality, isScanning, isCapturing, cameraAlert, dismissCooldown, cleanFrameCount, flowMode, captureEnroll, captureIdentify]);

  const dismissCameraAlert = useCallback(() => {
    setCameraAlert(null);
    setDismissCooldown(true);
    setCleanFrameCount(0);
    clearTimeout(dismissCooldownTimerRef.current);
    dismissCooldownTimerRef.current = setTimeout(() => {
      setDismissCooldown(false);
    }, 1000);
  }, []);

  const resetResults = useCallback(() => {
    setBioResult(null);
    setMatchedPet(null);
    setEnrollStatus('');
    setVerifyStatus('');
    setError('');
    setCameraAlert(null);
    setDismissCooldown(false);
    setCleanFrameCount(0);
    setAutoCapturePending(false);
    autoCaptureFiredRef.current = false;
  }, []);

  return {
    videoRef,
    isScanning,
    startCamera,
    stopCamera,
    quality,
    brightness,
    centerScore,
    frameStable,
    isCapturing,
    error,
    setError,
    cameraAlert,
    setCameraAlert,
    dismissCameraAlert,
    petFrameValid,
    detectedSpecies,
    roiBox,
    enrollStatus,
    verifyStatus,
    bioResult,
    matchedPet,
    setMatchedPet,
    autoCapturePending,
    cameraMirrored,
    dismissCooldown,
    cleanFrameCount,
    captureEnroll,
    captureVerify,
    captureIdentify,
    resetResults,
  };
}
