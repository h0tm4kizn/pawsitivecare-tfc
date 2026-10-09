import { Pencil, Trash2 } from 'lucide-react';
import { formatInventoryDate, formatStock, getNearestExpiryBatch, PhpAmount, stockTone } from '../inventoryUtils';
import InventoryProductImage from './InventoryProductImage';

export default function InventoryPanel({ item, onEdit, onDelete }) {
  if (!item) {
    return (
      <div className="flex min-h-[300px] items-center justify-center rounded-xl border border-brand-teal/20 bg-white p-5 shadow-[0_6px_12px_rgba(23,53,81,0.08)]">
        <p className="text-xs font-semibold text-brand-dark-soft">Selected Supplies</p>
      </div>
    );
  }

  const profit = Number(item.selling_price || 0) - Number(item.cost_price || 0);
  const margin = Number(item.selling_price || 0) > 0 ? (profit / Number(item.selling_price || 0)) * 100 : 0;
  const nearestExpiryBatch = getNearestExpiryBatch(item);

  return (
    <div className="overflow-hidden rounded-xl border border-brand-teal/20 bg-white shadow-[0_6px_12px_rgba(23,53,81,0.08)]">
      <div className="px-4 py-3">
        <p className="text-xs font-bold text-brand-dark">Selected Supplies</p>
      </div>
      <div className="h-px bg-brand-teal/10" />

      <div className="space-y-4 p-4">
        <div className="flex justify-center">
          <InventoryProductImage item={item} variant="panel" />
        </div>

        <div className="rounded-xl border border-brand-teal/15 bg-brand-teal-light/20 px-3 py-3">
          <p className="text-sm font-extrabold text-brand-dark">{item.item_name}</p>
          <p className="mt-1 text-[11px] font-bold text-brand-teal-dark">{item.item_id}</p>
        </div>

        <div className="space-y-3 text-xs">
          <PanelRow label="Category" value={item.category || '-'} />
          <PanelRow label="Barcode" value={item.barcode || '-'} />
          <PanelRow label="Cost Price" value={<PhpAmount value={item.cost_price} prefixClassName="text-[0.72em] font-bold text-brand-dark-soft/70" amountClassName="text-brand-dark" />} />
          <PanelRow label="Selling Price" value={<PhpAmount value={item.selling_price} prefixClassName="text-[0.72em] font-bold text-brand-dark-soft/70" amountClassName="text-brand-dark" />} />
          <PanelRow label="Profit" value={<PhpAmount value={profit} prefixClassName="text-[0.72em] font-bold text-brand-dark-soft/70" amountClassName="text-brand-dark" />} />
          <PanelRow label="Margin" value={`${margin.toFixed(2)}%`} />
          <PanelRow label="Type" value={item.item_type || 'product'} />
          <PanelRow label="Status" value={item.is_active ? 'Active' : 'Inactive'} />
          <PanelRow
            label="Expiration Date"
            value={nearestExpiryBatch ? formatInventoryDate(nearestExpiryBatch.expiration_date) : '—'}
          />
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="font-semibold text-brand-dark-soft">Stock</span>
            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${stockTone(item.stock_quantity)}`}>
              {formatStock(item.stock_quantity)}
            </span>
          </div>
        </div>

        {item.description && (
          <div className="rounded-xl border border-brand-dark-light bg-white px-3 py-3">
            <p className="text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">Description</p>
            <p className="mt-1 text-xs text-brand-dark">{item.description}</p>
          </div>
        )}

        {(onEdit || onDelete) && <div className="grid grid-cols-2 gap-2 border-t border-brand-teal/10 pt-4">
          {onEdit && <button
            type="button"
            onClick={() => onEdit?.(item)}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-teal py-2.5 text-xs font-bold text-white hover:bg-brand-teal-dark"
          >
            <Pencil size={13} />
            Edit
          </button>}
          {onDelete && <button
            type="button"
            onClick={() => onDelete?.(item)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-2.5 text-xs font-bold text-red-500 hover:bg-red-100"
          >
            <Trash2 size={13} />
            Delete
          </button>}
        </div>}
      </div>
    </div>
  );
}

function PanelRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <span className="shrink-0 font-semibold text-brand-dark-soft">{label}</span>
      <span className="min-w-0 max-w-[65%] break-words text-right font-medium text-brand-dark">{value}</span>
    </div>
  );
}

