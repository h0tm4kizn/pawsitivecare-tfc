import { useState } from 'react';
import { Check, Plus, Trash2, X } from 'lucide-react';
import { apiFetch } from '../../../api/apiClient';
import SelectDropdown from '../../../components/reusable-ui/SelectDropdown';

const GROUP_OPTIONS = [
  { value: 'Pawsome Extras', label: 'Pawsome Extras' },
  { value: 'Upgrade', label: 'Upgrade' },
  { value: '__new__', label: 'Create new group' },
];

const SERVICE_FLAGS = [
  { key: 'applies_to_grooming', label: 'Grooming' },
  { key: 'applies_to_daycare', label: 'Daycare' },
  { key: 'applies_to_hotel', label: 'Hotel' },
];

const emptyTier = () => ({ tier_label: '', price_min: '', price_max: '' });

export default function AddAddonModal({ onClose, onSaved }) {
  const [form, setForm] = useState({
    name: '',
    groupChoice: 'Pawsome Extras',
    newGroup: '',
    applies_to_grooming: true,
    applies_to_daycare: false,
    applies_to_hotel: false,
    has_size_pricing: false,
    is_active: true,
  });
  const [tiers, setTiers] = useState([emptyTier()]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const set = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErr('');
  };

  const setTier = (index, key, value) => {
    setTiers((prev) => prev.map((tier, idx) => (idx === index ? { ...tier, [key]: value } : tier)));
    setErr('');
  };

  const addonGroup = form.groupChoice === '__new__' ? form.newGroup.trim() : form.groupChoice;

  const submit = async () => {
    if (!form.name.trim()) {
      setErr('Pawsome Extra name is required.');
      return;
    }
    if (!addonGroup) {
      setErr('Group is required.');
      return;
    }
    if (!form.applies_to_grooming && !form.applies_to_daycare && !form.applies_to_hotel) {
      setErr('Choose at least one service where this Pawsome Extra appears.');
      return;
    }

    const validTiers = tiers.map((tier) => ({
      tier_label: tier.tier_label.trim(),
      price_min: tier.price_min,
      price_max: tier.price_max,
    }));

    if (validTiers.some((tier) => tier.price_min === '')) {
      setErr('Each tier needs a price.');
      return;
    }

    setSaving(true);
    setErr('');
    try {
      const res = await apiFetch('/api/service-addons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          addon_group: addonGroup,
          applies_to_grooming: form.applies_to_grooming,
          applies_to_daycare: form.applies_to_daycare,
          applies_to_hotel: form.applies_to_hotel,
          has_size_pricing: form.has_size_pricing || validTiers.length > 1 || validTiers.some((tier) => tier.tier_label),
          is_active: form.is_active,
          price_min: Number(validTiers[0].price_min),
          price_max: validTiers[0].price_max !== '' ? Number(validTiers[0].price_max) : null,
          tier_label: validTiers.length === 1 ? validTiers[0].tier_label || null : null,
          ...(validTiers.length > 1 ? {
            tiers: validTiers.map((tier) => ({
              tier_label: tier.tier_label || null,
              price_min: Number(tier.price_min),
              price_max: tier.price_max !== '' ? Number(tier.price_max) : null,
            })),
          } : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Failed to add Pawsome Extra.');
      onSaved?.();
      onClose?.();
    } catch (error) {
      setErr(error?.message || 'Failed to add Pawsome Extra.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex h-[100dvh] min-h-[100dvh] w-screen items-center justify-center bg-brand-dark/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between bg-brand-teal px-5 py-3.5">
          <h2 className="text-sm font-semibold text-white">Add Pawsome Extra</h2>
          <button type="button" onClick={onClose} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25">
            <X size={15} strokeWidth={2.8} />
          </button>
        </div>

        <div className="max-h-[72vh] space-y-4 overflow-y-auto px-5 py-5">
          {err && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-500">{err}</p>}

          <div>
            <label className="text-xs font-semibold text-brand-dark">Pawsome Extra Name <span className="text-red-500">*</span></label>
            <input
              value={form.name}
              onChange={(event) => set('name', event.target.value)}
              placeholder="e.g. Nail Trim"
              className="mt-1 w-full rounded-xl border border-brand-teal/20 px-3 py-2 text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-semibold text-brand-dark">Group</label>
              <SelectDropdown
                value={form.groupChoice}
                onChange={(value) => set('groupChoice', value)}
                options={GROUP_OPTIONS}
              />
            </div>
            {form.groupChoice === '__new__' && (
              <div>
                <label className="text-xs font-semibold text-brand-dark">New Group Name</label>
                <input
                  value={form.newGroup}
                  onChange={(event) => set('newGroup', event.target.value)}
                  placeholder="e.g. Wellness"
                  className="mt-1 w-full rounded-xl border border-brand-teal/20 px-3 py-2 text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
                />
              </div>
            )}
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold text-brand-dark">Appears For</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {SERVICE_FLAGS.map((service) => (
                <button
                  key={service.key}
                  type="button"
                  onClick={() => set(service.key, !form[service.key])}
                  className={`flex min-h-[42px] items-center justify-between rounded-xl border px-3 py-2 text-left text-sm font-semibold transition-colors ${
                    form[service.key]
                      ? 'border-brand-teal bg-brand-teal text-white shadow-sm'
                      : 'border-brand-teal/15 bg-white text-brand-dark hover:border-brand-teal/40 hover:bg-brand-teal/5'
                  }`}
                  aria-pressed={form[service.key]}
                >
                  {service.label}
                  <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                    form[service.key] ? 'border-white bg-white text-brand-teal' : 'border-brand-teal/25 text-transparent'
                  }`}>
                    <Check size={13} strokeWidth={3} />
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-brand-teal/15 pt-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-brand-dark">Tiers</p>
                <p className="text-[11px] text-brand-dark-soft">Leave tier label blank for a single standard price.</p>
              </div>
              <button
                type="button"
                onClick={() => setTiers((prev) => [...prev, emptyTier()])}
                className="inline-flex items-center gap-1.5 rounded-xl border border-brand-teal/25 px-3 py-2 text-xs font-semibold text-brand-teal hover:bg-brand-teal hover:text-white"
              >
                <Plus size={13} />
                Add Tier
              </button>
            </div>

            <div className="space-y-3">
              {tiers.map((tier, index) => (
                <div key={index} className="grid gap-3 rounded-xl border border-brand-teal/15 px-3 py-3 sm:grid-cols-[1fr_120px_120px_32px]">
                  <div>
                    <label className="text-xs font-semibold text-brand-dark">Tier Label</label>
                    <input
                      value={tier.tier_label}
                      onChange={(event) => setTier(index, 'tier_label', event.target.value)}
                      placeholder={index === 0 ? 'Standard' : 'e.g. Large'}
                      className="mt-1 w-full rounded-xl border border-brand-teal/20 px-3 py-2 text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-brand-dark">Price <span className="text-red-500">*</span></label>
                    <input
                      type="number"
                      min="0"
                      value={tier.price_min}
                      onChange={(event) => setTier(index, 'price_min', event.target.value)}
                      placeholder="0.00"
                      className="mt-1 w-full rounded-xl border border-brand-teal/20 px-3 py-2 text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-brand-dark">Max</label>
                    <input
                      type="number"
                      min="0"
                      value={tier.price_max}
                      onChange={(event) => setTier(index, 'price_max', event.target.value)}
                      placeholder="Optional"
                      className="mt-1 w-full rounded-xl border border-brand-teal/20 px-3 py-2 text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setTiers((prev) => prev.filter((_, idx) => idx !== index))}
                    disabled={tiers.length === 1}
                    className="mt-6 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Remove tier"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <label className="flex items-center justify-between gap-3 rounded-xl border border-brand-teal/15 px-4 py-3 text-sm font-semibold text-brand-dark">
            Active
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(event) => set('is_active', event.target.checked)}
              className="h-4 w-4 accent-brand-teal"
            />
          </label>
        </div>

        <div className="flex border-t border-brand-teal/15 px-5 py-4">
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="w-full rounded-xl bg-brand-teal py-2.5 text-sm font-semibold text-white hover:bg-brand-teal-dark disabled:opacity-60"
          >
            {saving ? 'Adding...' : 'Add Pawsome Extra'}
          </button>
        </div>
      </div>
    </div>
  );
}
