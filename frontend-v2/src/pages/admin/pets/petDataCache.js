// Memory cache for pet records to eliminate redundant network calls and accelerate lookup speeds.
const CACHE_TTL_MS = 30000; // 30 seconds TTL

const petCacheMap = new Map();
let allPetsCache = null;
let allPetsFetchedAt = 0;

export const clearPetCache = () => {
  petCacheMap.clear();
  allPetsCache = null;
  allPetsFetchedAt = 0;
};

export const cachePetRecord = (pet) => {
  if (!pet || typeof pet !== 'object') return;
  if (pet.id) petCacheMap.set(String(pet.id), pet);
  if (pet.pet_id) petCacheMap.set(String(pet.pet_id).toLowerCase(), pet);
  if (pet.name) petCacheMap.set(String(pet.name).toLowerCase(), pet);
};

export const cachePetList = (pets) => {
  if (!Array.isArray(pets)) return;
  allPetsCache = pets;
  allPetsFetchedAt = Date.now();
  pets.forEach(cachePetRecord);
};

export const getCachedPet = (key) => {
  if (!key) return null;
  const str = String(key).trim().toLowerCase();
  if (petCacheMap.has(str)) return petCacheMap.get(str);
  if (petCacheMap.has(String(key))) return petCacheMap.get(String(key));
  return null;
};

export const getCachedAllPets = () => {
  if (allPetsCache && Date.now() - allPetsFetchedAt < CACHE_TTL_MS) {
    return allPetsCache;
  }
  return null;
};
