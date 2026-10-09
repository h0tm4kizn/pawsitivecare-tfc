import { useState } from 'react';
import { AdminSkeleton } from '../../../../components/admin/AdminLoading';
import { ArrowLeft, ChevronDown, ChevronRight, Gift, Pencil, Plus, Search, Settings, Trash2 } from 'lucide-react';
import StatusBadge from '../../../../components/StatusBadge';
import SelectDropdown from '../../../../components/reusable-ui/SelectDropdown';
import ServiceStatBox from '../ServiceStatBox';
import AddonsPanel from '../AddonsPanel';

const SERVICE_CATEGORY_COLORS = {
  grooming: '#a78bfa',
  hotel: '#fb7185',
  daycare: '#fbbf24',
};

const catColor = (cats, slug) => SERVICE_CATEGORY_COLORS[slug] || cats.find((cat) => cat.slug === slug)?.color || SERVICE_CATEGORY_COLORS.grooming;
const catLabel = (cats, slug) => cats.find((cat) => cat.slug === slug)?.name || slug;

export default function ServicePage_MobileView({
  isAdmin = false,
  loading = false,
  loadError = '',
  search = '',
  onSearch,
  filterCat = 'all',
  onFilterCat,
  filterOptions = [],
  packages = [],
  rows = [],
  stats = {},
  displayCats = [],
  packageCodeById = new Map(),
  totalTiles = [],
  activeInactiveTiles = [],
  completedTiles = [],
  mobileSection = 'home',
  onMobileSectionChange,
  onAddPackage,
  onManagePromos,
  onManageAddons,
  onOpenHotelOccupancy,
  onEditPackage,
  onDeactivatePackage,
  onDeletePackage,
  addons = [],
  addonsLoading = false,
  onRefreshAddons,
  addToast,
}) {
  const [packagesOpen, setPackagesOpen] = useState(false);
  return (
    <section className="min-w-0 space-y-4 overflow-x-hidden px-4 pb-10 pt-5 font-poppins">
      {mobileSection === 'settings' ? (
        <>
          <div className="flex min-w-0 items-center gap-2">
            <button type="button" onClick={() => onMobileSectionChange?.('home')} aria-label="Back to Service Management" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-brand-teal-dark hover:bg-brand-teal/10"><ArrowLeft size={19} /></button>
            <div className="min-w-0">
              <h1 className="text-xl font-extrabold leading-tight text-brand-teal-dark">Service Settings</h1>
              <p className="mt-0.5 text-xs text-brand-dark-soft">Choose a management tool.</p>
            </div>
          </div>
          <div className="divide-y divide-brand-teal/10 overflow-hidden rounded-2xl border border-brand-teal/15 bg-white shadow-sm">
            {isAdmin && <>
              <MobileNavOption
                icon={Plus}
                title="Add Service"
                description="Create a service and its pricing tiers."
                onClick={() => { onMobileSectionChange?.('home'); onAddPackage?.(); }}
              />
              <MobileNavOption
                icon={Gift}
                title="Promo Management"
                description="Create, edit, and manage promotions."
                onClick={() => { onMobileSectionChange?.('home'); onManagePromos?.(); }}
              />
              <MobileNavOption
                icon={ChevronRight}
                title="Hotel Management"
                description="Review Hotel Suite occupancy and capacity."
                onClick={() => { onMobileSectionChange?.('home'); onOpenHotelOccupancy?.(); }}
              />
            </>}
            {!isAdmin && <p className="px-4 py-5 text-sm text-brand-dark-soft">No service management options are available for your role.</p>}
          </div>
        </>
      ) : (
        <>
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-extrabold leading-tight text-brand-teal-dark">Service <span className="text-brand-dark">Management</span></h1>
              <p className="mt-1 text-xs text-brand-dark-soft">Browse packages, pricing, and Pawsome Extras.</p>
            </div>
            {isAdmin && <button type="button" onClick={() => onMobileSectionChange?.('settings')} aria-label="Service Management Settings" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-brand-teal/20 bg-white text-brand-teal-dark hover:bg-brand-teal/10"><Settings size={20} /></button>}
          </div>

      <div className="grid min-w-0 grid-cols-2 gap-3 max-[350px]:grid-cols-1">
        <ServiceStatBox loading={loading}
          title="Packages"
          value={stats.total ?? packages.length}
          note={`${stats.active ?? 0} active`}
          modalTitle="Total Packages"
          modalSubtitle="All packages across every service category."
          tiles={totalTiles}
          insight={`${stats.total ?? 0} total package${(stats.total ?? 0) === 1 ? '' : 's'} across ${displayCats.length} service categories.`}
        />
        <ServiceStatBox loading={loading}
          title="Active"
          value={stats.active ?? 0}
          note={`${stats.inactive ?? 0} inactive`}
          modalTitle="Package Availability"
          modalSubtitle="Current package availability."
          tiles={activeInactiveTiles}
          insight={`${stats.active ?? 0} package${(stats.active ?? 0) === 1 ? ' is' : 's are'} currently active.`}
        />
        <ServiceStatBox loading={loading}
          title="Records"
          value={stats.completed ?? 0}
          note="Completed"
          modalTitle="Completed Records"
          modalSubtitle="Appointments completed per category."
          tiles={completedTiles}
          insight={`${stats.completed ?? 0} completed appointment${(stats.completed ?? 0) === 1 ? '' : 's'} across all packages.`}
        />
        <ServiceStatBox loading={loading}
          title="Pawsome Extras"
          value={addons.length}
          note={`${addons.filter((addon) => addon.is_active).length} active`}
          modalTitle="Pawsome Extras"
          modalSubtitle="Pawsome Extras available for bookings."
          tiles={[
            { label: 'Total Pawsome Extras', value: addons.length, note: 'Configured Pawsome Extras', tone: 'brand' },
            { label: 'Active Pawsome Extras', value: addons.filter((addon) => addon.is_active).length, note: 'Available', tone: 'emerald' },
          ]}
          insight="Pawsome Extras can be managed from the panel below."
        />
      </div>

      <div className="space-y-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-dark-soft/60" />
          <input
            value={search}
            onChange={(event) => onSearch?.(event.target.value)}
            placeholder="Search packages..."
            className="w-full rounded-xl border border-brand-teal/30 bg-white py-2.5 pl-9 pr-4 text-sm text-brand-dark placeholder:text-brand-dark-soft/50 focus:border-brand-teal focus:outline-none"
          />
        </div>
        <SelectDropdown
          value={filterCat}
          onChange={onFilterCat}
          options={filterOptions}
        />
      </div>

      <div className="min-w-0 overflow-hidden rounded-xl border border-brand-teal/20 bg-white">
        <button type="button" onClick={() => setPackagesOpen((open) => !open)} aria-expanded={packagesOpen} className="flex min-h-14 w-full items-center justify-between gap-3 px-4 py-3 text-left">
          <span className="min-w-0"><span className="block text-sm font-extrabold text-brand-dark">Packages</span><span className="block text-[11px] text-brand-dark-soft">Service packages under Grooming, Daycare, and Hotel</span></span>
          <ChevronDown size={18} className={`shrink-0 text-brand-teal transition-transform duration-200 ${packagesOpen ? 'rotate-180' : ''}`} />
        </button>
        {packagesOpen && <div className="space-y-3 border-t border-brand-teal/15 p-3">
          {loading ? <AdminSkeleton label="Loading packages" /> : loadError && rows.length === 0 ? <p className="px-2 py-5 text-sm text-red-600">{loadError?.message || String(loadError)}</p> : rows.length === 0 ? <p className="px-2 py-5 text-center text-sm text-brand-dark-soft">No packages found.</p> : Array.from(new Set(rows.map((pkg) => pkg.category))).map((category) => <div key={category} className="space-y-2">
            <h3 className="px-1 text-xs font-bold uppercase tracking-wide text-brand-teal-dark">{catLabel(displayCats, category)}</h3>
            {rows.filter((pkg) => pkg.category === category).map((pkg) => <article key={pkg.id} className="min-w-0 rounded-xl border border-brand-teal/15 bg-white p-3">
            <div className="flex min-w-0 items-start justify-between gap-2"><div className="min-w-0"><h4 className="break-words text-sm font-bold text-brand-dark">{pkg.name}</h4><p className="mt-0.5 text-[11px] text-brand-dark-soft">{packageCodeById.get(pkg.id) || pkg.package_code || '—'}</p></div><StatusBadge active={pkg.is_active} /></div>
            <dl className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between gap-3"><dt className="shrink-0 text-brand-dark-soft">Service</dt><dd className="min-w-0 text-right font-semibold text-brand-dark"><span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: catColor(displayCats, pkg.category) }} />{catLabel(displayCats, pkg.category)}</dd></div>
              {(pkg.service_tiers || []).map((tier) => <div key={tier.id || tier.size_label} className="flex justify-between gap-3"><dt className="min-w-0 break-words text-brand-dark-soft">{tier.size_label || 'Standard'}</dt><dd className="min-w-0 break-words text-right font-semibold text-brand-teal-dark">PHP {Number(tier.price || 0).toLocaleString('en-PH')}{tier.price_max ? ` - PHP ${Number(tier.price_max).toLocaleString('en-PH')}` : ''}</dd></div>)}
              {pkg.description && <div><dt className="text-brand-dark-soft">Description</dt><dd className="mt-0.5 break-words text-brand-dark">{pkg.description}</dd></div>}
            </dl>
            {isAdmin && <div className="mt-3 flex flex-wrap gap-2 border-t border-brand-teal/10 pt-3"><button type="button" onClick={() => onEditPackage?.(pkg)} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-brand-teal/30 px-3 text-xs font-semibold text-brand-teal-dark"><Pencil size={14} />Edit</button>{pkg.is_active && <button type="button" onClick={() => onDeactivatePackage?.(pkg)} className="min-h-10 rounded-lg border border-brand-teal/30 px-3 text-xs font-semibold text-brand-teal-dark">Deactivate</button>}<button type="button" onClick={() => onDeletePackage?.(pkg)} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-600"><Trash2 size={14} />Delete</button></div>}
          </article>)}
          </div>)}
          {!loading && rows.length > 0 && <p className="px-1 text-[11px] text-brand-dark-soft">Showing {rows.length} of {packages.length} packages</p>}
        </div>}
      </div>

      <div className="min-w-0 max-w-full space-y-4 overflow-hidden">
        <AddonsPanel
          addons={addons}
          loading={addonsLoading}
          isAdmin={isAdmin}
          onRefresh={onRefreshAddons}
          addToast={addToast}
          mobileCards
          onAdd={isAdmin ? onManageAddons : undefined}
        />
      </div>
        </>
      )}
    </section>
  );
}

function MobileNavOption({ icon: Icon, title, description, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[76px] w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-brand-teal/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-teal"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-teal/10 text-brand-teal-dark">
        <Icon size={19} aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-brand-dark">{title}</span>
        <span className="mt-0.5 block text-xs leading-4 text-brand-dark-soft">{description}</span>
      </span>
      <ChevronRight size={18} className="shrink-0 text-brand-dark-soft" aria-hidden="true" />
    </button>
  );
}
