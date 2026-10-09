import { CalendarPlus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { apiFetch } from '../../../api/apiClient';
import { createPortal } from 'react-dom';
import useBodyScrollLock from '../../../hooks/useBodyScrollLock';
import ServiceViewAllModal from '../../../landing_page/ServiceViewAllModal';
import { db } from '../../../utils/powersync/db';
import { formatHotelDescription } from '../../../utils/textUtils';

const CATEGORY_META = {
  daycare:  { label: 'PET DAYCARE',      desc: 'Safe playtime & socialization (Dogs only)',       icon: 'fa-solid fa-bone',     img: '/assets/furclub-daycare.webp',
    border: 'border-brand-daycare/20',  hoverBorder: 'hover:border-brand-daycare/40',  hoverShadow: 'hover:shadow-[0_4px_10px_rgba(251,191,36,0.16)]',
    iconBg: 'bg-brand-daycare-soft',  iconText: 'text-brand-daycare',  availText: 'text-brand-daycare' },
  grooming: { label: 'PET GROOMING', desc: 'Fresh baths, grooming, and coat care',        icon: 'fa-solid fa-scissors', img: '/assets/furclub-grooming.webp',
    border: 'border-brand-grooming/20', hoverBorder: 'hover:border-brand-grooming/40', hoverShadow: 'hover:shadow-[0_4px_10px_rgba(167,139,250,0.16)]',
    iconBg: 'bg-brand-grooming-soft', iconText: 'text-brand-grooming', availText: 'text-brand-grooming' },
  hotel:    { label: 'PET HOTEL',    desc: 'Cozy & Air-conditioned rooms for cats & dogs',   icon: 'fa-solid fa-hotel',    img: '/assets/furclub-hotel.webp',
    border: 'border-brand-hotel/20',    hoverBorder: 'hover:border-brand-hotel/40',    hoverShadow: 'hover:shadow-[0_4px_10px_rgba(251,113,133,0.16)]',
    iconBg: 'bg-brand-hotel-soft',    iconText: 'text-brand-hotel',    availText: 'text-brand-hotel' },
  supplies: { label: 'PET SUPPLIES', desc: 'Browse pet essentials available at our shop.', icon: 'fa-solid fa-bag-shopping', img: '',
    border: 'border-brand-teal/20', hoverBorder: 'hover:border-brand-teal/40', hoverShadow: 'hover:shadow-[0_4px_10px_rgba(77,182,172,0.16)]',
    iconBg: 'bg-brand-teal-light', iconText: 'text-brand-teal', availText: 'text-brand-teal' },
};

const fmtPrice = (p) =>
  `PHP ${Number(p).toLocaleString('en-PH', { timeZone: 'Asia/Manila',  minimumFractionDigits: 2 })}`;

function ServiceListModal({ isOpen, onClose, category, services, hotelSuites, onBook }) {
  useBodyScrollLock(isOpen);

  const [activeTab, setActiveTab] = useState(category || 'grooming');
  const [hotelSpecies, setHotelSpecies] = useState('dog');
  const [groomingSpecies, setGroomingSpecies] = useState('dog');

  useEffect(() => {
    if (isOpen) {
      setActiveTab(category || 'grooming');
      setGroomingSpecies('dog');
      setHotelSpecies('dog');
    }
  }, [isOpen, category]);

  const isLockedToCategory = !!category;

  const dogSuites = hotelSuites.filter((s) => {
    const species = String(s.species_type || '').toLowerCase();
    const name = String(s.name || '').toLowerCase();
    return species === 'dog' || (!species && !/whisker|purr|cat/i.test(name));
  });
  const catSuites = hotelSuites.filter((s) => {
    const species = String(s.species_type || '').toLowerCase();
    const name = String(s.name || '').toLowerCase();
    return species === 'cat' || /whisker|purr|cat/i.test(name);
  });
  const filteredSuites = hotelSpecies === 'cat' ? catSuites : dogSuites;
  const hotelDescription = filteredSuites.find((suite) => suite.description)?.description || '';
  const filtered = services.filter((s) => s.category === activeTab);

  const tabAccent = {
    grooming: { text: 'text-brand-grooming', border: 'border-brand-grooming' },
    daycare:  { text: 'text-brand-daycare',  border: 'border-brand-daycare' },
    hotel:    { text: 'text-brand-hotel',   border: 'border-brand-hotel' },
  };

  const meta = CATEGORY_META[activeTab];
  const headerBg   = activeTab === 'hotel' ? 'bg-brand-hotel'    : activeTab === 'daycare' ? 'bg-brand-daycare'   : 'bg-brand-grooming';
  const bookBtnCls = activeTab === 'hotel' ? 'bg-brand-hotel text-white hover:brightness-95' : activeTab === 'daycare' ? 'bg-brand-daycare text-white hover:brightness-95' : 'bg-brand-grooming text-white hover:brightness-95';

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-sm bg-brand-dark/40 h-[100dvh] min-h-[100dvh] w-screen" onClick={onClose}>
      <div className="w-full sm:max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl font-poppins flex flex-col" style={{ maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>

        {/* Header colored like landing page */}
        <div className={`${headerBg} px-5 py-4 flex items-center justify-between shrink-0`}>
          <div className="flex items-center gap-2">
            <i className={`${meta?.icon || 'fa-solid fa-paw'} text-white text-lg`} />
            <h2 className="font-bauhaus font-extrabold text-xl text-white tracking-wide">
              {meta?.label || 'Services'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
            aria-label="Close services"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto scrollbar-teal px-5 py-5 space-y-3 flex-1">
          {(activeTab === 'hotel' || activeTab === 'grooming') && (
            <div className="flex gap-2 mb-1">
              {['dog', 'cat'].map((sp) => (
                <button
                  key={sp}
                  type="button"
                  onClick={() => (activeTab === 'hotel' ? setHotelSpecies(sp) : setGroomingSpecies(sp))}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors ${
                    (activeTab === 'hotel' ? hotelSpecies : groomingSpecies) === sp
                      ? `${ activeTab === 'hotel' ? 'bg-brand-hotel' : activeTab === 'daycare' ? 'bg-brand-daycare' : 'bg-brand-grooming' } text-white`
                      : `${ activeTab === 'hotel' ? 'bg-brand-hotel-soft text-brand-hotel border border-brand-hotel/30 hover:bg-brand-hotel-soft' : activeTab === 'daycare' ? 'bg-brand-daycare-soft text-brand-daycare border border-brand-daycare/30 hover:bg-brand-daycare-soft' : 'bg-brand-grooming-soft text-brand-grooming border border-brand-grooming/30 hover:bg-brand-grooming-soft' }`
                  }`}
                >
                  {sp === 'dog' ? 'Dogs' : 'Cats'}
                </button>
              ))}
            </div>
          )}

              {filtered.length === 0 && activeTab !== 'hotel' ? (
                <p className="py-8 text-center text-sm text-brand-dark-soft">No services available yet.</p>
          ) : activeTab === 'grooming' ? (() => {
                const MAIN_PACKAGES = ['Fresh me up', 'Tidy up', 'Glow up', 'Glam up'];
                const CAT_SIZES = ['CAT', 'KITTEN'];
                const packages = filtered.filter((s) => MAIN_PACKAGES.includes(s.name))
                  .sort((a, b) => MAIN_PACKAGES.indexOf(a.name) - MAIN_PACKAGES.indexOf(b.name));
                const dogPackages = packages
                  .map((svc) => ({ ...svc, tiers: svc.tiers.filter((t) => !CAT_SIZES.includes(String(t.size_label || '').toUpperCase())) }))
                  .filter((svc) => svc.tiers.length > 0);
                const catPackages = packages
                  .map((svc) => ({ ...svc, tiers: svc.tiers.filter((t) => CAT_SIZES.includes(String(t.size_label || '').toUpperCase())) }))
                  .filter((svc) => svc.tiers.length > 0);
                const selectedPackages = groomingSpecies === 'cat' ? catPackages : dogPackages;
                return (
                  <div className="space-y-4">
                    {selectedPackages.map((svc) => (
                      <div key={`${groomingSpecies}-${svc.id}`} className="rounded-xl border border-brand-dark-light/60 bg-white shadow-sm overflow-hidden">
                        <div className="bg-brand-grooming-soft px-4 py-3.5 border-b border-brand-grooming/20">
                          <p className="text-sm font-extrabold text-brand-grooming">{svc.name}</p>
                          {svc.description && <p className="text-[11px] text-brand-dark-soft mt-1 leading-relaxed">{svc.description}</p>}
                        </div>
                        <div className="divide-y divide-brand-dark-light/60">
                          {svc.tiers.map((tier) => (
                            <div key={tier.size_label} className="flex items-center justify-between px-4 py-2.5">
                              <span className="text-xs font-medium text-brand-dark">{tier.size_label}</span>
                              <span className="text-xs font-bold text-brand-grooming">
                                {tier.price_max ? `${fmtPrice(tier.price)} - ${fmtPrice(tier.price_max)}` : fmtPrice(tier.price)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    {selectedPackages.length === 0 && (
                      <p className="py-6 text-center text-sm text-brand-dark-soft">No grooming packages available.</p>
                    )}
                  </div>
                );
              })() : activeTab === 'hotel' ? (
                <div className="space-y-6">
                  {hotelDescription && (
                    <p className="rounded-xl border border-brand-hotel/20 bg-brand-hotel-soft/40 px-4 py-3 text-xs leading-relaxed text-brand-dark-soft">
                      {formatHotelDescription(hotelDescription)}
                    </p>
                  )}
                  {filteredSuites.length > 0 ? filteredSuites.map((suite) => (
                    <div key={suite.id} className="rounded-xl border border-brand-dark-light p-4 flex items-start justify-between gap-4 bg-white">
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-brand-dark text-sm">{suite.name}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-2">
                          {suite.size_range && (
                            <span className="text-[10px] font-semibold uppercase tracking-wider bg-brand-pink/10 text-brand-pink px-2 py-0.5 rounded-full">
                              {suite.size_range}
                            </span>
                          )}
                          <span className="text-[10px] text-brand-dark-soft">
                            Capacity: {suite.capacity} {suite.capacity === 1 ? 'pet' : 'pets'}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-lg font-extrabold text-brand-pink">PHP {Number(suite.price_per_night).toLocaleString()}</p>
                        <p className="text-[10px] text-brand-dark-soft">per night</p>
                      </div>
                    </div>
                  )) : <p className="text-center text-sm text-brand-dark-soft py-6">No suites available.</p>}
                </div>
              ) : activeTab === 'daycare' ? (
                <div className="space-y-3">
                  {(() => {
                    const allTiers = filtered.flatMap((svc) => svc.tiers || []);
                    const DURATION_GROUPS = [
                      { key: 'hourly',   label: 'Hourly',   match: (t) => /hourly/i.test(t.size_label) },
                      { key: 'half_day', label: 'Half Day', match: (t) => /half.?day/i.test(t.size_label) },
                      { key: 'full_day', label: 'Full Day', match: (t) => /full.?day/i.test(t.size_label) },
                    ];
                    const normalizeSize = (raw) =>
                      String(raw || '').replace(/^(hourly|half.?day|full.?day)\s*-\s*/i, '').replace(/_/g, ' ').trim();

                    return DURATION_GROUPS.map(({ key, label, match }) => {
                      const tiers = allTiers.filter(match);
                      if (!tiers.length) return null;
                      return (
                        <div key={key} className="rounded-xl border border-brand-dark-light/60 bg-white shadow-sm overflow-hidden">
                          <div className="bg-brand-daycare-soft px-4 py-3 border-b border-brand-daycare/20">
                            <p className="text-sm font-extrabold text-brand-daycare">{label}</p>
                          </div>
                          <div className="divide-y divide-brand-dark-light/60">
                            {tiers.map((tier) => (
                              <div key={tier.size_label} className="flex items-center justify-between px-4 py-2.5">
                                <span className="text-xs font-medium text-brand-dark">{normalizeSize(tier.size_label)}</span>
                                <span className="text-xs font-bold text-brand-daycare">{fmtPrice(tier.price)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              ) : (
                <p className="py-8 text-center text-sm text-brand-dark-soft">No services available yet.</p>
              )}
        </div>

        <div className="flex shrink-0 flex-col gap-2 border-t border-brand-dark-light px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" onClick={onClose}
            className="rounded-xl border border-brand-dark-light bg-white px-6 py-2.5 text-sm font-medium text-brand-dark-soft transition hover:bg-brand-surface focus:outline-none focus:ring-2 focus:ring-brand-teal/30 focus:ring-offset-2">
            Cancel
          </button>
          <button type="button" onClick={() => { onClose(); onBook?.(null, activeTab); }}
            className={`flex items-center justify-center gap-1.5 rounded-xl px-6 py-2.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-brand-teal/40 focus:ring-offset-2 active:scale-[0.98] ${bookBtnCls}`}>
            <CalendarPlus size={14} />
            Book Now
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

function SuppliesCatalogModal({ isOpen, onClose, supplies, loading }) {
  useBodyScrollLock(isOpen);
  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[110] flex h-[100dvh] w-screen items-center justify-center bg-brand-dark/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[88vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl font-poppins" onClick={(event) => event.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between bg-brand-teal px-5 py-4">
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-bag-shopping text-lg text-white" />
            <h2 className="font-bauhaus text-xl font-extrabold tracking-wide text-white">PET SUPPLIES</h2>
          </div>
          <button type="button" onClick={onClose} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25" aria-label="Close supplies catalog">
            <i className="fa-solid fa-xmark text-sm" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 scrollbar-teal">
          <div className="mb-4 rounded-xl border border-brand-teal/25 bg-brand-teal-light/50 px-4 py-3">
            <p className="text-xs font-bold text-brand-dark">Shop Transaction Only</p>
            <p className="mt-1 text-[11px] leading-relaxed text-brand-dark-soft">These items are for viewing only. Purchases and payments are completed at The Fur Club shop.</p>
          </div>

          {loading ? (
            <p className="py-8 text-center text-sm text-brand-dark-soft">Loading supplies...</p>
          ) : supplies.length === 0 ? (
            <p className="py-8 text-center text-sm text-brand-dark-soft">No supplies are available right now.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
              {supplies.map((item) => (
                <div key={item.id} className="overflow-hidden rounded-xl border border-brand-dark-light bg-white shadow-sm">
                  <div className="aspect-square overflow-hidden bg-brand-teal-light/40">
                    {item.image_url ? (
                      <img src={item.image_url} alt={item.item_name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <i className="fa-solid fa-bag-shopping text-3xl text-brand-teal/45" />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="line-clamp-2 min-h-10 text-sm font-bold leading-5 text-brand-dark">{item.item_name}</p>
                    <p className="mt-2 text-sm font-extrabold text-brand-teal">{fmtPrice(item.selling_price)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>,
    document.body
  );
}

export default function ServiceSection({ onBook }) {
  const [services,       setServices]      = useState([]);
  const [hotelSuites,    setHotelSuites]   = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [modalOpen,      setModalOpen]     = useState(false);
  const [supplies,       setSupplies]       = useState([]);
  const [suppliesLoading, setSuppliesLoading] = useState(true);
  const [suppliesOpen,   setSuppliesOpen]   = useState(false);

  useEffect(() => {
    let disposed = false;

    const hydrateFromPowerSync = async () => {
      const serviceRows = await db.getAll(
        `SELECT *
         FROM services
         WHERE is_active = 1
         ORDER BY category, name`
      );

      const tierRows = await db.getAll(
        `SELECT *
         FROM service_tiers
         ORDER BY service_id, size_label`
      );

      const tiersByService = tierRows.reduce((acc, tier) => {
        const key = String(tier.service_id || '');
        if (!acc[key]) acc[key] = [];
        acc[key].push(tier);
        return acc;
      }, {});

      const mergedServices = serviceRows.map((svc) => ({
        ...svc,
        tiers: tiersByService[String(svc.id)] || [],
      }));

      const suiteRows = await db.getAll(
        `SELECT *
         FROM hotel_suites
         WHERE is_available = 1
         ORDER BY name`
      );

      if (!disposed) {
        setServices(mergedServices);
        setHotelSuites(suiteRows);
      }

      return mergedServices.length > 0 || suiteRows.length > 0;
    };

    const hydrateFromApiFallback = async () => {
      try {
        const [servicesRes, suitesRes] = await Promise.all([
          apiFetch('/api/services/catalog'),
          apiFetch('/api/public/hotel-suites'),
        ]);

        const servicesJson = servicesRes?.ok ? await servicesRes.json() : { data: [] };
        const suitesJson = suitesRes?.ok ? await suitesRes.json() : { data: [] };

        if (!disposed) {
          setServices(
            Array.isArray(servicesJson?.data)
              ? servicesJson.data.map((s) => ({ ...s, tiers: s.tiers ?? s.service_tiers ?? [] }))
              : []
          );
          setHotelSuites(Array.isArray(suitesJson) ? suitesJson : suitesJson?.data || []);
        }
      } catch {
        if (!disposed) {
          setServices([]);
          setHotelSuites([]);
        }
      }
    };

    const load = async () => {
      try {
        const hasData = await hydrateFromPowerSync();
        // PowerSync succeeded but returned nothing — tables not synced yet, try API
        if (!hasData) await hydrateFromApiFallback();
      } catch {
        await hydrateFromApiFallback();
      }
    };

    load();
    const refreshId = setInterval(load, 15_000);
    return () => {
      disposed = true;
      clearInterval(refreshId);
    };
  }, []);

  useEffect(() => {
    let disposed = false;
    setSuppliesLoading(true);
    apiFetch('/api/supplies/catalog')
      .then(async (response) => {
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.message || 'Unable to load supplies.');
        const rows = Array.isArray(payload?.data) ? payload.data : Array.isArray(payload) ? payload : [];
        if (!disposed) setSupplies(rows);
      })
      .catch(() => {
        if (!disposed) setSupplies([]);
      })
      .finally(() => {
        if (!disposed) setSuppliesLoading(false);
      });
    return () => { disposed = true; };
  }, []);

  const openCategory = (cat) => {
    if (cat === 'supplies') {
      setSuppliesOpen(true);
      return;
    }
    setActiveCategory(cat);
    setModalOpen(true);
  };

  return (
    <>
      <div>
        <div className="mb-2 sm:mb-3 flex items-center justify-between px-1">
          <p className="text-xs font-bold uppercase tracking-widest text-brand-dark-soft">Services</p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {Object.entries(CATEGORY_META).map(([key, meta]) => {
            const MAIN_GROOMING = ['fresh me up', 'tidy up', 'glow up', 'glam up'];
            const DAYCARE_DURATION_MATCHERS = [
              (t) => /hourly/i.test(t.size_label),
              (t) => /half.?day/i.test(t.size_label),
              (t) => /full.?day/i.test(t.size_label),
            ];
            const count = key === 'supplies'
              ? supplies.length
              : key === 'grooming'
              ? services.filter((s) => s.category === 'grooming' && MAIN_GROOMING.includes(String(s.name || '').toLowerCase())).length || services.filter((s) => s.category === 'grooming').length
              : key === 'daycare'
                ? (() => {
                    const allTiers = services.filter((s) => s.category === 'daycare').flatMap((s) => s.tiers || []);
                    return DAYCARE_DURATION_MATCHERS.filter((match) => allTiers.some(match)).length;
                  })()
                : services.filter((s) => s.category === key).length;
            const availabilityText =
              key === 'supplies'
                ? `${count} item${count !== 1 ? 's' : ''} available`
                : key === 'hotel'
                ? `${hotelSuites.length} suite${hotelSuites.length !== 1 ? 's' : ''} available`
                : key === 'grooming'
                  ? `${count} package${count !== 1 ? 's' : ''} available`
                  : key === 'daycare'
                    ? `${count} duration${count !== 1 ? 's' : ''} available`
                    : `${count} service${count !== 1 ? 's' : ''} available`;
            return (
              <button
                key={key}
                type="button"
                onClick={() => openCategory(key)}
                className={`flex min-h-[190px] h-full flex-col rounded-2xl border bg-white p-3 text-left shadow-sm transition-all sm:min-h-[210px] sm:p-4 ${meta.border} ${meta.hoverShadow} ${meta.hoverBorder}`}
              >
                <div className={`mb-2.5 flex h-9 w-9 items-center justify-center rounded-full sm:mb-3 sm:h-10 sm:w-10 ${meta.iconBg}`}>
                  <i className={`${meta.icon} ${meta.iconText} text-base sm:text-lg`} />
                </div>
                <p className={`mb-1 text-[10px] font-extrabold uppercase tracking-wider sm:text-[11px] sm:tracking-widest ${meta.iconText}`}>{meta.label}</p>
                <p className="line-clamp-3 flex-1 text-[10px] leading-relaxed text-brand-dark-soft sm:text-xs">{meta.desc}</p>
                <p className={`mt-2 border-t border-brand-dark-light/60 pt-2 text-[9px] font-semibold sm:mt-3 sm:text-[10px] ${meta.availText}`}>
                  {availabilityText}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      <ServiceViewAllModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onOpenLogin={() => onBook?.(null, activeCategory)}
        selectedCategory={activeCategory || 'grooming'}
      />
      <SuppliesCatalogModal
        isOpen={suppliesOpen}
        onClose={() => setSuppliesOpen(false)}
        supplies={supplies}
        loading={suppliesLoading}
      />
    </>
  );
}
