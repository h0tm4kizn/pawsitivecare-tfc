import { AdminSkeleton } from '../../../components/admin/AdminLoading';
import { Fragment, useMemo, useState } from 'react';
import { Check, ChevronDown, Pencil, Plus, Trash2, X } from 'lucide-react';
import { apiFetch } from '../../../api/apiClient';

const ADDON_ORDER = ['Pawsome Extras', 'Upgrade'];
const SERVICE_FLAGS = [
  { key: 'applies_to_grooming', label: 'Grooming' },
  { key: 'applies_to_daycare', label: 'Daycare' },
  { key: 'applies_to_hotel', label: 'Hotel' },
];
const PAWSOME_EXTRAS_ORDER = [
  'Tooth Brush',
  'Nail Trim',
  'Ear Cleaning',
  'Face Trim',
  'Poodle Feet',
  'Anal Sac',
  'Paw Shave',
  'Sanitary Shave',
  'Round Face',
  'Dematting - S',
  'Dematting - M',
  'Dematting - L',
  'Dematting - XL',
  'Bath & Blow dry - S',
  'Bath & Blow dry - M',
  'Bath & Blow dry - L',
  'Bath & Blow dry - XL',
  'Bath & Blow dry - XXL',
  'Medicated Bath - S',
  'Medicated Bath - M',
  'Medicated Bath - L',
  'Organic Bath - S',
  'Organic Bath - M',
  'Whitening - S',
  'Whitening - M',
];

const ADDON_DESCRIPTIONS = {
  'Tooth Brush': 'Basic dental brushing Pawsome Extra for fresher breath and cleaner teeth.',
  'Nail Trim': 'Quick nail trimming to keep paws neat and comfortable.',
  'Ear Cleaning': 'Gentle ear cleaning for routine hygiene.',
  'Face Trim': 'Light facial trim for a cleaner, tidier look.',
  'Poodle Feet': 'Clean shaved feet styling, commonly requested for poodle-style grooming.',
  'Anal Sac': 'Anal sac care Pawsome Extra when needed during grooming.',
  'Paw Shave': 'Paw area shaving to remove excess fur and improve cleanliness.',
  'Sanitary Shave': 'Sanitary area shaving for easier hygiene maintenance.',
  'Round Face': 'Rounded face trim style for a soft, polished finish.',
  Dematting: 'Mat and tangle removal priced by pet size.',
  'Bath & Blow dry': 'Bath and blow dry Pawsome Extra priced by pet size.',
  'Medicated Bath': 'Medicated bath Pawsome Extra priced by pet size.',
  'Organic Bath': 'Organic bath service for pets needing gentler bath care.',
  Whitening: 'Whitening bath Pawsome Extra for coat brightening.',
  'Mind of Play Package': 'Daycare enrichment upgrade with interactive play activities.',
};

const SIZE_SUFFIX = /\s*-\s*(S|M|L|XL|XXL)$/i;

const formatPrice = (addon) => {
  const min = Number(addon?.price_min || 0).toLocaleString('en-PH');
  if (addon?.price_max) return `PHP ${min} - PHP ${Number(addon.price_max).toLocaleString('en-PH')}`;
  return `PHP ${min}`;
};

const shortText = (value, max = 30) => {
  const text = String(value || '');
  return text.length > max ? `${text.slice(0, max)}..` : text;
};

const addonBaseName = (name = '') => String(name || '').replace(SIZE_SUFFIX, '').trim();

const addonSizeName = (name = '') => {
  const match = String(name || '').match(SIZE_SUFFIX);
  return match ? match[1].toUpperCase() : '';
};

const fallbackGroup = (addon) => {
  const category = String(addon?.category || '');
  if (category === 'daycare_upgrade') return 'Upgrade';
  if (category === 'hotel_grooming') return 'Hotel';
  return 'Pawsome Extras';
};

const serviceLabels = (addon) => {
  const labels = [];
  if (addon?.applies_to_grooming || ['grooming_extra', 'grooming_addon', 'treatment'].includes(addon?.category)) labels.push('Grooming');
  if (addon?.applies_to_daycare || addon?.category === 'daycare_upgrade') labels.push('Daycare');
  if (addon?.applies_to_hotel || addon?.category === 'hotel_grooming') labels.push('Hotel');
  return labels.length ? labels.join(', ') : '-';
};

const sortAddons = (items) => [...items].sort((a, b) => {
  const ai = PAWSOME_EXTRAS_ORDER.indexOf(String(a?.name || ''));
  const bi = PAWSOME_EXTRAS_ORDER.indexOf(String(b?.name || ''));
  if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  return String(a?.name || '').localeCompare(String(b?.name || ''));
});

const groupDisplayAddons = (items) => {
  const groups = [];
  const seen = {};
  sortAddons(items).forEach((addon) => {
    const legacySize = addonSizeName(addon.name);
    const tier = addon.tier_label || legacySize;
    const base = addon.addon_group ? addon.name : (legacySize ? addonBaseName(addon.name) : addon.name);
    const groupName = addon.addon_group || fallbackGroup(addon);
    const key = `${groupName}:${base}`;
    if (seen[key] === undefined) {
      seen[key] = groups.length;
      groups.push({ key, name: base, groupLabel: groupName, groupKey: groupName, items: [] });
    }
    groups[seen[key]].items.push({ ...addon, size: tier, serviceLabel: serviceLabels(addon) });
  });
  return groups;
};

export default function AddonsPanel({ addons, loading, onSelectAddon, selectedAddonKey, onRefresh, onAdd, addToast, isAdmin = false, mobileCards = false }) {
  const [editGroup, setEditGroup] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    addon_group: '',
    applies_to_grooming: false,
    applies_to_daycare: false,
    applies_to_hotel: false,
  });
  const [editRows, setEditRows] = useState([]);
  const [editErr, setEditErr] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [actionTarget, setActionTarget] = useState(null);
  const [isRunningAction, setIsRunningAction] = useState(false);
  const [actionMenuFor, setActionMenuFor] = useState(null);
  const [showAddonsTable, setShowAddonsTable] = useState(!mobileCards);

  const rows = useMemo(() => {
    return groupDisplayAddons(addons)
      .map((addonGroup) => ({
        ...addonGroup,
        active: addonGroup.items.some((addon) => addon.is_active),
        description: addonGroup.items[0]?.description || ADDON_DESCRIPTIONS[addonGroup.name] || 'Optional Pawsome Extra available during booking.',
      }))
      .sort((a, b) => {
        const ai = ADDON_ORDER.indexOf(a.groupLabel);
        const bi = ADDON_ORDER.indexOf(b.groupLabel);
        const groupSort = (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        if (groupSort !== 0) return groupSort;
        return a.name.localeCompare(b.name);
      });
  }, [addons]);

  const openEdit = (row) => {
    const first = row.items[0] || {};
    setEditGroup(row);
    setEditForm({
      name: row.name || '',
      addon_group: row.groupLabel || '',
      applies_to_grooming: Boolean(first.applies_to_grooming || ['grooming_extra', 'grooming_addon', 'treatment'].includes(first.category)),
      applies_to_daycare: Boolean(first.applies_to_daycare || first.category === 'daycare_upgrade'),
      applies_to_hotel: Boolean(first.applies_to_hotel || first.category === 'hotel_grooming'),
    });
    setEditRows(row.items.map((addon) => ({
      id: addon.id,
      tier_label: addon.size || addon.tier_label || '',
      price_min: String(addon.price_min ?? ''),
      price_max: String(addon.price_max ?? ''),
    })));
    setEditErr('');
  };

  const saveEdit = async () => {
    const invalid = !editForm.name.trim()
      || !editForm.addon_group.trim()
      || (!editForm.applies_to_grooming && !editForm.applies_to_daycare && !editForm.applies_to_hotel)
      || editRows.some((row) => row.price_min === '');
    if (invalid) {
      setEditErr('Name, group, appears for, and price min are required.');
      return;
    }

    setIsSavingEdit(true);
    setEditErr('');
    try {
      for (const row of editRows) {
        const res = await apiFetch(`/api/service-addons/${row.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: editForm.name.trim(),
            addon_group: editForm.addon_group.trim(),
            applies_to_grooming: editForm.applies_to_grooming,
            applies_to_daycare: editForm.applies_to_daycare,
            applies_to_hotel: editForm.applies_to_hotel,
            tier_label: row.tier_label.trim() || null,
            price_min: Number(row.price_min),
            price_max: row.price_max !== '' ? Number(row.price_max) : null,
          }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Failed to update Pawsome Extra.');
      }
      addToast?.('Pawsome Extra updated.');
      setEditGroup(null);
      await onRefresh?.();
    } catch (error) {
      setEditErr(error.message || 'Failed to update Pawsome Extra.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const runAction = async () => {
    if (!actionTarget) return;
    const { type, row } = actionTarget;
    setIsRunningAction(true);
    try {
      for (const addon of row.items) {
        const res = await apiFetch(`/api/service-addons/${addon.id}`, {
          method: type === 'delete' ? 'DELETE' : 'PUT',
          headers: { 'Content-Type': 'application/json' },
          ...(type === 'delete' ? {} : {
            body: JSON.stringify({
              is_active: !row.active,
              ...((row.active) ? {
                deactivation_reason: 'Admin action from service management.',
                action_reason: 'Admin action from service management.',
              } : {}),
            }),
          }),
        });
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Action failed.');
      }
      addToast?.(type === 'delete' ? 'Pawsome Extra deleted.' : `Pawsome Extra ${row.active ? 'deactivated' : 'activated'}.`);
      setActionTarget(null);
      await onRefresh?.();
    } catch (error) {
      addToast?.(error.message || 'Failed to update Pawsome Extra.', 'error');
      setActionTarget(null);
    } finally {
      setIsRunningAction(false);
    }
  };

  return (
    <>
    <div className="overflow-hidden rounded-xl border border-brand-teal/20 bg-white shadow-[0_6px_12px_rgba(23,53,81,0.08)]">
      <div className="flex items-center justify-between gap-3 border-b border-brand-teal/20 bg-white px-4 py-3">
        <button
          type="button"
          onClick={() => setShowAddonsTable((open) => !open)}
          aria-expanded={showAddonsTable}
          className="min-w-0 flex-1 text-left"
        >
          <p className="text-sm font-semibold text-brand-dark">Pawsome Extras</p>
          <p className="text-[11px] text-brand-dark-soft">Configured Pawsome Extras and service add-ons.</p>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {onAdd && <button type="button" onClick={onAdd} className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-brand-teal/25 px-2.5 text-xs font-semibold text-brand-teal-dark hover:bg-brand-teal/5"><Plus size={14} />Add</button>}
          <button
            type="button"
            onClick={() => setShowAddonsTable((open) => !open)}
            aria-expanded={showAddonsTable}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-brand-teal transition-colors hover:bg-brand-teal/10"
            aria-label={showAddonsTable ? 'Hide Pawsome Extras' : 'Show Pawsome Extras'}
          >
            <ChevronDown size={16} className={`transition-transform ${showAddonsTable ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {showAddonsTable ? (
      <div>
      {mobileCards ? (
        <div className="space-y-3 p-3">
          {loading ? <AdminSkeleton label="Loading extras" rows={3} /> : rows.length === 0 ? <p className="py-6 text-center text-sm text-brand-dark-soft">No Pawsome Extras configured.</p> : rows.map((row) => <article key={row.key} className="min-w-0 rounded-xl border border-brand-teal/15 bg-white p-3">
            <div className="flex min-w-0 items-start justify-between gap-2"><h3 className="min-w-0 break-words text-sm font-bold text-brand-dark">{row.name}</h3><span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${row.active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>{row.active ? 'Active' : 'Inactive'}</span></div>
            <p className="mt-2 break-words text-xs text-brand-dark-soft">{row.description}</p>
            <dl className="mt-3 space-y-2 text-xs"><div className="flex justify-between gap-3"><dt className="text-brand-dark-soft">Group</dt><dd className="min-w-0 break-words text-right font-semibold text-brand-dark">{row.groupLabel}</dd></div>{row.items.map((addon) => <div key={addon.id} className="flex justify-between gap-3"><dt className="min-w-0 break-words text-brand-dark-soft">{addon.size || row.name}</dt><dd className="min-w-0 break-words text-right font-semibold text-brand-teal-dark">{formatPrice(addon)}</dd></div>)}</dl>
            {isAdmin && <div className="mt-3 flex flex-wrap gap-2 border-t border-brand-teal/10 pt-3"><button type="button" onClick={() => openEdit(row)} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-brand-teal/30 px-3 text-xs font-semibold text-brand-teal-dark"><Pencil size={14} />Edit</button><button type="button" onClick={() => setActionTarget({ type: row.active ? 'deactivate' : 'activate', row })} className="min-h-10 rounded-lg border border-brand-teal/30 px-3 text-xs font-semibold text-brand-teal-dark">{row.active ? 'Deactivate' : 'Activate'}</button><button type="button" onClick={() => setActionTarget({ type: 'delete', row })} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-red-200 px-3 text-xs font-semibold text-red-600"><Trash2 size={14} />Delete</button></div>}
          </article>)}
        </div>
      ) : <div className="overflow-x-auto">
        <table className="w-full table-fixed text-sm">
          <colgroup>
            <col className="w-[36%]" />
            <col className="w-[16%]" />
            <col className="w-[24%]" />
            <col className="w-[12%]" />
            {isAdmin && <col className="w-[12%]" />}
          </colgroup>
          <thead>
            <tr className="border-b border-brand-teal/15 bg-white">
              {['PAWSOME EXTRA', 'GROUP', 'PRICING', 'STATUS', ...(isAdmin ? ['ACTIONS'] : [])].map((col) => (
                <th
                  key={col}
                  className={`${col === 'GROUP' ? 'px-2' : 'px-4'} py-3 text-[11px] font-extrabold uppercase tracking-wider text-brand-dark ${col === 'STATUS' || col === 'ACTIONS' ? 'text-center' : 'text-left'}`}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={isAdmin ? 5 : 4}><AdminSkeleton label="Loading extras" rows={3} /></td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 5 : 4} className="px-4 py-8 text-center text-sm font-semibold text-brand-dark-soft">No Pawsome Extras configured.</td>
              </tr>
            )}
            {!loading && rows.map((row, rowIndex) => {
              const hasVariants = row.items.length > 1;
              const first = row.items[0];
              const priceLabel = hasVariants
                ? `${formatPrice(row.items[0])} to ${formatPrice(row.items[row.items.length - 1])}`
                : formatPrice(first);

              return (
                <Fragment key={row.key}>
                  <tr
                    onClick={() => onSelectAddon?.(row)}
                    className={`border-b border-brand-teal/10 transition-colors hover:bg-brand-dark/5 ${selectedAddonKey === row.key ? 'bg-brand-teal/10' : ''} ${onSelectAddon ? 'cursor-pointer' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-brand-dark">{row.name}</p>
                      <p className="mt-0.5 text-[11px] text-brand-dark-soft">{shortText(ADDON_DESCRIPTIONS[row.name] || 'Optional Pawsome Extra available during booking.')}</p>
                    </td>
                    <td className="px-1 py-3 text-xs font-semibold text-brand-dark-soft">{row.groupLabel}</td>
                    <td className="px-4 py-3 text-xs font-bold text-brand-teal">{priceLabel}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${row.active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-500'}`}>
                        {row.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={(event) => { event.stopPropagation(); openEdit(row); }}
                            aria-label={`Edit ${row.name}`}
                            className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-brand-teal/35 bg-brand-teal/10 text-brand-teal-dark transition-colors hover:bg-brand-teal/20"
                          >
                            <Pencil size={12} />
                          </button>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={(event) => { event.stopPropagation(); setActionMenuFor((prev) => (prev === row.key ? null : row.key)); }}
                              aria-label="Action options"
                              title="Action options"
                              className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-500 transition-colors hover:bg-red-100"
                            >
                              <Trash2 size={12} />
                            </button>
                            {actionMenuFor === row.key && (
                              <div className={`absolute right-0 z-20 w-32 overflow-hidden rounded-lg border border-brand-teal/20 bg-white shadow-lg ${
                                rowIndex >= rows.length - 2 ? 'bottom-[calc(100%+6px)]' : 'top-[calc(100%+6px)]'
                              }`}>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setActionTarget({ type: row.active ? 'deactivate' : 'activate', row });
                                    setActionMenuFor(null);
                                  }}
                                  className="w-full px-3 py-2 text-left text-xs font-semibold text-brand-dark hover:bg-brand-dark/5"
                                >
                                  {row.active ? 'Deactivate' : 'Activate'}
                                </button>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setActionTarget({ type: 'delete', row });
                                    setActionMenuFor(null);
                                  }}
                                  className="w-full border-t border-brand-teal/15 px-3 py-2 text-left text-xs font-semibold text-red-500 hover:bg-red-50"
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
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>}
      {!loading && rows.length > 0 && (
        <div className="border-t border-brand-teal/10 px-4 py-2 text-[11px] text-brand-dark-soft">
          Showing {rows.length} Pawsome Extra group{rows.length !== 1 ? 's' : ''}
        </div>
      )}
      </div>
      ) : null}
    </div>
    {editGroup && (
      <div className="fixed inset-0 z-[90] flex h-[100dvh] min-h-[100dvh] w-screen items-end justify-center overflow-hidden bg-brand-dark/45 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => !isSavingEdit && setEditGroup(null)}>
        <div className="max-h-[100dvh] w-full max-w-lg overflow-hidden rounded-t-2xl bg-white/95 shadow-[0_18px_35px_rgba(23,53,81,0.16)] ring-1 ring-white/70 sm:max-h-[88vh] sm:rounded-2xl" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-center justify-between bg-brand-teal px-5 py-3.5">
            <h3 className="text-sm font-bold text-white">Edit Pawsome Extra</h3>
            <button type="button" onClick={() => setEditGroup(null)} disabled={isSavingEdit} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 disabled:opacity-50">
              <X size={15} strokeWidth={2.8} />
            </button>
          </div>
          <div className="max-h-[72vh] space-y-3 overflow-y-auto px-5 py-5">
            {editErr && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-500">{editErr}</p>}
            <div>
              <label className="text-xs font-semibold text-brand-dark">Pawsome Extra Name</label>
              <input
                value={editForm.name}
                onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-brand-teal/20 px-3 py-2 text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-brand-dark">Group</label>
              <input
                value={editForm.addon_group}
                onChange={(event) => setEditForm((prev) => ({ ...prev, addon_group: event.target.value }))}
                placeholder="e.g. Pawsome Extras"
                className="mt-1 w-full rounded-xl border border-brand-teal/20 px-3 py-2 text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
              />
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold text-brand-dark">Appears For</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {SERVICE_FLAGS.map((service) => (
                  <button
                    key={service.key}
                    type="button"
                    onClick={() => setEditForm((prev) => ({ ...prev, [service.key]: !prev[service.key] }))}
                    className={`flex min-h-[42px] items-center justify-between rounded-xl border px-3 py-2 text-left text-sm font-semibold transition-colors ${
                      editForm[service.key]
                        ? 'border-brand-teal bg-brand-teal text-white shadow-sm'
                        : 'border-brand-teal/15 bg-white text-brand-dark hover:border-brand-teal/40 hover:bg-brand-teal/5'
                    }`}
                    aria-pressed={editForm[service.key]}
                  >
                    {service.label}
                    <span className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                      editForm[service.key] ? 'border-white bg-white text-brand-teal' : 'border-brand-teal/25 text-transparent'
                    }`}>
                      <Check size={13} strokeWidth={3} />
                    </span>
                  </button>
                ))}
              </div>
            </div>
            {editRows.map((row, index) => (
              <div key={row.id} className="rounded-xl border border-brand-teal/15 px-4 py-3">
                <div>
                  <label className="text-xs font-semibold text-brand-dark">Tier Label</label>
                  <input value={row.tier_label} onChange={(event) => setEditRows((prev) => prev.map((item, i) => i === index ? { ...item, tier_label: event.target.value } : item))} placeholder={editRows.length === 1 ? 'Standard' : 'e.g. Large'} className="mt-1 w-full rounded-xl border border-brand-teal/20 px-3 py-2 text-sm text-brand-dark focus:border-brand-teal focus:outline-none" />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-brand-dark">Price Min</label>
                    <input type="number" min="0" value={row.price_min} onChange={(event) => setEditRows((prev) => prev.map((item, i) => i === index ? { ...item, price_min: event.target.value } : item))} className="mt-1 w-full rounded-xl border border-brand-teal/20 px-3 py-2 text-sm text-brand-dark focus:border-brand-teal focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-brand-dark">Price Max</label>
                    <input type="number" min="0" value={row.price_max} onChange={(event) => setEditRows((prev) => prev.map((item, i) => i === index ? { ...item, price_max: event.target.value } : item))} placeholder="Optional" className="mt-1 w-full rounded-xl border border-brand-teal/20 px-3 py-2 text-sm text-brand-dark focus:border-brand-teal focus:outline-none" />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-2 border-t border-brand-teal/15 px-5 py-4">
            <button type="button" onClick={() => setEditGroup(null)} disabled={isSavingEdit} className="flex-1 rounded-xl border border-brand-teal/20 py-2 text-sm text-brand-dark hover:bg-gray-50 disabled:opacity-50">
              Cancel
            </button>
            <button type="button" onClick={saveEdit} disabled={isSavingEdit} className="flex-1 rounded-xl bg-brand-teal py-2 text-sm font-bold text-white hover:bg-brand-teal-dark disabled:opacity-60">
              {isSavingEdit ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    )}

    {actionTarget && (
      <div className="fixed inset-0 z-[90] flex h-[100dvh] min-h-[100dvh] w-screen items-center justify-center bg-brand-dark/40 p-4 backdrop-blur-sm" onClick={() => !isRunningAction && setActionTarget(null)}>
        <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
          <div className="flex items-center justify-between bg-brand-teal px-5 py-3.5">
            <h3 className="text-sm font-bold text-white">
              {actionTarget.type === 'delete' ? 'Delete Pawsome Extra' : actionTarget.type === 'activate' ? 'Activate Pawsome Extra' : 'Deactivate Pawsome Extra'}
            </h3>
            <button type="button" onClick={() => setActionTarget(null)} disabled={isRunningAction} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 disabled:opacity-50">
              <X size={15} strokeWidth={2.8} />
            </button>
          </div>
          <div className="px-5 py-5">
            <p className="text-sm text-brand-dark">
              {actionTarget.type === 'delete'
                ? <>Delete <strong>{actionTarget.row.name}</strong>? This will remove all variants under this Pawsome Extra.</>
                : actionTarget.type === 'activate'
                  ? <>Activate <strong>{actionTarget.row.name}</strong>?</>
                  : <>Deactivate <strong>{actionTarget.row.name}</strong>? It will be hidden from booking Pawsome Extra choices.</>}
            </p>
          </div>
          <div className="flex gap-2 border-t border-brand-teal/15 px-5 py-4">
            <button type="button" onClick={() => setActionTarget(null)} disabled={isRunningAction} className="flex-1 rounded-xl border border-brand-teal/20 py-2 text-sm font-semibold text-brand-dark hover:bg-gray-50 disabled:opacity-50">
              Cancel
            </button>
            <button type="button" onClick={runAction} disabled={isRunningAction} className={`flex-1 rounded-xl py-2 text-sm font-bold text-white disabled:opacity-60 ${actionTarget.type === 'delete' ? 'bg-red-500 hover:bg-red-600' : 'bg-brand-teal hover:bg-brand-teal-dark'}`}>
              {isRunningAction ? 'Saving...' : actionTarget.type === 'delete' ? 'Delete' : actionTarget.type === 'activate' ? 'Activate' : 'Deactivate'}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
