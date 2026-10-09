import { CalendarPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiFetch } from '../api/apiClient';
import Loading from '../components/Loading';
import { AdminSkeleton } from '../components/admin/AdminLoading';
import useBodyScrollLock from '../hooks/useBodyScrollLock';
import { formatHotelDescription } from '../utils/textUtils';

const PESO = '\u20B1';

const CATEGORY_META = {
  grooming: {
    label: 'Grooming',
    icon: 'fa-scissors',
    header: 'bg-brand-grooming',
    headerText: 'text-white',
    close: 'text-white/75 hover:text-white',
    button: 'bg-brand-grooming hover:brightness-95',
  },
  daycare: {
    label: 'Pet Daycare',
    icon: 'fa-bone',
    header: 'bg-brand-daycare',
    headerText: 'text-white',
    close: 'text-white/75 hover:text-white',
    button: 'bg-brand-daycare text-brand-dark hover:brightness-95',
  },
  hotel: {
    label: 'Pet Hotel',
    icon: 'fa-hotel',
    header: 'bg-brand-hotel',
    headerText: 'text-white',
    close: 'text-white/75 hover:text-white',
    button: 'bg-brand-hotel hover:brightness-95',
  },
};

const SUITE_ORDER = {
  'The Cozy Paw Suite': 1,
  'The Happy Paws Suite': 2,
  'The Grand Paw Suite': 3,
  'The VIPaws Suite': 4,
  'The Cozy Whiskers': 5,
  'The Grand Purr Suite': 6,
  'The VIPurr Villa': 7,
};

const sortSuitesByDisplayOrder = (a, b) => {
  const aOrder = SUITE_ORDER[a?.name] ?? 999;
  const bOrder = SUITE_ORDER[b?.name] ?? 999;
  if (aOrder !== bOrder) return aOrder - bOrder;
  return String(a?.name ?? '').localeCompare(String(b?.name ?? ''));
};

const SIZE_RANGE_MAP = {
  S: 'up to 5kg',
  M: '6-10kg',
  L: '11-15kg',
  XL: '15-20kg',
  XXL: '20kg up',
  GIANT: '20kg up',
};

function formatTierSizeLabel(rawLabel) {
  const label = String(rawLabel || '').trim();
  if (!label) return 'N/A';

  const normalized = label.toUpperCase();
  if (normalized === 'CAT') return 'CAT (feline size)';

  const sizeRange = SIZE_RANGE_MAP[normalized];
  if (sizeRange) return `${normalized} (${sizeRange})`;

  return label;
}

function formatTierPrice(tier, suffix = '') {
  const price = Number(tier?.price || 0).toLocaleString();
  const priceMax = tier?.price_max ? Number(tier.price_max).toLocaleString() : null;
  return priceMax ? `${PESO}${price} - ${PESO}${priceMax}${suffix}` : `${PESO}${price}${suffix}`;
}

const extractRows = (payload = {}) => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.data)) return payload.data.data;
  if (Array.isArray(payload?.addons)) return payload.addons;
  if (Array.isArray(payload?.data?.addons)) return payload.data.addons;
  return [];
};

const isActiveGroomingExtra = (row) => {
  const category = String(row?.category || '').toLowerCase();
  const active = row?.is_active !== false && row?.is_active !== 0 && row?.is_active !== '0';
  const applies = row?.applies_to_grooming === true || row?.applies_to_grooming === 1 || row?.applies_to_grooming === '1';
  const legacy = ['grooming_extra', 'grooming_addon', 'treatment'].includes(category);
  const hasScope = category || row?.applies_to_grooming != null;
  return active && (!hasScope || applies || legacy);
};

export default function ServiceViewAllModal({ isOpen, onClose, onOpenLogin, selectedCategory = 'grooming' }) {
  useBodyScrollLock(isOpen);
  const [activeCategory, setActiveCategory] = useState(selectedCategory);
  const [catalog,      setCatalog]      = useState([]);
  const [groomingExtras, setGroomingExtras] = useState([]);
  const [suites,       setSuites]       = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [hotelSpecies, setHotelSpecies] = useState('dog');

  useEffect(() => {
    if (isOpen) setActiveCategory(selectedCategory);
  }, [isOpen, selectedCategory]);

  useEffect(() => {
    if (!isOpen) return;
    const fetchData = async () => {
      setLoading(true);
      try {
        const [catalogData, suitesData, extrasData] = await Promise.all([
          apiFetch('/api/services/catalog').then((r) => r.json()),
          apiFetch('/api/public/hotel-suites').then((r) => r.json()),
          apiFetch(`/api/booking/addons?category=grooming&_=${Date.now()}`).then((r) => r.json()),
        ]);
        setCatalog(Array.isArray(catalogData.data) ? catalogData.data : []);
        setSuites(Array.isArray(suitesData) ? suitesData : suitesData.data ?? []);
        setGroomingExtras(extractRows(extrasData).filter(isActiveGroomingExtra));
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [isOpen]);

  if (!isOpen) return null;

  const groomingServices = catalog.filter((s) => (
    s.category === 'grooming' && String(s?.name || '').trim().toLowerCase() !== 'pawsome extras'
  ));
  const daycareServices  = catalog.filter((s) => s.category === 'daycare');
  const filteredSuites   = suites
    .filter((s) => s.species_type === hotelSpecies)
    .sort(sortSuitesByDisplayOrder);
  const meta = CATEGORY_META[activeCategory] || CATEGORY_META.grooming;

  return createPortal(
    <div className="fixed inset-0 z-50 flex h-[100dvh] min-h-[100dvh] w-screen items-center justify-center p-4">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0 backdrop-blur-sm bg-brand-dark/40"
        aria-label="Close"
      />

      <div
        className="relative z-10 w-full max-w-2xl rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className={`${meta.header} px-5 py-4 flex items-center justify-between shrink-0`}>
          <div className="flex items-center gap-2">
            <i className={`fa-solid ${meta.icon} ${meta.headerText} text-lg`} />
            <h2 className={`font-bauhaus font-extrabold text-xl tracking-wide ${meta.headerText}`}>{meta.label} Services</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
            aria-label="Close"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto px-5 py-5 space-y-3 flex-1">
          {loading ? (
            <AdminSkeleton variant="cards" label="Loading services" />
          ) : activeCategory === 'hotel' ? (
            <HotelContent
              suites={filteredSuites}
              hotelSpecies={hotelSpecies}
              onSpeciesChange={setHotelSpecies}
            />
          ) : (
            <CatalogContent
              services={activeCategory === 'grooming' ? groomingServices : daycareServices}
              accent={activeCategory === 'grooming' ? 'grooming' : 'daycare'}
              groomingExtras={groomingExtras}
            />
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-brand-dark-light px-5 py-4 flex justify-end shrink-0">
          <button
            type="button"
            onClick={() => { onClose(); onOpenLogin(); }}
            className={`flex items-center gap-1.5 rounded-xl px-6 py-2.5 text-sm font-bold transition-colors ${meta.headerText === 'text-white' ? 'text-white' : ''} ${meta.button}`}
          >
            <CalendarPlus size={14} />
            Book Now
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

/* Hotel tab */
function HotelContent({ suites, hotelSpecies, onSpeciesChange }) {
  const hotelDescription = suites.find((suite) => suite.description)?.description || '';
  return (
    <>
      <div className="flex gap-2 mb-1">
        {['dog', 'cat'].map((sp) => (
          <button
            key={sp}
            type="button"
            onClick={() => onSpeciesChange(sp)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${
              hotelSpecies === sp
                ? 'bg-brand-hotel text-white'
                : 'bg-brand-hotel-soft text-brand-hotel border border-brand-hotel/30 hover:bg-brand-hotel/20'
            }`}
          >
            {sp === 'dog' ? 'Dogs' : 'Cats'}
          </button>
        ))}
      </div>

      <div className="mb-3 rounded-xl border border-brand-hotel/25 bg-brand-hotel/5 px-3 py-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-hotel">Size Guide</p>
        <p className="mt-1 text-xs text-brand-dark-soft">
          Small (up to 5kg), Medium (6-10kg), Large (11-15kg), XL (15-20kg), XXL (20kg up)
        </p>
      </div>

      {hotelDescription && (
        <p className="mb-3 rounded-xl border border-brand-hotel/20 bg-brand-hotel-soft/40 px-3 py-2 text-xs leading-relaxed text-brand-dark-soft">
          {formatHotelDescription(hotelDescription)}
        </p>
      )}

      {suites.length === 0 ? (
        <p className="text-center text-sm text-brand-dark-soft py-6">No suites available.</p>
      ) : (
        suites.map((suite) => (
          <div
            key={suite.id}
            className="rounded-xl border border-brand-dark-light p-4 flex items-start justify-between gap-4"
          >
            <div className="flex-1 min-w-0">
              <p className="font-bold text-brand-dark text-sm">{suite.name}</p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {suite.size_range && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider bg-brand-hotel/10 text-brand-hotel px-2 py-0.5 rounded-full">
                    {suite.size_range}
                  </span>
                )}
                <span className="text-[10px] text-brand-dark-soft">
                  Capacity: {suite.capacity} {suite.capacity === 1 ? 'pet' : 'pets'}
                </span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-lg font-extrabold text-brand-hotel">
                {PESO}{Number(suite.price_per_night).toLocaleString()}
              </p>
              <p className="text-[10px] text-brand-dark-soft">per night</p>
            </div>
          </div>
        ))
      )}
    </>
  );
}
function CatalogContent({ services, accent, groomingExtras = [] }) {
  const [groomingSpecies, setGroomingSpecies] = useState('dog');
  const colorMap = {
    grooming: { text: 'text-brand-grooming', bg: 'bg-brand-grooming-soft', border: 'border-brand-grooming/30', body: 'text-brand-dark' },
    daycare:  { text: 'text-brand-daycare',  bg: 'bg-brand-daycare-soft',  border: 'border-brand-daycare/40',  body: 'text-brand-dark' },
  };
  const { text, bg, border, body } = colorMap[accent];

  if (services.length === 0) {
    return <p className="text-center text-sm text-brand-dark-soft py-6">No services available.</p>;
  }

  if (accent === 'daycare') {
    const allTiers = services.flatMap((s) => s.tiers ?? s.service_tiers ?? []);
    const DURATION_GROUPS = [
      { key: 'hourly', label: 'Hourly', match: (t) => /hourly/i.test(t.size_label), suffix: ' / hour' },
      { key: 'half_day', label: 'Half Day Package', match: (t) => /half.?day/i.test(t.size_label), suffix: '' },
      { key: 'full_day', label: 'Full Day Package', match: (t) => /full.?day/i.test(t.size_label), suffix: '' },
    ];
    const normalizeSize = (raw) => String(raw || '')
      .replace(/^(hourly|half.?day|full.?day)\s*-\s*/i, '')
      .replace(/^upgrade\s*/i, '')
      .trim();
    return (
      <div className="space-y-3">
        <p className="text-[11px] font-semibold text-amber-600 flex items-center gap-1.5">
          <i className="fa-solid fa-dog text-xs" />
          Daycare is available for dogs only.
        </p>
        <div className="rounded-xl border border-brand-daycare/35 bg-brand-daycare/10 px-3 py-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-daycare">Size Guide</p>
          <p className="mt-1 text-xs text-brand-dark-soft">
            Small (up to 5kg), Medium (6-10kg), Large (11-15kg), XL (15-20kg), XXL (20kg up)
          </p>
        </div>
        {DURATION_GROUPS.map(({ key, label, match, suffix }) => {
          const tiers = allTiers.filter(match);
          if (!tiers.length) return null;
          return (
            <div key={key} className={`rounded-xl border ${border} overflow-hidden`}>
              <div className={`${bg} px-4 py-3`}>
                <p className={`font-bold text-sm ${text}`}>{label}</p>
              </div>
              <div className="divide-y divide-brand-dark-light/50">
                {tiers.map((tier, i) => (
                  <div key={i} className="flex items-center justify-between px-4 py-2.5 gap-3">
                    <span className={`text-xs font-semibold ${body}`}>{formatTierSizeLabel(normalizeSize(tier.size_label))}</span>
                    <span className={`text-sm font-extrabold ${text} shrink-0`}>
                      {formatTierPrice(tier, suffix)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  const CAT_SIZES = ['CAT', 'KITTEN'];

  return (
    <>
      {/* Grooming catalog tabs */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {[
          { key: 'dog', label: 'Dog Packages' },
          { key: 'cat', label: 'Cat Packages' },
          { key: 'extras', label: 'Pawsome Extras' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setGroomingSpecies(tab.key)}
            className={`min-h-10 rounded-xl px-2 py-2 text-[11px] font-bold transition-colors sm:text-xs ${
              groomingSpecies === tab.key
                ? 'bg-brand-grooming text-white'
                : 'bg-brand-grooming-soft text-brand-grooming border border-brand-grooming/30'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {groomingSpecies !== 'extras' && <div className="rounded-xl border border-brand-grooming/35 bg-brand-grooming/10 px-3 py-2 mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-grooming">Size Guide</p>
        <p className="mt-1 text-xs text-brand-dark-soft">
          {groomingSpecies === 'cat'
            ? 'Cat, Kitten'
            : 'Small (up to 5kg), Medium (6-10kg), Large (11-15kg), XL (15-20kg), XXL (20kg up)'}
        </p>
      </div>}
      {groomingSpecies === 'extras' ? (
        <div className="space-y-2">
          {groomingExtras.length === 0 ? (
            <div className="rounded-xl border border-brand-grooming/25 bg-brand-grooming-soft/40 px-4 py-8 text-center">
              <i className="fa-solid fa-paw text-xl text-brand-grooming/50" />
              <p className="mt-2 text-sm font-semibold text-brand-dark">No Pawsome Extras available.</p>
            </div>
          ) : groomingExtras.map((extra) => (
            <div key={extra.id} className="flex items-center justify-between gap-4 rounded-xl border border-brand-grooming/30 bg-white px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm font-bold text-brand-dark">{extra.name}</p>
                {extra.description && <p className="mt-0.5 text-xs leading-relaxed text-brand-dark-soft">{extra.description}</p>}
              </div>
              <span className="shrink-0 text-sm font-extrabold text-brand-grooming">
                {formatTierPrice({ price: extra.price_min ?? extra.price ?? 0, price_max: extra.price_max })}
              </span>
            </div>
          ))}
        </div>
      ) : services.map((svc) => {
        const allTiers = svc.tiers ?? svc.service_tiers ?? [];
        const filteredTiers = groomingSpecies === 'cat'
          ? allTiers.filter((t) => CAT_SIZES.includes(String(t.size_label || '').toUpperCase()))
          : allTiers.filter((t) => !CAT_SIZES.includes(String(t.size_label || '').toUpperCase()));
        if (filteredTiers.length === 0) return null;
        return (
        <div key={`${groomingSpecies}-${svc.id}`} className={`rounded-xl border ${border} overflow-hidden`}>
          <div className={`${bg} px-4 py-3`}>
            <p className={`font-bold text-sm ${text}`}>{svc.name}</p>
            {svc.description && (
              <p className={`text-xs mt-0.5 leading-relaxed ${body}`}>{svc.description}</p>
            )}
          </div>
          <div className="divide-y divide-brand-dark-light/50">
            {filteredTiers.map((tier, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-2.5 gap-3">
                <span className={`text-xs font-semibold ${body}`}>{formatTierSizeLabel(tier.size_label)}</span>
                <span className={`text-sm font-extrabold ${text} shrink-0`}>
                  {formatTierPrice(tier)}
                </span>
              </div>
            ))}
          </div>
        </div>
        );
      })}
    </>
  );
}
