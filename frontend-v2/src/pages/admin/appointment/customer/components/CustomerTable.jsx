import { AdminSkeleton } from '../../../../../components/admin/AdminLoading';
import { ChevronRight, Pencil, Trash2 } from 'lucide-react';
import StatusBadge from '../../../../../components/StatusBadge';
import { formatAddressFromOwner } from '../../../../../utils/textUtils';
import { formatAddressPreview, formatEmailPreview } from '../customerUtils';

export default function CustomerTable({
  customers,
  loading,
  error,
  selectedOwner,
  onSelect,
  onEdit,
  isAdmin,
  actionMenuFor,
  setActionMenuFor,
  actionMenuRef,
  onRemove,
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-brand-teal/20 bg-white shadow-[0_6px_12px_rgba(23,53,81,0.08)]">
      <div className="overflow-x-auto">
        <table className="min-w-[980px] w-full text-sm">
          <thead>
            <tr className="border-b border-brand-teal/15 bg-brand-teal-light/30">
              <th className="px-4 py-3 text-left text-[11px] font-extrabold uppercase tracking-wider text-brand-dark whitespace-nowrap">ID</th>
              <th className="px-4 py-3 text-left text-[11px] font-extrabold uppercase tracking-wider text-brand-dark whitespace-nowrap">Customer</th>
              <th className="hidden sm:table-cell px-4 py-3 text-left text-[11px] font-extrabold uppercase tracking-wider text-brand-dark whitespace-nowrap">Email</th>
              <th className="hidden sm:table-cell px-4 py-3 text-left text-[11px] font-extrabold uppercase tracking-wider text-brand-dark whitespace-nowrap">Contact Number</th>
              <th className="hidden sm:table-cell px-4 py-3 text-left text-[11px] font-extrabold uppercase tracking-wider text-brand-dark whitespace-nowrap">Address</th>
              <th className="hidden sm:table-cell px-4 py-3 text-center text-[11px] font-extrabold uppercase tracking-wider text-brand-dark whitespace-nowrap">Status</th>
              <th className="hidden w-[104px] sm:table-cell py-3 pl-3 pr-6 text-center text-[11px] font-extrabold uppercase tracking-wider text-brand-dark whitespace-nowrap">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7}><AdminSkeleton label="Loading records" /></td></tr>}
            {!loading && !error && customers.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm font-semibold text-brand-dark-soft">No customers found.</td>
              </tr>
            )}
            {!loading && customers.map((owner, index) => (
              <tr
                key={owner.id}
                onClick={() => onSelect(owner)}
                className={`cursor-pointer border-b border-brand-teal/10 transition-colors last:border-b-0 ${selectedOwner?.id === owner.id ? 'bg-brand-dark/[0.06] hover:bg-brand-dark/[0.08]' : 'hover:bg-brand-teal-light/20'}`}
              >
                <td className="px-4 py-3 text-xs font-bold text-brand-dark-soft whitespace-nowrap">{owner.display_id || `C${String(index + 1).padStart(3, '0')}`}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-brand-dark whitespace-nowrap">{owner.fullName}</span>
                    <ChevronRight size={14} className="shrink-0 text-brand-dark-soft sm:hidden" />
                  </div>
                </td>
                <td className="hidden sm:table-cell px-4 py-3 text-xs text-brand-dark-soft whitespace-nowrap">{formatEmailPreview(owner.email)}</td>
                <td className="hidden sm:table-cell px-4 py-3 text-xs text-brand-dark-soft whitespace-nowrap">{owner.phone}</td>
                <td
                  className="hidden sm:table-cell px-4 py-3 text-xs text-brand-dark-soft whitespace-nowrap"
                  title={formatAddressFromOwner(owner) || undefined}
                >
                  {formatAddressPreview(formatAddressFromOwner(owner))}
                </td>
                <td className="hidden sm:table-cell px-4 py-3 text-center"><StatusBadge active={owner.is_active} variant="customer" /></td>
                <td className="hidden w-[104px] sm:table-cell py-3 pl-3 pr-6 text-center" onClick={(event) => event.stopPropagation()}>
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onEdit(owner)}
                      aria-label="Edit customer"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-brand-teal/35 bg-brand-teal/10 text-brand-teal-dark transition-colors hover:bg-brand-teal/20"
                    >
                      <Pencil size={12} />
                    </button>
                    {isAdmin && (
                      <div ref={actionMenuFor === owner.id ? actionMenuRef : null} className="relative">
                        <button
                          type="button"
                          onClick={() => setActionMenuFor((previous) => (previous === owner.id ? null : owner.id))}
                          className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-500 transition-colors hover:bg-red-100"
                          aria-label="Action options"
                          title="Action options"
                        >
                          <Trash2 size={12} />
                        </button>
                        {actionMenuFor === owner.id && (
                          <div className={`absolute right-0 z-20 w-32 overflow-hidden rounded-lg border border-brand-teal/20 bg-white shadow-lg ${
                            index >= customers.length - 2 ? 'bottom-[calc(100%+6px)]' : 'top-[calc(100%+6px)]'
                          }`}>
                            {owner.is_active && (
                              <button
                                type="button"
                                onClick={() => onRemove(owner, 'deactivate')}
                                className="w-full px-3 py-2 text-left text-xs font-semibold text-brand-dark hover:bg-brand-teal-light/20"
                              >
                                Deactivate
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onRemove(owner, 'delete')}
                              className={`w-full px-3 py-2 text-left text-xs font-semibold text-red-500 hover:bg-red-50 ${owner.is_active ? 'border-t border-brand-teal/15' : ''}`}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!loading && customers.length > 0 && (
        <div className="border-t border-brand-teal/10 px-4 py-2 text-[11px] text-brand-dark-soft">
          Showing {customers.length} customer{customers.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
