import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, PawPrint, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { apiFetch } from '../../../api/apiClient';
import { useAuthStore } from '../../../stores/authStore';
import useMediaQuery from '../../../hooks/useMediaQuery';
import PetStatBox from './PetStatBox';
import { AdminSkeleton, AdminLoadState } from '../../../components/admin/AdminLoading';
import useAdminQuery from '../../../hooks/useAdminQuery';
import { adminJson } from '../../../api/adminData';
import { sanitizeText } from '../../../utils/textUtils';
import { normalizePet, ownerName, titleCasePetName } from './petUtils';
import StatusBadge from '../../../components/StatusBadge';
import PetPanel from './components/PetPanel';
import ViewPetModal from './components/ViewPetModal';
import ViewPetModal_Mobile from './components/ViewPetModal_Mobile';
import PetEditModal from './components/PetEditModal';
import PetActionModal from './components/PetActionModal';
import ManageBreedsModal from './components/ManageBreedsModal';
import RegisterPetModal from './components/RegisterPetModal';
import PetsPage_MobileView from './mobile/PetsPage_MobileView';
import NewPetsStatBox from './components/NewPetsStatBox';
import { cachePetList } from './petDataCache';

export default function PetsPage({ focusPet = null, onFocusHandled }) {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const role = useAuthStore((state) => state.role);
  const isAdmin = role() === 'admin';

  const petsQuery = useAdminQuery('pets', async () => {
    const d = await adminJson('/api/pets?per_page=200');
    const raw = Array.isArray(d?.data?.data) ? d.data.data : Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : [];
    const rows = raw.map(normalizePet);
    cachePetList(rows);
    return rows;
  }, []);
  const { data: pets, setData: setPets, loading: isLoading, error: loadError, refresh: loadPets } = petsQuery;
  const [speciesList, setSpeciesList] = useState([]);

  const [search, setSearch]         = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [breedFilter, setBreedFilter] = useState('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [isBreedFilterOpen, setIsBreedFilterOpen] = useState(false);
  const filterRef = useRef(null);
  const breedFilterRef = useRef(null);

  const [panelPet, setPanelPet]     = useState(null);
  useEffect(() => {
    if (petsQuery.loaded) setPanelPet(current => current || pets[pets.length - 1] || null);
  }, [pets, petsQuery.loaded]);
  const [viewPet, setViewPet]       = useState(null);
  const [editPet, setEditPet]       = useState(null);
  const [actionPet, setActionPet]   = useState(null);
  const [initialPetAction, setInitialPetAction] = useState(null);
  const [isSavingAction, setIsSavingAction] = useState(false);
  const [actionErr, setActionErr]   = useState('');
  const [actionMenuFor, setActionMenuFor] = useState(null);
  const actionMenuRef = useRef(null);

  const [showAdd, setShowAdd]           = useState(false);
  const [showManageBreeds, setShowManageBreeds] = useState(false);

  const [toasts, setToasts]         = useState([]);
  const [toastSeq, setToastSeq]     = useState(0);

  const addToast = (msg, type = 'success') => {
    const id = toastSeq + 1;
    setToastSeq(id);
    setToasts((t) => [...t, { id, msg, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  };

  useEffect(() => {
    const refreshInterval = setInterval(loadPets, 24 * 60 * 60 * 1000);
    apiFetch('/api/species-types')
      .then((r) => r.ok ? r.json() : {})
      .then((d) => {
        let list = Array.isArray(d?.data) ? d.data : Array.isArray(d) ? d : [];
        // Sort species: Dog first, then Cat, then others
        const speciesOrder = ['dog', 'dogs', 'cat', 'cats'];
        list.sort((a, b) => {
          const aName = (a.name || '').toLowerCase();
          const bName = (b.name || '').toLowerCase();
          const aIndex = speciesOrder.indexOf(aName);
          const bIndex = speciesOrder.indexOf(bName);
          return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
        });
        setSpeciesList(list);
      })
      .catch(() => {});
    return () => clearInterval(refreshInterval);
  }, [loadPets]);

  useEffect(() => {
    if (!focusPet || pets.length === 0) return;
    const target = pets.find((pet) => {
      if (focusPet.petId && String(pet.id) === String(focusPet.petId)) return true;
      const petOwnerId = pet.owner_id || pet.owner?.id;
      return focusPet.ownerId
        && String(petOwnerId) === String(focusPet.ownerId)
        && focusPet.petName
        && String(pet.name || '').toLowerCase() === String(focusPet.petName).toLowerCase();
    });
    if (target) {
      setPanelPet(target);
      setViewPet(target);
    }
    onFocusHandled?.();
  }, [focusPet, onFocusHandled, pets]);

  useEffect(() => {
    const onClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) setIsFilterOpen(false);
      if (breedFilterRef.current && !breedFilterRef.current.contains(event.target)) setIsBreedFilterOpen(false);
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target)) setActionMenuFor(null);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const stats = useMemo(() => {
    const dogPets = pets.filter((p) => { const s = (p.species_type?.name || '').toLowerCase(); return s === 'dog' || s === 'dogs'; });
    const catPets = pets.filter((p) => { const s = (p.species_type?.name || '').toLowerCase(); return s === 'cat' || s === 'cats'; });
    const dogs = dogPets.length;
    const cats = catPets.length;
    const others = pets.length - dogs - cats;
    const deactivated = pets.filter((p) => !p.is_active).length;
    const activeRate = pets.length ? ((pets.filter((p) => p.is_active).length / pets.length) * 100).toFixed(1) : '0.0';
    const dogBreeds = [...new Set(dogPets.map((p) => sanitizeText(p.breed?.name || '')).filter(Boolean))];
    const catBreeds = [...new Set(catPets.map((p) => sanitizeText(p.breed?.name || '')).filter(Boolean))];
    return { total: pets.length, dogs, cats, others, deactivated, activeRate, dogBreeds, catBreeds };
  }, [pets]);

  const speciesFilterOptions = useMemo(() => {
    const options = [{ value: 'all', label: 'ALL SPECIES' }];
    const seen = new Set();
    pets.forEach((p) => {
      const raw = sanitizeText(p.species_type?.name || '');
      const name = raw;
      if (name && !seen.has(name.toLowerCase())) {
        seen.add(name.toLowerCase());
        const val = name.toLowerCase() === 'dog' || name.toLowerCase() === 'dogs' ? 'dogs'
                  : name.toLowerCase() === 'cat' || name.toLowerCase() === 'cats' ? 'cats'
                  : 'others';
        if (!options.find((o) => o.value === val)) options.push({ value: val, label: name.toUpperCase() });
      }
    });
    // Sort species: Dog first, then Cat, then others
    const speciesOrder = ['dogs', 'cats', 'others'];
    const sorted = [
      { value: 'all', label: 'ALL SPECIES' },
      ...options.filter((o) => o.value !== 'all').sort((a, b) => {
        const aIndex = speciesOrder.indexOf(a.value);
        const bIndex = speciesOrder.indexOf(b.value);
        return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
      }),
    ];
    return sorted;
  }, [pets]);

  const filterLabel = speciesFilterOptions.find((o) => o.value === typeFilter)?.label ?? 'ALL SPECIES';

  const breedFilterOptions = useMemo(() => {
    if (typeFilter === 'all') return [{ value: 'all', label: 'ALL BREEDS' }];
    const source = pets.filter((p) => {
      const s = (p.species_type?.name || '').toLowerCase();
      if (typeFilter === 'dogs') return s === 'dog' || s === 'dogs';
      if (typeFilter === 'cats') return s === 'cat' || s === 'cats';
      if (typeFilter === 'others') return s !== 'dog' && s !== 'dogs' && s !== 'cat' && s !== 'cats';
      return true;
    });
    const map = new Map();
    source.forEach((p) => {
      const name = sanitizeText(p?.breed?.name || '').trim();
      if (!name) return;
      const key = name.toLowerCase();
      if (!map.has(key)) map.set(key, { value: key, label: name.toUpperCase() });
    });
    return [{ value: 'all', label: 'ALL BREEDS' }, ...Array.from(map.values())];
  }, [pets, typeFilter]);

  useEffect(() => {
    if (!breedFilterOptions.some((o) => o.value === breedFilter)) setBreedFilter('all');
  }, [breedFilterOptions, breedFilter]);

  const displayed = useMemo(() => pets.filter((p) => {
    if (typeFilter && typeFilter !== 'all') {
      const s = (p.species_type?.name || '').toLowerCase();
      if (typeFilter === 'dogs' && s !== 'dog' && s !== 'dogs') return false;
      if (typeFilter === 'cats' && s !== 'cat' && s !== 'cats') return false;
      if (typeFilter === 'others' && (s === 'dog' || s === 'dogs' || s === 'cat' || s === 'cats')) return false;
    }
    if (breedFilter && breedFilter !== 'all') {
      if (String(p?.breed?.name || '').trim().toLowerCase() !== breedFilter) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      if (!p.name.toLowerCase().includes(q) &&
          !(p.pet_id || '').toLowerCase().includes(q) &&
          !ownerName(p.owner).toLowerCase().includes(q)) return false;
    }
    return true;
  }), [pets, typeFilter, breedFilter, search]);

  const handlePetActionConfirm = async (action, reason) => {
    if (!actionPet?.id) return;
    setIsSavingAction(true);
    setActionErr('');
    try {
      if (action === 'deactivate') {
        const response = await apiFetch(`/api/pets/${actionPet.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: false, action_reason: reason }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.message || 'Failed to deactivate pet.');
        setPets((prev) => prev.map((row) => row.id === actionPet.id ? { ...row, is_active: false, deactivation_reason: reason } : row));
        if (panelPet?.id === actionPet.id) setPanelPet((prev) => (prev ? { ...prev, is_active: false, deactivation_reason: reason } : prev));
        addToast(data?.queued ? `Offline: ${actionPet.name} deactivation queued.` : `${actionPet.name} deactivated.`);
      } else {
        const response = await apiFetch(`/api/pets/${actionPet.id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action_reason: reason }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.message || 'Failed to delete pet.');
        setPets((prev) => prev.filter((row) => row.id !== actionPet.id));
        if (panelPet?.id === actionPet.id) setPanelPet(null);
        addToast(data?.queued ? `Offline: ${actionPet.name} deletion queued.` : `${actionPet.name} deleted successfully.`);
      }
      setActionPet(null);
    } catch (err) {
      setActionErr(err.message || 'An error occurred.');
    } finally {
      setIsSavingAction(false);
    }
  };

  const totalTiles = [
    { label: 'Dogs',   value: stats.dogs,   note: `${stats.total ? ((stats.dogs / stats.total) * 100).toFixed(1) : 0}% of total`, tone: 'dog' },
    { label: 'Cats',   value: stats.cats,   note: `${stats.total ? ((stats.cats / stats.total) * 100).toFixed(1) : 0}% of total`, tone: 'cat' },
    { label: 'Others', value: stats.others, note: `${stats.total ? ((stats.others / stats.total) * 100).toFixed(1) : 0}% of total`, tone: 'neutral' },
  ];
  const dogTiles = [
    { label: 'Total Dogs',    value: stats.dogs,             note: `${stats.total ? ((stats.dogs / stats.total) * 100).toFixed(1) : 0}% of pets`, tone: 'dog' },
    { label: 'Unique Breeds', value: stats.dogBreeds.length, note: 'Breeds registered', tone: 'dog' },
  ];
  const catTiles = [
    { label: 'Total Cats',    value: stats.cats,             note: `${stats.total ? ((stats.cats / stats.total) * 100).toFixed(1) : 0}% of pets`, tone: 'cat' },
    { label: 'Unique Breeds', value: stats.catBreeds.length, note: 'Breeds registered', tone: 'cat' },
  ];

  return (
    <>
      <div className="fixed right-4 top-4 z-[200] flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={`rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg ${t.type === 'error' ? 'bg-red-500' : 'bg-brand-teal'}`}>
            {t.msg}
          </div>
        ))}
      </div>

      {!isDesktop ? (
        <PetsPage_MobileView
          loading={isLoading}
          refreshing={petsQuery.refreshing}
          loadError={loadError}
          onRetry={loadPets}
          search={search}
          onSearch={setSearch}
          typeFilter={typeFilter}
          onTypeFilter={setTypeFilter}
          breedFilter={breedFilter}
          onBreedFilter={setBreedFilter}
          speciesFilterOptions={speciesFilterOptions}
          breedFilterOptions={breedFilterOptions}
          pets={pets}
          rows={displayed}
          panelPet={panelPet}
          onSelectPet={setPanelPet}
          onViewPet={setViewPet}
          onEditPet={setEditPet}
          onPickAction={(pet, action) => {
            setInitialPetAction(action);
            setActionPet(pet);
            setActionErr('');
            setPanelPet(null);
          }}
          onAddPet={() => setShowAdd(true)}
          onManageBreeds={() => setShowManageBreeds(true)}
          isAdmin={isAdmin}
          stats={stats}
          totalTiles={totalTiles}
          dogTiles={dogTiles}
          catTiles={catTiles}
        />
      ) : (
      <section className="space-y-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold text-brand-teal-dark">
              Pet <span className="text-brand-dark">Management</span>
            </h1>
            <p className="text-sm text-brand-dark-soft">View and manage all registered pets.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowManageBreeds(true)}
              className="rounded-xl border border-brand-teal bg-white px-5 py-2.5 text-sm font-semibold text-brand-teal-dark shadow-[0_2px_8px_rgba(23,53,81,0.08)] transition-colors hover:bg-brand-teal hover:text-white"
            >
              Manage Breeds
            </button>
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-brand-teal px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-teal-dark"
            >
              <span className="relative inline-flex h-4 w-4 items-center justify-center">
                <PawPrint size={16} strokeWidth={2.4} />
                <Plus size={9} strokeWidth={3} className="absolute -right-1 -top-1 rounded-full bg-brand-teal text-white" />
              </span>
              Register New Pet
            </button>
          </div>
        </div>

        <AdminLoadState loading={petsQuery.refreshing} error={loadError} onRetry={loadPets} />

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr_1fr_420px]">
          <div className="space-y-4 xl:col-span-3">

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <NewPetsStatBox loading={isLoading}
                pets={pets}
                onView={(pet) => setViewPet(pet)}
              />
              <PetStatBox loading={isLoading}
                title="TOTAL PETS"
                value={stats.total}
                note={`${stats.deactivated} deactivated • ${stats.activeRate}% active rate`}
                modalTitle="Total Pets"
                modalSubtitle="All registered pets in the system"
                tiles={totalTiles}
                insight={`The system currently manages ${stats.total} pet${stats.total !== 1 ? 's' : ''} across all species.`}
              />
              <PetStatBox loading={isLoading}
                title="DOGS"
                value={stats.dogs}
                note={`${stats.dogBreeds.length} breed(s) registered`}
                modalTitle="Dogs"
                modalSubtitle="Canine population breakdown"
                tiles={dogTiles}
                insight={`Dogs represent ${stats.total ? ((stats.dogs / stats.total) * 100).toFixed(1) : 0}% of all pets with ${stats.dogBreeds.length} breed(s).`}
              />
              <PetStatBox loading={isLoading}
                title="CATS"
                value={stats.cats}
                note={`${stats.catBreeds.length} breed(s) registered`}
                modalTitle="Cats"
                modalSubtitle="Feline population breakdown"
                tiles={catTiles}
                insight={`Cats represent ${stats.total ? ((stats.cats / stats.total) * 100).toFixed(1) : 0}% of all pets with ${stats.catBreeds.length} breed(s).`}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[180px] flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-dark-soft/60" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search pet name, ID, or owner..."
                  className="w-full rounded-xl border border-brand-teal/30 bg-white py-2.5 pl-9 pr-4 text-sm text-brand-dark placeholder:text-brand-dark-soft/50 focus:border-brand-teal focus:outline-none"
                />
              </div>
              <div ref={filterRef} className="relative">
                <button
                  type="button"
                  onClick={() => { setIsFilterOpen((open) => !open); setIsBreedFilterOpen(false); }}
                  className={`inline-flex items-center gap-2 whitespace-nowrap rounded-xl border px-4 py-2.5 text-xs font-bold transition ${isFilterOpen ? 'border-brand-teal bg-brand-teal text-white shadow-[0_4px_10px_rgba(36,119,122,0.25)]' : 'border-brand-teal bg-white text-brand-dark shadow-[0_2px_8px_rgba(23,53,81,0.08)]'}`}
                >
                  {filterLabel}
                  <ChevronDown size={13} className={`shrink-0 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
                </button>
                {isFilterOpen && (
                  <div className="absolute left-0 top-full z-20 mt-1 min-w-[160px] overflow-hidden rounded-xl border border-brand-teal/20 bg-white shadow-lg">
                    {speciesFilterOptions.map((option) => (
                      <button key={option.value} type="button"
                        onClick={() => { setTypeFilter(option.value); setBreedFilter('all'); setIsFilterOpen(false); setIsBreedFilterOpen(false); }}
                        className={`block w-full px-4 py-2 text-left text-xs font-bold transition-colors ${typeFilter === option.value ? 'bg-brand-teal text-white' : 'text-brand-dark hover:bg-brand-dark/5'}`}>
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div ref={breedFilterRef} className="relative">
                <button
                  type="button"
                  disabled={typeFilter === 'all'}
                  onClick={() => { if (typeFilter === 'all') return; setIsBreedFilterOpen((open) => !open); setIsFilterOpen(false); }}
                  className={`inline-flex min-w-[190px] items-center justify-between gap-2 whitespace-nowrap rounded-xl border px-4 py-2.5 text-xs font-bold transition ${
                    typeFilter === 'all'
                      ? 'cursor-not-allowed border-brand-teal/20 bg-brand-teal/20 text-brand-dark-soft shadow-none'
                      : isBreedFilterOpen
                        ? 'border-brand-teal bg-brand-teal text-white shadow-[0_4px_10px_rgba(36,119,122,0.25)]'
                        : 'border-brand-teal bg-white text-brand-dark shadow-[0_2px_8px_rgba(23,53,81,0.08)]'
                  }`}
                >
                  <span className="max-w-[130px] truncate">
                    {breedFilterOptions.find((option) => option.value === breedFilter)?.label ?? 'ALL BREEDS'}
                  </span>
                  <ChevronDown size={13} className={`shrink-0 transition-transform ${isBreedFilterOpen ? 'rotate-180' : ''}`} />
                </button>
                {isBreedFilterOpen && typeFilter !== 'all' && (
                  <div className="absolute left-0 top-full z-20 mt-1 min-w-[190px] overflow-hidden rounded-xl border border-brand-teal/20 bg-white shadow-lg">
                    {breedFilterOptions.map((option) => (
                      <button key={option.value} type="button"
                        onClick={() => { setBreedFilter(option.value); setIsBreedFilterOpen(false); }}
                        className={`block w-full px-4 py-2 text-left text-xs font-bold transition-colors ${breedFilter === option.value ? 'bg-brand-teal text-white' : 'text-brand-dark hover:bg-brand-dark/5'}`}>
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-brand-teal/20 bg-white shadow-[0_6px_12px_rgba(23,53,81,0.08)]">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-brand-teal/15 bg-white">
                      {['PET ID', 'PET NAME', 'TYPE', 'BREED', 'OWNER', 'STATUS', 'ACTIONS'].map((col) => (
                        <th key={col} className={`px-4 py-3 text-[11px] font-extrabold uppercase tracking-wider text-brand-dark ${col === 'STATUS' || col === 'ACTIONS' ? 'text-center' : 'text-left'}`}>
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading && <tr><td colSpan={8}><AdminSkeleton label="Loading pets" /></td></tr>}
                    {!isLoading && !loadError && displayed.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-8 text-center text-sm font-semibold text-brand-dark-soft">No pets found.</td>
                      </tr>
                    )}
                    {!isLoading && displayed.map((pet, idx) => (
                      <tr key={pet.id} onClick={() => setPanelPet(pet)}
                        className={`cursor-pointer border-b border-brand-teal/10 transition-colors last:border-b-0 ${panelPet?.id === pet.id ? 'bg-brand-dark/[0.06] hover:bg-brand-dark/[0.08]' : 'hover:bg-brand-dark/5'}`}>
                        <td className="px-4 py-3 text-xs font-bold text-brand-dark-soft">{pet.pet_id || `P${String(idx + 1).padStart(3, '0')}`}</td>
                        <td className="px-4 py-3"><span className="font-semibold text-brand-dark">{titleCasePetName(pet.name)}</span></td>
                        <td className="px-4 py-3 text-xs text-brand-dark-soft">{pet.species_type?.name || '—'}</td>
                        <td className="px-4 py-3 text-xs text-brand-dark-soft">{sanitizeText(pet.breed?.name || '—')}</td>
                        <td className="max-w-[180px] truncate px-4 py-3 text-xs text-brand-dark-soft">{ownerName(pet.owner)}</td>
                        <td className="px-4 py-3 text-center"><StatusBadge active={pet.is_active} /></td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            <button type="button" onClick={() => setEditPet(pet)} aria-label="Edit pet"
                              className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-brand-teal/35 bg-brand-teal/10 text-brand-teal-dark transition-colors hover:bg-brand-teal/20">
                              <Pencil size={12} />
                            </button>
                            {isAdmin && (
                              <div ref={actionMenuFor === pet.id ? actionMenuRef : null} className="relative">
                                <button type="button"
                                  onClick={() => setActionMenuFor((prev) => (prev === pet.id ? null : pet.id))}
                                  className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-500 transition-colors hover:bg-red-100"
                                  aria-label="Action options"
                                >
                                  <Trash2 size={12} />
                                </button>
                                {actionMenuFor === pet.id && (
                                  <div className={`absolute right-0 z-20 w-32 overflow-hidden rounded-lg border border-brand-teal/20 bg-white shadow-lg ${
                                    idx >= displayed.length - 2 ? 'bottom-[calc(100%+6px)]' : 'top-[calc(100%+6px)]'
                                  }`}>
                                    {pet.is_active && (
                                      <button type="button"
                                        onClick={() => { setInitialPetAction('deactivate'); setActionPet(pet); setActionErr(''); setActionMenuFor(null); }}
                                        className="w-full px-3 py-2 text-left text-xs font-semibold text-brand-dark hover:bg-brand-dark/5">
                                        Deactivate
                                      </button>
                                    )}
                                    <button type="button"
                                      onClick={() => { setInitialPetAction('delete'); setActionPet(pet); setActionErr(''); setActionMenuFor(null); }}
                                      className={`w-full px-3 py-2 text-left text-xs font-semibold text-red-500 hover:bg-red-50 ${pet.is_active ? 'border-t border-brand-teal/15' : ''}`}>
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!isLoading && displayed.length > 0 && (
                <div className="border-t border-brand-teal/10 px-4 py-2 text-[11px] text-brand-dark-soft">
                  Showing {displayed.length} of {pets.length} pet{pets.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          </div>

          <div className="xl:self-start">
            <PetPanel pet={panelPet} onSeeDetails={() => panelPet && setViewPet(panelPet)} />
          </div>
        </div>
      </section>
      )}

      {showAdd && (
        <RegisterPetModal
          speciesList={speciesList}
          onClose={() => setShowAdd(false)}
          onSaved={(saved) => {
            loadPets();
            if (saved?.id) setPanelPet(normalizePet(saved));
            addToast('Pet registered successfully.');
          }}
        />
      )}

      {showManageBreeds && (
        <ManageBreedsModal
          speciesList={speciesList}
          onClose={() => setShowManageBreeds(false)}
          onChanged={(msg) => addToast(msg)}
        />
      )}

      {viewPet && (isDesktop ? (
        <ViewPetModal pet={viewPet} onClose={() => setViewPet(null)} />
      ) : (
        <ViewPetModal_Mobile pet={viewPet} onClose={() => setViewPet(null)} />
      ))}

      <PetEditModal
        pet={editPet}
        speciesList={speciesList}
        onClose={() => setEditPet(null)}
        onSaved={(updated) => {
          const merge = (row) => ({ ...row, ...updated, photo_url: updated.photo_url || row.photo_url });
          setPets((prev) => prev.map((row) => (row.id === updated.id ? merge(row) : row)));
          if (panelPet?.id === updated.id) setPanelPet((prev) => (prev ? merge(prev) : prev));
          if (viewPet?.id === updated.id) setViewPet((prev) => (prev ? merge(prev) : prev));
          addToast(`${updated.name} updated successfully.`);
        }}
      />

      <PetActionModal
        pet={actionPet}
        initialAction={initialPetAction}
        onClose={() => { setActionPet(null); setInitialPetAction(null); }}
        onConfirm={handlePetActionConfirm}
        isSaving={isSavingAction}
        error={actionErr}
      />
    </>
  );
}

