import { AdminSkeleton, AdminLoadState } from '../../../../components/admin/AdminLoading';
import { BarChart2, Camera, Pencil, Plus, ScanLine, Search, Trash2, X } from 'lucide-react';
import { useRef } from 'react';
import SelectDropdown from '../../../../components/reusable-ui/SelectDropdown';
import InventoryProductImage from '../components/InventoryProductImage';
import InventoryStatsGrid from '../components/InventoryStatsGrid';
import { formatInventoryDate, formatStock, getNearestExpiryBatch, PhpAmount, stockTone } from '../inventoryUtils';

export default function InventoryPage_MobileView({
  loading = false,
  refreshing = false,
  onRetry,
  error = '',
  items = [],
  stats = {},
  categories = [],
  search = '',
  onSearch,
  category = '',
  onCategoryChange,
  selectedItem = null,
  onSelectItem,
  onScanSearch,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onOpenSalesReport,
  pagination,
  onPageChange,
}) {
  const searchInputRef = useRef(null);
  const categoryOptions = [
    { value: '', label: 'All Categories' },
    ...categories.map((row) => ({ value: row.category, label: `${row.category} (${row.total})` })),
  ];

  return (
    <section className="space-y-4 px-4 pb-10 pt-5 font-poppins">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold leading-tight text-brand-teal-dark">
            Supplies <span className="text-brand-dark">Management</span>
          </h1>
          <p className="mt-0.5 text-xs text-brand-dark-soft">Products for services and standalone sales.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onAddItem && <button
            type="button"
            onClick={onOpenSalesReport}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-brand-teal/35 bg-white text-brand-teal-dark transition-colors hover:bg-brand-teal hover:text-white"
            aria-label="Open sales supplies report"
          >
            <BarChart2 size={15} strokeWidth={2.6} />
          </button>}
          <button
            type="button"
            onClick={onAddItem}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-brand-teal text-white transition-colors hover:bg-brand-teal-dark"
            aria-label="Add supplies item"
          >
            <Plus size={16} strokeWidth={2.8} />
          </button>
        </div>
      </div>

      <InventoryStatsGrid loading={loading} stats={stats} items={items} />
      {pagination && pagination.last_page > 1 && (
        <div className="flex items-center justify-between text-xs font-semibold text-brand-dark-soft">
          <span>Page {pagination.current_page} of {pagination.last_page}</span>
          <div className="flex gap-2">
            <button type="button" disabled={pagination.current_page <= 1} onClick={() => onPageChange?.(pagination.current_page - 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Previous</button>
            <button type="button" disabled={pagination.current_page >= pagination.last_page} onClick={() => onPageChange?.(pagination.current_page + 1)} className="rounded-lg border px-3 py-1.5 disabled:opacity-40">Next</button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center gap-2 rounded-xl border border-brand-teal/30 bg-white px-3 py-2.5 focus-within:border-brand-teal">
          <Search size={14} className="shrink-0 text-brand-dark-soft/60" />
          <input
            ref={searchInputRef}
            value={search}
            onChange={(event) => onSearch?.(event.target.value)}
            placeholder="Search supplies or barcode..."
            className="min-w-0 flex-1 bg-transparent text-sm text-brand-dark placeholder:text-brand-dark-soft/50 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => searchInputRef.current?.focus()}
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-[11px] font-bold text-brand-teal hover:bg-brand-teal/10"
            title="Focus search for hardware scanner"
          >
            <ScanLine size={13} strokeWidth={2.5} />
            Scan
          </button>
          <button
            type="button"
            onClick={onScanSearch}
            className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-[11px] font-bold text-brand-teal hover:bg-brand-teal/10"
            title="Scan with camera"
          >
            <Camera size={13} strokeWidth={2.5} />
            Camera
          </button>
        </div>
        <SelectDropdown
          value={category}
          onChange={onCategoryChange}
          options={categoryOptions}
        />
      </div>

      <AdminLoadState loading={refreshing} error={error} onRetry={onRetry} />

      <div className="space-y-2">
        {loading ? (
          <AdminSkeleton label="Loading supplies" />
        ) : error && items.length === 0 ? null : items.length === 0 ? (
          <EmptyState text="No supplies products found." />
        ) : (
          items.map((item) => (
            <button
              key={item.id || item.item_id}
              type="button"
              onClick={() => onSelectItem?.(item)}
              className="w-full rounded-xl border border-brand-dark-light bg-white px-4 py-3 text-left shadow-[0_4px_10px_rgba(23,53,81,0.07)] transition-colors hover:border-brand-teal/40"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-brand-dark">{item.item_name}</p>
                  <p className="mt-0.5 text-[11px] font-semibold text-brand-teal-dark">{item.item_id}</p>
                  <p className="mt-1 text-xs font-semibold text-brand-dark-soft">{item.category}</p>
                </div>
                <InventoryProductImage item={item} variant="mobile" />
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 border-t border-brand-teal/10 pt-3">
                <InfoTile label="Selling Price" value={<PhpAmount value={item.selling_price} prefixClassName="text-[0.68em] font-bold text-brand-dark-soft/70" amountClassName="text-brand-dark" />} />
                <InfoTile
                  label="Stock"
                  value={formatStock(item.stock_quantity)}
                  valueClassName={`inline-flex rounded-full border px-2 py-0.5 text-[11px] ${stockTone(item.stock_quantity)}`}
                />
              </div>
            </button>
          ))
        )}
      </div>

      {selectedItem && (
        <div>
          <div className="fixed inset-0 z-[80] h-[100dvh] min-h-[100dvh] w-screen bg-brand-dark/40 backdrop-blur-sm" onClick={() => onSelectItem?.(null)} />
          <div className="fixed bottom-0 inset-x-0 z-[85] flex max-h-[92vh] flex-col rounded-t-3xl bg-white px-4 shadow-2xl">
            <div className="-mx-4 flex shrink-0 items-center justify-between rounded-t-3xl bg-brand-teal px-5 py-4">
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-white/70">Supplies Product</p>
                <p className="truncate text-base font-bold text-white">{selectedItem.item_name || '-'}</p>
              </div>
              <button
                type="button"
                onClick={() => onSelectItem?.(null)}
                className="ml-3 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition-colors hover:bg-white/25"
                aria-label="Close supplies preview"
              >
                <X size={16} strokeWidth={2.8} />
              </button>
            </div>
            <div className="-mx-4 h-1 shrink-0 bg-brand-teal-light" />

            <div className="flex-1 overflow-y-auto py-4">
              <div className="flex items-center gap-4 rounded-2xl border border-brand-teal/20 bg-brand-teal-light/30 p-4">
                <div className="shrink-0">
                  <InventoryProductImage item={selectedItem} variant="panel" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-lg font-extrabold leading-tight text-brand-dark">{selectedItem.item_name || '-'}</p>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-widest text-brand-teal">
                    {selectedItem.item_id || '-'}
                  </p>
                  <p className="mt-1 truncate text-xs font-semibold text-brand-dark-soft">{selectedItem.category || 'Uncategorized'}</p>
                </div>
              </div>

              <DetailSection title="Product Details">
                <SheetRow label="Category" value={selectedItem.category || '-'} />
                <SheetRow label="Barcode" value={selectedItem.barcode || '-'} />
                <SheetRow label="Type" value={selectedItem.item_type || 'product'} />
                <SheetRow label="Status" value={selectedItem.is_active ? 'Active' : 'Inactive'} />
                <SheetRow
                  label="Expiration Date"
                  value={(() => {
                    const batch = getNearestExpiryBatch(selectedItem);
                    return batch ? formatInventoryDate(batch.expiration_date) : '—';
                  })()}
                />
              </DetailSection>

              <DetailSection title="Pricing & Stock">
                <SheetRow label="Cost Price" value={<PhpAmount value={selectedItem.cost_price} prefixClassName="text-[0.72em] font-bold text-brand-dark-soft/70" amountClassName="text-brand-dark" />} />
                <SheetRow label="Selling Price" value={<PhpAmount value={selectedItem.selling_price} prefixClassName="text-[0.72em] font-bold text-brand-dark-soft/70" amountClassName="text-brand-dark" />} />
                <SheetRow label="Profit" value={<PhpAmount value={getProfit(selectedItem)} prefixClassName="text-[0.72em] font-bold text-brand-dark-soft/70" amountClassName="text-brand-dark" />} />
                <SheetRow label="Margin" value={`${getMargin(selectedItem).toFixed(2)}%`} />
                <div className="flex items-center justify-between gap-4 px-4 py-2.5">
                  <span className="text-xs font-semibold text-brand-teal">Stock</span>
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${stockTone(selectedItem.stock_quantity)}`}>
                    {formatStock(selectedItem.stock_quantity)}
                  </span>
                </div>
              </DetailSection>

              {selectedItem.description && (
                <div className="mt-4 overflow-hidden rounded-xl border border-brand-teal/20">
                  <div className="border-b border-brand-teal/20 bg-brand-teal-light/30 px-4 py-2.5">
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-teal">Description</span>
                  </div>
                  <p className="px-4 py-3 text-xs leading-relaxed text-brand-dark">{selectedItem.description}</p>
                </div>
              )}
            </div>

            <div className="flex shrink-0 gap-2 border-t border-brand-dark-light bg-white py-4">
              {onEditItem && <button
                type="button"
                onClick={() => {
                  onEditItem?.(selectedItem);
                  onSelectItem?.(null);
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-teal py-2.5 text-sm font-bold text-white hover:bg-brand-teal-dark"
              >
                <Pencil size={14} /> Edit
              </button>}
              {onDeleteItem && <button
                type="button"
                onClick={() => {
                  onDeleteItem?.(selectedItem);
                  onSelectItem?.(null);
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 py-2.5 text-sm font-bold text-red-500 hover:bg-red-100"
              >
                <Trash2 size={14} /> Delete
              </button>}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function EmptyState({ text }) {
  return (
    <div className="rounded-xl border border-brand-dark-light bg-white px-4 py-8 text-center text-xs font-semibold text-brand-dark-soft">
      {text}
    </div>
  );
}

function InfoTile({ label, value, valueClassName = 'font-bold text-brand-dark' }) {
  return (
    <div className="rounded-xl border border-brand-teal/10 bg-[#f8faf9] px-3 py-2">
      <p className="text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">{label}</p>
      <p className={`mt-1 text-xs ${valueClassName}`}>{value}</p>
    </div>
  );
}

function DetailSection({ title, children }) {
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-brand-teal/20">
      <div className="border-b border-brand-teal/20 bg-brand-teal-light/30 px-4 py-2.5">
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand-teal">{title}</span>
      </div>
      <div className="divide-y divide-brand-dark-light/60">{children}</div>
    </div>
  );
}

function SheetRow({ label, value }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <span className="shrink-0 text-xs font-semibold text-brand-teal">{label}</span>
      <span className="min-w-0 max-w-[62%] break-words text-right text-xs font-medium text-brand-dark">{value}</span>
    </div>
  );
}

function getProfit(item) {
  return Number(item?.selling_price || 0) - Number(item?.cost_price || 0);
}

function getMargin(item) {
  const sellingPrice = Number(item?.selling_price || 0);
  return sellingPrice > 0 ? (getProfit(item) / sellingPrice) * 100 : 0;
}
