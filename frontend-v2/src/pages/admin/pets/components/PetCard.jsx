import { speciesColor, speciesInitial, ownerName, titleCasePetName } from '../petUtils';

export default function PetCard({ pet, showOwner = true }) {
  const speciesName = pet?.species_type?.name || '';
  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <div className={`flex h-16 w-16 items-center justify-center rounded-xl text-2xl font-semibold text-white ${speciesColor(speciesName)}`}>
        {pet?.photo_url
          ? <img src={pet.photo_url} alt={titleCasePetName(pet.name)} className="h-full w-full rounded-xl object-cover" />
          : speciesInitial(speciesName)}
      </div>
      <div className="text-center">
        <p className="text-base font-semibold text-brand-dark">{titleCasePetName(pet?.name)}</p>
        {pet?.pet_id && <p className="text-[10px] text-brand-dark-soft">{pet.pet_id}</p>}
        {showOwner && <p className="text-xs text-brand-dark-soft">{ownerName(pet?.owner)}</p>}
      </div>
    </div>
  );
}
