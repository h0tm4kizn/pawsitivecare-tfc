export function sanitizeText(input) {
  if (input === null || input === undefined) return input;
  try {
    let s = String(input);
    s = s.replace(/\uFFFD/g, '');
    s = Array.from(s)
      .filter((character) => {
        const code = character.charCodeAt(0);
        return !(code <= 0x1f || (code >= 0x7f && code <= 0x9f));
      })
      .join('');
    s = s.replace(/[\u00A0\s]+/g, ' ').trim();
    s = s.replace(/\s*\(\s*(?:please\s+)?specif(?:y|iy)\s*\)\s*/gi, ' ').trim();
    return s;
  } catch {
    return input;
  }
}

export function getCustomBreedName(pet = {}) {
  if (!pet || typeof pet !== 'object') return '';
  const direct = sanitizeText(
    pet.other_breed ||
    pet.custom_breed ||
    pet.breed_other ||
    pet.otherBreed ||
    pet.customBreed ||
    ''
  );
  if (direct) return String(direct).trim();

  const notes = sanitizeText(pet.medical_notes || pet.notes || '');
  const match = String(notes || '').match(/Other\s+Breed\s*:\s*([^\n;]+)/i);
  return match?.[1] ? sanitizeText(match[1]).trim() : '';
}

export function normalizeBreedName(input, pet = null) {
  const raw = String(input ?? '').trim();
  const cleaned = sanitizeText(raw);
  const custom = getCustomBreedName(pet || {});
  if (cleaned === null || cleaned === undefined || cleaned === '') return custom || cleaned;
  if (/^others?\b/i.test(raw) || /^others?$/i.test(String(cleaned))) return custom || 'Others';
  return String(cleaned).trim();
}

export function formatBreedName(name) {
  const value = sanitizeText(name || '');
  return /^others?\s*(?:\(\s*please specify\s*\))?$/i.test(value) ? 'Others' : value;
}

export function toTitleCase(value) {
  return sanitizeText(value || '')
    .toLocaleLowerCase()
    .replace(/(^|[\s/&(-])([a-z])/g, (_, prefix, letter) => `${prefix}${letter.toLocaleUpperCase()}`);
}

export function formatHotelDescription(value) {
  return toTitleCase(String(value || '').replace(/^\s*[-\u2013\u2014]+\s*/, ''));
}

export function formatAddressFromOwner(owner = {}) {
  if (!owner) return '';
  const addr = sanitizeText(owner.address || owner.street_address || '');
  if (addr) return addr;
  const brgy = sanitizeText(owner.address_barangay || owner.addressBarangay || owner.barangay || '');
  if (brgy) return `Brgy. [${brgy}]`;
  return '';
}

export function truncateAddress(str, max = 30) {
  if (!str) return str;
  return str.length > max ? str.slice(0, max) + '...' : str;
}

export function formatAddressString(raw = '') {
  const s = sanitizeText(raw || '');
  if (!s) return '';
  const lower = s.toLowerCase();
  if (lower.includes('brgy') || lower.includes('barangay')) {
    const m = s.match(/(?:brgy\.?|barangay)\s*[:-]?\s*(.*)/i);
    const name = (m && m[1]) ? m[1].trim() : s;
    return `Brgy. [${name}]`;
  }
  return s;
}
