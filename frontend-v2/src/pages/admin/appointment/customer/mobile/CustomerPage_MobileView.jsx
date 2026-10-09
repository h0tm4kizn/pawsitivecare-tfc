import { AdminSkeleton, AdminLoadState } from '../../../../../components/admin/AdminLoading';
import { PawPrint, Pencil, Search, Trash2, UserPlus, X } from 'lucide-react';
import StatusBadge from '../../../../../components/StatusBadge';
import SelectDropdown from '../../../../../components/reusable-ui/SelectDropdown';
import CustomerStatBox from '../CustomerStatBox';
import NewCustomersStatBox from '../components/NewCustomersStatBox';
import { avatarColor, getInitials } from '../customerUtils';
import { formatAddressFromOwner, truncateAddress } from '../../../../../utils/textUtils';

const FILTER_OPTIONS = [
  { value: 'all', label: 'All Customers' },
  { value: 'active', label: 'Active' },
  { value: 'deactivated', label: 'Deactivated' },
];

export default function CustomerPage_MobileView({
  loading = false,
  refreshing = false,
  onRetry,
  loadError = '',
  search = '',
  onSearch,
  filter = 'all',
  onFilter,
  owners = [],
  rows = [],
  selectedOwner = null,
  onSelectOwner,
  onViewOwner,
  onOpenPetProfile,
  onEditOwner,
  onPickAction,
  onAddCustomer,
  isAdmin = false,
  stats = {},
  completionContent = null,
}) {
  return (
    <section className="space-y-4 px-4 pb-10 pt-5 font-poppins">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold leading-tight text-brand-teal-dark">
            Customer <span className="text-brand-dark">Management</span>
          </h1>
          <p className="mt-0.5 text-xs text-brand-dark-soft">Manage registered pet owners.</p>
        </div>
        <button
          type="button"
          onClick={onAddCustomer}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-brand-teal px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-teal-dark"
        >
          <UserPlus size={14} strokeWidth={2.6} />
          New Customer
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <NewCustomersStatBox loading={loading} owners={owners} onView={onViewOwner} />
        <CustomerStatBox loading={loading}
          title="ACCOUNT HEALTH"
          value={stats.statActive ?? 0}
          note={`${stats.statDeactivated ?? 0} deactivated - ${stats.activeRate ?? '0.0'}% active rate`}
          modalTitle="Account Health"
          modalSubtitle="Active vs deactivated customers and the pet-owner segment."
          tiles={[
            { label: 'Active', value: stats.statActive ?? 0, note: `${stats.activeRate ?? '0.0'}% of total`, tone: 'emerald' },
            { label: 'Deactivated', value: stats.statDeactivated ?? 0, note: `${stats.deactivatedRate ?? '0.0'}% of total`, tone: 'red' },
          ]}
          insight={`${stats.deactivatedWithPets ?? 0} deactivated account(s) still have pets linked and can be targeted for reactivation.`}
        />
        <CustomerStatBox loading={loading}
          title="PET OWNERSHIP"
          value={stats.statTotalPets ?? 0}
          note={`${stats.multiPetOwners ?? 0} household(s) with 2+ pets`}
          modalTitle="Pet Ownership"
          modalSubtitle="How many pets are connected to customers and how concentrated they are."
          tiles={[
            { label: 'Total Pets', value: stats.statTotalPets ?? 0, note: 'All linked pets', tone: 'sky' },
            { label: 'Avg / Customer', value: stats.avgPets ?? '0.00', note: 'Household density', tone: 'brand' },
            { label: '2+ Pet Homes', value: stats.multiPetOwners ?? 0, note: 'Frequent users', tone: 'emerald' },
          ]}
          insight={`${stats.ownersWithPets ?? 0} customers own pets (${stats.petOwnerRate ?? '0.0'}%). ${stats.ownersWithout ?? 0} customer(s) still have no pets linked.`}
        />
        <CustomerStatBox loading={loading}
          title="PROFILE COMPLETION"
          value={stats.completeProfiles ?? 0}
          note={`${stats.profileCompletionRate ?? '0.0'}% complete profiles`}
          modalTitle="Profile Completion"
          modalSubtitle="How complete customer records are for contact and admin follow-up."
          customContent={completionContent}
        />
      </div>

      <div className="space-y-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-dark-soft/60" />
          <input
            value={search}
            onChange={(event) => onSearch?.(event.target.value)}
            placeholder="Search customers..."
            className="w-full rounded-xl border border-brand-teal/30 bg-white py-2.5 pl-9 pr-4 text-sm text-brand-dark placeholder:text-brand-dark-soft/50 focus:border-brand-teal focus:outline-none"
          />
        </div>
        <SelectDropdown
          value={filter}
          onChange={onFilter}
          options={FILTER_OPTIONS}
        />
      </div>

      <AdminLoadState loading={refreshing} error={loadError} onRetry={onRetry} />

      <div className="space-y-2">
        {loading ? (
          <AdminSkeleton label="Loading customers" />
        ) : loadError && rows.length === 0 ? null : rows.length === 0 ? (
          <EmptyState text="No customers found." />
        ) : (
          rows.map((owner, index) => (
            <button
              key={owner.id}
              type="button"
              onClick={() => onSelectOwner?.(owner)}
              className="w-full rounded-xl border border-brand-dark-light bg-white px-4 py-3 text-left shadow-[0_4px_10px_rgba(23,53,81,0.07)] transition-colors hover:border-brand-teal/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColor(owner.fullName)}`}>
                    {getInitials(owner.fullName)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-brand-dark">{owner.fullName}</p>
                    <p className="mt-0.5 text-[11px] font-semibold text-brand-dark-soft">{owner.display_id || `C${String(index + 1).padStart(3, '0')}`}</p>
                    <p className="mt-1 truncate text-xs text-brand-dark-soft">{owner.email || '-'}</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <StatusBadge active={owner.is_active} variant="customer" />
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {selectedOwner && (
        <div>
          <div className="fixed inset-0 z-[80] bg-black/50" onClick={() => onSelectOwner?.(null)} />
          <div className="fixed bottom-0 inset-x-3 z-[85] flex max-h-[82vh] flex-col rounded-t-2xl bg-white shadow-2xl sm:inset-x-6">
            <div className="flex items-center justify-between rounded-t-2xl bg-brand-teal px-5 py-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${avatarColor(selectedOwner.fullName)}`}>
                  {getInitials(selectedOwner.fullName)}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-white">{selectedOwner.fullName}</p>
                  <p className="truncate text-xs text-white/70">{selectedOwner.email}</p>
                </div>
              </div>
              <button type="button" onClick={() => onSelectOwner?.(null)} className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25">
                <X size={16} strokeWidth={2.8} />
              </button>
            </div>
            <div className="h-1 bg-brand-teal/20" />

            <div className="overflow-y-auto px-6 py-5 text-xs">
              <div className="space-y-4">
                <SheetRow label="Customer ID" value={selectedOwner.display_id || '-'} />
                <SheetRow label="Contact" value={selectedOwner.phone || '-'} />
                <SheetRow label="Address" value={truncateAddress(formatAddressFromOwner(selectedOwner)) || '-'} />
                <div className="flex items-center justify-between gap-4 border-b border-brand-dark-light/70 px-1 pb-3">
                  <span className="font-semibold text-brand-dark-soft">Status</span>
                  <StatusBadge active={selectedOwner.is_active} variant="customer" />
                </div>
                {selectedOwner.pets?.length > 0 && (
                  <div className="border-b border-brand-dark-light/70 px-1 pb-3">
                  <p className="mb-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-brand-teal-dark">
                      <PawPrint size={11} className="text-brand-teal" /> Pets
                  </p>
                    <div className="space-y-1.5">
                      {selectedOwner.pets.map((pet, index) => (
                        <button
                          key={pet.id ?? index}
                          type="button"
                          onClick={() => onOpenPetProfile?.(selectedOwner, pet)}
                          className="flex w-full items-center gap-2 rounded-lg border border-brand-teal/10 bg-white px-3 py-1.5 text-left transition hover:border-brand-teal/40 hover:bg-brand-teal-light/20"
                        >
                          <div className={`h-1.5 w-1.5 rounded-full ${String(pet.species_type?.name ?? '').toLowerCase().includes('cat') ? 'bg-orange-400' : 'bg-brand-teal'}`} />
                          <p className="truncate text-xs font-semibold text-brand-dark">{pet.name || `Pet ${index + 1}`}</p>
                          {pet.species_type?.name && <p className="ml-auto text-[11px] text-brand-dark-soft">{pet.species_type.name}</p>}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 border-t border-brand-teal/15 px-6 py-4">
              <button type="button" onClick={() => { onEditOwner?.(selectedOwner); onSelectOwner?.(null); }} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-teal py-2.5 text-sm font-bold text-white hover:bg-brand-teal-dark">
                <Pencil size={14} /> Edit
              </button>
              {isAdmin && (
                <button type="button" onClick={() => onPickAction?.(selectedOwner, selectedOwner.is_active ? 'deactivate' : 'delete')} className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-2.5 text-sm font-bold text-red-500 hover:bg-red-100">
                  <Trash2 size={14} /> {selectedOwner.is_active ? 'Deactivate' : 'Delete'}
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
      <span className="shrink-0 font-semibold text-brand-dark-soft">{label}:</span>
      <span className="min-w-0 max-w-[65%] break-words text-right font-medium text-brand-dark">{value}</span>
    </div>
  );
}
