export const CURRENCY_LABEL = 'PHP ';

const SIZE_KEYS = {
  small: 'small',
  s: 'small',
  medium: 'medium',
  m: 'medium',
  large: 'large',
  l: 'large',
  xlarge: 'xlarge',
  xl: 'xlarge',
  'x-large': 'xlarge',
};

const DAYCARE_SESSION_META = {
  hourly: { session: 'Hourly', icon: 'fa-clock', highlight: false, order: 1 },
  half_day: { session: 'Half Day Package', icon: 'fa-sun', highlight: false, order: 2 },
  full_day: { session: 'Full Day Package', icon: 'fa-moon', highlight: true, order: 3 },
};

const GROOMING_PACKAGE_ICONS = {
  'fresh me up': 'fa-droplet',
  'tidy up': 'fa-scissors',
  'glow up': 'fa-star',
  'glam up': 'fa-wand-magic-sparkles',
  dematting: 'fa-brush',
  'bath & blow dry': 'fa-shower',
  'medicated bath': 'fa-prescription-bottle-medical',
  'organic bath': 'fa-leaf',
  'whitening bath': 'fa-sparkles',
};

const HOTEL_SUITE_ICONS = {
  cozy: 'fa-house',
  happy: 'fa-house-chimney',
  grand: 'fa-star',
  vip: 'fa-crown',
};

export function normalizeCategory(value) {
  return String(value || '').trim().toLowerCase();
}

export function normalizeName(value) {
  return String(value || '').trim().toLowerCase();
}

export function getTiers(service) {
  return Array.isArray(service?.tiers) ? service.tiers : (Array.isArray(service?.service_tiers) ? service.service_tiers : []);
}

export function formatCurrency(value, suffix = '') {
  const amount = Number(value);
  return Number.isFinite(amount) && amount > 0 ? `${CURRENCY_LABEL}${amount.toLocaleString()}${suffix}` : '';
}

export function formatTierPrice(tier, suffix = '') {
  const min = Number(tier?.price);
  const max = Number(tier?.price_max);
  if (!Number.isFinite(min) || min <= 0) return '';
  return Number.isFinite(max) && max > min
    ? `${formatCurrency(min)} - ${formatCurrency(max)}${suffix}`
    : formatCurrency(min, suffix);
}

export function getServicePriceRange(service, suffix = '') {
  const prices = getTiers(service)
    .flatMap((tier) => [Number(tier?.price), Number(tier?.price_max)])
    .filter((price) => Number.isFinite(price) && price > 0);

  if (!prices.length) return '';

  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatCurrency(min, suffix) : `${formatCurrency(min)} - ${formatCurrency(max)}${suffix}`;
}

export function getStartingPrice(values) {
  const prices = values
    .map(Number)
    .filter((price) => Number.isFinite(price) && price > 0);

  return prices.length ? Math.min(...prices) : 0;
}

export function filterServicesByCategory(catalog, category) {
  return (Array.isArray(catalog) ? catalog : []).filter((service) => normalizeCategory(service?.category) === category);
}

function titleCase(value) {
  return String(value || '')
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function normalizeDaycareSession(value) {
  const label = normalizeName(value).replace(/[_-]+/g, ' ');
  if (label.includes('half')) return 'half_day';
  if (label.includes('full')) return 'full_day';
  if (label.includes('hour')) return 'hourly';
  return label.replace(/\s+/g, '_') || 'session';
}

function normalizeDaycareSize(value) {
  const label = normalizeName(value).replace(/[_]+/g, ' ');
  return SIZE_KEYS[label] || SIZE_KEYS[label.replace(/\s+/g, '-')] || null;
}

export function buildDaycarePricingRows(daycareServices) {
  const rowsBySession = new Map();

  daycareServices.forEach((service) => {
    getTiers(service).forEach((tier) => {
      const rawLabel = String(tier?.size_label || '').trim();
      const [rawSession, rawSize] = rawLabel.includes(' - ')
        ? rawLabel.split(' - ', 2)
        : [service.name, rawLabel];
      const sessionKey = normalizeDaycareSession(rawSession);
      const sizeKey = normalizeDaycareSize(rawSize);
      if (!sizeKey) return;

      const meta = DAYCARE_SESSION_META[sessionKey] || {
        session: titleCase(rawSession || service.name),
        icon: 'fa-paw',
        highlight: false,
        order: 50,
      };
      const current = rowsBySession.get(sessionKey) || {
        ...meta,
        small: '-',
        medium: '-',
        large: '-',
        xlarge: '-',
      };
      current[sizeKey] = formatTierPrice(tier) || '-';
      rowsBySession.set(sessionKey, current);
    });
  });

  return Array.from(rowsBySession.values()).sort((a, b) => a.order - b.order || a.session.localeCompare(b.session));
}

export function buildGroomingPackageCards(groomingServices, fallbackPackages = []) {
  const dynamicPackages = groomingServices
    .filter((service) => normalizeName(service?.name) !== 'pawsome extras')
    .map((service) => ({
      id: service.id,
      name: service.name,
      desc: service.description || 'Professional grooming care managed from the Admin service catalog.',
      range: getServicePriceRange(service) || 'Price varies',
      icon: GROOMING_PACKAGE_ICONS[normalizeName(service.name)] || 'fa-paw',
    }))
    .filter((service) => service.name);

  return dynamicPackages.length ? dynamicPackages : fallbackPackages;
}

export function buildHotelSuiteCards(suites, species) {
  return (Array.isArray(suites) ? suites : [])
    .filter((suite) => normalizeCategory(suite?.species_type) === species)
    .map((suite, index) => {
      const name = String(suite?.name || '').trim();
      const lowerName = normalizeName(name);
      const iconKey = Object.keys(HOTEL_SUITE_ICONS).find((key) => lowerName.includes(key));
      return {
        id: suite.id || name,
        name,
        size: suite.size_range || 'All sizes',
        price: Number(suite.price_per_night || 0),
        desc: suite.description || 'Comfortable monitored care with feeding, playtime, and attentive supervision.',
        icon: HOTEL_SUITE_ICONS[iconKey] || 'fa-house',
        popular: lowerName.includes('happy') || lowerName.includes('grand purr') || index === 1,
      };
    })
    .filter((suite) => suite.name);
}