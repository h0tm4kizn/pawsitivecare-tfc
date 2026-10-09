import { useMemo, useState } from 'react';
import { ChevronDown, Trash2, X } from 'lucide-react';
import { apiFetch } from '../../../api/apiClient';

function Toggle({ value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${value ? 'bg-brand-teal' : 'bg-gray-300'}`}
    >
      <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-4' : ''}`} />
    </button>
  );
}

export default function AddPackageModal({ cats, onClose, onSaved, actionLabel = 'Add Package' }) {
  const usableCats = useMemo(
    () => cats.filter((cat) => String(cat.slug || '').toLowerCase() !== 'hotel'),
    [cats]
  );
  const [form, setForm] = useState({
    name: '',
    category: usableCats[0]?.slug || '',
    description: '',
    is_active: true,
  });
  const [tiers, setTiers] = useState([{ size_label: 'Standard', price: '', duration_hours: '', _delete: false }]);
  const [selectedTierIndex, setSelectedTierIndex] = useState(0);
  const [tierMenuOpen, setTierMenuOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const setTierField = (index, field, value) => {
    setTiers((prev) => prev.map((tier, idx) => (idx === index ? { ...tier, [field]: value } : tier)));
    setErr('');
  };

  const addTier = () => {
    setTiers((prev) => {
      setSelectedTierIndex(prev.length);
      return [...prev, { size_label: '', price: '', duration_hours: '', _delete: false }];
    });
    setTierMenuOpen(false);
  };

  const removeTier = (index) => {
    setTiers((prev) => {
      const next = prev.filter((_, idx) => idx !== index);
      setSelectedTierIndex(Math.max(0, Math.min(index, next.length - 1)));
      return next;
    });
    setTierMenuOpen(false);
  };

  const activeTierEntries = tiers.map((tier, index) => ({ tier, index }));
  const selectedTierEntry = activeTierEntries.find(({ index }) => index === selectedTierIndex) || activeTierEntries[0] || null;
  const selectedTier = selectedTierEntry?.tier || null;
  const selectedRealIdx = selectedTierEntry?.index ?? 0;

  const tierLabel = (tier, index) => {
    const label = tier?.size_label?.trim() || `Tier ${index + 1}`;
    const price = tier?.price ? `PHP ${Number(tier.price).toLocaleString('en-PH')}` : 'No price';
    return `${label} - ${price}`;
  };

  const submit = async () => {
    if (!form.name.trim()) {
      setErr('Package name is required.');
      return;
    }
    if (!form.category) {
      setErr('Service type is required.');
      return;
    }

    const active = tiers.filter((tier) => !tier._delete);
    if (active.length === 0) {
      setErr('Add at least one pricing tier.');
      return;
    }
    for (const tier of active) {
      if (!tier.size_label.trim() || !tier.price) {
        setErr('Each tier needs a label and price.');
        return;
      }
    }

    setSaving(true);
    setErr('');
    try {
      const res = await apiFetch('/api/admin/services', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          category: form.category,
          description: form.description || null,
          is_active: form.is_active,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Failed to add package.');

      const service = data?.data || data?.service || data;
      const serviceId = service?.id;
      if (!serviceId) throw new Error('Package was created but the service ID was not returned.');

      for (const tier of active) {
        const tierRes = await apiFetch('/api/service-tiers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_id: serviceId,
            size_label: tier.size_label.trim(),
            price: parseFloat(tier.price),
            ...(tier.duration_hours ? { duration_hours: parseFloat(tier.duration_hours) } : {}),
          }),
        });
        const tierData = await tierRes.json().catch(() => ({}));
        if (!tierRes.ok) throw new Error(tierData?.message || 'Failed to save pricing tiers.');
      }

      if (onSaved) onSaved();
      else onClose?.();
    } catch (error) {
      setErr(error?.message || 'Failed to add package.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex h-[100dvh] min-h-[100dvh] w-screen items-center justify-center bg-brand-dark/40 p-2 backdrop-blur-sm sm:p-4" onClick={onClose}>
      <div className="max-h-[calc(100dvh-1rem)] w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl sm:max-h-[94vh]" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between gap-3 bg-brand-teal px-4 py-3.5 sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="truncate text-sm font-semibold text-white">{actionLabel}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label={`Close ${actionLabel}`} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25">
            <X size={15} strokeWidth={2.8} />
          </button>
        </div>

        <div className="max-h-[calc(100dvh-4rem)] overflow-y-auto px-4 py-4 sm:max-h-[72vh] sm:px-5 sm:py-5">
          {err && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</div>}

          <div className="grid gap-5 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-brand-dark">Package Name <span className="text-red-500">*</span></label>
                <input
                  value={form.name}
                  onChange={(event) => { setForm((prev) => ({ ...prev, name: event.target.value })); setErr(''); }}
                  className="mt-1 w-full rounded-xl border border-brand-teal/20 px-3 py-2 text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
                />
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold text-brand-dark">Service Type</p>
                <div className="flex flex-wrap gap-2">
                  {usableCats.map((cat) => (
                    <button
                      key={cat.slug}
                      type="button"
                      onClick={() => { setForm((prev) => ({ ...prev, category: cat.slug })); setErr(''); }}
                      className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                        form.category === cat.slug
                          ? 'border-brand-teal bg-brand-teal text-white'
                          : 'border-brand-teal/20 text-brand-dark hover:border-brand-teal'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-brand-dark">Description</label>
                <textarea
                  rows={5}
                  value={form.description}
                  onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  className="mt-1 w-full resize-none rounded-xl border border-brand-teal/20 px-3 py-2 text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-brand-teal/15 px-4 py-3">
                <span className="text-sm font-semibold text-brand-dark">Active</span>
                <Toggle value={form.is_active} onChange={(value) => setForm((prev) => ({ ...prev, is_active: value }))} />
              </div>
            </div>

            <div className="border-t border-brand-teal/15 pt-5 md:border-l md:border-t-0 md:pl-5 md:pt-0">
              <p className="text-sm font-semibold text-brand-dark">Pricing Tiers</p>
              <p className="mt-0.5 text-[11px] text-brand-dark-soft">Add at least one package price.</p>

              <div className="mt-4">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setTierMenuOpen((open) => !open)}
                    className="flex w-full items-center justify-between rounded-xl border border-brand-teal/20 bg-white px-3 py-2.5 text-left text-sm font-semibold text-brand-dark transition-colors hover:border-brand-teal"
                  >
                    <span className="truncate">{selectedTier ? tierLabel(selectedTier, selectedRealIdx) : 'No tiers available'}</span>
                    <ChevronDown size={15} className={`shrink-0 text-brand-teal transition-transform ${tierMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {tierMenuOpen && (
                    <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-xl border border-brand-teal/20 bg-white shadow-lg">
                      {activeTierEntries.map(({ tier, index }) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => { setSelectedTierIndex(index); setTierMenuOpen(false); }}
                          className={`block w-full px-3 py-2 text-left text-xs font-semibold transition-colors ${selectedRealIdx === index ? 'bg-brand-teal text-white' : 'text-brand-dark hover:bg-brand-teal/10'}`}
                        >
                          {tierLabel(tier, index)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {selectedTier ? (
                  <div className="mt-4 space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-brand-dark">Size / Label</label>
                      <input
                        value={selectedTier.size_label}
                        onChange={(event) => setTierField(selectedRealIdx, 'size_label', event.target.value)}
                        placeholder="e.g. Small"
                        className="mt-1 w-full rounded-xl border border-brand-teal/20 bg-white px-3 py-2 text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-brand-dark">Price</label>
                        <input
                          type="number"
                          min="0"
                          value={selectedTier.price}
                          onChange={(event) => setTierField(selectedRealIdx, 'price', event.target.value)}
                          placeholder="0.00"
                          className="mt-1 w-full rounded-xl border border-brand-teal/20 bg-white px-3 py-2 text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-brand-dark">Hours</label>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={selectedTier.duration_hours || ''}
                          onChange={(event) => setTierField(selectedRealIdx, 'duration_hours', event.target.value)}
                          placeholder="Optional"
                          className="mt-1 w-full rounded-xl border border-brand-teal/20 bg-white px-3 py-2 text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeTier(selectedRealIdx)}
                      disabled={tiers.length <= 1}
                      className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-500 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 size={13} />
                      Delete selected tier
                    </button>
                  </div>
                ) : null}

                <button type="button" onClick={addTier} className="mt-2 text-xs font-semibold text-brand-teal hover:underline">
                  + Add tier
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex border-t border-brand-teal/15 px-5 py-4">
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="w-full rounded-xl bg-brand-teal py-2.5 text-sm font-semibold text-white hover:bg-brand-teal-dark disabled:opacity-60"
          >
            {saving ? 'Saving...' : actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
