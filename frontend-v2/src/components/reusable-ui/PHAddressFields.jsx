import { useEffect, useRef, useState } from 'react';
import SelectDropdown from './SelectDropdown';

// ── psgc.cloud API helpers ────────────────────────────────────────────────────

const BASE = 'https://psgc.cloud/api';
const NCR_CODE = '__NCR__';
const NCR_REGION_CODE = '1300000000';

// psgc.cloud returns place names with Latin-1 mojibake (e.g. "Ã±" instead of "ñ").
// Fix by re-interpreting each character's code point as a raw byte and decoding as UTF-8.
function fixEncoding(name) {
  if (!name || !/[-ÿ]/.test(name)) return name;
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(
      Uint8Array.from(name, (c) => c.charCodeAt(0))
    );
  } catch {
    return name;
  }
}

function fixPlace(p) {
  return { ...p, name: fixEncoding(p.name) };
}

function placeSearchAlias(name = '') {
  return String(name)
    .replace(/^(?:city|municipality)\s+of\s+/i, '')
    .replace(/^(?:city|municipality)\s+/i, '')
    .trim();
}

// Module-level cache — survives re-renders and re-mounts
const CACHE = {
  provinces: null,
  cities: {},   // provinceCode → sorted city array
};

async function getProvinces() {
  if (CACHE.provinces) return CACHE.provinces;
  const [pr, rr] = await Promise.all([
    fetch(`${BASE}/provinces`),
    fetch(`${BASE}/regions`),
  ]);
  if (!pr.ok || !rr.ok) throw new Error('api');
  const [provinces, regions] = await Promise.all([pr.json(), rr.json()]);
  const ncr = regions.find((r) => r.code === NCR_REGION_CODE);
  const all = [...provinces.map(fixPlace), ...(ncr ? [{ name: 'Metro Manila', code: NCR_CODE }] : [])];
  CACHE.provinces = all.sort((a, b) => a.name.localeCompare(b.name, 'fil'));
  return CACHE.provinces;
}

async function getCities(provinceCode) {
  if (CACHE.cities[provinceCode]) return CACHE.cities[provinceCode];
  const url = provinceCode === NCR_CODE
    ? `${BASE}/regions/${NCR_REGION_CODE}/cities-municipalities`
    : `${BASE}/provinces/${provinceCode}/cities-municipalities`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('api');
  const data = await res.json();
  CACHE.cities[provinceCode] = [...data].map(fixPlace).sort((a, b) => a.name.localeCompare(b.name, 'fil'));
  return CACHE.cities[provinceCode];
}

async function getBarangays(cityCode, signal) {
  const res = await fetch(`${BASE}/cities-municipalities/${cityCode}/barangays`, { signal });
  if (!res.ok) throw new Error('api');
  const data = await res.json();
  return [...data].map(fixPlace).sort((a, b) => a.name.localeCompare(b.name, 'fil'));
}

// Kick off province fetch the moment this module is imported so data is
// likely ready by the time the user opens a form.
getProvinces().catch(() => {});

// ── Component ────────────────────────────────────────────────────────────────

/**
 * Cascading Philippine address dropdowns: Province → City/Municipality → Barangay + Postal Code.
 *
 * Props:
 *   form           – { address_province, address_city, address_barangay, address_postal_code }
 *   onFieldChange  – (fieldName: string, value: string) => void
 *   errors         – { address_province?, address_city?, address_barangay?, address_postal_code? }
 *   variant        – 'light' | 'dark'
 *
 * Returns a Fragment of 4 <div> children — slot into any parent grid.
 */
export default function PHAddressFields({
  form,
  onFieldChange,
  errors = {},
  variant = 'light',
  requiredFields = ['address_province', 'address_city', 'address_barangay', 'address_postal_code'],
}) {
  const isDark = variant === 'dark';

  // Province state
  const [provinces, setProvinces]         = useState(CACHE.provinces || []);
  const [provLoading, setProvLoading]     = useState(!CACHE.provinces);
  const [provCode, setProvCode]           = useState('');

  // City state
  const [cities, setCities]               = useState([]);
  const [cityLoading, setCityLoading]     = useState(false);
  const [cityCode, setCityCode]           = useState('');

  // Barangay state
  const [barangays, setBarangays]         = useState([]);
  const [brgyLoading, setBrgyLoading]     = useState(false);
  const [brgyError, setBrgyError]         = useState(false);

  const abortRef = useRef(null);

  // Load provinces on mount if not already cached
  useEffect(() => {
    if (CACHE.provinces) {
      setProvinces(CACHE.provinces);
      setProvLoading(false);
      return;
    }
    let alive = true;
    getProvinces()
      .then((data) => { if (alive) { setProvinces(data); setProvLoading(false); } })
      .catch(() => { if (alive) setProvLoading(false); });
    return () => { alive = false; };
  }, []);

  // Restore cascade state from pre-filled values (edit mode)
  // Runs after provinces are loaded so we can find the province code.
  useEffect(() => {
    if (!provinces.length || !form.address_province) return;
    const prov = provinces.find((p) => p.name === form.address_province);
    if (!prov) return;
    setProvCode(prov.code);

    if (!form.address_city) return;
    getCities(prov.code)
      .then((data) => {
        setCities(data);
        const city = data.find((c) => c.name === form.address_city);
        if (!city) return;
        setCityCode(city.code);
        if (!form.address_barangay) return;
        void loadBarangays(city.code);
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provinces]); // re-run when provinces load

  const loadBarangays = async (code) => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setBrgyLoading(true);
    setBrgyError(false);
    setBarangays([]);
    try {
      const data = await getBarangays(code, ctrl.signal);
      setBarangays(data);
    } catch (err) {
      if (err.name !== 'AbortError') setBrgyError(true);
    } finally {
      setBrgyLoading(false);
    }
  };

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleProvinceChange = async (value) => {
    const prov = provinces.find((p) => p.name === value);
    const code = prov?.code || '';
    setProvCode(code);
    setCityCode('');
    setCities([]);
    setBarangays([]);
    setBrgyError(false);
    onFieldChange('address_province', value);
    onFieldChange('address_city', '');
    onFieldChange('address_barangay', '');
    if (!code) return;
    setCityLoading(true);
    try {
      const data = await getCities(code);
      setCities(data);
    } catch {
      setCities([]);
    } finally {
      setCityLoading(false);
    }
  };

  const handleCityChange = (value) => {
    const city = cities.find((c) => c.name === value);
    const code = city?.code || '';
    setCityCode(code);
    setBarangays([]);
    setBrgyError(false);
    onFieldChange('address_city', value);
    onFieldChange('address_barangay', '');
    if (code) void loadBarangays(code);
  };

  // ── Derived options ────────────────────────────────────────────────────────

  const provinceOptions = [
    { value: '', label: provLoading ? 'Loading provinces…' : 'Select province' },
    ...provinces.map((p) => ({ value: p.name, label: p.name })),
  ];

  const cityOptions = [
    { value: '', label: !provCode ? 'Select province first' : cityLoading ? 'Loading cities…' : 'Select city/municipality' },
    ...cities.map((c) => ({ value: c.name, label: c.name, searchText: placeSearchAlias(c.name) })),
  ];

  const brgyPlaceholder = !cityCode
    ? 'Select city first'
    : brgyLoading
    ? 'Loading barangays…'
    : 'Select barangay';

  const brgyOptions = [
    { value: '', label: brgyPlaceholder },
    ...barangays.map((b) => ({ value: b.name, label: b.name })),
  ];

  // ── Styles ─────────────────────────────────────────────────────────────────

  const labelCls = isDark
    ? 'block text-xs font-semibold tracking-widest mb-2 text-white/80'
    : 'mb-1 block text-xs font-bold text-brand-dark';

  const errCls = isDark ? 'mt-1 text-xs text-red-400' : 'mt-1 text-[11px] text-red-500';

  const textInputCls = (hasErr) =>
    isDark
      ? `w-full rounded-lg bg-white/10 border ${hasErr ? 'border-red-400' : 'border-white/15'} px-4 py-3 text-sm text-white placeholder:text-white/50 focus:outline-none focus:ring-2 focus:ring-brand-teal transition-all`
      : `w-full rounded-xl border ${hasErr ? 'border-red-400' : 'border-brand-dark-light'} bg-white px-3 py-2.5 text-sm placeholder:text-brand-dark-soft/50 focus:border-brand-dark focus:outline-none`;

  const requiredMark = (field) => requiredFields.includes(field)
    ? <> <span className={isDark ? 'text-red-400' : 'text-red-500'}>*</span></>
    : null;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Province */}
      <div id="field-address_province">
        <label className={labelCls}>Province{requiredMark('address_province')}</label>
        <SelectDropdown
          value={form.address_province}
          onChange={handleProvinceChange}
          options={provinceOptions}
          placeholder={provLoading ? 'Loading…' : 'Select province'}
          disabled={provLoading}
          hasError={!!errors.address_province}
          searchable
          searchPlaceholder="Search province…"
          variant={variant}
        />
        {errors.address_province && <p className={errCls}>{errors.address_province}</p>}
      </div>

      {/* City / Municipality */}
      <div id="field-address_city">
        <label className={labelCls}>City / Municipality{requiredMark('address_city')}</label>
        <SelectDropdown
          value={form.address_city}
          onChange={handleCityChange}
          options={cityOptions}
          placeholder={!provCode ? 'Select province first' : cityLoading ? 'Loading…' : 'Select city/municipality'}
          disabled={!provCode || cityLoading}
          hasError={!!errors.address_city}
          searchable
          searchPlaceholder="Search city…"
          variant={variant}
        />
        {errors.address_city && <p className={errCls}>{errors.address_city}</p>}
      </div>

      {/* Barangay — dropdown if API ok, text fallback if API failed */}
      <div id="field-address_barangay">
        <label className={labelCls}>
          Barangay{requiredMark('address_barangay')}
          {brgyLoading && (
            <span className={isDark ? 'ml-2 text-[10px] font-normal text-white/40' : 'ml-2 text-[10px] font-normal text-brand-dark-soft'}>
              Loading…
            </span>
          )}
        </label>
        {brgyError ? (
          <input
            type="text"
            value={form.address_barangay}
            onChange={(e) => onFieldChange('address_barangay', e.target.value)}
            placeholder="Enter barangay name"
            className={textInputCls(!!errors.address_barangay)}
          />
        ) : (
          <SelectDropdown
            value={form.address_barangay}
            onChange={(v) => onFieldChange('address_barangay', v)}
            options={brgyOptions}
            placeholder={brgyPlaceholder}
            disabled={!cityCode || brgyLoading}
            hasError={!!errors.address_barangay}
            searchable
            searchPlaceholder="Search barangay…"
            variant={variant}
          />
        )}
        {errors.address_barangay && <p className={errCls}>{errors.address_barangay}</p>}
      </div>

      {/* Postal Code */}
      <div id="field-address_postal_code">
        <label className={labelCls}>Postal Code{requiredMark('address_postal_code')}</label>
        <input
          type="text"
          inputMode="numeric"
          value={form.address_postal_code}
          onChange={(e) => onFieldChange('address_postal_code', e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="4-digit postal code"
          maxLength={4}
          className={textInputCls(!!errors.address_postal_code)}
        />
        {errors.address_postal_code && <p className={errCls}>{errors.address_postal_code}</p>}
      </div>
    </>
  );
}
