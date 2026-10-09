import { ChevronDown, Search, UserPlus } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdminLoadState } from '../../../../components/admin/AdminLoading';
import { apiFetch } from '../../../../api/apiClient';
import useMediaQuery from '../../../../hooks/useMediaQuery';
import { useCustomerStore } from '../../../../stores/customerStore';
import { useAuthStore } from '../../../../stores/authStore';
import AddCustomerModal from './components/AddCustomerModal';
import CustomerBottomSheet from './components/CustomerBottomSheet';
import CustomerViewModal from './components/CustomerViewModal';
import EditCustomerModal from './components/EditCustomerModal';
import CustomerPanel from './components/CustomerPanel';
import RemoveCustomerModal from './components/RemoveCustomerModal';
import CustomerStatBox from './CustomerStatBox';
import { getMissingFields } from './customerUtils';
import CustomerPage_MobileView from './mobile/CustomerPage_MobileView';
import CustomerPetProfileModal_Mobile from './components/CustomerPetProfileModal_Mobile';
import NewCustomersStatBox from './components/NewCustomersStatBox';
import CustomerTable from './components/CustomerTable';

let toastSeq = 0;

export default function CustomerPage({ focusOwnerId = null, onFocusHandled }) {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const role = useAuthStore((state) => state.role);
  const isAdmin = role() === 'admin';

  const owners = useCustomerStore((state) => state.owners);
  const loading = useCustomerStore((state) => state.loading);
  const refreshing = useCustomerStore((state) => state.refreshing);
  const loadError = useCustomerStore((state) => state.loadError);
  const search = useCustomerStore((state) => state.search);
  const filter = useCustomerStore((state) => state.filter);
  const setSearch = useCustomerStore((state) => state.setSearch);
  const setFilter = useCustomerStore((state) => state.setFilter);
  const fetchOwners = useCustomerStore((state) => state.fetchOwners);

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [selectedOwner, setSelectedOwner] = useState(null);
  const [viewTarget, setViewTarget] = useState(null);
  const [viewInitialPetId, setViewInitialPetId] = useState(null);
  const [viewPetTarget, setViewPetTarget] = useState(null);
  const [viewPetOwner, setViewPetOwner] = useState(null);
  const [removeTarget, setRemoveTarget] = useState(null);
  const [removeAction, setRemoveAction] = useState(null);
  const [actionMenuFor, setActionMenuFor] = useState(null);
  const [toasts, setToasts] = useState([]);
  const filterRef = useRef(null);
  const actionMenuRef = useRef(null);

  const addToast = useCallback((message, type = 'success') => {
    const id = ++toastSeq;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((toast) => toast.id !== id)), 3500);
  }, []);

  useEffect(() => {
    fetchOwners({ force: false });
    const interval = setInterval(() => fetchOwners({ silent: true }), 24 * 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchOwners]);

  useEffect(() => {
    const onClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setIsFilterOpen(false);
      }
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target)) {
        setActionMenuFor(null);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const statTotal = owners.length;
  const statActive = owners.filter((owner) => owner.is_active).length;
  const statDeactivated = owners.filter((owner) => !owner.is_active).length;
  const statTotalPets = useMemo(() => owners.reduce((sum, owner) => sum + owner.pets.length, 0), [owners]);
  const multiPetOwners = owners.filter((owner) => owner.pets.length >= 2).length;
  const ownersWithPets = owners.filter((owner) => owner.pets.length > 0).length;
  const ownersWithout = statTotal - ownersWithPets;
  const completeProfiles = useMemo(() => owners.filter((owner) => getMissingFields(owner).length === 0).length, [owners]);
  const incompleteOwners = useMemo(
    () =>
      owners
        .filter((owner) => getMissingFields(owner).length > 0)
        .map((owner) => ({ ...owner, missing: getMissingFields(owner) }))
        .sort((a, b) => b.missing.length - a.missing.length),
    [owners],
  );

  const activeRate = statTotal ? ((statActive / statTotal) * 100).toFixed(1) : '0.0';
  const deactivatedRate = statTotal ? ((statDeactivated / statTotal) * 100).toFixed(1) : '0.0';
  const avgPets = statTotal ? (statTotalPets / statTotal).toFixed(2) : '0.00';
  const petOwnerRate = statTotal ? ((ownersWithPets / statTotal) * 100).toFixed(1) : '0.0';
  const profileCompletionRate = statTotal ? ((completeProfiles / statTotal) * 100).toFixed(1) : '0.0';
  const deactivatedWithPets = owners.filter((owner) => !owner.is_active && owner.pets.length > 0).length;
  const stats = {
    statTotal,
    statActive,
    statDeactivated,
    statTotalPets,
    multiPetOwners,
    ownersWithPets,
    ownersWithout,
    completeProfiles,
    activeRate,
    deactivatedRate,
    avgPets,
    petOwnerRate,
    profileCompletionRate,
    deactivatedWithPets,
  };

  const completionContent = useMemo(() => {
    const rate = parseFloat(profileCompletionRate);
    const circumference = 2 * Math.PI * 28;
    const offset = circumference - (rate / 100) * circumference;
    return (
      <div className="flex gap-4">
        <div className="flex w-44 shrink-0 flex-col items-center rounded-xl border border-brand-dark-light bg-brand-teal-light/10 px-4 py-4">
          <svg width="72" height="72" viewBox="0 0 72 72" className="-rotate-90">
            <circle cx="36" cy="36" r="28" fill="none" stroke="#e5ecf0" strokeWidth="8" />
            <circle cx="36" cy="36" r="28" fill="none" stroke="#4DB6AC" strokeWidth="8" strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" />
          </svg>
          <p className="mt-2 text-2xl font-extrabold leading-none text-brand-dark">{profileCompletionRate}%</p>
          <p className="mt-0.5 text-[10px] text-brand-dark-soft">profiles complete</p>
          <div className="mt-2 flex flex-col items-center gap-0.5 text-[10px]">
            <span className="font-semibold text-emerald-600">{completeProfiles} complete</span>
            <span className="font-semibold text-red-500">{statTotal - completeProfiles} incomplete</span>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-red-200">
          <div className="flex shrink-0 items-center justify-between bg-red-50 px-3 py-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-red-600">Needs Attention</p>
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">{incompleteOwners.length}</span>
          </div>
          <div className="max-h-52 flex-1 divide-y divide-red-100 overflow-y-auto">
            {incompleteOwners.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-brand-dark-soft">All profiles complete!</p>
            ) : (
              incompleteOwners.map((row) => (
                <div key={row.id} className="flex items-start justify-between gap-2 bg-white px-3 py-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-brand-dark">{row.fullName}</p>
                    <p className="mt-0.5 text-[10px] leading-snug text-red-500">{row.missing.join(' · ')}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-500">{row.missing.length}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  }, [profileCompletionRate, completeProfiles, statTotal, incompleteOwners]);

  const filtered = useMemo(() => {
    let list = owners;
    if (filter === 'active') list = list.filter((owner) => owner.is_active);
    if (filter === 'deactivated') list = list.filter((owner) => !owner.is_active);
    if (search.trim()) {
      const query = search.toLowerCase();
      list = list.filter(
        (owner) =>
          owner.fullName.toLowerCase().includes(query) ||
          String(owner.display_id || '').toLowerCase().includes(query) ||
          owner.email.toLowerCase().includes(query) ||
          owner.phone.toLowerCase().includes(query) ||
          owner.pets.some((pet) => (pet.name || '').toLowerCase().includes(query)),
      );
    }
    return list;
  }, [owners, filter, search]);

  useEffect(() => {
    if (!selectedOwner?.id) return;
    const updated = owners.find((owner) => owner.id === selectedOwner.id);
    if (updated) setSelectedOwner(updated);
    else setSelectedOwner(null);
  }, [owners, selectedOwner?.id]);

  useEffect(() => {
    if (!focusOwnerId || owners.length === 0) return;
    const owner = owners.find((item) => String(item.id) === String(focusOwnerId));
    if (owner) setSelectedOwner(owner);
    onFocusHandled?.();
  }, [focusOwnerId, onFocusHandled, owners]);

  const handleDeactivate = async (reason) => {
    const response = await apiFetch(`/api/owners/${removeTarget.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: false, action_reason: reason }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || 'Failed to deactivate customer.');
    addToast(data?.queued ? 'Offline: customer deactivation queued.' : 'Customer deactivated.');
    setRemoveTarget(null);
    await fetchOwners();
  };

  const handleDelete = async (reason) => {
    const response = await apiFetch(`/api/owners/${removeTarget.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action_reason: reason }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data?.message || 'Failed to delete customer.');
    addToast(data?.queued ? 'Offline: customer deletion queued.' : 'Customer deleted.');
    setRemoveTarget(null);
    await fetchOwners();
  };

  const filterLabel = { all: 'ALL CUSTOMERS', active: 'ACTIVE', deactivated: 'DEACTIVATED' }[filter] ?? 'ALL CUSTOMERS';

  return (
    <>
      <div className="fixed right-4 top-4 z-[200] flex flex-col gap-2">
        {toasts.map((toast) => (
          <div key={toast.id} className={`rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg ${toast.type === 'error' ? 'bg-red-500' : 'bg-brand-teal'}`}>
            {toast.message}
          </div>
        ))}
      </div>

      {!isDesktop ? (
        <CustomerPage_MobileView
          loading={loading}
          refreshing={refreshing}
          onRetry={() => fetchOwners()}
          loadError={loadError}
          search={search}
          onSearch={setSearch}
          filter={filter}
          onFilter={setFilter}
          owners={owners}
          rows={filtered}
          selectedOwner={selectedOwner}
          onSelectOwner={setSelectedOwner}
          onViewOwner={(owner) => {
            setViewInitialPetId(null);
            setViewTarget(owner);
          }}
          onOpenPetProfile={(owner, pet) => {
            setViewPetTarget({
              ...pet,
              owner: pet?.owner || owner,
            });
            setViewPetOwner(owner);
            setSelectedOwner(null);
          }}
          onEditOwner={setEditTarget}
          onPickAction={(owner, action) => {
            setRemoveTarget(owner);
            setRemoveAction(action);
            setSelectedOwner(null);
          }}
          onAddCustomer={() => setIsAddOpen(true)}
          isAdmin={isAdmin}
          stats={stats}
          completionContent={completionContent}
        />
      ) : (
      <section className="space-y-5 py-4">
          <AdminLoadState loading={refreshing} error={loadError} onRetry={() => fetchOwners()} />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold text-brand-teal-dark">
              Customer <span className="text-brand-dark">Management</span>
            </h1>
            <p className="text-sm text-brand-dark-soft">View, manage, and monitor all registered pet owners.</p>
          </div>
          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-teal px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-teal-dark"
          >
            <UserPlus size={16} strokeWidth={2.6} />
            Add New Customer
          </button>
        </div>



        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr_1fr_420px]">
          <div className="space-y-4 xl:col-span-3">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {loadError && owners.length === 0 ? (
                <div role="alert" className="col-span-full rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
                  Customer statistics are unavailable: {loadError}
                  <button type="button" onClick={() => fetchOwners()} className="ml-3 rounded border border-red-300 px-3 py-1 font-semibold">Retry</button>
                </div>
              ) : <>
              <NewCustomersStatBox loading={loading}
                owners={owners}
                onView={(owner) => setViewTarget(owner)}
              />
              <CustomerStatBox loading={loading}
                title="ACCOUNT HEALTH"
                value={statActive}
                note={`${statDeactivated} deactivated • ${activeRate}% active rate`}
                modalTitle="Account Health"
                modalSubtitle="Active vs deactivated customers and the pet-owner segment."
                tiles={[
                  { label: 'Active', value: statActive, note: `${activeRate}% of total`, tone: 'emerald' },
                  { label: 'Deactivated', value: statDeactivated, note: `${deactivatedRate}% of total`, tone: 'red' },
                ]}
                insight={`${deactivatedWithPets} deactivated account(s) still have pets linked and can be targeted for reactivation.`}
              />
              <CustomerStatBox loading={loading}
                title="PET OWNERSHIP"
                value={statTotalPets}
                note={`${multiPetOwners} household(s) with 2+ pets`}
                modalTitle="Pet Ownership"
                modalSubtitle="How many pets are connected to customers and how concentrated they are."
                tiles={[
                  { label: 'Total Pets', value: statTotalPets, note: 'All linked pets', tone: 'sky' },
                  { label: 'Avg / Customer', value: avgPets, note: 'Household density', tone: 'brand' },
                  { label: '2+ Pet Homes', value: multiPetOwners, note: 'Frequent users', tone: 'emerald' },
                ]}
                insight={`${ownersWithPets} customers own pets (${petOwnerRate}%). ${ownersWithout} customer(s) still have no pets linked.`}
              />
              <CustomerStatBox loading={loading}
                title="PROFILE COMPLETION"
                value={completeProfiles}
                note={`${profileCompletionRate}% complete profiles`}
                modalTitle="Profile Completion"
                modalSubtitle="How complete customer records are for contact and admin follow-up."
                customContent={completionContent}
              />
              </>}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[180px] flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-dark-soft/60" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search..."
                  className="w-full rounded-xl border border-brand-teal/30 bg-white py-2.5 pl-9 pr-4 text-sm text-brand-dark placeholder:text-brand-dark-soft/50 focus:border-brand-teal focus:outline-none"
                />
              </div>
              <div ref={filterRef} className="relative">
                <button
                  type="button"
                  onClick={() => setIsFilterOpen((open) => !open)}
                  className={`inline-flex items-center gap-2 whitespace-nowrap rounded-xl border px-4 py-2.5 text-xs font-bold transition ${isFilterOpen ? 'border-brand-teal bg-brand-teal text-white shadow-[0_4px_10px_rgba(36,119,122,0.25)]' : 'border-brand-teal bg-white text-brand-dark shadow-[0_2px_8px_rgba(23,53,81,0.08)]'}`}
                >
                  {filterLabel}
                  <ChevronDown size={13} className={`shrink-0 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
                </button>
                {isFilterOpen && (
                  <div className="absolute left-0 top-full z-20 mt-1 min-w-[160px] overflow-hidden rounded-xl border border-brand-teal/20 bg-white shadow-lg">
                    {[
                      ['all', 'ALL CUSTOMERS'],
                      ['active', 'ACTIVE'],
                      ['deactivated', 'DEACTIVATED'],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          setFilter(value);
                          setIsFilterOpen(false);
                        }}
                        className={`block w-full px-4 py-2 text-left text-xs font-bold transition-colors ${filter === value ? 'bg-brand-teal text-white' : 'text-brand-dark hover:bg-brand-teal-light/40'}`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <CustomerTable
                error={loadError}
              customers={filtered}
              loading={loading}
          refreshing={refreshing}
          onRetry={() => fetchOwners()}
              selectedOwner={selectedOwner}
              onSelect={setSelectedOwner}
              onEdit={setEditTarget}
              isAdmin={isAdmin}
              actionMenuFor={actionMenuFor}
              setActionMenuFor={setActionMenuFor}
              actionMenuRef={actionMenuRef}
              onRemove={(owner, action) => {
                setRemoveTarget(owner);
                setRemoveAction(action);
                setActionMenuFor(null);
              }}
            />
          </div>

          <div className="hidden xl:block">
            <CustomerPanel
              owner={selectedOwner}
              label="Selected Customer"
              onSeeDetails={(owner) => owner && setViewTarget(owner)}
            />
          </div>
        </div>
      </section>
      )}

      {/* Mobile bottom sheet */}
      {isDesktop && (
        <CustomerBottomSheet
          owner={selectedOwner}
          isAdmin={isAdmin}
          onClose={() => setSelectedOwner(null)}
          onSeeDetails={(owner) => {
            setViewTarget(owner);
            setSelectedOwner(null);
          }}
          onEdit={(owner) => {
            setEditTarget(owner);
            setSelectedOwner(null);
          }}
          onRemove={(owner) => {
            setRemoveTarget(owner);
            setRemoveAction(owner.is_active ? 'deactivate' : 'delete');
            setSelectedOwner(null);
          }}
        />
      )}

      <AddCustomerModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        onSaved={(message) => {
          addToast(message);
          fetchOwners();
        }}
      />
      {removeTarget && <RemoveCustomerModal owner={removeTarget} action={removeAction} onClose={() => { setRemoveTarget(null); setRemoveAction(null); }} onDeactivate={handleDeactivate} onDelete={handleDelete} />}
      {editTarget && (
        <EditCustomerModal
          owner={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={async (message) => {
            addToast(message);
            setEditTarget(null);
            await fetchOwners();
          }}
        />
      )}
      {viewTarget && (
        <CustomerViewModal
          owner={viewTarget}
          initialPetId={viewInitialPetId}
          onClose={() => {
            setViewTarget(null);
            setViewInitialPetId(null);
          }}
        />
      )}
      {viewPetTarget && (
        <CustomerPetProfileModal_Mobile
          pet={viewPetTarget}
          owner={viewPetOwner}
          onBack={() => {
            setViewPetTarget(null);
            setSelectedOwner(viewPetOwner);
          }}
          onClose={() => {
            setViewPetTarget(null);
            setViewPetOwner(null);
          }}
        />
      )}
    </>
  );
}
