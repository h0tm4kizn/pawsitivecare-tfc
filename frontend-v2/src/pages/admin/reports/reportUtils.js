export const formatOwnerPets = (owner) => {
  const pets = Array.isArray(owner?.pets) ? owner.pets : [];
  return (
    pets
      .map((pet) => pet.name || pet.pet_id)
      .filter(Boolean)
      .join(", ") || "—"
  );
};

// A customer-entered breed is saved in medical_notes as "Other Breed: …".
// Keep it visible in reports instead of grouping every custom breed under the
// generic reference option, "Other (Please Specify)".
export const formatReportBreed = (pet) => {
  const breed = String(
    pet?.breed?.name || pet?.breed_name || pet?.breed || "",
  ).trim();
  const isOtherBreed = /^(other|others)(\s*\(please specify\))?$/i.test(breed);
  if (!isOtherBreed) return breed || "Unknown";

  const match = String(pet?.medical_notes || "").match(
    /^Other Breed:\s*(.+?)\s*$/im,
  );
  const customBreed = match?.[1]?.trim();
  return customBreed ? `Others: ${customBreed}` : "Others";
};

export const getSpeciesSortRank = (species) => {
  const normalized = String(species || "").toLowerCase();
  if (normalized === "dog") return 1;
  if (normalized === "cat") return 2;
  return 3;
};

export const buildBreedBreakdownRows = (pets) => {
  const counts = {};
  (pets || []).forEach((pet) => {
    const species =
      pet?.species_type?.name || pet?.speciesType?.name || "Unknown";
    const breed = formatReportBreed(pet);
    const key = `${species}|${breed}`;
    counts[key] ||= { species, breed, count: 0 };
    counts[key].count += 1;
  });

  return Object.values(counts)
    .sort((a, b) => {
      const speciesOrder =
        getSpeciesSortRank(a.species) - getSpeciesSortRank(b.species);
      if (speciesOrder !== 0) return speciesOrder;
      if (b.count !== a.count) return b.count - a.count;
      return a.breed.localeCompare(b.breed);
    })
    .map(({ species, breed, count }) => [species, breed, count]);
};

export const getPetIdentifier = (pet) => pet?.pet_id || "";

export const formatPetWithId = (pet) => {
  const name = pet?.name || "-";
  const identifier = getPetIdentifier(pet);
  return identifier ? `${identifier} - ${name}` : name;
};

export const getWeekOfMonthLabel = (date) => {
  const day = new Date(`${date}T00:00:00`).getDate();
  return `Week ${Math.min(4, Math.max(1, Math.ceil(day / 7)))}`;
};

export const formatTime12h = (time) => {
  if (!time) return "";
  const [hours, minutes] = String(time).split(":");
  const hour = parseInt(hours, 10);
  if (Number.isNaN(hour)) return time;
  return `${hour % 12 || 12}:${minutes || "00"} ${hour >= 12 ? "PM" : "AM"}`;
};

export const formatServiceCategory = (category) => {
  const normalized = String(category || "").trim();
  if (!normalized) return "Uncategorized";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};
