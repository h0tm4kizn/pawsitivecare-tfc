import { AdminSkeleton, AdminLoadState } from '../../../../components/admin/AdminLoading';
import { PawPrint, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import StatusBadge from '../../../../components/StatusBadge';
import SelectDropdown from '../../../../components/reusable-ui/SelectDropdown';
import { formatWeightKg } from '../../../../utils/recordFormatters';
import PetStatBox from '../PetStatBox';
import NewPetsStatBox from '../components/NewPetsStatBox';
import { calcAge, fmtDate, ownerName, titleCasePetName } from '../petUtils';
import useBodyScrollLock from '../../../../hooks/useBodyScrollLock';

export default function PetsPage_MobileView({
  loading = false,
  refreshing = false,
  loadError = '',
  onRetry,
  search = '',
  onSearch,
  typeFilter = 'all',
  onTypeFilter,
  breedFilter = 'all',
  onBreedFilter,
  speciesFilterOptions = [],
  breedFilterOptions = [],
  pets = [],
  rows = [],
  panelPet = null,
  onSelectPet,
  onViewPet,
  onEditPet,
  onPickAction,
  onAddPet,
  onManageBreeds,
  isAdmin = false,
  stats = {},
  totalTiles = [],
  dogTiles = [],
  catTiles = [],
}) {
  useBodyScrollLock(!!panelPet);
  return (
    <section className="space-y-4 px-4 pb-10 pt-5 font-poppins">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold leading-tight text-brand-teal-dark">
            Pet <span className="text-brand-dark">Management</span>
          </h1>
          <p className="mt-0.5 text-xs text-brand-dark-soft">Manage registered pets.</p>
        </div>
        <button
          type="button"
          onClick={onAddPet}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-brand-teal px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-teal-dark"
        >
          <span className="relative inline-flex h-4 w-4 items-center justify-center">
            <PawPrint size={14} strokeWidth={2.4} />
            <Plus size={8} strokeWidth={3} className="absolute -right-1 -top-1 rounded-full bg-brand-teal text-white" />
          </span>
          Register Pet
        </button>
      </div>

      <button
        type="button"
        onClick={onManageBreeds}
        className="w-full rounded-xl border border-brand-teal/35 bg-white px-4 py-2.5 text-xs font-bold text-brand-teal-dark transition-colors hover:bg-brand-teal hover:text-white"
      >
        Manage Breeds
      </button>

      <div className="grid grid-cols-2 gap-3">
        <NewPetsStatBox loading={loading} pets={pets} onView={onViewPet} />
        <PetStatBox loading={loading}
          title="Total Pets"
          value={stats.total ?? pets.length}
          note={`${stats.deactivated ?? 0} deactivated`}
          modalTitle="Total Pets"
          modalSubtitle="All registered pets in the system."
          tiles={totalTiles}
          insight={`The system currently manages ${stats.total ?? 0} pet${(stats.total ?? 0) === 1 ? '' : 's'} across all species.`}
        />
        <PetStatBox loading={loading}
          title="Dogs"
          value={stats.dogs ?? 0}
          note={`${stats.dogBreeds?.length ?? 0} breeds`}
          modalTitle="Dogs"
          modalSubtitle="Canine population breakdown."
          tiles={dogTiles}
          insight={`Dogs represent ${(stats.total ?? 0) ? (((stats.dogs ?? 0) / stats.total) * 100).toFixed(1) : 0}% of all pets.`}
        />
        <PetStatBox loading={loading}
          title="Cats"
          value={stats.cats ?? 0}
          note={`${stats.catBreeds?.length ?? 0} breeds`}
          modalTitle="Cats"
          modalSubtitle="Feline population breakdown."
          tiles={catTiles}
          insight={`Cats represent ${(stats.total ?? 0) ? (((stats.cats ?? 0) / stats.total) * 100).toFixed(1) : 0}% of all pets.`}
        />
      </div>

      <div className="space-y-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-dark-soft/60" />
          <input
            value={search}
            onChange={(event) => onSearch?.(event.target.value)}
            placeholder="Search pet, ID, or owner..."
            className="w-full rounded-xl border border-brand-teal/30 bg-white py-2.5 pl-9 pr-4 text-sm text-brand-dark placeholder:text-brand-dark-soft/50 focus:border-brand-teal focus:outline-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <SelectDropdown
            value={typeFilter}
            onChange={(value) => {
              onTypeFilter?.(value);
              onBreedFilter?.('all');
            }}
            options={speciesFilterOptions}
            className="min-w-0"
          />
          <SelectDropdown
            value={breedFilter}
            disabled={typeFilter === 'all'}
            onChange={onBreedFilter}
            options={breedFilterOptions}
            className="min-w-0"
          />
        </div>
      </div>

      <AdminLoadState loading={refreshing} error={loadError} onRetry={onRetry} />

      <div className="space-y-2">
        {loading ? (
          <AdminSkeleton label="Loading pets" />
        ) : loadError && rows.length === 0 ? null : rows.length === 0 ? (
          <EmptyState text="No pets found." />
        ) : (
          rows.map((pet, index) => (
            <button
              key={pet.id}
              type="button"
              onClick={() => onSelectPet?.(pet)}
              className="w-full rounded-xl border border-brand-dark-light bg-white px-4 py-3 text-left shadow-[0_4px_10px_rgba(23,53,81,0.07)] transition-colors hover:border-brand-teal/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-brand-dark">{titleCasePetName(pet.name)}</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-brand-dark-soft">{pet.pet_id || `P${String(index + 1).padStart(3, '0')}`}</p>
                  <p className="mt-1 truncate text-xs text-brand-dark-soft">{ownerName(pet.owner)}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <StatusBadge active={pet.is_active} />
                  <span className="text-[10px] font-bold uppercase tracking-wide text-brand-teal-dark">
                    {pet.species_type?.name || 'Pet'}
                  </span>
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {panelPet && (
        <div>
          <div className="fixed inset-0 z-[80] bg-black/60" onClick={() => onSelectPet?.(null)} />
          <div className="fixed bottom-0 inset-x-0 z-[85] flex max-h-[92vh] flex-col rounded-t-3xl bg-white shadow-2xl px-4">
            {/* Header */}
            <div className="flex items-center justify-between bg-brand-teal px-5 py-4 -mx-4 shrink-0 rounded-t-3xl">
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-paw text-white text-sm" />
                <h2 className="text-sm font-bold text-white uppercase tracking-widest">Pet Profile</h2>
              </div>
              <button
                type="button"
                onClick={() => onSelectPet?.(null)}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 transition-colors"
                aria-label="Close"
              >
                <X size={15} strokeWidth={2.5} />
              </button>
            </div>
            <div className="h-1 bg-brand-teal-light -mx-4 shrink-0" />

            {/* Scrollable body */}
            <div className="overflow-y-auto no-scrollbar flex-1 py-4">
              {/* Pet photo + name */}
              <div className="flex items-center gap-4 rounded-2xl p-4 border bg-brand-teal-light/30 border-brand-teal/20">
                <div className="w-20 h-20 rounded-xl overflow-hidden shrink-0 border-2 shadow-sm border-brand-teal/30">
                  {panelPet.photo_url ? (
                    <img src={panelPet.photo_url} alt={titleCasePetName(panelPet.name)} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-brand-teal flex items-center justify-center">
                      <span className="text-xl font-semibold text-white">
                        {String(panelPet.name || '?').slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate text-xl font-medium uppercase leading-tight text-brand-dark">
                    {titleCasePetName(panelPet.name)}
                  </p>
                  {panelPet.pet_id && (
                    <p className="text-[11px] font-semibold uppercase tracking-widest mt-1 text-brand-teal">
                      {panelPet.pet_id}
                    </p>
                  )}
                  <p className="text-[10px] mt-1 text-brand-teal-dark/70">
                    {panelPet.species_type?.name || ''}
                    {panelPet.breed?.name ? ` • ${panelPet.breed.name}` : ''}
                  </p>
                </div>
              </div>

              {/* Pet Details */}
              <div className="mt-4 rounded-xl border overflow-hidden border-brand-teal/20">
                <div className="flex items-center justify-between px-4 py-2.5 border-b border-brand-teal/20 bg-brand-teal-light/30">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-teal">Pet Details</span>
                </div>
                <div className="divide-y divide-brand-dark-light/60">
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs font-semibold text-brand-teal">Species</span>
                    <span className="text-xs text-brand-dark font-medium text-right">{panelPet.species_type?.name || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs font-semibold text-brand-teal">Breed</span>
                    <span className="text-xs text-brand-dark font-medium text-right">{panelPet.breed?.name || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs font-semibold text-brand-teal">Sex</span>
                    <span className="text-xs text-brand-dark font-medium text-right">
                      {panelPet.sex ? panelPet.sex.charAt(0).toUpperCase() + panelPet.sex.slice(1) : '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs font-semibold text-brand-teal">Date of Birth</span>
                    <span className="text-xs text-brand-dark font-medium text-right">{fmtDate(panelPet.date_of_birth)}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs font-semibold text-brand-teal">Age</span>
                    <span className="text-xs text-brand-dark font-medium text-right">{calcAge(panelPet.date_of_birth) || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs font-semibold text-brand-teal">Weight</span>
                    <span className="text-xs text-brand-dark font-medium text-right">{formatWeightKg(panelPet.weight_kg)}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-xs font-semibold text-brand-teal">Status</span>
                    <StatusBadge active={panelPet.is_active} />
                  </div>
                </div>
              </div>

              {/* Owner Details */}
              {panelPet.owner && (
                <div className="mt-4 rounded-xl border overflow-hidden border-brand-teal/20">
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-brand-teal/20 bg-brand-teal-light/30">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-teal">Owner Details</span>
                  </div>
                  <div className="divide-y divide-brand-dark-light/60">
                    <div className="flex items-center justify-between px-4 py-2.5">
                      <span className="text-xs font-semibold text-brand-teal">Name</span>
                      <span className="text-xs text-brand-dark font-medium text-right">{ownerName(panelPet.owner)}</span>
                    </div>
                    {panelPet.owner?.email && (
                      <div className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-xs font-semibold text-brand-teal">Email</span>
                        <span className="text-xs text-brand-dark font-medium text-right truncate max-w-[60%]">{panelPet.owner.email}</span>
                      </div>
                    )}
                    {panelPet.owner?.phone && (
                      <div className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-xs font-semibold text-brand-teal">Phone</span>
                        <span className="text-xs text-brand-dark font-medium text-right">{panelPet.owner.phone}</span>
                      </div>
                    )}
                    {panelPet.owner?.address && (
                      <div className="flex items-center justify-between px-4 py-2.5">
                        <span className="text-xs font-semibold text-brand-teal">Address</span>
                        <span className="text-xs text-brand-dark font-medium text-right max-w-[60%]">{panelPet.owner.address?.length > 30 ? panelPet.owner.address.slice(0, 30) + '…' : panelPet.owner.address}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer buttons */}
            <div className="shrink-0 border-t border-brand-dark-light px-0 py-4 bg-white flex gap-2">
              <button
                type="button"
                onClick={() => { onViewPet?.(panelPet); onSelectPet?.(null); }}
                className="flex flex-1 items-center justify-center rounded-xl border border-brand-teal/30 py-2 text-sm font-bold text-brand-teal transition-colors hover:bg-brand-teal hover:text-white"
              >
                Records
              </button>
              <button
                type="button"
                onClick={() => { onEditPet?.(panelPet); onSelectPet?.(null); }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-teal py-2 text-sm font-bold text-white hover:bg-brand-teal-dark"
              >
                <Pencil size={14} /> Edit
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => onPickAction?.(panelPet, panelPet.is_active ? 'deactivate' : 'delete')}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-2 text-sm font-bold text-red-500 hover:bg-red-100"
                >
                  <Trash2 size={14} /> {panelPet.is_active ? 'Deactivate' : 'Delete'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function EmptyState({ text }) {
  return (
    <div className="rounded-xl border border-brand-dark-light bg-white px-4 py-8 text-center text-xs font-semibold text-brand-dark-soft">
      {text}
    </div>
  );
}

function SheetRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-brand-dark-light/70 px-1 pb-3">
      <span className="shrink-0 font-semibold text-brand-dark-soft">{label}</span>
      <span className="min-w-0 max-w-[65%] break-words text-right font-medium text-brand-dark">{value}</span>
    </div>
  );
}

