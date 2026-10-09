import { Printer, X } from 'lucide-react';
import { fmtCurrency, getPaymentLabel, getReceivingAccountLabel, printReceiptPDF } from '../receiptPdfUtils';

const formatExpiry = (date) => {
  if (!date) return '-';
  const value = new Date(`${String(date).slice(0, 10)}T00:00:00`);
  return Number.isNaN(value.getTime()) ? '-' : value.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

export default function WalkInSaleReceiptModal({ sale, onDone }) {
  if (!sale) return null;

  return (
    <div className="fixed inset-0 z-[120] flex h-[100dvh] min-h-[100dvh] w-screen items-center justify-center bg-brand-dark/40 p-3 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between bg-brand-teal px-5 py-3.5">
          <h2 className="text-base font-extrabold text-white">Sale Records</h2>
          <button
            type="button"
            onClick={onDone}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
          >
            <X size={16} strokeWidth={2.8} />
          </button>
        </div>
        <div className="h-1 shrink-0 bg-white" />

        <div className="flex-1 overflow-y-auto p-5">
          <div className="mb-4 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-dark-soft">The Fur Club Pet Station</p>
            <p className="mt-1 font-mono text-xl font-extrabold text-brand-teal-dark">{sale.receipt_number}</p>
            <p className="text-xs text-brand-dark-soft">
              {sale.sold_at ? new Date(sale.sold_at).toLocaleString('en-PH') : ''}
            </p>
          </div>

          <div className="mb-4 divide-y divide-brand-teal/10 rounded-xl border border-brand-teal/15 px-3 py-1 text-xs">
            <div className="flex items-center justify-between py-2">
              <span className="text-brand-dark-soft">Customer</span>
              <span className="font-semibold text-brand-dark">{sale.customer_name || 'Walk-in'}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-brand-dark-soft">Paid From</span>
              <span className="font-semibold text-brand-dark">{getPaymentLabel(sale.payment_method, sale.payment_channel)}</span>
            </div>
            {sale.payment_method !== 'cash' && sale.payment_received_by && (
              <div className="flex items-center justify-between py-2">
                <span className="text-brand-dark-soft">Paid To</span>
                <span className="font-semibold text-brand-dark">{getReceivingAccountLabel(sale.payment_received_by)}</span>
              </div>
            )}
            {sale.reference_number && (
              <div className="flex items-center justify-between py-2">
                <span className="text-brand-dark-soft">Reference No.</span>
                <span className="font-semibold text-brand-dark font-mono">{sale.reference_number}</span>
              </div>
            )}
            {sale.sold_by?.name && (
              <div className="flex items-center justify-between py-2">
                <span className="text-brand-dark-soft">Served by</span>
                <span className="font-semibold text-brand-dark">{sale.sold_by.name}</span>
              </div>
            )}
          </div>

          <div className="mb-1">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">Items</p>
            <div className="divide-y divide-brand-teal/8 rounded-xl border border-brand-teal/15 overflow-hidden">
              {(sale.items || []).map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-2 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-brand-dark">{item.product_name || item.item_snapshot_name}</p>
                    <p className="text-[10px] text-brand-dark-soft">PHP {fmtCurrency(item.unit_price ?? item.selling_price)} x {item.quantity_used ?? item.quantity}</p>
                    {(item.batch_code || item.expiration_date) && (
                      <p className="text-[9px] text-brand-dark-soft">
                        Batch {item.batch_code || '-'} · Exp {formatExpiry(item.expiration_date)}
                      </p>
                    )}
                  </div>
                  <p className="shrink-0 text-xs font-extrabold text-brand-teal-dark">PHP {fmtCurrency(item.line_total ?? item.subtotal)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between rounded-xl bg-brand-teal px-4 py-3">
            <span className="text-sm font-extrabold text-white">Total</span>
            <span className="text-lg font-extrabold text-white">PHP {fmtCurrency(sale.total_amount)}</span>
          </div>

          {sale.notes && (
            <p className="mt-3 rounded-xl border border-brand-teal/10 bg-brand-teal/5 px-3 py-2 text-xs text-brand-dark-soft">
              <span className="font-bold text-brand-dark">Note: </span>{sale.notes}
            </p>
          )}
        </div>

        <div className="shrink-0 flex gap-2 border-t border-brand-teal/10 p-4">
          <button
            type="button"
            onClick={() => printReceiptPDF(sale)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-brand-teal py-2.5 text-sm font-bold text-brand-teal transition-colors hover:bg-brand-teal/5"
          >
            <Printer size={14} strokeWidth={2.5} />
            Print PDF
          </button>
          <button
            type="button"
            onClick={onDone}
            className="flex-1 rounded-xl bg-brand-teal py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-teal-dark"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
