import { FileText } from 'lucide-react';
import WalkInSaleModal from '../../../inventory/components/WalkInSaleModal';

export default function BookingSuccessModal({
  walkInMode,
  onClose,
  suppliesEnabled,
  retailSales,
  openRetailPurchaseModal,
  canUseRetailPurchase,
  isPrintingAssessment,
  onPrintAssessment,
  approvedAppointmentId,
  selectedOwner,
  getOwnerName,
  retailSaleOpen,
  editingRetailSale,
  onCloseRetailSale,
  onRetailSaleSaved,
}) {
  return (
    <div className="fixed inset-0 z-[120] bg-brand-dark/40 backdrop-blur-sm" onClick={onClose}>
      <div className="fixed left-1/2 top-1/2 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="bg-brand-teal px-6 py-4">
          <h2 className="text-center text-sm font-extrabold text-white sm:text-base">{walkInMode ? 'Walk-In Service' : 'Schedule an Appointment'}</h2>
        </div>
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-10 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
            <i className="fa-solid fa-check text-emerald-600 text-2xl" />
          </div>
          <p className="text-xl font-extrabold text-brand-dark">Booking Approved</p>
          <p className="text-sm font-medium text-brand-dark-soft">The appointment was saved successfully.</p>
          <div className="mt-2 flex w-full max-w-xs flex-col gap-2">
            {suppliesEnabled && retailSales.length > 0 && (
              <div className="rounded-xl border border-brand-dark-light bg-brand-surface/60 p-3 text-left">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-brand-dark-soft">Retail Purchases</p>
                <div className="space-y-1.5">
                  {retailSales.map((sale) => (
                    <div key={sale.id || sale.receipt_number} className="flex items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-semibold text-brand-dark">{sale.receipt_number || 'Retail purchase'}</p>
                        <p className="text-[10px] font-bold text-brand-teal-dark">PHP {Number(sale.total_amount || 0).toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {suppliesEnabled && (
              <button type="button" onClick={openRetailPurchaseModal} aria-disabled={!canUseRetailPurchase} title={!canUseRetailPurchase ? 'Select an owner and pet first' : undefined} className={`rounded-xl border border-brand-teal bg-white px-5 py-2.5 text-sm font-bold text-brand-teal transition hover:bg-brand-teal-light active:bg-brand-teal-light ${!canUseRetailPurchase ? 'cursor-not-allowed opacity-55' : ''}`}>
                {retailSales.length > 0 ? 'Edit Retail Purchase' : 'Add Retail Purchase'}
              </button>
            )}
            <button type="button" disabled={isPrintingAssessment} onClick={onPrintAssessment} className="inline-flex items-center justify-center gap-2 rounded-xl border border-brand-teal/35 bg-white px-5 py-2.5 text-sm font-bold text-brand-teal-dark transition hover:bg-brand-teal hover:text-white disabled:opacity-60">
              <FileText size={15} strokeWidth={2.5} />
              {isPrintingAssessment ? 'Preparing...' : 'Print Assessment Form'}
            </button>
            <button type="button" onClick={() => { void onClose(); }} className="rounded-xl bg-brand-teal px-6 py-2.5 text-sm font-bold text-white transition hover:bg-brand-teal-dark">Done</button>
          </div>
        </div>
      </div>
      {suppliesEnabled && retailSaleOpen && (
        <WalkInSaleModal
          appointmentId={approvedAppointmentId}
          initialCustomerName={selectedOwner ? getOwnerName(selectedOwner) : ''}
          hidePayment
          editingSale={editingRetailSale}
          draftMode={!approvedAppointmentId}
          onClose={onCloseRetailSale}
          onSaved={onRetailSaleSaved}
        />
      )}
    </div>
  );
}
