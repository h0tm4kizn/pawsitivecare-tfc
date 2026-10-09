import { Activity, FileText, Pencil, X } from 'lucide-react';
import { useState } from 'react';
import StatusBadge from '../../../../components/StatusBadge';
import { formatStaffDate, staffLabel } from '../staffUiUtils';
import StaffAttendanceCommissionPanel from './StaffAttendanceCommissionPanel';
import StaffQRCode from './StaffQRCode';

export default function ViewStaffPanel({ staff, label = 'Selected Staff', onEdit, addToast = null, readOnly = false }) {
  const [modal, setModal] = useState(null);

  if (!staff) {
    return (
      <div className="sticky top-4 rounded-xl border border-brand-teal/20 bg-white p-5 shadow-[0_6px_12px_rgba(23,53,81,0.08)]">
        <p className="text-sm font-semibold text-brand-dark">View Mode</p>
        <p className="mt-2 text-xs leading-5 text-brand-dark-soft">Select a staff account to view its full details here.</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-brand-teal/20 bg-white shadow-[0_6px_12px_rgba(23,53,81,0.08)]">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <p className="text-xs font-semibold text-brand-dark">{label}</p>
          <StatusBadge status={staff.status} />
        </div>
        <div className="h-px bg-brand-teal/10" />
        <div className="space-y-3 p-3">
          {!readOnly && (
            <>
              <StaffQRCode key={staff.id} staffId={staff.display_id} staffName={staff.name} staffUuid={staff.id} size={176} />
              <div className="text-center">
                <p className="text-[11px] text-brand-dark">{staffLabel(staff.staff_type)}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setModal('details')} className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-teal/30 px-3 py-2.5 text-xs font-bold text-brand-teal-dark transition hover:bg-brand-surface"><FileText size={14} strokeWidth={2.2} /> Details</button>
                <button type="button" onClick={() => setModal('activity')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-teal px-3 py-2.5 text-xs font-bold text-white transition hover:bg-brand-teal-dark"><Activity className="shrink-0" size={15} strokeWidth={2.2} /> Activity</button>
              </div>
            </>
          )}
          {readOnly && (
            <div className="space-y-2 px-1 text-xs">
              <Row label="Staff ID" value={staff.display_id || '-'} />
              <Row label="Email" value={staff.email || '-'} />
              <Row label="Contact" value={staff.contact_number || '-'} />
              <Row label="Type" value={staffLabel(staff.staff_type)} />
              <Row label="Created" value={formatStaffDate(staff.created_at)} />
            </div>
          )}
        </div>
      </div>

      {!readOnly && modal && (
        <div className="fixed inset-0 z-[120] flex h-[100dvh] min-h-[100dvh] w-screen items-center justify-center bg-brand-dark/40 p-3 backdrop-blur-sm sm:p-4" role="dialog" aria-modal="true" aria-label={modal === 'details' ? 'Staff details' : 'Staff activity'}>
        <div className={`flex max-h-[92vh] w-full flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ${modal === 'activity' ? 'max-w-4xl' : 'max-w-lg'}`}>
          <div className="flex shrink-0 items-center justify-between rounded-t-2xl bg-brand-teal px-4 py-3 text-white sm:px-6 sm:py-4">
            <div>
              <p className="text-sm font-extrabold sm:text-base">{modal === 'activity' ? 'Staff Activity' : 'Staff details'}</p>
              <p className="mt-0.5 text-[11px] font-semibold text-white/80">{staff.name}</p>
            </div>
            <button type="button" onClick={() => setModal(null)} aria-label="Close staff modal" className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"><X size={16} strokeWidth={2.8} /></button>
          </div>
          {modal === 'details' ? (
            <>
              <div className="overflow-y-auto px-5 py-4 text-xs">
                <div className="space-y-2.5">
                  <Row label="Staff ID" value={staff.display_id || '-'} />
                  <Row label="Email" value={staff.email || '-'} />
                  <Row label="Contact" value={staff.contact_number || '-'} />
                  <Row label="Type" value={staffLabel(staff.staff_type)} />
                  <Row label="Deactivation Reason" value={staff.deactivation_reason || staff.reason || '-'} />
                  <div className="flex justify-between gap-2"><span className="font-semibold text-brand-dark-soft">Status</span><StatusBadge status={staff.status} /></div>
                  <Row label="Created" value={formatStaffDate(staff.created_at)} />
                </div>
                <section className="mt-4 rounded-xl border border-brand-teal/20 bg-brand-teal-light/20 px-3 py-3 text-center">
                  <h3 className="mb-2 text-xs font-bold text-brand-dark">Staff QR Code</h3>
                  <StaffQRCode key={staff.id} staffId={staff.display_id} staffName={staff.name} staffUuid={staff.id} size={168} showDownload showReissue />
                </section>
              </div>
              <div className="shrink-0 border-t border-brand-teal/10 px-5 py-4">
                <button type="button" onClick={() => { setModal(null); onEdit?.(staff); }} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-teal px-4 py-2.5 text-xs font-bold text-white hover:bg-brand-teal-dark"><Pencil size={14} /> Edit Staff</button>
              </div>
            </>
          ) : (
            <div className="overflow-y-auto bg-brand-surface/40 p-2.5 sm:p-3"><StaffAttendanceCommissionPanel selectedStaff={staff} addToast={addToast} /></div>
          )}
        </div>
        </div>
      )}
    </>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="shrink-0 font-semibold text-brand-dark-soft">{label}</span>
      <span className={`truncate text-right text-brand-dark ${label.toLowerCase().includes('id') ? 'font-bold' : 'font-normal'}`}>{value}</span>
    </div>
  );
}
