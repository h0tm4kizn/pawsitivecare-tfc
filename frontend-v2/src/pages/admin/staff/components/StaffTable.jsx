import { AdminSkeleton } from '../../../../components/admin/AdminLoading';
import { ChevronRight, Pencil, Trash2 } from 'lucide-react';
import StatusBadge from '../../../../components/StatusBadge';
import { formatStaffId, staffLabel } from '../staffUiUtils';

export default function StaffTable({
  loading,
  error,
  rows,
  selectedStaffId,
  onToggleSelect,
  onEdit,
  actionMenuFor,
  setActionMenuFor,
  actionMenuRef,
  onPickAction,
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-brand-teal/20 bg-white shadow-[0_6px_12px_rgba(23,53,81,0.08)]">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-brand-teal/15 bg-brand-teal-light/30">
              <th className="px-4 py-3 text-left text-[11px] font-extrabold uppercase tracking-wider text-brand-dark">ID</th>
              <th className="px-4 py-3 text-left text-[11px] font-extrabold uppercase tracking-wider text-brand-dark">Staff Member</th>
              <th className="hidden px-4 py-3 text-left text-[11px] font-extrabold uppercase tracking-wider text-brand-dark sm:table-cell">Role</th>
              <th className="hidden px-4 py-3 text-left text-[11px] font-extrabold uppercase tracking-wider text-brand-dark sm:table-cell">Email</th>
              <th className="hidden px-4 py-3 text-left text-[11px] font-extrabold uppercase tracking-wider text-brand-dark sm:table-cell">Contact Number</th>
              <th className="hidden px-4 py-3 text-center text-[11px] font-extrabold uppercase tracking-wider text-brand-dark sm:table-cell">Status</th>
              <th className="hidden px-4 py-3 text-center text-[11px] font-extrabold uppercase tracking-wider text-brand-dark sm:table-cell">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading && <tr><td colSpan={7}><AdminSkeleton label="Loading records" /></td></tr>}
            {!loading && !error && rows.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-sm font-semibold text-brand-dark-soft">No staff found.</td></tr>
            )}
            {!loading && rows.map((staff, index) => (
              <tr
                key={staff.id}
                onClick={() => onToggleSelect({ ...staff, _formattedStaffId: formatStaffId(staff, index) })}
                className={`cursor-pointer border-b border-brand-teal/10 transition-colors last:border-b-0 ${
                  selectedStaffId === staff.id
                    ? 'bg-brand-dark/[0.06] hover:bg-brand-dark/[0.08]'
                    : 'hover:bg-brand-teal-light/20'
                }`}
              >
                <td className="w-[110px] px-4 py-3 text-left text-xs font-bold text-brand-dark-soft">
                  {formatStaffId(staff, index)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-[13px] font-extrabold text-brand-dark">{staff.name}</p>
                    <ChevronRight size={14} className="shrink-0 text-brand-dark-soft sm:hidden" />
                  </div>
                </td>
                <td className="hidden sm:table-cell px-4 py-3 text-xs text-brand-dark-soft">{staffLabel(staff.staff_type)}</td>
                <td className="hidden sm:table-cell px-4 py-3 text-xs text-brand-dark-soft">{staff.email || '-'}</td>
                <td className="hidden sm:table-cell px-4 py-3 text-xs text-brand-dark-soft">{staff.contact_number || '-'}</td>
                <td className="hidden sm:table-cell px-4 py-3 text-center"><StatusBadge status={staff.status} /></td>
                <td className="hidden sm:table-cell px-4 py-3">
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onEdit(staff);
                      }}
                      aria-label="Edit staff"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-brand-teal/35 bg-brand-teal/10 text-brand-teal-dark transition-colors hover:bg-brand-teal/20"
                    >
                      <Pencil size={12} />
                    </button>
                    <div ref={actionMenuFor === staff.id ? actionMenuRef : null} className="relative">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setActionMenuFor((prev) => (prev === staff.id ? null : staff.id));
                        }}
                        className="inline-flex h-6 w-6 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-500 transition-colors hover:bg-red-100"
                        aria-label="Action options"
                        title="Action options"
                      >
                        <Trash2 size={12} />
                      </button>

                      {actionMenuFor === staff.id && (
                        <div className={`absolute right-0 z-20 w-32 overflow-hidden rounded-lg border border-brand-teal/20 bg-white shadow-lg ${
                          index >= rows.length - 2 ? 'bottom-[calc(100%+6px)]' : 'top-[calc(100%+6px)]'
                        }`}>
                          {staff.is_active && (
                            <button
                              type="button"
                              onClick={() => {
                                onPickAction(staff, 'deactivate');
                                setActionMenuFor(null);
                              }}
                              className="w-full px-3 py-2 text-left text-xs font-semibold text-brand-dark hover:bg-brand-teal-light/20"
                            >
                              Deactivate
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              onPickAction(staff, 'delete');
                              setActionMenuFor(null);
                            }}
                            className={`w-full px-3 py-2 text-left text-xs font-semibold text-red-500 hover:bg-red-50 ${staff.is_active ? 'border-t border-brand-teal/15' : ''}`}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
