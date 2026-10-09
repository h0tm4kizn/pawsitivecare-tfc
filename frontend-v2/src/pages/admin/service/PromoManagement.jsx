import { Gift, Pencil, Search, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../../api/apiClient';
import { adminJson } from '../../../api/adminData';
import SelectDropdown from '../../../components/reusable-ui/SelectDropdown';

const EMPTY = {
  title: '',
  description: '',
  discount_type: 'percentage',
  discount_value: '',
  promotional_price: '',
  starts_on: '',
  ends_on: '',
  is_active: true,
  applies_to_all_services: false,
  applies_to_all_inventory: false,
  service_id: '',
  service_ids: [],
  tier_ids: [],
  inventory_ids: [],
};

const button = 'inline-flex min-h-9 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50';
const money = (value) => `PHP ${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

function PackagePicker({ tiers, value, onChange }) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {tiers.length === 0 ? (
        <p className="col-span-full rounded-xl border border-dashed border-brand-teal/25 px-3 py-3 text-xs text-brand-dark-soft">
          Select a service to choose packages.
        </p>
      ) : tiers.map((tier) => {
        const selected = value.includes(tier.id);
        return (
          <label key={tier.id} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-colors ${selected ? 'border-brand-teal bg-brand-teal/10' : 'border-brand-dark-light bg-white hover:border-brand-teal/50'}`}>
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onChange(selected ? value.filter((id) => id !== tier.id) : [...value, tier.id])}
              className="accent-brand-teal"
            />
            <span className="min-w-0 flex-1 truncate font-semibold text-brand-dark">{tier.size_label || 'Standard'}</span>
            <span className="text-xs text-brand-dark-soft">{money(tier.price)}</span>
          </label>
        );
      })}
    </div>
  );
}

function ProductPicker({ products, value, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const selectedProducts = products.filter((item) => value.includes(item.id));
  const filtered = products.filter((item) => `${item.item_name} ${item.category || ''}`.toLowerCase().includes(query.toLowerCase()));
  const toggle = (id) => onChange(value.includes(id) ? value.filter((item) => item !== id) : [...value, id]);

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((current) => !current)} className={`${button} w-full justify-between border border-brand-dark-light bg-white text-left font-semibold text-brand-dark hover:border-brand-teal`}>
        <span className="truncate">{selectedProducts.length ? `${selectedProducts.length} product${selectedProducts.length === 1 ? '' : 's'} selected — add another` : 'Select retail products'}</span>
        <span className="text-brand-teal">{open ? '⌃' : '⌄'}</span>
      </button>
      {selectedProducts.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selectedProducts.map((item) => (
            <button key={item.id} type="button" onClick={() => toggle(item.id)} className="rounded-full bg-brand-teal/10 px-2.5 py-1 text-[11px] font-bold text-brand-teal-dark">
              {item.item_name} <X size={11} className="ml-1 inline" />
            </button>
          ))}
        </div>
      )}
      {open && (
        <div className="absolute left-0 right-0 z-20 mt-2 max-h-64 overflow-hidden rounded-xl border border-brand-teal/20 bg-white p-2 shadow-xl">
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-brand-dark-light px-2.5 py-2">
            <Search size={14} className="text-brand-dark-soft" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products..." className="min-w-0 flex-1 text-xs outline-none" />
          </div>
          <div className="max-h-44 overflow-y-auto">
            {filtered.length === 0 ? <p className="px-2 py-3 text-xs text-brand-dark-soft">No products found.</p> : filtered.map((item) => (
              <label key={item.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-xs hover:bg-brand-teal/5">
                <input type="checkbox" checked={value.includes(item.id)} onChange={() => toggle(item.id)} className="accent-brand-teal" />
                <span className="min-w-0 flex-1 truncate font-semibold text-brand-dark">{item.item_name}</span>
                <span className="text-brand-dark-soft">{money(item.selling_price)}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const statusFor = (promo) => {
  const today = new Date().toISOString().slice(0, 10);
  if (!promo.is_active) return { label: 'Inactive', className: 'bg-brand-dark/10 text-brand-dark-soft' };
  if (promo.ends_on && promo.ends_on < today) return { label: 'Expired', className: 'bg-red-100 text-red-700' };
  if (promo.starts_on && promo.starts_on > today) return { label: 'Scheduled', className: 'bg-amber-100 text-amber-700' };
  return { label: 'Active', className: 'bg-emerald-100 text-emerald-700' };
};

export default function PromoManagement({ services = [], onClose, addToast }) {
  const [promos, setPromos] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const payload = await adminJson('/api/admin/promotions');
      setPromos(Array.isArray(payload?.data) ? payload.data : []);
    } catch (err) {
      setError(err?.message || 'Unable to load promotions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    adminJson('/api/admin/inventory?all=1')
      .then((payload) => setInventory(Array.isArray(payload?.data?.items) ? payload.data.items : []))
      .catch(() => setInventory([]));
  }, []);

  const serviceOptions = useMemo(() => services.filter((service) => service?.id && service?.is_active !== false).map((service) => ({ value: service.id, label: service.name })), [services]);
  const selectedServiceIds = form.service_ids?.length ? form.service_ids : (form.service_id ? [form.service_id] : []);
  const selectedServices = services.filter((service) => selectedServiceIds.some((id) => String(id) === String(service.id)));
  const tiers = selectedServices.flatMap((service) => service.service_tiers || service.tiers || []);
  const setField = (name, value) => setForm((previous) => ({ ...previous, [name]: value }));
  const reset = () => { setEditing(null); setForm(EMPTY); setError(''); };
  const edit = (promo) => {
    const firstTier = promo.serviceTiers?.[0] || promo.service_tiers?.[0];
    setEditing(promo);
    setForm({
      ...EMPTY,
      ...promo,
      applies_to_all_services: Boolean(promo.applies_to_all_services),
      applies_to_all_inventory: Boolean(promo.applies_to_all_inventory),
      service_id: firstTier?.service_id || firstTier?.service?.id || '',
      service_ids: [...new Set((promo.serviceTiers || promo.service_tiers || []).map((tier) => tier.service_id || tier.service?.id).filter(Boolean))],
      tier_ids: (promo.serviceTiers || promo.service_tiers || []).map((tier) => tier.id),
      inventory_ids: (promo.inventoryItems || promo.inventory_items || []).map((item) => item.id),
      discount_value: promo.discount_value ?? '',
      promotional_price: promo.promotional_price ?? '',
    });
    setError('');
  };
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await apiFetch(editing ? `/api/admin/promotions/${editing.id}` : '/api/admin/promotions', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.message || Object.values(payload?.errors || {}).flat()[0] || 'Unable to save promotion.');
      addToast?.(editing ? 'Promotion updated.' : 'Promotion created.');
      reset();
      await load();
    } catch (err) {
      setError(err?.message || 'Unable to save promotion.');
    } finally {
      setSaving(false);
    }
  };
  const remove = async (promo) => {
    if (!window.confirm(`Delete “${promo.title}”?`)) return;
    const response = await apiFetch(`/api/admin/promotions/${promo.id}`, { method: 'DELETE' });
    if (!response.ok) { setError('Unable to delete promotion.'); return; }
    addToast?.('Promotion deleted.');
    if (editing?.id === promo.id) reset();
    load();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-dark/45 p-3 backdrop-blur-sm sm:p-5" onClick={onClose}>
      <section className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-brand-dark-light bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <header className="flex shrink-0 items-center justify-between gap-2 rounded-t-2xl bg-brand-teal px-3 py-3 text-white sm:px-6 sm:py-4">
          <div className="flex min-w-0 items-center gap-2">
            <div className="min-w-0"><h2 className="truncate text-base font-extrabold sm:text-lg">Promo Management</h2><p className="mt-0.5 text-[11px] font-semibold text-white/80">Select a promotion to edit its details.</p></div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close promo management" className="shrink-0 rounded-lg p-1.5 transition-colors hover:bg-white/15"><X size={18} /></button>
        </header>
        <div className="grid min-h-0 flex-1 gap-2.5 overflow-y-auto bg-brand-surface/40 p-2.5 sm:gap-3 sm:p-3 lg:grid-cols-[.9fr_1.1fr] lg:overflow-hidden">
          <section className="flex min-h-0 flex-col rounded-xl bg-white shadow-sm lg:overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-brand-dark-light px-3 py-2.5 sm:px-4 sm:py-3">
              <div><h3 className="text-xs font-extrabold uppercase tracking-wide text-brand-dark">Add or Edit Promotion Detail</h3></div>
            </div>
            <div className="min-h-0 space-y-2 overflow-y-auto p-3 sm:p-4">
              {loading ? <p className="rounded-lg border border-dashed border-brand-teal/20 px-3 py-6 text-center text-xs text-brand-dark-soft">Loading promotions...</p> : promos.length === 0 ? (
                <div className="rounded-xl border border-dashed border-brand-teal/25 bg-brand-teal/5 px-4 py-8 text-center"><Gift size={24} className="mx-auto mb-2 text-brand-teal/60" /><p className="text-xs font-bold text-brand-dark">No promotions yet</p><p className="mt-1 text-[11px] text-brand-dark-soft">Create a promotion to offer a discount on selected services or products.</p></div>
              ) : promos.map((promo) => {
                const status = statusFor(promo);
                return <article key={promo.id} className={`rounded-lg border p-2.5 transition-colors ${editing?.id === promo.id ? 'border-brand-teal bg-brand-teal/5 shadow-sm' : 'border-brand-dark-light bg-white hover:border-brand-teal/50'}`}><div className="flex items-start justify-between gap-2"><div className="min-w-0"><h4 className="truncate text-xs font-extrabold text-brand-dark">{promo.title}</h4><p className="mt-1 text-[11px] font-bold text-brand-teal-dark">{promo.discount_type === 'percentage' ? `${promo.discount_value}% off` : promo.discount_type === 'fixed' ? `${money(promo.discount_value)} off` : `Set price ${money(promo.promotional_price)}`}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-bold ${status.className}`}>{status.label}</span></div><p className="mt-1.5 text-[10px] text-brand-dark-soft">{promo.starts_on} to {promo.ends_on}</p><div className="mt-2 flex gap-2"><button type="button" onClick={() => edit(promo)} className="inline-flex items-center gap-1 rounded-md border border-brand-teal/25 px-2 py-1 text-[10px] font-bold text-brand-teal-dark hover:bg-brand-teal/10"><Pencil size={11} /> Edit</button><button type="button" onClick={() => remove(promo)} className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-[10px] font-bold text-red-600 hover:bg-red-50"><Trash2 size={11} /> Delete</button></div></article>;
              })}
            </div>
          </section>
          <form onSubmit={save} className="flex min-h-0 flex-col rounded-xl bg-white shadow-sm lg:overflow-hidden">
            <div className="flex items-center gap-2 border-b border-brand-dark-light px-3 py-2.5 sm:px-4 sm:py-3"><Gift size={16} className="text-brand-teal" /><h3 className="text-xs font-extrabold uppercase tracking-wide text-brand-dark">{editing ? 'Edit Promotion' : 'Create Promotion'}</h3></div>
            <div className="min-h-0 space-y-2.5 overflow-y-auto p-3 sm:p-4">
              {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-600">{error}</p>}
              <fieldset className="space-y-2.5 rounded-xl border border-brand-dark-light bg-white p-3 shadow-sm"><legend className="px-1 text-[10px] font-extrabold uppercase tracking-wide text-brand-dark">Promotion Details</legend><label className="block text-[10px] font-semibold uppercase tracking-wide text-brand-dark-soft">Title<input required value={form.title} onChange={(event) => setField('title', event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-brand-dark-light bg-white px-3 text-xs text-brand-dark outline-none transition-colors focus:border-brand-teal" /></label><label className="block text-[10px] font-semibold uppercase tracking-wide text-brand-dark-soft">Description<textarea value={form.description || ''} onChange={(event) => setField('description', event.target.value)} className="mt-1 min-h-16 w-full rounded-lg border border-brand-dark-light bg-white px-3 py-2 text-xs text-brand-dark outline-none transition-colors focus:border-brand-teal" rows="2" /></label></fieldset>
              <fieldset className="space-y-2.5 rounded-xl border border-brand-dark-light bg-white p-3 shadow-sm"><legend className="px-1 text-[10px] font-extrabold uppercase tracking-wide text-brand-dark">Discount</legend><div className="grid gap-2.5 sm:grid-cols-2"><label className="text-[10px] font-semibold uppercase tracking-wide text-brand-dark-soft">Type<SelectDropdown value={form.discount_type} onChange={(value) => setField('discount_type', value)} options={[{ value: 'percentage', label: 'Percentage' }, { value: 'fixed', label: 'Fixed amount' }, { value: 'promotional_price', label: 'Set price' }]} /></label><label className="text-[10px] font-semibold uppercase tracking-wide text-brand-dark-soft">{form.discount_type === 'promotional_price' ? 'Promo Price' : 'Value'}<input required type="number" min="0" step="0.01" value={form.discount_type === 'promotional_price' ? form.promotional_price : form.discount_value} onChange={(event) => setField(form.discount_type === 'promotional_price' ? 'promotional_price' : 'discount_value', event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-brand-dark-light px-3 text-xs outline-none focus:border-brand-teal" /></label></div></fieldset>
              <fieldset className="space-y-2.5 rounded-xl border border-brand-dark-light bg-white p-3 shadow-sm"><legend className="px-1 text-[10px] font-extrabold uppercase tracking-wide text-brand-dark">Applicable Services &amp; Packages</legend><button type="button" aria-pressed={form.applies_to_all_services} onClick={() => setForm((previous) => ({ ...previous, applies_to_all_services: !previous.applies_to_all_services, service_id: '', service_ids: [], tier_ids: [] }))} className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-[11px] font-extrabold transition-colors ${form.applies_to_all_services ? 'border-brand-teal bg-brand-teal text-white shadow-sm' : 'border-brand-teal/30 bg-brand-teal/5 text-brand-teal-dark hover:border-brand-teal hover:bg-brand-teal/10'}`}><span>Apply to all services and packages</span><span className={`rounded-full px-2 py-0.5 text-[9px] uppercase tracking-wide ${form.applies_to_all_services ? 'bg-white/20 text-white' : 'bg-white text-brand-teal-dark'}`}>{form.applies_to_all_services ? 'On' : 'Off'}</span></button>{!form.applies_to_all_services && <><SelectDropdown value="" onChange={(value) => value && !selectedServiceIds.includes(value) && setForm((previous) => ({ ...previous, service_id: previous.service_id || value, service_ids: [...selectedServiceIds, value] }))} options={serviceOptions.filter((option) => !selectedServiceIds.includes(option.value))} placeholder={selectedServiceIds.length ? 'Add another service' : 'Select service'} searchable searchPlaceholder="Search services" />{selectedServices.length > 0 && <div className="flex flex-wrap gap-1.5">{selectedServices.map((service) => <button key={service.id} type="button" onClick={() => { const ids = selectedServiceIds.filter((id) => String(id) !== String(service.id)); const allowedTiers = tiers.filter((tier) => ids.some((id) => String(id) === String(tier.service_id))); setForm((previous) => ({ ...previous, service_id: ids[0] || '', service_ids: ids, tier_ids: previous.tier_ids.filter((id) => allowedTiers.some((tier) => String(tier.id) === String(id))) })); }} className="rounded-full bg-brand-teal/10 px-2.5 py-1 text-[10px] font-bold text-brand-teal-dark">{service.name} <X size={10} className="ml-1 inline" /></button>)}</div>}<PackagePicker tiers={tiers} value={form.tier_ids} onChange={(value) => setField('tier_ids', value)} /></>}</fieldset>
              <fieldset className="space-y-2.5 rounded-xl border border-brand-dark-light bg-white p-3 shadow-sm"><legend className="px-1 text-[10px] font-extrabold uppercase tracking-wide text-brand-dark">Applicable Retail Products</legend><button type="button" aria-pressed={form.applies_to_all_inventory} onClick={() => setForm((previous) => ({ ...previous, applies_to_all_inventory: !previous.applies_to_all_inventory, inventory_ids: [] }))} className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left text-[11px] font-extrabold transition-colors ${form.applies_to_all_inventory ? 'border-brand-teal bg-brand-teal text-white shadow-sm' : 'border-brand-teal/30 bg-brand-teal/5 text-brand-teal-dark hover:border-brand-teal hover:bg-brand-teal/10'}`}><span>Apply to all retail products</span><span className={`rounded-full px-2 py-0.5 text-[9px] uppercase tracking-wide ${form.applies_to_all_inventory ? 'bg-white/20 text-white' : 'bg-white text-brand-teal-dark'}`}>{form.applies_to_all_inventory ? 'On' : 'Off'}</span></button>{!form.applies_to_all_inventory && <ProductPicker products={inventory} value={form.inventory_ids} onChange={(value) => setField('inventory_ids', value)} />}</fieldset>
              <fieldset className="space-y-2.5 rounded-xl border border-brand-dark-light bg-white p-3 shadow-sm"><legend className="px-1 text-[10px] font-extrabold uppercase tracking-wide text-brand-dark">Validity &amp; Status</legend><div className="grid gap-2.5 sm:grid-cols-2"><label className="text-[10px] font-semibold uppercase tracking-wide text-brand-dark-soft">Start Date<input required type="date" value={form.starts_on || ''} onChange={(event) => setField('starts_on', event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-brand-dark-light px-3 text-xs outline-none focus:border-brand-teal" /></label><label className="text-[10px] font-semibold uppercase tracking-wide text-brand-dark-soft">End Date<input required type="date" value={form.ends_on || ''} onChange={(event) => setField('ends_on', event.target.value)} className="mt-1 h-10 w-full rounded-lg border border-brand-dark-light px-3 text-xs outline-none focus:border-brand-teal" /></label></div><label className="flex items-center gap-2 text-xs font-semibold text-brand-dark"><input type="checkbox" checked={form.is_active} onChange={(event) => setField('is_active', event.target.checked)} className="accent-brand-teal" /> Active</label></fieldset>
            </div>
            <div className="sticky bottom-2 z-10 mx-1 mt-2 flex shrink-0 gap-2 rounded-xl bg-white/95 p-2 shadow-lg ring-1 ring-brand-dark-light/70 backdrop-blur"><button type="submit" disabled={saving || ((!form.applies_to_all_services && (!selectedServiceIds.length || form.tier_ids.length === 0)) && (!form.applies_to_all_inventory && form.inventory_ids.length === 0))} className={`${button} flex-1 bg-brand-teal text-white shadow-md shadow-brand-teal/20 hover:bg-brand-teal-dark`}>{saving ? 'Saving...' : editing ? 'Update Promotion' : 'Save Promotion'}</button>{editing && <button type="button" onClick={reset} className={`${button} border border-brand-dark-light bg-white text-brand-dark hover:bg-brand-surface`}>Cancel</button>}</div>
          </form>
        </div>
      </section>
    </div>
  );
}
