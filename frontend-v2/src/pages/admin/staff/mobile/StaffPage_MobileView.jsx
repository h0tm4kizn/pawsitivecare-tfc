import { AdminSkeleton, AdminLoadState } from '../../../../components/admin/AdminLoading';
import { Camera, Pencil, Search, Trash2, UserPlus, X } from 'lucide-react';
import StatusBadge from '../../../../components/StatusBadge';
import StaffSummaryCards from '../StaffSummaryCards';
import FilterSelect from '../components/FilterSelect';
import { formatStaffDate, formatStaffId, staffLabel } from '../staffUiUtils';
import StaffAttendanceCommissionPanel from '../components/StaffAttendanceCommissionPanel';
import StaffRateSettingsMenu from '../components/StaffRateSettingsMenu';
import StaffQRCode from '../components/StaffQRCode';

export default function StaffPage_MobileView({
  loading = false,
  refreshing = false,
  onRetry,
  loadError = '',
  searchValue = '',
  onSearchValue,
  typeFilter = 'all',
  onTypeFilter,
  filterOptions = [],
  rows = [],
  selectedStaff = null,
  onSelectStaff,
  onEditStaff,
  onPickAction,
  onAddStaff,
  onScanStaff,
  stats = {},
  staffOptions = [],
  addToast = null,
}) {
  return (
    <section className="space-y-4 px-4 pb-10 pt-5 font-poppins">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold leading-tight text-brand-teal-dark">
            Staff <span className="text-brand-dark">Management</span>
          </h1>
          <p className="mt-0.5 text-xs text-brand-dark-soft">Manage staff accounts and access.</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          <StaffRateSettingsMenu staff={staffOptions} />
          <button
            type="button"
            onClick={onScanStaff}
            className="inline-flex items-center gap-1.5 rounded-xl border border-brand-teal/35 bg-white px-3 py-2 text-xs font-semibold text-brand-teal-dark"
          >
            <Camera size={14} /> Scan Staff QR
          </button>
          <button
            type="button"
            onClick={onAddStaff}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-teal px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-teal-dark"
          >
            <UserPlus size={14} strokeWidth={2.6} />
            New Staff
          </button>
        </div>
      </div>

      <StaffSummaryCards stats={stats} staffLoading={loading} />

      <div className="space-y-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-dark-soft/60" />
          <input
            value={searchValue}
            onChange={(event) => onSearchValue?.(event.target.value)}
            placeholder="Search staff..."
            className="w-full rounded-xl border border-brand-teal/30 bg-white py-2.5 pl-9 pr-4 text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
          />
        </div>
        <FilterSelect
          value={typeFilter}
          onChange={onTypeFilter}
          options={filterOptions}
          widthClass="w-full"
        />
      </div>

      <AdminLoadState loading={refreshing} error={loadError} onRetry={onRetry} />

      <div className="space-y-2">
        {loading ? (
          <AdminSkeleton label="Loading staff" />
        ) : loadError && rows.length === 0 ? null : rows.length === 0 ? (
          <div className="rounded-xl border border-brand-dark-light bg-white px-4 py-8 text-center text-xs font-semibold text-brand-dark-soft">
            No staff found.
          </div>
        ) : (
          rows.map((staff, index) => (
            <button
              key={staff.id}
              type="button"
              onClick={() => onSelectStaff?.({ ...staff, _formattedStaffId: formatStaffId(staff, index) })}
              className="w-full rounded-xl border border-brand-dark-light bg-white px-4 py-3 text-left shadow-[0_4px_10px_rgba(23,53,81,0.07)] transition-colors hover:border-brand-teal/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-brand-dark">{staff.name || '-'}</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-brand-dark-soft">{formatStaffId(staff, index)}</p>
                  <p className="mt-1 truncate text-xs text-brand-dark-soft">{staff.email || '-'}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <StatusBadge status={staff.status} />
                  <span className="text-[10px] font-bold uppercase tracking-wide text-brand-teal-dark">
                    {staffLabel(staff.staff_type)}
                  </span>
                </div>
              </div>
            </button>
          ))
        )}
      </div>

      {selectedStaff && (
        <div>
          <div
            className="fixed inset-0 z-[80] h-[100dvh] min-h-[100dvh] w-screen bg-brand-dark/40 backdrop-blur-sm"
            onClick={() => onSelectStaff?.(null)}
          />
          <div className="fixed bottom-0 inset-x-3 z-[85] flex max-h-[82vh] flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:inset-x-6">
            <div className="flex items-center justify-between gap-2 rounded-t-2xl bg-brand-teal px-5 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-white">Selected Staff</p>
                  <StatusBadge status={selectedStaff.status} />
                </div>
                <p className="mt-1 truncate text-sm font-bold text-white">{selectedStaff.name}</p>
                <p className="text-xs text-white/70">{staffLabel(selectedStaff.staff_type)}</p>
              </div>
              <button
                type="button"
                onClick={() => onSelectStaff?.(null)}
                className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
              >
                <X size={16} strokeWidth={2.8} />
              </button>
            </div>
            <div className="h-1 bg-brand-teal/20" />

            <div className="overflow-y-auto px-6 py-5 text-xs">
              <div className="space-y-4">
                <div className="py-1">
                  <p className="mb-2 text-center text-xs font-bold text-brand-dark">Staff QR Code</p>
                  <StaffQRCode key={selectedStaff.id} staffId={selectedStaff.display_id} staffName={selectedStaff.name} staffUuid={selectedStaff.id} size={168} showDownload showReissue />
                </div>
                <SheetRow label="Email" value={selectedStaff.email || '-'} />
                <SheetRow label="Contact" value={selectedStaff.contact_number || '-'} />
                <SheetRow label="Type" value={staffLabel(selectedStaff.staff_type)} />
                {(selectedStaff.deactivation_reason || selectedStaff.reason) && (
                  <SheetRow label="Deactivation Reason" value={selectedStaff.deactivation_reason || selectedStaff.reason} />
                )}
                <div className="flex items-center justify-between gap-4 border-b border-brand-dark-light/70 px-1 pb-3">
                  <span className="font-semibold text-brand-dark-soft">Status</span>
                  <StatusBadge status={selectedStaff.status} />
                </div>
                <SheetRow
                  label="Created"
                  value={formatStaffDate(selectedStaff.created_at)}
                />
              </div>
              <div className="mt-5">
                <StaffAttendanceCommissionPanel staff={staffOptions} selectedStaff={selectedStaff} addToast={addToast} />
              </div>
            </div>

            <div className="flex gap-2 border-t border-brand-teal/15 px-6 py-4">
              <button
                type="button"
                onClick={() => onEditStaff?.(selectedStaff)}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-teal py-2.5 text-sm font-bold text-white hover:bg-brand-teal-dark"
              >
                <Pencil size={14} /> Edit
              </button>
              <button
                type="button"
                onClick={() => onPickAction?.(selectedStaff, selectedStaff.is_active ? 'deactivate' : 'delete')}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-2.5 text-sm font-bold text-red-500 hover:bg-red-100"
              >
                <Trash2 size={14} /> {selectedStaff.is_active ? 'Deactivate' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function SheetRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-brand-dark-light/70 px-1 pb-3">
      <span className="shrink-0 font-semibold text-brand-dark-soft">{label}</span>
      <span className={`min-w-0 max-w-[65%] break-words text-right text-brand-dark ${label.toLowerCase().includes('id') ? 'font-bold' : 'font-normal'}`}>{value}</span>
    </div>
  );
}
