import { useState } from 'react';
import { ChevronDown, Trash2, X } from 'lucide-react';
import { apiFetch } from '../../../api/apiClient';
import useMediaQuery from '../../../hooks/useMediaQuery';
import useBodyScrollLock from '../../../hooks/useBodyScrollLock';

function Toggle({ value, onChange, activeColor = 'bg-brand-teal' }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${value ? activeColor : 'bg-gray-300'}`}
    >
      <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-4' : ''}`} />
    </button>
  );
}

export default function EditPackageModal({ service, cats, onClose, onSaved }) {
  const isMobile = useMediaQuery('(max-width: 767px)');
  useBodyScrollLock(isMobile);
  const normalizeCategory = (value) => String(value || '').trim().toLowerCase();
  const CATEGORY_TONE = {
    grooming: { activeBg: '#a78bfa', activeText: 'text-white', inactiveText: 'text-brand-grooming', inactiveBorder: 'border-brand-grooming-soft', hoverBorder: 'hover:border-brand-grooming' },
    daycare: { activeBg: '#fbbf24', activeText: 'text-white', inactiveText: 'text-brand-daycare', inactiveBorder: 'border-brand-daycare-soft', hoverBorder: 'hover:border-brand-daycare' },
    hotel: { activeBg: '#fb7185', activeText: 'text-white', inactiveText: 'text-brand-hotel', inactiveBorder: 'border-brand-hotel-soft', hoverBorder: 'hover:border-brand-hotel' },
  };

  const [form, setForm] = useState({
    name: service.name,
    category: normalizeCategory(service.category),
    description: service.description || '',
    is_active: service.is_active,
  });
  const [tiers, setTiers] = useState((service.service_tiers || []).map((t) => ({ ...t, _delete: false })));
  const [selectedTierIndex, setSelectedTierIndex] = useState(0);
  const [tierMenuOpen, setTierMenuOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const setTierField = (i, field, val) =>
    setTiers((prev) => prev.map((t, idx) => (idx === i ? { ...t, [field]: val } : t)));

  const addTier = () => {
    setTiers((p) => {
      setSelectedTierIndex(p.length);
      return [...p, { id: null, size_label: '', price: '', duration_hours: '', _delete: false }];
    });
    setTierMenuOpen(false);
  };

  const removeTier = (i) => {
    const tier = tiers[i];
    if (tier.id) setTiers((p) => p.map((t, idx) => (idx === i ? { ...t, _delete: true } : t)));
    else setTiers((p) => p.filter((_, idx) => idx !== i));
    const next = tiers.findIndex((t, idx) => idx !== i && !t._delete);
    setSelectedTierIndex(next >= 0 ? next : 0);
    setTierMenuOpen(false);
  };

  const activeTierEntries = tiers
    .map((tier, index) => ({ tier, index }))
    .filter(({ tier }) => !tier._delete);
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
      setErr('Name is required.');
      return;
    }

    const active = tiers.filter((t) => !t._delete);
    for (const t of active) {
      if (!t.size_label.trim() || !t.price) {
        setErr('Each tier needs a label and price.');
        return;
      }
    }

    setSaving(true);
    setErr('');
    try {
      if (service.category === 'hotel') {
        const res = await apiFetch(`/api/hotel-suites/${service.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: form.name.trim(), is_available: form.is_active }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.message || 'Failed to update hotel suite.');
        onSaved();
        onClose();
        return;
      }

      const res = await apiFetch(`/api/admin/services/${service.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          category: form.category,
          description: form.description || null,
          is_active: form.is_active,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || 'Failed to update package.');
      if (data?.queued) {
        onSaved();
        onClose();
        return;
      }

      for (const t of tiers) {
        let tierRes = null;
        if (t._delete && t.id) {
          tierRes = await apiFetch(`/api/service-tiers/${t.id}`, { method: 'DELETE' });
        } else if (!t._delete && t.id) {
          tierRes = await apiFetch(`/api/service-tiers/${t.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              size_label: t.size_label.trim(),
              price: parseFloat(t.price),
              ...(t.duration_hours ? { duration_hours: parseFloat(t.duration_hours) } : {}),
            }),
          });
        } else if (!t._delete && !t.id) {
          tierRes = await apiFetch('/api/service-tiers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              service_id: service.id,
              size_label: t.size_label.trim(),
              price: parseFloat(t.price),
              ...(t.duration_hours ? { duration_hours: parseFloat(t.duration_hours) } : {}),
            }),
          });
        }

        if (tierRes && !tierRes.ok) {
          const tierData = await tierRes.json().catch(() => ({}));
          throw new Error(tierData?.message || 'Failed to save pricing tiers.');
        }
      }

      onSaved();
      onClose();
    } catch (e) {
      setErr(e.message || 'An error occurred.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex h-[100dvh] min-h-[100dvh] w-screen items-center justify-center bg-brand-dark/40 p-2 backdrop-blur-sm sm:p-4" onClick={onClose}>
      <div className="flex max-h-[calc(100dvh-1rem)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl md:max-h-none" onClick={(e) => e.stopPropagation()}>
        <div className="flex shrink-0 items-center justify-between bg-brand-teal px-4 py-3.5 sm:px-5">
          <h2 className="text-sm font-bold text-white">Edit Package Details</h2>
          <button type="button" onClick={onClose} aria-label="Close Edit Package Details" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25">
            <X size={15} strokeWidth={2.8} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5 sm:py-5 md:max-h-[72vh] md:flex-none">
          {err && <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{err}</div>}

          <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
            <div className="min-w-0 overflow-hidden rounded-xl border border-brand-teal/25 bg-brand-teal/5">
              <div className="border-b border-brand-teal/15 bg-brand-teal/10 px-4 py-3">
                <p className="text-sm font-extrabold text-brand-dark">Package Details</p>
                <p className="mt-0.5 text-[11px] text-brand-dark-soft">Name, service type, description, and availability.</p>
              </div>

              <div className="space-y-4 px-4 py-4">
              <div>
                <label className="text-xs font-semibold text-brand-dark">Package Name <span className="text-red-500">*</span></label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  className="mt-1 w-full rounded-xl border border-brand-teal/20 px-3 py-2 text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
                />
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold text-brand-dark">Service Type</p>
                <div className="flex max-w-full flex-wrap gap-2">
                  {cats.map((c) => (
                    <button
                      key={c.slug}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, category: normalizeCategory(c.slug) }))}
                      className={`rounded-xl border px-4 py-2 text-sm font-semibold transition-colors ${
                        form.category === normalizeCategory(c.slug)
                          ? `${CATEGORY_TONE[normalizeCategory(c.slug)]?.activeText || 'text-white'} border-transparent`
                          : `${CATEGORY_TONE[normalizeCategory(c.slug)]?.inactiveText || 'text-brand-dark'} ${CATEGORY_TONE[normalizeCategory(c.slug)]?.inactiveBorder || 'border-brand-teal/20'} ${CATEGORY_TONE[normalizeCategory(c.slug)]?.hoverBorder || 'hover:border-brand-teal'}`
                      }`}
                      style={form.category === normalizeCategory(c.slug) ? { backgroundColor: CATEGORY_TONE[normalizeCategory(c.slug)]?.activeBg || c.color, borderColor: CATEGORY_TONE[normalizeCategory(c.slug)]?.activeBg || c.color } : {}}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-brand-dark">Description</label>
                <textarea
                  rows={5}
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  className="mt-1 w-full resize-none rounded-xl border border-brand-teal/20 px-3 py-2 text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between rounded-xl border border-brand-teal/15 px-4 py-3">
                <span className="text-sm font-semibold text-brand-dark">Active</span>
                <Toggle value={form.is_active} onChange={(v) => setForm((p) => ({ ...p, is_active: v }))} />
              </div>
              </div>
            </div>

            <div className="min-w-0 overflow-hidden rounded-xl border border-brand-teal/25 bg-white">
              <div className="border-b border-brand-teal/15 bg-brand-dark/5 px-4 py-3">
                <p className="text-sm font-extrabold text-brand-dark">Pricing Tiers</p>
                <p className="mt-0.5 text-[11px] text-brand-dark-soft">Prices, durations, and size labels.</p>
              </div>

              <div className="px-4 py-4">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setTierMenuOpen((open) => !open)}
                    className="flex min-h-11 w-full items-center justify-between gap-2 rounded-xl border border-brand-teal/20 bg-white px-3 py-2.5 text-left text-sm font-semibold text-brand-dark transition-colors hover:border-brand-teal"
                  >
                    <span className="min-w-0 break-words sm:truncate">{selectedTier ? tierLabel(selectedTier, selectedRealIdx) : 'No tiers available'}</span>
                    <ChevronDown size={15} className={`shrink-0 text-brand-teal transition-transform ${tierMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {tierMenuOpen && (
                    <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-xl border border-brand-teal/20 bg-white shadow-lg">
                      {activeTierEntries.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-brand-dark-soft">No tiers yet.</p>
                      ) : activeTierEntries.map(({ tier, index }) => (
                        <button
                          key={tier.id || index}
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
                        onChange={(e) => setTierField(selectedRealIdx, 'size_label', e.target.value)}
                        placeholder="e.g. Small"
                        className="mt-1 w-full rounded-xl border border-brand-teal/20 bg-white px-3 py-2 text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className="text-xs font-semibold text-brand-dark">Price</label>
                        <input
                          type="number"
                          min="0"
                          value={selectedTier.price}
                          onChange={(e) => setTierField(selectedRealIdx, 'price', e.target.value)}
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
                          onChange={(e) => setTierField(selectedRealIdx, 'duration_hours', e.target.value)}
                          placeholder="Optional"
                          className="mt-1 w-full rounded-xl border border-brand-teal/20 bg-white px-3 py-2 text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
                        />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeTier(selectedRealIdx)}
                      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-500 transition-colors hover:bg-red-100 sm:min-h-0 sm:w-auto"
                    >
                      <Trash2 size={13} />
                      Delete selected tier
                    </button>
                  </div>
                ) : (
                  <p className="mt-4 text-xs font-semibold text-brand-dark-soft">Add a tier to edit pricing details.</p>
                )}

                <button type="button" onClick={addTier} className="mt-2 inline-flex min-h-11 w-full items-center justify-center rounded-xl px-3 text-xs font-semibold text-brand-teal hover:bg-brand-teal/5 sm:min-h-0 sm:w-auto sm:justify-start sm:px-0 sm:hover:bg-transparent sm:hover:underline">
                  + Add tier
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 z-10 flex shrink-0 border-t border-brand-teal/15 bg-white px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-5 md:static">
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="w-full rounded-xl bg-brand-teal py-2.5 text-sm font-bold text-white hover:bg-brand-teal-dark disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
