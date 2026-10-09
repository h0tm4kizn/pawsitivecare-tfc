import { Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { fmtTimeAgo } from './headerDateUtils';
import HeaderModalShell from './shared/HeaderModalShell';
import SelectDropdown from '../../../components/reusable-ui/SelectDropdown';

export default function HeaderMessagesAllModal({ isOpen, messages = [], onClose, onReply, onDelete, deletingId }) {
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [confirmDeleteMany, setConfirmDeleteMany] = useState(false);

  useEffect(() => {
    if (isOpen) return;
    setQuery('');
    setSortBy('newest');
    setConfirmDeleteId(null);
    setSelectMode(false);
    setSelectedIds([]);
    setConfirmDeleteMany(false);
  }, [isOpen]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = messages.filter((row) => {
      if (!q) return true;
      return `${row?.name || ''} ${row?.email || ''} ${row?.message || ''}`.toLowerCase().includes(q);
    });
    rows.sort((a, b) => {
      if (sortBy === 'oldest') return new Date(a.created_at) - new Date(b.created_at);
      if (sortBy === 'unread') return Number(a.is_read) - Number(b.is_read);
      if (sortBy === 'read') return Number(b.is_read) - Number(a.is_read);
      return new Date(b.created_at) - new Date(a.created_at);
    });
    return rows;
  }, [messages, query, sortBy]);
  const allChecked = filtered.length > 0 && selectedIds.length === filtered.length;

  return (
    <>
      <HeaderModalShell isOpen={isOpen} onClose={onClose} title="All Messages" className="w-full max-w-4xl" headerClassName="bg-brand-teal">
        <div className="flex flex-col gap-2 border-b border-brand-teal/20 px-6 py-3 md:flex-row md:items-center md:gap-3">
          <div className="relative w-full md:flex-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-dark-soft" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search messages..."
              className="w-full rounded-xl border border-brand-dark-light py-2 pl-9 pr-3 text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 md:ml-auto md:flex-nowrap">
            <SelectDropdown
              value={sortBy}
              onChange={setSortBy}
              options={[
                { value: 'newest', label: 'Newest' },
                { value: 'oldest', label: 'Oldest' },
                { value: 'unread', label: 'Unread First' },
                { value: 'read', label: 'Read First' },
              ]}
              buttonClassName="h-10 md:w-[118px]"
              textClassName="text-xs font-semibold"
            />
            <button
              type="button"
              onClick={() => {
                if (!selectMode) {
                  setSelectMode(true);
                  return;
                }
                if (selectedIds.length === 0) return;
                setConfirmDeleteMany(true);
              }}
              disabled={selectMode && selectedIds.length === 0}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50 hover:bg-red-100"
            >
              <Trash2 size={13} />
              {selectMode ? 'Delete Selected' : 'Select'}
            </button>
            {selectMode && (
              <button
                type="button"
                onClick={() => {
                  setSelectMode(false);
                  setSelectedIds([]);
                }}
                className="whitespace-nowrap rounded-xl border border-brand-dark-light bg-white px-3 py-2 text-xs font-semibold text-brand-dark-soft transition-colors hover:bg-brand-surface"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
        {selectMode && (
          <div className="flex items-center gap-2 border-b border-brand-teal/15 px-6 py-2">
            <button
              type="button"
              onClick={() => {
                if (allChecked) setSelectedIds([]);
                else setSelectedIds(filtered.map((row) => row.id));
              }}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-dark-soft"
            >
              <span className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded border ${allChecked ? 'border-brand-teal bg-brand-teal text-white' : 'border-brand-dark-soft/50 bg-white text-transparent'}`}>
                <i className="fa-solid fa-check text-[8px]" />
              </span>
              Select all
            </button>
          </div>
        )}

        <div className="max-h-[520px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm font-semibold text-brand-dark-soft">No messages found.</div>
          ) : (
            filtered.map((row) => (
              <div key={row.id} className={`flex items-start justify-between gap-3 border-b border-brand-teal/15 px-6 py-3 ${row.is_read ? '' : 'bg-white'}`}>
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  {selectMode ? (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedIds((prev) => (prev.includes(row.id) ? prev.filter((id) => id !== row.id) : [...prev, row.id]));
                      }}
                      className={`mt-1 inline-flex h-4 w-4 items-center justify-center rounded border ${
                        selectedIds.includes(row.id)
                          ? 'border-brand-teal bg-brand-teal text-white'
                          : 'border-brand-dark-soft/50 bg-white text-transparent'
                      }`}
                      aria-label={selectedIds.includes(row.id) ? 'Unselect message' : 'Select message'}
                    >
                      <i className="fa-solid fa-check text-[9px]" />
                    </button>
                  ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {!row.is_read && <span className="h-1.5 w-1.5 rounded-full bg-brand-teal" />}
                    <p className="truncate text-sm font-semibold text-brand-dark">{row?.name || 'Unknown'}</p>
                    <p className="truncate text-xs text-brand-dark-soft">{row?.email || '-'}</p>
                  </div>
                  <p className="mt-1 text-sm text-brand-dark">{row?.message || '-'}</p>
                  <p className="mt-1 text-[10px] text-brand-dark-soft">{fmtTimeAgo(row?.created_at)}</p>
                </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onReply?.(row)}
                    className="rounded-lg bg-brand-teal px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-brand-teal-dark"
                  >
                    Reply
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteId(row?.id)}
                    disabled={deletingId === row?.id || selectMode}
                    className="rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-500 hover:bg-red-100 disabled:opacity-60"
                    aria-label="Delete message"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </HeaderModalShell>

      <HeaderModalShell
        isOpen={Boolean(confirmDeleteId)}
        onClose={() => setConfirmDeleteId(null)}
        title="Delete Message"
        className="w-full max-w-sm"
        headerClassName="bg-brand-teal"
      >
        <div className="px-5 py-5">
          <p className="text-sm font-semibold text-brand-dark">Are you sure you want to delete this message?</p>
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-brand-dark-light px-5 py-4">
          <button
            type="button"
            onClick={() => setConfirmDeleteId(null)}
            className="rounded-xl border border-brand-dark-light py-2.5 text-sm font-semibold text-brand-dark hover:bg-brand-dark/5"
          >
            No
          </button>
          <button
            type="button"
            disabled={deletingId === confirmDeleteId}
            onClick={async () => {
              await onDelete?.(confirmDeleteId);
              setConfirmDeleteId(null);
            }}
            className="rounded-xl bg-red-500 py-2.5 text-sm font-bold text-white hover:bg-red-600 disabled:opacity-60"
          >
            {deletingId === confirmDeleteId ? 'Deleting...' : 'Yes'}
          </button>
        </div>
      </HeaderModalShell>

      <HeaderModalShell
        isOpen={confirmDeleteMany}
        onClose={() => setConfirmDeleteMany(false)}
        title="Delete Selected Messages"
        className="w-full max-w-sm"
        headerClassName="bg-brand-teal"
      >
        <div className="px-5 py-5">
          <p className="text-sm font-semibold text-brand-dark">Are you sure you want to delete selected messages?</p>
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-brand-dark-light px-5 py-4">
          <button
            type="button"
            onClick={() => setConfirmDeleteMany(false)}
            className="rounded-xl border border-brand-dark-light py-2.5 text-sm font-semibold text-brand-dark hover:bg-brand-dark/5"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={async () => {
              for (const id of selectedIds) {
                // sequential to respect existing deletingId guard and keep UI stable
                // eslint-disable-next-line no-await-in-loop
                await onDelete?.(id);
              }
              setSelectedIds([]);
              setSelectMode(false);
              setConfirmDeleteMany(false);
            }}
            className="rounded-xl bg-red-500 py-2.5 text-sm font-bold text-white hover:bg-red-600"
          >
            Delete
          </button>
        </div>
      </HeaderModalShell>
    </>
  );
}
