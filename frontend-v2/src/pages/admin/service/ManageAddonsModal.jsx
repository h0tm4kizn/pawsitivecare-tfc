import { useState } from 'react';
import { Check, ChevronDown, MoreVertical, X } from 'lucide-react';
import { apiFetch } from '../../../api/apiClient';
import SelectDropdown from '../../../components/reusable-ui/SelectDropdown';

const DEACTIVATION_REASONS = [
  { value: 'seasonal', label: 'Seasonal / Temporary Unavailability' },
  { value: 'low_demand', label: 'Low Demand' },
  { value: 'pricing_review', label: 'Pricing Review' },
  { value: 'service_update', label: 'Service Update' },
  { value: 'other', label: 'Other (specify)' },
];

const DELETION_REASONS = [
  { value: 'duplicate', label: 'Duplicate Pawsome Extra' },
  { value: 'discontinued', label: 'Discontinued' },
  { value: 'data_entry_error', label: 'Data Entry Error' },
  { value: 'other', label: 'Other (specify)' },
];

const ADDON_ORDER = ['grooming_extra', 'grooming_addon', 'daycare_upgrade'];
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
  'Organic Bath',
  'Whitening',
];
const DISPLAY_GROUPS = [
  { key: 'grooming', label: 'Pawsome extras', categories: ['grooming_extra', 'grooming_addon'], activeOnly: true },
  { key: 'daycare', label: 'Daycare', categories: ['daycare_upgrade'] },
];

const priceLabel = (addon) => {
  const min = Number(addon.price_min || 0).toLocaleString('en-PH');
  if (addon.price_max) return `PHP ${min} - PHP ${Number(addon.price_max).toLocaleString('en-PH')}`;
  return `PHP ${min}`;
};

export default function ManageAddonsModal({ isOpen, addons, onClose, onRefresh, addToast }) {
  const [savingId, setSavingId] = useState(null);
  const [editAddon, setEditAddon] = useState(null);
  const [editForm, setEditForm] = useState({
    name: '',
    addon_group: '',
    applies_to_grooming: false,
    applies_to_daycare: false,
    applies_to_hotel: false,
    tier_label: '',
    price_min: '',
    price_max: '',
  });
  const [editErr, setEditErr] = useState('');
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deleteAddon, setDeleteAddon] = useState(null);
  const [deleteSelected, setDeleteSelected] = useState('');
  const [deleteOther, setDeleteOther] = useState('');
  const [deleteErr, setDeleteErr] = useState('');
  const [isDeletingAddon, setIsDeletingAddon] = useState(false);
  const [deactivateAddon, setDeactivateAddon] = useState(null);
  const [deactivateSelected, setDeactivateSelected] = useState('');
  const [deactivateReason, setDeactivateReason] = useState('');
  const [deactivateErr, setDeactivateErr] = useState('');
  const [isDeactivatingAddon, setIsDeactivatingAddon] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [openGroup, setOpenGroup] = useState('grooming');

  if (!isOpen) return null;

  const sorted = [...addons].sort((a, b) => {
    const ai = ADDON_ORDER.indexOf(a?.category);
    const bi = ADDON_ORDER.indexOf(b?.category);
    const categorySort = (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
    if (categorySort !== 0) return categorySort;
    const aName = String(a?.name || '');
    const bName = String(b?.name || '');
    const aOrder = PAWSOME_EXTRAS_ORDER.indexOf(aName);
    const bOrder = PAWSOME_EXTRAS_ORDER.indexOf(bName);
    if (aOrder !== -1 || bOrder !== -1) return (aOrder === -1 ? 999 : aOrder) - (bOrder === -1 ? 999 : bOrder);
    return aName.localeCompare(bName);
  });

  const groups = DISPLAY_GROUPS.map((group) => {
    const items = sorted.filter((addon) => group.categories.includes(addon?.category) && (!group.activeOnly || addon?.is_active));
    return {
      ...group,
      items,
      total: items.length,
      active: items.filter((addon) => addon?.is_active).length,
    };
  });

  const otherItems = sorted.filter((addon) => !ADDON_ORDER.includes(addon?.category));
  if (otherItems.length > 0) {
    groups.push({
      key: 'other',
      label: 'Other',
      categories: ['other'],
      items: otherItems,
      total: otherItems.length,
      active: otherItems.filter((addon) => addon?.is_active).length,
    });
  }

  const toggleAddon = async (addon, reason = '') => {
    setSavingId(addon.id);
    try {
      const res = await apiFetch(`/api/service-addons/${addon.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          is_active: !addon.is_active,
          ...(addon.is_active ? { deactivation_reason: reason, action_reason: reason } : {}),
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Failed.');
      addToast(`Pawsome Extra ${addon.is_active ? 'deactivated' : 'activated'}.`);
      await onRefresh();
      return true;
    } catch (error) {
      addToast(error.message || 'Failed to update Pawsome Extra.', 'error');
      return false;
    } finally {
      setSavingId(null);
    }
  };

  const confirmDeactivate = async () => {
    const finalReason = deactivateSelected === 'other'
      ? deactivateReason.trim()
      : (deactivateSelected ? DEACTIVATION_REASONS.find((o) => o.value === deactivateSelected)?.label : '');
    if (!finalReason) {
      setDeactivateErr(deactivateSelected === 'other' ? 'Please specify the reason.' : 'Reason is required.');
      return;
    }

    setIsDeactivatingAddon(true);
    setDeactivateErr('');
    try {
      const updated = await toggleAddon(deactivateAddon, finalReason);
      if (updated) {
        setDeactivateAddon(null);
        setDeactivateSelected('');
        setDeactivateReason('');
      }
    } finally {
      setIsDeactivatingAddon(false);
    }
  };

  const openEdit = (addon) => {
    setEditAddon(addon);
    setEditForm({
      name: addon.name || '',
      addon_group: addon.addon_group || (addon.category === 'daycare_upgrade' ? 'Upgrade' : addon.category === 'hotel_grooming' ? 'Hotel' : 'Pawsome Extras'),
      applies_to_grooming: Boolean(addon.applies_to_grooming || ['grooming_extra', 'grooming_addon', 'treatment'].includes(addon.category)),
      applies_to_daycare: Boolean(addon.applies_to_daycare || addon.category === 'daycare_upgrade'),
      applies_to_hotel: Boolean(addon.applies_to_hotel || addon.category === 'hotel_grooming'),
      tier_label: addon.tier_label || '',
      price_min: String(addon.price_min ?? ''),
      price_max: String(addon.price_max ?? ''),
    });
    setEditErr('');
  };

  const saveEdit = async () => {
    if (!editForm.name.trim()) {
      setEditErr('Name is required.');
      return;
    }
    if (!editForm.addon_group.trim()) {
      setEditErr('Group is required.');
      return;
    }
    if (!editForm.applies_to_grooming && !editForm.applies_to_daycare && !editForm.applies_to_hotel) {
      setEditErr('Choose at least one service where this Pawsome Extra appears.');
      return;
    }

    setIsSavingEdit(true);
    setEditErr('');
    try {
      const res = await apiFetch(`/api/service-addons/${editAddon.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name.trim(),
          addon_group: editForm.addon_group.trim(),
          applies_to_grooming: editForm.applies_to_grooming,
          applies_to_daycare: editForm.applies_to_daycare,
          applies_to_hotel: editForm.applies_to_hotel,
          tier_label: editForm.tier_label.trim() || null,
          price_min: Number(editForm.price_min),
          price_max: editForm.price_max !== '' ? Number(editForm.price_max) : null,
        }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || 'Failed.');
      addToast('Pawsome Extra updated.');
      setEditAddon(null);
      await onRefresh();
    } catch (error) {
      setEditErr(error.message || 'Error.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const doDelete = async () => {
    const finalReason = deleteSelected === 'other'
      ? deleteOther.trim()
      : (deleteSelected ? DELETION_REASONS.find((o) => o.value === deleteSelected)?.label : '');
    if (!finalReason) {
      setDeleteErr(deleteSelected === 'other' ? 'Please specify the reason.' : 'Reason is required.');
      return;
    }

    setIsDeletingAddon(true);
    try {
      const res = await apiFetch(`/api/service-addons/${deleteAddon.id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: finalReason }),
      });
      if (!res.ok) throw new Error();
      addToast('Pawsome Extra deleted.');
      setDeleteAddon(null);
      setDeleteSelected('');
      setDeleteOther('');
      setDeleteErr('');
      await onRefresh();
    } catch {
      addToast('Failed to delete Pawsome Extra.', 'error');
      setDeleteAddon(null);
    } finally {
      setIsDeletingAddon(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex h-[100dvh] min-h-[100dvh] w-screen items-center justify-center bg-brand-dark/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between bg-brand-teal px-5 py-3.5">
          <h2 className="text-sm font-bold text-white">Manage Pawsome Extras</h2>
          <button type="button" onClick={onClose} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25">
            <X size={15} strokeWidth={2.8} />
          </button>
        </div>

        <div className="max-h-[72vh] space-y-3 overflow-y-auto px-5 py-5">
          {addons.length === 0 && <p className="text-xs italic text-brand-dark-soft">No Pawsome Extras found.</p>}
          {groups.map((group) => {
            const isOpen = openGroup === group.key;
            return (
              <div key={group.key} className="overflow-hidden rounded-xl border border-brand-teal/15">
                <button
                  type="button"
                  onClick={() => setOpenGroup(isOpen ? null : group.key)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-brand-teal/5"
                >
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-brand-dark">{group.label}</h3>
                    <p className="mt-0.5 text-xs text-brand-dark-soft">
                      {group.active} active / {group.total} item{group.total !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <ChevronDown size={16} className={`shrink-0 text-brand-teal transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                {isOpen && (
                  <div className="space-y-2 border-t border-brand-teal/15 px-4 py-3">
                    {group.items.length === 0 ? (
                      <p className="rounded-lg bg-brand-teal/5 px-3 py-2 text-xs italic text-brand-dark-soft">No Pawsome Extras in this category.</p>
                    ) : group.items.map((addon) => (
                      <div key={addon.id} className="rounded-xl border border-brand-teal/15 px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-brand-dark">{addon.name}</p>
                            <p className="mt-0.5 text-[11px] font-semibold text-brand-teal-dark">{addon.display_id || addon.id}</p>
                            <p className="mt-0.5 text-xs text-brand-dark-soft">
                              {priceLabel(addon)}
                              {addon.has_size_pricing ? ' - size-based' : ' - fixed Pawsome Extra'}
                            </p>
                            <p className={`mt-1 text-[11px] font-semibold ${addon.is_active ? 'text-brand-green' : 'text-brand-red'}`}>
                              {addon.is_active ? 'Active' : 'Inactive'}
                            </p>
                          </div>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setOpenMenuId(openMenuId === addon.id ? null : addon.id)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-brand-teal/20 text-brand-teal transition-colors hover:bg-brand-teal hover:text-white"
                              title="More options"
                            >
                              <MoreVertical size={16} strokeWidth={2} />
                            </button>
                            {openMenuId === addon.id && (
                              <div className="absolute right-0 top-10 z-50 w-40 overflow-hidden rounded-lg border border-brand-teal/20 bg-white shadow-lg">
                                <button type="button" onClick={() => { openEdit(addon); setOpenMenuId(null); }} className="block w-full px-4 py-2.5 text-left text-sm font-semibold text-brand-dark transition-colors hover:bg-brand-teal/10">
                                  Edit
                                </button>
                                <button type="button" onClick={() => { setDeleteAddon(addon); setOpenMenuId(null); }} className="block w-full px-4 py-2.5 text-left text-sm font-semibold text-red-500 transition-colors hover:bg-red-50">
                                  Delete
                                </button>
                                <button
                                  type="button"
                                  disabled={savingId === addon.id}
                                  onClick={() => {
                                    if (addon.is_active) {
                                      setDeactivateAddon(addon);
                                      setDeactivateSelected('');
                                      setDeactivateReason('');
                                      setDeactivateErr('');
                                    } else {
                                      toggleAddon(addon);
                                    }
                                    setOpenMenuId(null);
                                  }}
                                  className="block w-full px-4 py-2.5 text-left text-sm font-semibold text-brand-dark transition-colors hover:bg-brand-teal/10 disabled:opacity-60"
                                >
                                  {savingId === addon.id ? 'Updating...' : addon.is_active ? 'Deactivate' : 'Activate'}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {editAddon && (
        <div className="fixed inset-0 z-[90] flex h-[100dvh] min-h-[100dvh] w-screen items-end justify-center overflow-hidden p-0 sm:items-center sm:p-4" onClick={(event) => event.stopPropagation()}>
          <div className="absolute inset-0 bg-brand-dark/45 backdrop-blur-sm" onClick={() => setEditAddon(null)} />
          <div className="relative z-10 max-h-[100dvh] w-full max-w-md overflow-hidden rounded-t-2xl bg-white/95 shadow-[0_18px_35px_rgba(23,53,81,0.16)] ring-1 ring-white/70 sm:max-h-[88vh] sm:rounded-2xl">
            <div className="flex items-center justify-between bg-brand-teal px-5 py-3.5">
              <h3 className="text-sm font-bold text-white">Edit Pawsome Extra</h3>
              <button type="button" onClick={() => setEditAddon(null)} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25">
                <X size={15} strokeWidth={2.8} />
              </button>
            </div>
            <div className="max-h-[70vh] space-y-3 overflow-y-auto px-5 py-5">
              {editErr && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-500">{editErr}</p>}
              <div>
                <label className="text-xs font-semibold text-brand-dark">Pawsome Extra Name</label>
                <input value={editForm.name} onChange={(event) => setEditForm((prev) => ({ ...prev, name: event.target.value }))} className="mt-1 w-full rounded-xl border border-brand-teal/20 px-3 py-2 text-sm text-brand-dark focus:border-brand-teal focus:outline-none" />
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
              <div>
                <label className="text-xs font-semibold text-brand-dark">Tier Label</label>
                <input
                  value={editForm.tier_label}
                  onChange={(event) => setEditForm((prev) => ({ ...prev, tier_label: event.target.value }))}
                  placeholder="Standard"
                  className="mt-1 w-full rounded-xl border border-brand-teal/20 px-3 py-2 text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-brand-dark">Price Min</label>
                  <input type="number" min="0" value={editForm.price_min} onChange={(event) => setEditForm((prev) => ({ ...prev, price_min: event.target.value }))} className="mt-1 w-full rounded-xl border border-brand-teal/20 px-3 py-2 text-sm text-brand-dark focus:border-brand-teal focus:outline-none" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-brand-dark">Price Max</label>
                  <input type="number" min="0" value={editForm.price_max} onChange={(event) => setEditForm((prev) => ({ ...prev, price_max: event.target.value }))} placeholder="Optional" className="mt-1 w-full rounded-xl border border-brand-teal/20 px-3 py-2 text-sm text-brand-dark focus:border-brand-teal focus:outline-none" />
                </div>
              </div>
              {/*
                  <option value="">— None —</option>
              */}
            </div>

            <div className="flex gap-2 border-t border-brand-teal/15 px-5 py-4">
              <button type="button" onClick={() => setEditAddon(null)} className="flex-1 rounded-xl border border-brand-teal/20 py-2 text-sm text-brand-dark hover:bg-gray-50">
                Cancel
              </button>
              <button type="button" onClick={saveEdit} disabled={isSavingEdit} className="flex-1 rounded-xl bg-brand-teal py-2 text-sm font-bold text-white hover:bg-brand-teal-dark disabled:opacity-60">
                {isSavingEdit ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteAddon && (
        <div className="fixed inset-0 z-[90] flex h-[100dvh] min-h-[100dvh] w-screen items-center justify-center p-4" onClick={(event) => event.stopPropagation()}>
          <div className="absolute inset-0 bg-brand-dark/40 backdrop-blur-sm" onClick={() => !isDeletingAddon && setDeleteAddon(null)} />
          <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-brand-teal px-5 py-3.5">
              <h3 className="text-sm font-bold text-white">Delete Pawsome Extra</h3>
              <button type="button" onClick={() => setDeleteAddon(null)} disabled={isDeletingAddon} className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 disabled:opacity-50">
                <X size={15} strokeWidth={2.8} />
              </button>
            </div>
            <div className="h-1 bg-white" />
            <div className="space-y-3 px-5 py-5">
              <p className="text-sm text-brand-dark">
                Permanently delete <strong>{deleteAddon.name}</strong>? This cannot be undone.
              </p>
              <div>
                <label className="mb-1 block text-xs font-bold text-brand-dark">Reason <span className="text-red-500">*</span></label>
                <SelectDropdown
                  value={deleteSelected}
                  onChange={(v) => { setDeleteSelected(v); setDeleteOther(''); if (deleteErr) setDeleteErr(''); }}
                  options={[{ value: '', label: 'Select reason' }, ...DELETION_REASONS]}
                  placeholder="Select reason"
                />
                {deleteSelected === 'other' && (
                  <textarea
                    value={deleteOther}
                    onChange={(e) => { setDeleteOther(e.target.value); if (deleteErr) setDeleteErr(''); }}
                    rows={3}
                    placeholder="Please specify..."
                    className="mt-2 w-full resize-none rounded-xl border border-brand-teal/20 px-3 py-2 text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
                  />
                )}
                {deleteErr && <p className="mt-1 text-[11px] font-semibold text-red-500">{deleteErr}</p>}
              </div>
            </div>
            <div className="flex gap-2 border-t border-brand-teal/15 px-5 py-4">
              <button type="button" onClick={() => setDeleteAddon(null)} disabled={isDeletingAddon} className="flex-1 rounded-xl border border-brand-teal/20 py-2 text-sm font-semibold text-brand-dark hover:bg-gray-50 disabled:opacity-50">
                Cancel
              </button>
              <button type="button" onClick={doDelete} disabled={isDeletingAddon} className="flex-1 rounded-xl bg-red-500 py-2 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-60">
                {isDeletingAddon ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deactivateAddon && (
        <div className="fixed inset-0 z-[90] flex h-[100dvh] min-h-[100dvh] w-screen items-center justify-center p-4" onClick={(event) => event.stopPropagation()}>
          <div className="absolute inset-0 bg-brand-dark/40 backdrop-blur-sm" onClick={() => !isDeactivatingAddon && setDeactivateAddon(null)} />
          <div className="relative z-10 w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-brand-teal px-5 py-3.5">
              <h3 className="text-sm font-bold text-white">Deactivate Pawsome Extra</h3>
              <button
                type="button"
                onClick={() => setDeactivateAddon(null)}
                disabled={isDeactivatingAddon}
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25 disabled:opacity-50"
              >
                <X size={15} strokeWidth={2.8} />
              </button>
            </div>
            <div className="h-1 bg-brand-teal-light" />

            <div className="space-y-3 px-5 py-5">
              <p className="text-sm text-brand-dark">
                Deactivate <strong>{deactivateAddon.name}</strong>? It will be hidden from booking Pawsome Extra choices.
              </p>
              <div>
                <label className="mb-1 block text-xs font-bold text-brand-dark">Reason <span className="text-red-500">*</span></label>
                <SelectDropdown
                  value={deactivateSelected}
                  onChange={(v) => { setDeactivateSelected(v); setDeactivateReason(''); if (deactivateErr) setDeactivateErr(''); }}
                  options={[{ value: '', label: 'Select reason' }, ...DEACTIVATION_REASONS]}
                  placeholder="Select reason"
                />
                {deactivateSelected === 'other' && (
                  <textarea
                    value={deactivateReason}
                    onChange={(e) => { setDeactivateReason(e.target.value); if (deactivateErr) setDeactivateErr(''); }}
                    rows={3}
                    placeholder="Please specify..."
                    className="mt-2 w-full resize-none rounded-xl border border-brand-teal/20 px-3 py-2 text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
                  />
                )}
                {deactivateErr && <p className="mt-1 text-[11px] font-semibold text-red-500">{deactivateErr}</p>}
              </div>
            </div>

            <div className="flex gap-2 border-t border-brand-teal/15 px-5 py-4">
              <button
                type="button"
                onClick={() => setDeactivateAddon(null)}
                disabled={isDeactivatingAddon}
                className="flex-1 rounded-xl border border-brand-teal/20 py-2 text-sm text-brand-dark hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeactivate}
                disabled={isDeactivatingAddon}
                className="flex-1 rounded-xl bg-brand-teal py-2 text-sm font-bold text-white hover:bg-brand-teal-dark disabled:opacity-50"
              >
                {isDeactivatingAddon ? 'Deactivating...' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
