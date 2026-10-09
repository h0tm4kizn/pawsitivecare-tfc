import { AdminSkeleton } from '../../../../components/admin/AdminLoading';
import { LayoutGrid, LayoutList, Package } from 'lucide-react';
import { useState } from 'react';
import { formatStock, isZeroStock, PhpAmount, stockTone } from '../inventoryUtils';

export default function InventoryTable({ items = [], loading, error, selectedItem, onSelectItem, pagination, onPageChange }) {
  const [view, setView] = useState('grid');

  return (
    <div className="overflow-hidden rounded-xl border border-brand-teal/20 bg-white shadow-[0_6px_14px_rgba(23,53,81,0.08)]">
      <div className="flex items-center justify-between border-b border-brand-dark-light px-5 py-4">
        <div>
          <h2 className="text-sm font-bold text-brand-dark">Product List</h2>
          <p className="mt-0.5 text-xs text-brand-dark-soft">Products available for service add-ons or standalone sale.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-brand-teal/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-teal-dark">
            {items.length} shown
          </span>
          <div className="flex items-center rounded-lg border border-brand-teal/20 bg-gray-50 p-0.5">
            <button
              type="button"
              onClick={() => setView('list')}
              className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors ${view === 'list' ? 'bg-brand-teal text-white shadow-sm' : 'text-brand-dark-soft hover:text-brand-teal'}`}
              title="List view"
            >
              <LayoutList size={14} strokeWidth={2.5} />
            </button>
            <button
              type="button"
              onClick={() => setView('grid')}
              className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors ${view === 'grid' ? 'bg-brand-teal text-white shadow-sm' : 'text-brand-dark-soft hover:text-brand-teal'}`}
              title="Grid view"
            >
              <LayoutGrid size={14} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>

      {loading && <AdminSkeleton label="Loading supplies" />}

      {!loading && !error && items.length === 0 && (
        <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-teal/10">
            <Package size={25} className="text-brand-teal" />
          </div>
          <p className="text-base font-bold text-brand-dark">No supplies products found</p>
          <p className="mt-1 text-sm text-brand-dark-soft">Try another search or category filter.</p>
        </div>
      )}

      {!loading && items.length > 0 && view === 'list' && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-brand-dark-light text-sm">
            <thead className="bg-[#f6f8fa]">
              <tr>
                <th className="px-5 py-3 text-left text-[11px] font-extrabold uppercase tracking-wider text-brand-dark">Item ID</th>
                <th className="px-5 py-3 text-left text-[11px] font-extrabold uppercase tracking-wider text-brand-dark">Product</th>
                <th className="px-5 py-3 text-left text-[11px] font-extrabold uppercase tracking-wider text-brand-dark">Category</th>
                <th className="px-5 py-3 text-center text-[11px] font-extrabold uppercase tracking-wider text-brand-dark">Selling</th>
                <th className="px-5 py-3 text-center text-[11px] font-extrabold uppercase tracking-wider text-brand-dark">Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-dark-light bg-white">
              {items.map((item) => (
                <tr
                  key={item.id || item.item_id}
                  onClick={() => onSelectItem?.(item)}
                  className={`cursor-pointer transition-colors ${
                    selectedItem?.id === item.id ? 'bg-brand-dark/[0.06] hover:bg-brand-dark/[0.08]' : 'hover:bg-brand-teal/5'
                  }`}
                >
                  <td className="whitespace-nowrap px-5 py-3 text-xs font-extrabold text-brand-teal-dark">{item.item_id}</td>
                  <td className="min-w-[260px] px-5 py-3">
                    <p className="font-bold text-brand-dark">{item.item_name}</p>
                    {item.description && <p className="mt-0.5 text-xs text-brand-dark-soft">{item.description}</p>}
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-xs font-semibold text-brand-dark-soft">{item.category}</td>
                  <td className="whitespace-nowrap px-5 py-3 text-center font-bold text-brand-dark">
                    <PhpAmount value={item.selling_price} className="justify-center" prefixClassName="text-[0.68em] font-bold text-brand-dark-soft/70" amountClassName="text-brand-teal-dark" />
                  </td>
                  <td className="whitespace-nowrap px-5 py-3 text-center">
                    <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${stockTone(item.stock_quantity)}`}>
                      {formatStock(item.stock_quantity)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && items.length > 0 && view === 'grid' && (
        <div className="grid grid-cols-2 gap-3 p-4 md:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <div
              key={item.id || item.item_id}
              onClick={() => onSelectItem?.(item)}
              className={`cursor-pointer overflow-hidden rounded-xl border shadow-sm transition-colors ${
                isZeroStock(item.stock_quantity)
                  ? selectedItem?.id === item.id
                    ? 'border-red-400 bg-red-50 ring-2 ring-red-200'
                    : 'border-red-300 bg-red-50 hover:border-red-400'
                  : selectedItem?.id === item.id
                    ? 'border-brand-teal bg-white ring-2 ring-brand-teal/20'
                    : 'border-brand-teal/15 bg-white hover:border-brand-teal/40'
              }`}
            >
              <div className={`aspect-[4/3] w-full overflow-hidden ${isZeroStock(item.stock_quantity) ? 'bg-red-100' : 'bg-brand-teal/10'}`}>
                {item.image_url ? (
                  <img src={item.image_url} alt={item.item_name} className="h-full w-full object-cover" />
                ) : (
                  <div className={`flex h-full w-full items-center justify-center text-3xl font-extrabold ${isZeroStock(item.stock_quantity) ? 'text-red-400' : 'text-brand-teal/40'}`}>
                    {item.item_name?.[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              <div className="space-y-1.5 p-3">
                <p className="line-clamp-2 min-h-[2.25rem] text-sm font-extrabold leading-snug text-brand-dark">{item.item_name}</p>
                <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-brand-dark-soft">{item.category}</p>
                <div className="flex items-end justify-between gap-3 border-t border-brand-dark-light/70 pt-2.5">
                  <div>
                    <p className="text-[9px] font-semibold uppercase tracking-wide text-brand-dark-soft/70">Selling Price</p>
                    <PhpAmount value={item.selling_price} prefixClassName="text-[0.65em] font-bold text-brand-dark-soft/60" amountClassName="text-sm font-extrabold text-brand-teal-dark" />
                  </div>
                  <span className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${stockTone(item.stock_quantity)}`}>
                    {formatStock(item.stock_quantity)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && pagination && pagination.last_page > 1 && (
        <div className="flex items-center justify-between border-t border-brand-dark-light px-5 py-3 text-xs font-semibold text-brand-dark-soft">
          <span>Page {pagination.current_page} of {pagination.last_page} · {pagination.total} products</span>
          <div className="flex gap-2">
            <button type="button" disabled={pagination.current_page <= 1} onClick={() => onPageChange?.(pagination.current_page - 1)} className="rounded-lg border px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
            <button type="button" disabled={pagination.current_page >= pagination.last_page} onClick={() => onPageChange?.(pagination.current_page + 1)} className="rounded-lg border px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
