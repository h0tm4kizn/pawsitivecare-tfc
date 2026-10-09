import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, ChevronDown, Gift, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { apiFetch } from '../../../api/apiClient';
import { useAuthStore } from '../../../stores/authStore';
import useMediaQuery from '../../../hooks/useMediaQuery';
import ServiceStatBox from './ServiceStatBox';
import HotelSuiteOccupancyModal from './HotelSuiteOccupancyModal';
import AddPackageModal from './AddPackageModal';
import AddAddonModal from './AddAddonModal';
import EditPackageModal from './EditPackageModal';
import DeletePackageModal from './DeletePackageModal';
import AddonsPanel from './AddonsPanel';
import { AdminSkeleton, AdminLoadState } from '../../../components/admin/AdminLoading';
import useAdminQuery from '../../../hooks/useAdminQuery';
import { adminJson, adminGet } from '../../../api/adminData';
import StatusBadge from '../../../components/StatusBadge';
import ServicePage_MobileView from './mobile/ServicePage_MobileView';
import PromoManagement from './PromoManagement';

// Constants

const PALETTE = ['#1e40af', '#ec4899', '#9333ea', '#5C7A8A', '#2E7D6B', '#A855F7', '#F59E0B', '#EF4444'];

const SERVICE_CATEGORY_COLORS = {
  grooming: '#a78bfa', // brand-grooming
  hotel:    '#fb7185', // brand-hotel
  daycare:  '#fbbf24', // brand-daycare
};

const FALLBACK_CAT_META = {
  grooming: { name: 'Grooming',    color: SERVICE_CATEGORY_COLORS.grooming },
  daycare:  { name: 'Daycare',     color: SERVICE_CATEGORY_COLORS.daycare },
  hotel:    { name: 'Hotel Suite', color: SERVICE_CATEGORY_COLORS.hotel },
};

const catColor  = (cats, slug) => SERVICE_CATEGORY_COLORS[slug] || cats.find((c) => c.slug === slug)?.color || SERVICE_CATEGORY_COLORS.grooming;
const catLabel  = (cats, slug) => cats.find((c) => c.slug === slug)?.name  || slug;
const packagePrefix = (category) => {
  const c = String(category || '').toLowerCase();
  if (c === 'grooming') return 'GPKG';
  if (c === 'hotel') return 'HPKG';
  if (c === 'daycare') return 'DCPKG';
  return 'PKG';
};
const currentYY = () => String(new Date().getFullYear()).slice(-2);
const GiftIcon = () => <Gift size={14} className="text-brand-teal" />;

let _toastId = 0;

const formatMoney = (value) => `PHP ${Number(value || 0).toLocaleString('en-PH')}`;

const formatTierPrice = (tier) => {
  if (!tier) return 'No price set';
  if (tier.price_max) return `${formatMoney(tier.price)} - ${formatMoney(tier.price_max)}`;
  return formatMoney(tier.price);
};

const formatAddonPrice = (addon) => {
  if (!addon) return 'No price set';
  if (addon.price_max) return `${formatMoney(addon.price_min)} - ${formatMoney(addon.price_max)}`;
  return formatMoney(addon.price_min);
};

function ServiceViewPanel({ selected, cats, packageCodeById }) {
  const item = selected?.item;

  if (!item) {
    return (
      <aside className="sticky top-4 rounded-xl border border-brand-teal/20 bg-white p-5 shadow-[0_6px_12px_rgba(23,53,81,0.08)]">
        <p className="text-sm font-semibold text-brand-dark">View Mode</p>
        <p className="mt-2 text-xs leading-5 text-brand-dark-soft">Select a package or Pawsome Extra to view its full details here.</p>
      </aside>
    );
  }

  if (selected.type === 'addon') {
    return (
      <aside className="sticky top-4 overflow-hidden rounded-xl border border-brand-teal/20 bg-white shadow-[0_6px_12px_rgba(23,53,81,0.08)]">
        <div className="border-b border-brand-teal/15 px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-teal">Pawsome Extra View</p>
          <h2 className="mt-1 text-xl font-semibold text-brand-dark">{item.name}</h2>
          <p className="mt-1 text-xs text-brand-dark-soft">{item.groupLabel}</p>
        </div>
        <div className="space-y-4 px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-dark-soft">Description</p>
            <p className="mt-1 text-sm leading-5 text-brand-dark">{item.description || 'Optional Pawsome Extra available during booking.'}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-dark-soft">Pricing</p>
            <div className="mt-2 space-y-2">
              {item.items.map((addon) => (
                <div key={addon.id} className="flex items-center justify-between gap-3 border-b border-brand-teal/10 pb-2 last:border-b-0 last:pb-0">
                  <span className="text-xs font-semibold text-brand-dark-soft">{addon.size || item.name}</span>
                  <span className="text-xs font-normal text-brand-dark">{formatAddonPrice(addon)}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg bg-brand-teal/10 px-3 py-2">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-dark-soft">Status</p>
            <p className="mt-0.5 text-sm font-normal text-brand-dark">{item.active ? 'Active' : 'Inactive'}</p>
          </div>
        </div>
      </aside>
    );
  }

  const tiers = Array.isArray(item.service_tiers) ? item.service_tiers : [];
  const color = catColor(cats, item.category);

  return (
    <aside className="sticky top-4 overflow-hidden rounded-xl border border-brand-teal/20 bg-white shadow-[0_6px_12px_rgba(23,53,81,0.08)]">
      <div className="border-b border-brand-teal/15 px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-teal">Package View</p>
        <h2 className="mt-1 text-xl font-semibold text-brand-dark">{item.name}</h2>
        <div className="mt-2 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
          <span className="text-xs font-semibold text-brand-dark-soft">{catLabel(cats, item.category)}</span>
        </div>
      </div>
      <div className="space-y-4 px-5 py-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-brand-dark/5 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-dark-soft">Package ID</p>
            <p className="mt-1 text-sm font-bold text-brand-dark">{packageCodeById.get(item.id) || item.id}</p>
          </div>
          <div className="rounded-lg bg-brand-dark/5 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-dark-soft">Status</p>
            <p className="mt-1 text-sm font-normal text-brand-dark">{item.is_active ? 'Active' : 'Inactive'}</p>
          </div>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-dark-soft">Description</p>
          <p className="mt-1 text-sm leading-5 text-brand-dark">{item.description || 'No description provided.'}</p>
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-dark-soft">Tiers</p>
          <div className="mt-2 space-y-2">
            {tiers.length === 0 ? (
              <p className="text-xs text-brand-dark-soft">No tiers configured.</p>
            ) : tiers.map((tier) => (
              <div key={tier.id || tier.size_label} className="flex items-center justify-between gap-3 border-b border-brand-teal/10 pb-2 last:border-b-0 last:pb-0">
                <span className="text-xs font-semibold text-brand-dark-soft">{tier.size_label || 'Standard'}</span>
                <span className="text-xs font-normal text-brand-dark">{formatTierPrice(tier)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

export default function ServicePage() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const role = useAuthStore((state) => state.role);
  const isAdmin = role() === 'admin';

  const [search,       setSearch]       = useState('');
  const [filterCat,    setFilterCat]    = useState('all');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterRef = useRef(null);

  const [showHotelOccupancy, setShowHotelOccupancy] = useState(false);
  const [showAddPackage, setShowAddPackage] = useState(false);
  const [showAddAddon, setShowAddAddon] = useState(false);
  const [showPromos, setShowPromos] = useState(false);
  const [mobileSection, setMobileSection] = useState('home');
  const [isManageMenuOpen, setIsManageMenuOpen] = useState(false);
  const [editTarget,       setEditTarget]       = useState(null);
  const [deleteTarget,     setDeleteTarget]     = useState(null);
  const [isDeleting,       setIsDeleting]       = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [isDeactivating,   setIsDeactivating]   = useState(false);
  const [actionMenuFor,    setActionMenuFor]    = useState(null);
  const [selectedView,     setSelectedView]     = useState(null);
  const [showPackageTable, setShowPackageTable] = useState(false);
  const actionMenuRef = useRef(null);
  const manageMenuRef = useRef(null);
  const [hotelLive,    setHotelLive]    = useState(null);
  const [hotelLiveLoading, setHotelLiveLoading] = useState(false);
  const [hotelLiveError, setHotelLiveError] = useState('');
  const [savingCapacity, setSavingCapacity] = useState(false);

  const [toasts,       setToasts]       = useState([]);

  const addToast = (msg, type = 'success') => {
    const id = ++_toastId;
    setToasts((p) => [...p, { id, msg, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3500);
  };

  // ── load ──────────────────────────────────────────────────────────────────

  const toArray = (payload, keys = []) => {
    if (payload?.data && typeof payload.data === 'object' && !Array.isArray(payload.data) && Array.isArray(payload.data.data))
      return payload.data.data;
    for (const key of keys) {
      if (Array.isArray(payload?.[key])) return payload[key];
      if (Array.isArray(payload?.data?.[key])) return payload.data[key];
    }
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload)) return payload;
    return [];
  };

  const packageQuery = useAdminQuery('service-packages', async () => {
    const data = await adminJson('/api/admin/services');
    return toArray(data, ['services']).filter(p => p.category !== 'hotel' && String(p.name || '').trim().toLowerCase() !== 'pawsome extras');
  }, []);
  const promotionServicesQuery = useAdminQuery('promotion-services', async () => {
    const data = await adminJson('/api/admin/services?per_page=100');
    return toArray(data, ['services']).filter((service) => String(service?.name || '').trim().toLowerCase() !== 'pawsome extras');
  }, []);
  const suiteQuery = useAdminQuery('service-suites', async () => {
    const data = await adminJson('/api/admin/hotel-suites/inventory');
    return toArray(data).map(s => ({
      id: s.id, name: s.name, category: 'hotel',
      description: `${s.species_type || 'All pets'} · ${s.size_range || 'Standard'}`,
      needs_cage: true, is_active: s.is_available, appointments_count: 0,
      service_tiers: [{ id: s.id, size_label: s.size_range || 'Standard', price: s.price_per_night, duration_hours: 24 }],
    }));
  }, []);
  const categoryQuery = useAdminQuery('service-categories', async () => {
    const data = await adminJson('/api/service-categories');
    return data.categories || [];
  }, []);
  const addonQuery = useAdminQuery('service-addons', async () => {
    const data = await adminJson('/api/service-addons');
    return toArray(data, ['addons']);
  }, []);
  const packages = useMemo(() => [...packageQuery.data, ...suiteQuery.data], [packageQuery.data, suiteQuery.data]);
  const setPackages = update => {
    const next = typeof update === 'function' ? update(packages) : update;
    packageQuery.setData(next.filter(p => p.category !== 'hotel'));
    suiteQuery.setData(next.filter(p => p.category === 'hotel'));
  };
  const cats = categoryQuery.data;
  const addons = addonQuery.data;
  const addonsLoading = addonQuery.loading;
  const loadAddons = addonQuery.refresh;
  const loadPackages = () => Promise.all([packageQuery.refresh(), suiteQuery.refresh()]);
  const isLoading = filterCat === 'hotel' ? suiteQuery.loading : filterCat === 'all' ? packageQuery.loading && suiteQuery.loading : packageQuery.loading;
  const loadError = packageQuery.error || suiteQuery.error;
  const packageLoadStates = <>
    <AdminLoadState loading={packageQuery.refreshing} error={packageQuery.error} onRetry={packageQuery.refresh} />
    <AdminLoadState loading={suiteQuery.refreshing} error={suiteQuery.error} onRetry={suiteQuery.refresh} />
    {!isLoading && (packageQuery.loading || suiteQuery.loading) && <p role="status" className="px-4 py-2 text-xs text-brand-teal">Loading remaining packages…</p>}
    <AdminLoadState loading={addonQuery.refreshing} error={addonQuery.error} onRetry={addonQuery.refresh} />
    <AdminLoadState error={categoryQuery.error} onRetry={categoryQuery.refresh} />
  </>;

  const loadHotelLive = async () => {
    setHotelLiveLoading(true);
    setHotelLiveError('');
    try {
      const today = new Date().toISOString().slice(0, 10);
      let res = await adminGet(`/api/admin/hotel-suites/live-inventory?date=${today}&nights=1`);
      if (!res.ok) {
        // Fallback to dashboard overview shape if live endpoint is unavailable.
        res = await adminGet(`/api/admin/dashboard/overview?date=${today}`);
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Unable to load live hotel occupancy.');
      const payload = data?.data || data;
      setHotelLive(payload);
    } catch (error) {
      setHotelLive(null);
      setHotelLiveError(error?.message || 'Unable to load live hotel occupancy.');
    } finally {
      setHotelLiveLoading(false);
    }
  };

  const adjustClusterCapacity = async (cluster, delta) => {
    if (!hotelLive || savingCapacity) return;
    const rows = Array.isArray(hotelLive.cluster_breakdown) ? hotelLive.cluster_breakdown : [];
    const current = rows.find((row) => String(row?.cluster || '').toUpperCase() === cluster);
    const currentCap = Number(current?.capacity || 0);
    const nextCap = Math.max(0, currentCap + delta);
    if (nextCap === currentCap) return;

    const nextMap = rows.reduce((acc, row) => {
      const key = String(row?.cluster || '').toUpperCase();
      if (!['A', 'B', 'C', 'D'].includes(key)) return acc;
      acc[key] = Number(row?.capacity || 0);
      return acc;
    }, {});
    nextMap[cluster] = nextCap;

    setSavingCapacity(true);
    try {
      const res = await apiFetch('/api/admin/clinic/cages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clusters: nextMap }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Failed to update cluster capacity.');
      addToast(`Cluster ${cluster} capacity updated.`, 'success');
      await loadHotelLive();
    } catch (error) {
      addToast(error?.message || 'Failed to update capacity.', 'error');
    } finally {
      setSavingCapacity(false);
    }
  };

  useEffect(() => { if (showHotelOccupancy) loadHotelLive(); }, [showHotelOccupancy]);


  useEffect(() => {
    const onClickOutside = (event) => {
      if (filterRef.current && !filterRef.current.contains(event.target)) {
        setIsFilterOpen(false);
      }
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target)) {
        setActionMenuFor(null);
      }
      if (manageMenuRef.current && !manageMenuRef.current.contains(event.target)) {
        setIsManageMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  // ── stats ─────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    const active    = packages.filter((p) => p.is_active).length;
    const inactive  = packages.filter((p) => !p.is_active).length;
    const completed = packages.reduce((n, p) => n + (p.appointments_count || 0), 0);
    return { total: packages.length, active, inactive, completed };
  }, [packages]);

  // ── display cats (merge API + fallback) ───────────────────────────────────

  const displayCats = useMemo(() => {
    const map = new Map();
    cats.forEach((c) => map.set(c.slug, c));
    packages.forEach((p) => {
      if (!p?.category || map.has(p.category)) return;
      const fb = FALLBACK_CAT_META[p.category] || { name: p.category.charAt(0).toUpperCase() + p.category.slice(1), color: '#4DB6AC' };
      map.set(p.category, { id: `fb-${p.category}`, slug: p.category, ...fb });
    });
    return Array.from(map.values());
  }, [cats, packages]);

  // ── filter ────────────────────────────────────────────────────────────────

  const filterOptions = useMemo(() => [
    { value: 'all', label: 'ALL PACKAGES' },
    ...['daycare', 'grooming', 'hotel']
      .map((slug) => displayCats.find((c) => c.slug === slug))
      .filter(Boolean)
      .map((c) => ({ value: c.slug, label: c.name.toUpperCase() })),
  ], [displayCats]);

  const filterLabel = filterOptions.find((o) => o.value === filterCat)?.label ?? 'ALL PACKAGES';

  const packageCodeById = useMemo(() => {
    const categoryCounters = { grooming: 0, hotel: 0, daycare: 0, other: 0 };
    const map = new Map();

    for (const pkg of packages) {
      const explicitCode = pkg?.package_id || pkg?.package_code || pkg?.service_code || pkg?.display_id || null;

      if (explicitCode) {
        map.set(pkg.id, explicitCode);
        continue;
      }

      const category = String(pkg?.category || '').toLowerCase();
      const bucket = ['grooming', 'hotel', 'daycare'].includes(category) ? category : 'other';
      categoryCounters[bucket] += 1;
      const prefix = packagePrefix(category);
      map.set(pkg.id, `${prefix}${currentYY()}${String(categoryCounters[bucket]).padStart(2, '0')}`);
    }

    return map;
  }, [packages]);

  const filtered = useMemo(() => {
    let list = filterCat === 'all' ? packages : packages.filter((p) => p.category === filterCat);
    const q = search.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      String(packageCodeById.get(p.id) || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q),
    );
  }, [packages, filterCat, search, packageCodeById]);

  // ── delete ────────────────────────────────────────────────────────────────

  const doDelete = async () => {
    if (!deleteTarget?.id) { setDeleteTarget(null); return; }
    setIsDeleting(true);
    try {
      const url = deleteTarget.category === 'hotel'
        ? `/api/hotel-suites/${deleteTarget.id}`
        : `/api/admin/services/${deleteTarget.id}`;
      const res = await apiFetch(url, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Delete failed.');
      if (data?.queued) {
        setPackages((prev) => prev.filter((row) => row.id !== deleteTarget.id));
        addToast('Offline: package deletion queued.', 'success');
      } else {
        addToast('Package deleted.');
      }
      setDeleteTarget(null);
      await loadPackages();
    } catch {
      addToast('Failed to delete package.', 'error');
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const doDeactivate = async () => {
    if (!deactivateTarget?.id) { setDeactivateTarget(null); return; }
    setIsDeactivating(true);
    try {
      const url = deactivateTarget.category === 'hotel'
        ? `/api/hotel-suites/${deactivateTarget.id}`
        : `/api/admin/services/${deactivateTarget.id}`;
      const body = deactivateTarget.category === 'hotel'
        ? { is_available: false }
        : { is_active: false };
      const res = await apiFetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Deactivation failed.');
      if (data?.queued) {
        setPackages((prev) => prev.map((row) => {
          if (row.id !== deactivateTarget.id) return row;
          return deactivateTarget.category === 'hotel'
            ? { ...row, is_available: false, is_active: false }
            : { ...row, is_active: false };
        }));
        addToast('Offline: package deactivation queued.', 'success');
      } else {
        addToast('Package deactivated.');
      }
      setDeactivateTarget(null);
      await loadPackages();
    } catch {
      addToast('Failed to deactivate package.', 'error');
      setDeactivateTarget(null);
    } finally {
      setIsDeactivating(false);
    }
  };

  // ── stat tiles ────────────────────────────────────────────────────────────

  const totalTiles = displayCats.map((c) => ({
    label: c.name,
    value: packages.filter((p) => p.category === c.slug).length,
    note:  'package(s)',
    tone:  'brand',
  }));

  const activeInactiveTiles = [
    { label: 'Active Packages', value: stats.active, note: `${stats.active} available`, tone: 'emerald' },
    { label: 'Inactive Packages', value: stats.inactive, note: `${stats.total ? ((stats.inactive / stats.total) * 100).toFixed(1) : 0}% of total`, tone: 'red' },
  ];

  const completedTiles = displayCats.map((c) => ({
    label: c.name,
    value: packages.filter((p) => p.category === c.slug).reduce((n, p) => n + (p.appointments_count || 0), 0),
    note:  'completed records',
    tone:  'sky',
  }));

  return (
    <>
      {packageLoadStates}
      <div className="fixed right-4 top-4 z-[200] flex flex-col gap-2">
        {toasts.map((t) => (
          <div key={t.id} className={`rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg ${t.type === 'error' ? 'bg-red-500' : 'bg-brand-teal'}`}>
            {t.msg}
          </div>
        ))}
      </div>

      {!isDesktop ? (
        <ServicePage_MobileView
          isAdmin={isAdmin}
          loading={isLoading}
          loadError={loadError}
          search={search}
          onSearch={setSearch}
          filterCat={filterCat}
          onFilterCat={setFilterCat}
          filterOptions={filterOptions}
          packages={packages}
          rows={filtered}
          stats={stats}
          displayCats={displayCats}
          packageCodeById={packageCodeById}
          totalTiles={totalTiles}
          activeInactiveTiles={activeInactiveTiles}
          completedTiles={completedTiles}
          mobileSection={mobileSection}
          onMobileSectionChange={setMobileSection}
          onOpenHotelOccupancy={() => setShowHotelOccupancy(true)}
          onAddPackage={() => setShowAddPackage(true)}
          onEditPackage={setEditTarget}
              onDeactivatePackage={setDeactivateTarget}
              onDeletePackage={setDeleteTarget}
              addons={addons}
              addonsLoading={addonsLoading}
              onRefreshAddons={loadAddons}
              addToast={addToast}
          onManageAddons={() => setShowAddAddon(true)}
          onManagePromos={() => setShowPromos(true)}
            />
      ) : (
      <section className="space-y-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-extrabold text-brand-teal-dark">
              Service <span className="text-brand-dark">Management</span>
            </h1>
            <p className="text-sm text-brand-dark-soft">Manage packages under Grooming, Daycare, and Hotel.</p>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-2">
              <div ref={manageMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setIsManageMenuOpen((open) => !open)}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-teal px-5 py-2.5 text-sm font-semibold text-white shadow-[0_2px_8px_rgba(23,53,81,0.08)] transition-colors hover:bg-brand-teal-dark"
                >
                  Manage Services
                  <ChevronDown size={15} className={`transition-transform ${isManageMenuOpen ? 'rotate-180' : ''}`} />
                </button>
                {isManageMenuOpen && (
                  <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-48 overflow-hidden rounded-xl border border-brand-teal/20 bg-white shadow-lg">
                    <button
                      type="button"
                      onClick={() => { setShowAddPackage(true); setIsManageMenuOpen(false); }}
                      className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs font-semibold text-brand-dark transition-colors hover:bg-brand-teal/10"
                    >
                      <Box size={14} className="text-brand-teal" />
                      Add Package
                    </button>
                    <button type="button" onClick={() => { setShowPromos(true); setIsManageMenuOpen(false); }} className="flex w-full items-center gap-2 border-t border-brand-teal/10 px-4 py-2.5 text-left text-xs font-semibold text-brand-dark transition-colors hover:bg-brand-teal/10"><GiftIcon /> Promo Management</button>
                    <button
                      type="button"
                      onClick={() => { setShowAddAddon(true); setIsManageMenuOpen(false); }}
                      className="flex w-full items-center gap-2 border-t border-brand-teal/10 px-4 py-2.5 text-left text-xs font-semibold text-brand-dark transition-colors hover:bg-brand-teal/10"
                    >
                      <Plus size={14} className="text-brand-teal" />
                      Add Pawsome Extras
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowHotelOccupancy(true); setIsManageMenuOpen(false); }}
                      className="flex w-full items-center gap-2 border-t border-brand-teal/10 px-4 py-2.5 text-left text-xs font-semibold text-brand-dark transition-colors hover:bg-brand-teal/10"
                    >
                      <ChevronDown size={14} className="rotate-[-90deg] text-brand-teal" />
                      Hotel Occupancy
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>



        <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-4">

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <ServiceStatBox loading={packageQuery.loading || suiteQuery.loading}
                title="TOTAL PACKAGES"
                value={stats.total}
                note={`${stats.active} active package${stats.active !== 1 ? 's' : ''}`}
                modalTitle="Total Packages"
                modalSubtitle="All packages across every service category"
                tiles={totalTiles}
                insight={`${stats.total} total package${stats.total !== 1 ? 's' : ''} across ${displayCats.length} service categor${displayCats.length !== 1 ? 'ies' : 'y'}.`}
              />
              <ServiceStatBox loading={packageQuery.loading || suiteQuery.loading}
                title="ACTIVE PACKAGES"
                value={stats.active}
                note={`${stats.active} available`}
                modalTitle="Active Packages"
                modalSubtitle="Current package availability"
                tiles={activeInactiveTiles}
                insight={`${stats.active} package${stats.active !== 1 ? 's are' : ' is'} currently active.`}
              />
              <ServiceStatBox loading={packageQuery.loading || suiteQuery.loading}
                title="COMPLETED RECORDS"
                value={stats.completed}
                note="Total completed appointments"
                modalTitle="Completed Records"
                modalSubtitle="Appointments completed per category"
                tiles={completedTiles}
                insight={`${stats.completed} completed appointment${stats.completed !== 1 ? 's' : ''} across all packages.`}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[180px] flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-dark-soft/60" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search packages..."
                  className="w-full rounded-xl border border-brand-teal/30 bg-white py-2.5 pl-9 pr-4 text-sm text-brand-dark placeholder:text-brand-dark-soft/50 focus:border-brand-teal focus:outline-none"
                />
              </div>
              <div ref={filterRef} className="relative w-[210px] shrink-0">
                <button
                  type="button"
                  onClick={() => setIsFilterOpen((open) => !open)}
                  className={`inline-flex w-[210px] items-center justify-between gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold transition ${isFilterOpen ? 'border-brand-teal bg-brand-teal text-white shadow-[0_4px_10px_rgba(36,119,122,0.25)]' : 'border-brand-teal bg-white text-brand-dark shadow-[0_2px_8px_rgba(23,53,81,0.08)]'}`}
                >
                  <span className="truncate">{filterLabel}</span>
                  <ChevronDown size={13} className={`shrink-0 transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
                </button>
                {isFilterOpen && (
                  <div className="absolute left-0 top-full z-20 mt-1 w-[210px] overflow-hidden rounded-xl border border-brand-teal/20 bg-white shadow-lg">
                    {filterOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => { setFilterCat(option.value); setIsFilterOpen(false); }}
                        className={`block w-full px-4 py-2 text-left text-xs font-bold transition-colors ${filterCat === option.value ? 'bg-brand-teal text-white' : 'text-brand-dark hover:bg-brand-dark/5'}`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-brand-teal/20 bg-white shadow-[0_6px_12px_rgba(23,53,81,0.08)]">
              <button
                type="button"
                onClick={() => setShowPackageTable((open) => !open)}
                className="flex w-full items-center justify-between border-b border-brand-teal/20 bg-white px-4 py-3 text-left transition-colors hover:bg-brand-dark/5"
              >
                <div>
                  <p className="text-sm font-extrabold text-brand-dark">Packages</p>
                  <p className="text-[11px] text-brand-dark-soft">Service packages under Grooming, Daycare, and Hotel</p>
                </div>
                <ChevronDown size={16} className={`shrink-0 text-brand-teal transition-transform ${showPackageTable ? 'rotate-180' : ''}`} />
              </button>
              {showPackageTable ? (
              <div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-brand-teal/15 bg-white">
                      {['PACKAGE ID', 'PACKAGE NAME', 'CATEGORY', 'TIERS', 'DESCRIPTION', 'STATUS', ...(isAdmin ? ['ACTIONS'] : [])].map((col) => (
                        <th
                          key={col}
                          className={`px-4 py-3 text-[11px] font-extrabold uppercase tracking-wider text-brand-dark ${col === 'STATUS' || col === 'ACTIONS' ? 'text-center' : 'text-left'}`}
                        >
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading && <tr><td colSpan={8}><AdminSkeleton label="Loading packages" /></td></tr>}
                    {!isLoading && !packageQuery.error && !suiteQuery.error && filtered.length === 0 && (
                      <tr>
                        <td colSpan={isAdmin ? 7 : 6} className="px-4 py-8 text-center text-sm font-semibold text-brand-dark-soft">No packages found.</td>
                      </tr>
                    )}
                    {!isLoading && filtered.map((pkg, idx) => {
                      const color = catColor(displayCats, pkg.category);
                      return (
                        <tr
                          key={pkg.id}
                          onClick={() => setSelectedView({ type: 'package', item: pkg })}
                          className={`cursor-pointer border-b border-brand-teal/10 transition-colors last:border-b-0 hover:bg-brand-dark/5 ${selectedView?.type === 'package' && selectedView?.item?.id === pkg.id ? 'bg-brand-teal/10' : ''}`}
                        >
                          <td className="px-4 py-3 text-xs font-bold text-brand-dark-soft">
                            {packageCodeById.get(pkg.id) || `S${String(idx + 1).padStart(3, '0')}`}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-semibold text-brand-dark">{pkg.name}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                              <span className="text-xs text-brand-dark-soft">{catLabel(displayCats, pkg.category)}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs text-brand-dark-soft">{pkg.service_tiers?.length || 0}</td>
                          <td className="max-w-[160px] truncate px-4 py-3 text-xs text-brand-dark-soft 2xl:max-w-[220px]">{pkg.description || '—'}</td>
                          <td className="px-4 py-3 text-center"><StatusBadge active={pkg.is_active} /></td>
                          {isAdmin && (
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={(event) => { event.stopPropagation(); setEditTarget(pkg); }}
                                  aria-label="Edit service"
                                  className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-brand-teal/35 bg-brand-teal/10 text-brand-teal-dark transition-colors hover:bg-brand-teal/20"
                                >
                                  <Pencil size={12} />
                                </button>
                                <div ref={actionMenuFor === pkg.id ? actionMenuRef : null} className="relative">
                                  <button
                                    type="button"
                                    onClick={(event) => { event.stopPropagation(); setActionMenuFor((prev) => (prev === pkg.id ? null : pkg.id)); }}
                                    className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-500 transition-colors hover:bg-red-100"
                                    aria-label="Action options"
                                    title="Action options"
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                  {actionMenuFor === pkg.id && (
                                    <div className={`absolute right-0 z-20 w-32 overflow-hidden rounded-lg border border-brand-teal/20 bg-white shadow-lg ${
                                      idx >= filtered.length - 2 ? 'bottom-[calc(100%+6px)]' : 'top-[calc(100%+6px)]'
                                    }`}>
                                      {pkg.is_active && (
                                        <button
                                          type="button"
                                          onClick={(event) => { event.stopPropagation(); setDeactivateTarget(pkg); setActionMenuFor(null); }}
                                          className="w-full px-3 py-2 text-left text-xs font-semibold text-brand-dark hover:bg-brand-dark/5"
                                        >
                                          Deactivate
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        onClick={(event) => { event.stopPropagation(); setDeleteTarget(pkg); setActionMenuFor(null); }}
                                        className={`w-full px-3 py-2 text-left text-xs font-semibold text-red-500 hover:bg-red-50 ${pkg.is_active ? 'border-t border-brand-teal/15' : ''}`}
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!isLoading && filtered.length > 0 && (
                <div className="border-t border-brand-teal/10 px-4 py-2 text-[11px] text-brand-dark-soft">
                  Showing {filtered.length} of {packages.length} package{packages.length !== 1 ? 's' : ''}
                </div>
              )}
              </div>
              ) : null}
            </div>

            <AddonsPanel
              addons={addons}
              loading={addonsLoading}
              isAdmin={isAdmin}
              onRefresh={loadAddons}
              addToast={addToast}
              selectedAddonKey={selectedView?.type === 'addon' ? selectedView.item?.key : null}
              onSelectAddon={(addonGroup) => setSelectedView({ type: 'addon', item: addonGroup })}
            />
          </div>

          <ServiceViewPanel
            selected={selectedView}
            cats={displayCats}
            packageCodeById={packageCodeById}
          />
        </div>
      </section>
      )}

      {deactivateTarget && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 backdrop-blur-sm bg-brand-dark/40 h-[100dvh] min-h-[100dvh] w-screen" onClick={() => !isDeactivating && setDeactivateTarget(null)}>
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between bg-brand-teal px-5 py-3.5">
              <h2 className="text-sm font-bold text-white">Deactivate Package</h2>
              <button type="button" onClick={() => setDeactivateTarget(null)} disabled={isDeactivating} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 disabled:opacity-50">
                <span className="text-base leading-none">×</span>
              </button>
            </div>
            <div className="h-1 bg-brand-teal-light" />
            <div className="px-5 py-5">
              <p className="text-sm text-brand-dark">
                Deactivate <strong>{deactivateTarget.name}</strong>? It will be hidden from bookings but can be reactivated later.
              </p>
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => setDeactivateTarget(null)} disabled={isDeactivating} className="flex-1 rounded-xl border border-brand-teal/20 py-2 text-sm text-brand-dark hover:bg-gray-50 disabled:opacity-50">
                  Cancel
                </button>
                <button type="button" onClick={doDeactivate} disabled={isDeactivating} className="flex-1 rounded-xl bg-brand-teal py-2 text-sm font-bold text-white hover:bg-brand-teal-dark disabled:opacity-50">
                  {isDeactivating ? 'Deactivating...' : 'Deactivate'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <HotelSuiteOccupancyModal
        isOpen={showHotelOccupancy}
        onClose={() => {
          setShowHotelOccupancy(false);
          if (!isDesktop) setMobileSection('home');
        }}
        live={hotelLive}
        loading={hotelLiveLoading}
        error={hotelLiveError}
        busy={savingCapacity}
        onAdjust={adjustClusterCapacity}
      />

      {showAddPackage && (
        <AddPackageModal
          cats={displayCats}
          actionLabel={!isDesktop ? 'Add Service' : undefined}
          onClose={() => {
            setShowAddPackage(false);
            if (!isDesktop) setMobileSection('home');
          }}
          onSaved={() => {
            loadPackages();
            addToast('Package added.');
            setShowAddPackage(false);
            if (!isDesktop) setMobileSection('home');
          }}
        />
      )}

      {showPromos && (
        <PromoManagement
          services={promotionServicesQuery.data}
          onClose={() => {
            setShowPromos(false);
            if (!isDesktop) setMobileSection('home');
          }}
          addToast={addToast}
        />
      )}

      {showAddAddon && (
        <AddAddonModal
          onClose={() => setShowAddAddon(false)}
          onSaved={() => { loadAddons(); addToast('Pawsome Extra added.'); setShowAddAddon(false); }}
        />
      )}

      {editTarget && (
        <EditPackageModal
          service={editTarget}
          cats={displayCats}
          onClose={() => setEditTarget(null)}
          onSaved={() => { loadPackages(); addToast('Package updated.'); setEditTarget(null); }}
        />
      )}

      <DeletePackageModal
        pkg={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={doDelete}
        isDeleting={isDeleting}
      />

    </>
  );
}
