import { normalizeBreedName } from '../../../../utils/textUtils';
import { removeDisposableApiCache, safeStorageGet, safeStorageSet } from '../../../../utils/browserStorage';

export const DOG_URL = import.meta.env.VITE_PET_ID_DOG_URL || '/dog-api';
export const CAT_URL = import.meta.env.VITE_PET_ID_CAT_URL || '/cat-api';
export const QUALITY_INTERVAL_MS = 300;
export const AUTO_SCAN_THRESHOLD = 75;
export const CAPTURE_SIZE = 224;
export const MIN_CENTER_SCORE = 22;
export const MIN_BRIGHTNESS = 40;
export const MAX_BRIGHTNESS = 220;
export const CAMERA_MIRROR_MODE = String(import.meta.env.VITE_PET_ID_CAMERA_MIRRORED ?? 'auto').toLowerCase();
export const CAMERA_FACING_MODE = import.meta.env.VITE_PET_ID_CAMERA_FACING_MODE || 'environment';
export const CAPTURE_ACTION_COOLDOWN_MS = 1200;
export const SYNC_RETRY_ATTEMPTS = 3;
export const SYNC_RETRY_DELAY_MS = 450;
export const ENROLL_SAME_PET_COOLDOWN_MS = 5000;
export const ENROLL_DUPLICATE_BLOCK_THRESHOLD = 0.85;
export const IDENTIFY_AMBIGUITY_MARGIN = 0.03;
export const RECOGNITION_SYNC_QUEUE_KEY = 'pet_recognition_sync_queue_v1';
let volatileRecognitionQueue = [];

export const normalizeEngineBaseUrl = (rawUrl) => {
  const trimmed = String(rawUrl || '').trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  const isAbsolute = /^https?:\/\//i.test(trimmed);
  if (!isAbsolute) return trimmed;
  return trimmed.replace(/\/(dog-api|cat-api)$/i, '');
};

export const buildEngineEndpoint = (engineUrl, path) => {
  const base = normalizeEngineBaseUrl(engineUrl);
  return `${base}/${String(path || '').replace(/^\/+/, '')}`;
};

export const readRecognitionSyncQueue = () => {
  if (typeof window === 'undefined') return [];
  try {
    const raw = safeStorageGet(window.localStorage, RECOGNITION_SYNC_QUEUE_KEY);
    if (!raw) return volatileRecognitionQueue;
    const parsed = JSON.parse(raw);
    volatileRecognitionQueue = Array.isArray(parsed) ? parsed : [];
    return volatileRecognitionQueue;
  } catch {
    return volatileRecognitionQueue;
  }
};

export const writeRecognitionSyncQueue = (queue) => {
  volatileRecognitionQueue = Array.isArray(queue) ? queue : [];
  if (typeof window === 'undefined') return false;
  const serialized = JSON.stringify(volatileRecognitionQueue);
  if (safeStorageSet(window.localStorage, RECOGNITION_SYNC_QUEUE_KEY, serialized)) return true;
  removeDisposableApiCache();
  return safeStorageSet(window.localStorage, RECOGNITION_SYNC_QUEUE_KEY, serialized);
};

export const tuneVideoTrackForPets = async (stream) => {
  try {
    const [track] = stream?.getVideoTracks?.() || [];
    if (!track || typeof track.getCapabilities !== 'function') return;
    const caps = track.getCapabilities();
    const advanced = [];

    if (Array.isArray(caps.focusMode) && caps.focusMode.includes('continuous')) {
      advanced.push({ focusMode: 'continuous' });
    }
    if (Array.isArray(caps.exposureMode) && caps.exposureMode.includes('continuous')) {
      advanced.push({ exposureMode: 'continuous' });
    }
    if (Array.isArray(caps.whiteBalanceMode) && caps.whiteBalanceMode.includes('continuous')) {
      advanced.push({ whiteBalanceMode: 'continuous' });
    }

    const nextConstraints = {
      advanced,
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30, max: 30 },
    };

    if (advanced.length > 0 || caps.frameRate) {
      await track.applyConstraints(nextConstraints);
    }
  } catch {
    // Best effort only
  }
};

export const extractArray = (data) => {
  if (Array.isArray(data?.data?.pets)) return data.data.pets;
  if (Array.isArray(data?.data?.owners)) return data.data.owners;
  if (Array.isArray(data?.pets)) return data.pets;
  if (Array.isArray(data?.owners)) return data.owners;
  if (Array.isArray(data?.data?.data)) return data.data.data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data)) return data;
  return [];
};

export const normalizePetId = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
export const isLikelyPetIdQuery = (value) => /^(dog|cat)?\d{2,}$/i.test(String(value || '').replace(/[^a-z0-9]/gi, ''));

export const ownerName = (owner) =>
  `${owner?.first_name || ''} ${owner?.last_name || ''}`.trim() || owner?.name || owner?.email || 'Owner';

export const petSpecies = (pet) => String(pet?.species_type?.name || pet?.species || '').toLowerCase();

export const rankManualPetResults = (query, pets = []) => {
  const rawQ = String(query || '').trim().toLowerCase();
  const qId = normalizePetId(query);
  if (!rawQ) return [];

  const scored = (Array.isArray(pets) ? pets : []).map((pet) => {
    const pid = normalizePetId(pet?.pet_id);
    const name = String(pet?.name || '').toLowerCase();
    const owner = String(ownerName(pet?.owner) || '').toLowerCase();
    const breed = String(normalizeBreedName(pet?.breed?.name || pet?.breed || '', pet)).toLowerCase();
    let score = 0;

    if (pid && qId && pid === qId) score += 100;
    else if (pid && qId && pid.startsWith(qId)) score += 60;
    else if (pid && qId && pid.includes(qId)) score += 40;

    if (name.includes(rawQ)) score += 50;
    if (owner.includes(rawQ)) score += 30;
    if (breed.includes(rawQ)) score += 20;

    return { pet, score: score || 1 };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.map((row) => row.pet).slice(0, 8);
};

export const toSha256Hex = async (blob) => {
  const buffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
};

export const parseEngineError = (raw) => {
  if (!raw) return null;
  const msg = String(raw).toLowerCase();

  if (msg.includes('human detected'))
    return { type: 'human', text: 'Human detected — this system is for dogs and cats only.' };

  if (msg.includes('image quality too low') || msg.includes('quality too low')) {
    const reasons = [];
    if (msg.includes('blurr')) reasons.push('image is blurry — hold the camera steady');
    if (msg.includes('low contrast')) reasons.push('low contrast — improve lighting');
    if (msg.includes('overexposed')) reasons.push('overexposed — reduce glare or direct light');
    if (msg.includes('underexposed') || msg.includes('too dark')) reasons.push('too dark — move to better lighting');
    if (msg.includes('low detail') || msg.includes('insufficient edges')) reasons.push('too far — get closer');
    const detail = reasons.length > 0 ? reasons.join(', ') : 'poor image quality';
    return { type: 'quality', text: `Image quality too low: ${detail}.` };
  }

  if (msg.includes('roi_not_detected') || msg.includes('roi detection failed') || msg.includes('roi required') || msg.includes('roi detection required'))
    return { type: 'position', text: 'Nose / face not detected — get closer and align in the frame.' };

  if (msg.includes('cat image detected') || msg.includes('use the cat facial'))
    return { type: 'species', text: 'A cat was detected — this pet is enrolled under the dog engine. Check species.' };

  if (msg.includes('dog image detected') || msg.includes('use the dog'))
    return { type: 'species', text: 'A dog was detected — this pet is enrolled under the cat engine. Check species.' };

  if (msg.includes('species ambiguous') || msg.includes('current angle'))
    return { type: 'position', text: 'Species is unclear at this angle. Re-capture from a clearer frontal pet view.' };

  if (msg.includes('no dogs registered') || msg.includes('no cats registered'))
    return { type: 'empty', text: 'No pets enrolled yet — register a pet first.' };

  if (msg.includes('embedding dimension mismatch'))
    return { type: 'system', text: 'Engine model was updated — all pets need to be re-enrolled.' };
  if (msg.includes('older model signature') || msg.includes('re-enroll pets to refresh embeddings'))
    return { type: 'system', text: 'Model updated — this pet must be re-enrolled before identification.' };
  if (msg.includes('ambiguous match detected') || msg.includes('top1-top2 margin'))
    return { type: 'nomatch', text: 'Possible match conflict — another pet looks similar. Capture again with better framing.' };
  if (msg.includes('distance check failed') || msg.includes('low confidence distance'))
    return { type: 'nomatch', text: 'Match confidence is weak. Capture again with better lighting and framing.' };

  if (msg.includes('no match found') || msg.includes('not found'))
    return { type: 'nomatch', text: 'No matching pet found.' };

  const cleaned = raw.replace(/\(Laplacian:.*?\)/gi, '').replace(/\(threshold:.*?\)/gi, '').replace(/\s{2,}/g, ' ').trim();
  return { type: 'generic', text: cleaned };
};

export const isSpeciesErrorMessage = (raw) => {
  const msg = String(raw || '').toLowerCase();
  return (
    msg.includes('cat image detected') ||
    msg.includes('dog image detected') ||
    msg.includes('use the cat facial') ||
    msg.includes('use the dog')
  );
};

export const isHumanErrorMessage = (raw) => String(raw || '').toLowerCase().includes('human detected');

export const isCatPet = (pet) => {
  const name = petSpecies(pet);
  const code = String(pet?.species_type?.code || '').toLowerCase();
  return name.includes('cat') || name.includes('feline') || code.includes('cat') || code.includes('feline');
};

export const isDogPet = (pet) => {
  const name = petSpecies(pet);
  const code = String(pet?.species_type?.code || '').toLowerCase();
  return name.includes('dog') || name.includes('canine') || code.includes('dog') || code.includes('canine');
};

export function analyzeFrame(videoEl) {
  try {
    const W = 224;
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = W;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(videoEl, 0, 0, W, W);
    const { data } = ctx.getImageData(0, 0, W, W);
    const gray = new Float32Array(W * W);
    let brightnessSum = 0;
    for (let i = 0, j = 0; i < data.length; i += 4, j++) {
      const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      gray[j] = g;
      brightnessSum += g;
    }
    const brightness = brightnessSum / (W * W);
    let sum = 0;
    let sumSq = 0;
    const n = (W - 2) * (W - 2);
    for (let y = 1; y < W - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const idx = y * W + x;
        const lap = gray[idx - W] + gray[idx + W] + gray[idx - 1] + gray[idx + 1] - 4 * gray[idx];
        sum += lap;
        sumSq += lap * lap;
      }
    }
    const mean = sum / n;
    const laplacianVar = sumSq / n - mean * mean;
    const quality = Math.min(100, Math.round(laplacianVar / 5));

    const cx0 = Math.floor(W * 0.28);
    const cx1 = Math.floor(W * 0.72);
    const cy0 = Math.floor(W * 0.28);
    const cy1 = Math.floor(W * 0.72);
    const gradThr = 12;
    let texAll = 0;
    let texCenter = 0;
    for (let y = 1; y < W - 1; y++) {
      for (let x = 1; x < W - 1; x++) {
        const idx = y * W + x;
        const gx = Math.abs(gray[idx + 1] - gray[idx - 1]);
        const gy = Math.abs(gray[idx + W] - gray[idx - W]);
        const g = gx + gy;
        if (g > gradThr) {
          texAll += 1;
          if (x >= cx0 && x <= cx1 && y >= cy0 && y <= cy1) texCenter += 1;
        }
      }
    }
    const centerScore = texAll > 0 ? Math.round((texCenter / texAll) * 100) : 0;
    return { quality, brightness, centerScore };
  } catch {
    return { quality: 0, brightness: 128, centerScore: 0 };
  }
}

export function drawCenterCropToCanvas(videoEl, canvas, outSize = CAPTURE_SIZE, mirrored = false) {
  const vw = videoEl.videoWidth || videoEl.clientHeight || videoEl.clientWidth;
  const vh = videoEl.videoHeight || videoEl.clientHeight;
  const side = Math.min(vw, vh);
  const sx = (vw - side) / 2;
  const sy = (vh - side) / 2;
  const ctx = canvas.getContext('2d');
  canvas.width = outSize;
  canvas.height = outSize;
  ctx.save();
  if (mirrored) {
    ctx.translate(outSize, 0);
    ctx.scale(-1, 1);
  }
  ctx.drawImage(videoEl, sx, sy, side, side, 0, 0, outSize, outSize);
  ctx.restore();
}

export function getLiveHint(quality, brightness, centerScore, species) {
  if (brightness < 45)  return 'Too dark — move to better lighting';
  if (brightness > 210) return 'Too bright — reduce glare or direct light';
  if (centerScore < 30) return species === 'dog' ? 'Center the dog nose in the frame' : species === 'cat' ? 'Center the cat face in the frame' : 'Center the pet in the frame';
  if (quality < 15)     return 'Playful pet motion — gently hold pet steady';
  if (quality < 40)     return species === 'dog' ? 'Align the dog\'s nose in the frame' : species === 'cat' ? 'Align the cat\'s face in the frame' : 'Align the pet in the frame';
  if (quality < AUTO_SCAN_THRESHOLD) return 'Move the pet a bit closer';
  return null;
}
