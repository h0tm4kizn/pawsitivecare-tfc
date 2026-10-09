import { AdminSkeleton } from '../../../../components/admin/AdminLoading';
import { useMemo, useRef, useState, useEffect } from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { formatCurrency, formatInventoryDate, formatStock, stockTone } from '../inventoryUtils';
import InventoryStatBox from './InventoryStatBox';

const TILE_TONES = ['emerald', 'sky', 'amber'];

function SortIcon({ active, dir }) {
  if (!active) return <ChevronsUpDown size={12} className="ml-1 opacity-40" />;
  return dir === 'asc'
    ? <ChevronUp size={12} className="ml-1 text-brand-teal" />
    : <ChevronDown size={12} className="ml-1 text-brand-teal" />;
}

function LowStockTable({ items }) {
  const [sortKey, setSortKey] = useState('stock_quantity');
  const [sortDir, setSortDir] = useState('asc');
  const [activeCategory, setActiveCategory] = useState('All');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const onMouseDown = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setDropdownOpen(false);
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, []);

  const categories = useMemo(() => {
    const cats = [...new Set(items.map((i) => i.category || 'Uncategorized'))].sort();
    return ['All', ...cats];
  }, [items]);

  const filtered = useMemo(() => {
    if (activeCategory === 'All') return items;
    return items.filter((i) => (i.category || 'Uncategorized') === activeCategory);
  }, [items, activeCategory]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av = sortKey === 'stock_quantity' ? Number(a.stock_quantity ?? -1) : (a[sortKey] || '').toString().toLowerCase();
      let bv = sortKey === 'stock_quantity' ? Number(b.stock_quantity ?? -1) : (b[sortKey] || '').toString().toLowerCase();
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filtered, sortKey, sortDir]);

  const toggle = (key) => {
    if (sortKey === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(key); setSortDir('asc'); }
  };

  const outOfStock = filtered.filter((i) => !i.stock_quantity || Number(i.stock_quantity) <= 0).length;
  const runningLow = filtered.filter((i) => Number(i.stock_quantity) > 0 && Number(i.stock_quantity) <= 5).length;

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-6 text-center">
        <p className="text-sm font-bold text-emerald-700">All products are well stocked!</p>
        <p className="mt-1 text-xs text-brand-dark-soft">No items with 5 or fewer units.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Category filter dropdown */}
      <div ref={dropdownRef} className="relative ml-auto w-[200px]">
        <button
          type="button"
          onClick={() => setDropdownOpen((prev) => !prev)}
          className={`inline-flex w-full items-center justify-between gap-2 rounded-2xl border px-4 py-2 text-sm font-semibold transition ${
            dropdownOpen || activeCategory !== 'All'
              ? 'border-brand-teal bg-brand-teal text-white shadow-[0_4px_10px_rgba(36,119,122,0.25)]'
              : 'border-brand-teal/30 bg-white text-brand-dark shadow-[0_2px_8px_rgba(23,53,81,0.08)] hover:border-brand-teal hover:bg-brand-teal/5'
          }`}
        >
          <span className="truncate text-left">{activeCategory}</span>
          <ChevronDown size={14} className={`shrink-0 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
        </button>
        {dropdownOpen && (
          <div className="ui-dropdown-menu absolute left-0 top-full z-20 mt-1 w-full py-1">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => { setActiveCategory(cat); setDropdownOpen(false); }}
                className={`ui-dropdown-item ${activeCategory === cat ? 'ui-dropdown-item-active' : ''}`}
              >
                {cat}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-brand-dark-light">
        <table className="min-w-full text-xs">
          <thead className="bg-[#f6f8fa]">
            <tr>
              {[
                { key: 'item_name', label: 'Product', align: 'text-left' },
                { key: 'category', label: 'Category', align: 'text-left' },
                { key: 'stock_quantity', label: 'Stock', align: 'text-center' },
              ].map(({ key, label, align }) => (
                <th
                  key={key}
                  onClick={() => toggle(key)}
                  className={`cursor-pointer select-none px-4 py-2.5 ${align} text-[11px] font-extrabold uppercase tracking-wider text-brand-dark-soft hover:text-brand-teal`}
                >
                  <span className="inline-flex items-center">
                    {label}
                    <SortIcon active={sortKey === key} dir={sortDir} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-dark-light bg-white">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-xs text-brand-dark-soft">No items in this category.</td>
              </tr>
            ) : sorted.map((item) => (
              <tr key={item.id || item.item_id}>
                <td className="px-4 py-2.5">
                  <p className="font-bold text-brand-dark">{item.item_name}</p>
                  <p className="text-[11px] text-brand-dark-soft">{item.item_id}</p>
                </td>
                <td className="px-4 py-2.5 font-semibold text-brand-dark-soft">{item.category || '—'}</td>
                <td className="px-4 py-2.5 text-center">
                  <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${stockTone(item.stock_quantity)}`}>
                    {formatStock(item.stock_quantity)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rounded-xl border border-red-200 bg-red-50/75 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">Insight</p>
        <p className="mt-1 text-sm text-brand-dark">
          {`${outOfStock} item${outOfStock !== 1 ? 's' : ''} out of stock, ${runningLow} running low. Restock soon to avoid service disruptions.`}
        </p>
      </div>
    </div>
  );
}

export default function InventoryStatsGrid({ loading = false, stats = {}, items = [] }) {
  const totalProducts = Number(stats.total_products || 0);
  const categoriesCount = Number(stats.categories || 0);
  const lowOrNoStock = Number(stats.low_or_no_stock || 0);

  const byCategory = useMemo(() => {
    const map = {};
    items.forEach((item) => {
      const cat = item.category || 'Uncategorized';
      if (!map[cat]) map[cat] = { count: 0 };
      map[cat].count += 1;
    });
    return Object.entries(map).sort((a, b) => b[1].count - a[1].count);
  }, [items]);

  const lowStockItems = useMemo(
    () => items
      .filter((i) => i.stock_quantity === null || i.stock_quantity === undefined || Number(i.stock_quantity) <= 5)
      .sort((a, b) => Number(a.stock_quantity ?? -1) - Number(b.stock_quantity ?? -1)),
    [items],
  );

  const activeItems = items.filter((i) => i.is_active);
  const inactiveItems = items.filter((i) => !i.is_active);
  const avgPrice = items.length > 0
    ? items.reduce((sum, i) => sum + Number(i.selling_price || 0), 0) / items.length
    : 0;
  const activePercent = items.length > 0 ? Math.round((activeItems.length / items.length) * 100) : 0;
  const sortedByStock = [...items].filter((i) => i.stock_quantity !== null && i.stock_quantity !== undefined);
  const mostSellable = [...sortedByStock].sort((a, b) => Number(a.stock_quantity) - Number(b.stock_quantity)).slice(0, 3);
  const leastSellable = [...sortedByStock].sort((a, b) => Number(b.stock_quantity) - Number(a.stock_quantity)).slice(0, 3);
  const expiringThisMonth = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    return items.flatMap((item) => (Array.isArray(item.batches) ? item.batches : [])
      .filter((batch) => {
        if (!batch?.expiration_date || Number(batch.quantity_available || 0) <= 0) return false;
        const expiration = new Date(`${String(batch.expiration_date).slice(0, 10)}T00:00:00`);
        return !Number.isNaN(expiration.getTime()) && expiration >= today && expiration <= monthEnd;
      })
      .map((batch) => ({ ...batch, item_name: item.item_name, item_id: item.item_id })))
      .sort((a, b) => String(a.expiration_date).localeCompare(String(b.expiration_date)));
  }, [items]);

  // — Modal content builders —

  const totalProductsContent = (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-brand-dark-soft">Active</p>
          <p className="mt-1 text-4xl font-extrabold leading-none text-brand-dark">{activeItems.length}</p>
          <p className="mt-2 text-xs font-semibold text-brand-dark-soft">available for sale</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50/75 px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-brand-dark-soft">Inactive</p>
          <p className="mt-1 text-4xl font-extrabold leading-none text-brand-dark">{inactiveItems.length}</p>
          <p className="mt-2 text-xs font-semibold text-brand-dark-soft">hidden from sale</p>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50/70 px-4 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wide text-brand-dark-soft">Avg. Price</p>
          <p className="mt-1 text-2xl font-extrabold leading-none text-brand-dark">{formatCurrency(avgPrice)}</p>
          <p className="mt-2 text-xs font-semibold text-brand-dark-soft">per product</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="overflow-hidden rounded-xl border border-brand-dark-light">
          <div className="bg-emerald-50 px-4 py-2 border-b border-brand-dark-light">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700">Most Sellable</p>
            <p className="text-[10px] text-brand-dark-soft">Lowest remaining stock</p>
          </div>
          <div className="divide-y divide-brand-dark-light bg-white">
            {mostSellable.length === 0 ? (
              <p className="px-4 py-3 text-xs text-brand-dark-soft">No data</p>
            ) : mostSellable.map((item) => (
              <div key={item.id || item.item_id} className="flex items-center justify-between px-4 py-2.5 gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-brand-dark">{item.item_name}</p>
                  <p className="text-[11px] text-brand-dark-soft">{item.category || '—'}</p>
                </div>
                <span className={`shrink-0 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold ${stockTone(item.stock_quantity)}`}>
                  {formatStock(item.stock_quantity)}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-brand-dark-light">
          <div className="bg-red-50 px-4 py-2 border-b border-brand-dark-light">
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-red-600">Least Sellable</p>
            <p className="text-[10px] text-brand-dark-soft">Highest remaining stock</p>
          </div>
          <div className="divide-y divide-brand-dark-light bg-white">
            {leastSellable.length === 0 ? (
              <p className="px-4 py-3 text-xs text-brand-dark-soft">No data</p>
            ) : leastSellable.map((item) => (
              <div key={item.id || item.item_id} className="flex items-center justify-between px-4 py-2.5 gap-2">
                <div className="min-w-0">
                  <p className="truncate text-xs font-bold text-brand-dark">{item.item_name}</p>
                  <p className="text-[11px] text-brand-dark-soft">{item.category || '—'}</p>
                </div>
                <span className={`shrink-0 inline-flex rounded-full border px-2 py-0.5 text-[11px] font-bold ${stockTone(item.stock_quantity)}`}>
                  {formatStock(item.stock_quantity)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-brand-teal/20 bg-brand-teal-light/20 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">Insight</p>
        <p className="mt-1 text-sm text-brand-dark">
          {items.length > 0
            ? `${activePercent}% of products (${activeItems.length} of ${items.length}) are active. Stock levels are used to estimate demand.`
            : 'No products found.'}
        </p>
      </div>
    </div>
  );

  const categoriesContent = (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-brand-dark-light">
        <table className="min-w-full text-xs">
          <thead className="bg-[#f6f8fa]">
            <tr>
              <th className="px-4 py-2.5 text-left text-[11px] font-extrabold uppercase tracking-wider text-brand-dark-soft">Category</th>
              <th className="px-4 py-2.5 text-center text-[11px] font-extrabold uppercase tracking-wider text-brand-dark-soft">Products</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-dark-light bg-white">
            {byCategory.map(([cat, data]) => (
              <tr key={cat}>
                <td className="px-4 py-2.5 font-semibold text-brand-dark">{cat}</td>
                <td className="px-4 py-2.5 text-center font-bold text-brand-teal-dark">{data.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rounded-xl border border-brand-teal/20 bg-brand-teal-light/20 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">Insight</p>
        <p className="mt-1 text-sm text-brand-dark">
          {byCategory.length > 0
            ? `${byCategory.length} active categor${byCategory.length !== 1 ? 'ies' : 'y'} covering ${totalProducts} total products.`
            : 'No categories found.'}
        </p>
      </div>
    </div>
  );

  const expiringContent = (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-brand-dark-light">
        <table className="min-w-full text-xs">
          <thead className="bg-[#f6f8fa]">
            <tr>
              <th className="px-4 py-2.5 text-left text-[11px] font-extrabold uppercase tracking-wider text-brand-dark-soft">Product</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-extrabold uppercase tracking-wider text-brand-dark-soft">Batch</th>
              <th className="px-4 py-2.5 text-left text-[11px] font-extrabold uppercase tracking-wider text-brand-dark-soft">Expiration</th>
              <th className="px-4 py-2.5 text-right text-[11px] font-extrabold uppercase tracking-wider text-brand-dark-soft">Stock</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-dark-light bg-white">
            {expiringThisMonth.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-xs text-brand-dark-soft">No in-stock batches expire this month.</td>
              </tr>
            ) : expiringThisMonth.map((batch) => (
              <tr key={batch.id || `${batch.item_id}-${batch.batch_code}`}>
                <td className="px-4 py-2.5">
                  <p className="font-bold text-brand-dark">{batch.item_name}</p>
                  <p className="text-[11px] text-brand-dark-soft">{batch.item_id}</p>
                </td>
                <td className="px-4 py-2.5 font-semibold text-brand-dark-soft">{batch.batch_code || '—'}</td>
                <td className="px-4 py-2.5 font-bold text-amber-700">{formatInventoryDate(batch.expiration_date)}</td>
                <td className="px-4 py-2.5 text-right font-bold text-brand-dark">{Number(batch.quantity_available || 0).toLocaleString('en-PH')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-brand-dark-soft">Insight</p>
        <p className="mt-1 text-sm text-brand-dark">
          {expiringThisMonth.length > 0
            ? `${expiringThisMonth.length} in-stock batch${expiringThisMonth.length !== 1 ? 'es' : ''} need attention before month-end.`
            : 'No expiration action is needed this month.'}
        </p>
      </div>
    </div>
  );

  const lowStockContent = <LowStockTable items={lowStockItems} />;

  if (loading) return <AdminSkeleton variant="cards" label="Loading statistics" />;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <InventoryStatBox
        title="Total Products"
        value={totalProducts.toLocaleString('en-PH')}
        note="Active sellable products"
        modalTitle="Total Products Breakdown"
        modalSubtitle={`${totalProducts} products across ${byCategory.length} categories`}
        customContent={totalProductsContent}
      />
      <InventoryStatBox
        title="Categories"
        value={categoriesCount.toLocaleString('en-PH')}
        note="Product groups in supplies"
        modalTitle="Category Overview"
        modalSubtitle="Supplies and stock value per category"
        customContent={categoriesContent}
      />
      <InventoryStatBox
        title="Expiring This Month"
        value={expiringThisMonth.length.toLocaleString('en-PH')}
        note="In-stock batches nearing expiration"
        modalTitle="Batches Expiring This Month"
        modalSubtitle="In-stock batches expiring from today through month-end"
        customContent={expiringContent}
      />
      <InventoryStatBox
        title="Low / No Stock"
        value={lowOrNoStock.toLocaleString('en-PH')}
        note="Items with 5 or fewer stock"
        modalTitle="Low & Out of Stock Items"
        modalSubtitle="Products that need restocking"
        customContent={lowStockContent}
      />
    </div>
  );
}
