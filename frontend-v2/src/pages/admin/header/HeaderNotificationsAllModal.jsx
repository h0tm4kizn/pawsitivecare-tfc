import { Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { fmtTimeAgo } from './headerDateUtils';
import HeaderModalShell from './shared/HeaderModalShell';

const safeTimestamp = (value) => {
  const ts = new Date(value || '').getTime();
  return Number.isFinite(ts) ? ts : 0;
};

export default function HeaderNotificationsAllModal({
  isOpen,
  items = [],
  readIds = [],
  onClose,
  onMarkRead,
  onMarkAllRead,
  onItemClick,
  onOpenPet,
  onDelete,
  onDeleteMany,
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState([]);
  const [selectMode, setSelectMode] = useState(false);
  const [confirmState, setConfirmState] = useState({ open: false, ids: [], isMany: false });

  useEffect(() => {
    if (isOpen) return;
    setQuery('');
    setSelected([]);
    setSelectMode(false);
    setConfirmState({ open: false, ids: [], isMany: false });
  }, [isOpen]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = !q
      ? items
      : items.filter((item) => `${item?.text || ''} ${item?.sub || ''}`.toLowerCase().includes(q));
    return [...rows].sort((a, b) => safeTimestamp(b?.time) - safeTimestamp(a?.time));
  }, [items, query]);
  const selectableIds = useMemo(
    () => filtered.filter((item) => item.source === 'system').map((item) => item.id),
    [filtered]
  );
  const selectedSelectableCount = useMemo(
    () => selectableIds.filter((id) => selected.includes(id)).length,
    [selectableIds, selected]
  );
  const allSelectableChecked = selectableIds.length > 0 && selectedSelectableCount === selectableIds.length;

  return (
    <HeaderModalShell isOpen={isOpen} onClose={onClose} title="All Notifications" className="w-full max-w-4xl" headerClassName="bg-brand-teal">
        <div className="flex shrink-0 flex-col gap-2 border-b border-brand-teal/20 px-4 py-3 sm:px-6 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:w-[360px]">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-dark-soft" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search notifications..."
              className="w-full rounded-xl border border-brand-dark-light py-2 pl-9 pr-3 text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
            />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {!selectMode && (
              <button
                type="button"
                onClick={() => onMarkAllRead?.(filtered.map((item) => item.id))}
                className="rounded-xl border border-brand-teal bg-white px-3 py-2 text-xs font-bold text-brand-teal-dark transition-colors hover:bg-brand-teal hover:text-white"
              >
                Mark All Read
              </button>
            )}
            <button
              type="button"
              onClick={async () => {
                if (!selectMode) {
                  setSelectMode(true);
                  return;
                }
                const notifIds = filtered
                  .filter((it) => selected.includes(it.id) && it.source === 'system')
                  .map((it) => it.raw?.id)
                  .filter(Boolean);
                if (notifIds.length === 0) return;
                setConfirmState({ open: true, ids: notifIds, isMany: true });
              }}
              disabled={selectMode && selected.length === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50 hover:bg-red-100"
            >
              {selectMode && <Trash2 size={13} />}
              {selectMode ? 'Delete Selected' : 'Select'}
            </button>
            {selectMode && (
              <button
                type="button"
                onClick={() => {
                  setSelectMode(false);
                  setSelected([]);
                }}
                className="rounded-xl border border-brand-dark-light bg-white px-3 py-2 text-xs font-semibold text-brand-dark-soft transition-colors hover:bg-brand-surface"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
        {selectMode && (
            <div className="flex shrink-0 items-center gap-2 border-b border-brand-teal/15 px-4 py-2 sm:px-6">
            <button
              type="button"
              onClick={() => {
                if (allSelectableChecked) {
                  setSelected((prev) => prev.filter((id) => !selectableIds.includes(id)));
                } else {
                  setSelected((prev) => [...new Set([...prev, ...selectableIds])]);
                }
              }}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-dark-soft"
              title="Select all deletable notifications"
            >
              <span
                className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded border ${
                  allSelectableChecked
                    ? 'border-brand-teal bg-brand-teal text-white'
                    : 'border-brand-dark-soft/50 bg-white text-transparent'
                }`}
              >
                <i className="fa-solid fa-check text-[8px]" />
              </span>
              Select all
            </button>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto scrollbar-teal">
            {filtered.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm font-semibold text-brand-dark-soft">No notifications found.</div>
            ) : (
            filtered.map((item) => {
              const isRead = readIds.includes(item.id);
              const isSelectable = item.source === 'system';
              const checked = selected.includes(item.id);
              const rawText = String(item.text || '');
              const cancellationMatch = rawText.match(/^(.*?)(?:\s*Reason:\s*)(.+)$/i);
              const primaryText = cancellationMatch ? cancellationMatch[1] : rawText;
              const cancellationReason = cancellationMatch?.[2] || '';
              return (
                <div key={item.id} className={`w-full border-b border-brand-teal/15 px-6 py-3 ${isRead ? '' : 'bg-white'}`}>
                  <div className="flex items-start gap-2.5">
                    {selectMode ? (
                      <button
                        type="button"
                        disabled={!isSelectable}
                        title={!isSelectable ? 'Appointment notifications are view-only.' : 'Select notification'}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!isSelectable) return;
                          setSelected((s) => (s.includes(item.id) ? s.filter((x) => x !== item.id) : [...s, item.id]));
                        }}
                        className={`mt-1 inline-flex h-4 w-4 items-center justify-center rounded border ${
                          checked
                            ? 'border-brand-teal bg-brand-teal text-white'
                            : 'border-brand-dark-soft/50 bg-white text-transparent'
                        } ${isSelectable ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                        aria-label={checked ? 'Unselect notification' : 'Select notification'}
                      >
                        <i className="fa-solid fa-check text-[9px]" />
                      </button>
                    ) : (
                      <div className="w-4" />
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (selectMode && isSelectable) {
                          setSelected((s) => (s.includes(item.id) ? s.filter((x) => x !== item.id) : [...s, item.id]));
                          return;
                        }
                        if (!isRead) onMarkRead?.(item.id);
                        onItemClick?.(item);
                      }}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex items-start gap-2.5">
                        <i className={`fa-solid ${item.icon?.icon || 'fa-bell'} ${item.icon?.cls || 'text-brand-teal'} mt-0.5 text-sm shrink-0`} />
                        <div className="min-w-0 flex-1">
                          {item.source === 'appointment' && item.raw?.pet ? (
                            <p className="max-w-[min(72vw,760px)] text-sm leading-snug text-brand-dark">
                              {String(primaryText || '').startsWith('Appointment booking:') ? 'Appointment booking: ' : ''}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenPet?.(item.raw?.pet?.id);
                                }}
                                className="inline underline text-brand-teal-dark hover:text-brand-teal"
                              >
                                {item.raw.pet.name || 'Pet'}
                              </button>
                              {` · ${item.raw?.service?.name || ''}`}
                            </p>
                          ) : (
                            <p className="max-w-[min(72vw,760px)] text-sm leading-snug text-brand-dark">{primaryText}</p>
                          )}
                          {cancellationReason && <p className="mt-1 max-w-[min(72vw,760px)] text-xs leading-snug text-brand-dark-soft">Reason: {cancellationReason}</p>}
                          {item.sub && <p className="mt-0.5 text-xs text-brand-dark-soft">{item.sub}</p>}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <span className="text-[10px] text-brand-dark-soft">{fmtTimeAgo(item.time)}</span>
                          {!isRead && <span className="h-1.5 w-1.5 rounded-full bg-brand-teal" />}
                        </div>
                      </div>
                    </button>
                    <div className="ml-3 flex items-start">
                      {isSelectable && !selectMode ? (
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            const notifId = item.raw?.id;
                            if (!notifId) return;
                            setConfirmState({ open: true, ids: [notifId], isMany: false });
                          }}
                          className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-500 transition-colors hover:bg-red-100"
                          aria-label="Delete notification"
                        >
                          <Trash2 size={13} />
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        {confirmState.open && (
          <div className="fixed inset-0 z-[260] flex items-center justify-center bg-brand-dark/45 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="bg-red-500 px-5 py-3.5">
                <h3 className="text-sm font-bold text-white">
                  {confirmState.isMany ? 'Delete Selected Notifications' : 'Delete Notification'}
                </h3>
              </div>
              <div className="px-5 py-5">
                <p className="text-sm text-brand-dark">
                  {confirmState.isMany
                    ? 'Are you sure you want to delete the selected notifications? This action cannot be undone.'
                    : 'Are you sure you want to delete this notification? This action cannot be undone.'}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmState({ open: false, ids: [], isMany: false })}
                    className="rounded-xl border border-brand-dark-light py-2 text-sm font-semibold text-brand-dark transition-colors hover:bg-brand-dark/5"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (confirmState.isMany) {
                        await onDeleteMany?.(confirmState.ids);
                        setSelected([]);
                        setSelectMode(false);
                      } else if (confirmState.ids[0]) {
                        await onDelete?.(confirmState.ids[0]);
                      }
                      setConfirmState({ open: false, ids: [], isMany: false });
                    }}
                    className="rounded-xl bg-red-500 py-2 text-sm font-bold text-white transition-colors hover:bg-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
    </HeaderModalShell>
  );
}
