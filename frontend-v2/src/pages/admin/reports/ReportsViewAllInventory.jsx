import { X } from 'lucide-react';
import { useState } from 'react';
import SelectDropdown from '../../../components/reusable-ui/SelectDropdown';
import ReportsTableFilterSort from './ReportsTableFilterSort';

export default function ReportsViewAllInventory({ isOpen, onClose, items = [], salesItems = [] }) {
  const [sortBy, setSortBy] = useState('name');
  if (!isOpen) return null;

  const salesById = new Map(salesItems.filter((sale) => sale.id).map((sale) => [String(sale.id), sale]));
  const salesByName = new Map(salesItems.map((sale) => [sale.name, sale]));
  const getSalesForItem = (item) => salesById.get(String(item.id)) || salesByName.get(item.name) || {};
  const sortedItems = [...items].sort((a, b) => {
    if (sortBy === 'stock') return Number(a.stock || 0) - Number(b.stock || 0);
    if (sortBy === 'category') {
      const categoryOrder = String(a.category || '').localeCompare(String(b.category || ''));
      return categoryOrder || String(a.name || '').localeCompare(String(b.name || ''));
    }
    return String(a.name || '').localeCompare(String(b.name || ''));
  });

  return (
      <div className="fixed inset-0 z-[320] flex items-center justify-center p-4 backdrop-blur-sm bg-brand-dark/40 h-[100dvh] min-h-[100dvh] w-screen">
      <div className="relative flex max-h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-brand-teal/10 bg-brand-teal px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-white">Supplies</h2>
            <p className="text-sm text-white/80">Complete supplies list</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-white transition-colors hover:bg-white/20" aria-label="Close inventory list">
            <X size={20} />
          </button>
        </div>

        <div className="overflow-y-auto p-4 sm:p-6">
          <div className="mb-3"><ReportsTableFilterSort><div className="sm:col-span-2"><p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-brand-dark-soft">Sort by</p><SelectDropdown value={sortBy} onChange={setSortBy} options={[{ value: 'name', label: 'Item name' }, { value: 'category', label: 'Category (A–Z)' }, { value: 'stock', label: 'Stock level' }]} buttonClassName="!rounded-lg !border-brand-teal/20 !px-2.5 !py-1.5" textClassName="!text-xs !font-semibold" /></div></ReportsTableFilterSort></div>
          <div className="overflow-hidden rounded-xl border border-brand-teal/10">
            <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] table-fixed text-sm">
              <colgroup>
                <col className="w-[34%]" />
                <col className="w-[17%]" />
                <col className="w-[10%]" />
                <col className="w-[15%]" />
                <col className="w-[15%]" />
                <col className="w-[9%]" />
              </colgroup>
              <thead>
                <tr className="border-b border-brand-teal/10 bg-gray-50">
                    {['Item', 'Category', 'Stock', 'Sales', 'Price', 'Status'].map((heading) => (
                    <th key={heading} className="px-3 py-2.5 text-left text-xs font-bold uppercase text-brand-dark-soft">{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-3 py-8 text-center text-sm text-brand-dark-soft">No supplies or inventory items found.</td>
                  </tr>
                ) : sortedItems.map((item) => (
                  <tr key={item.id || item.code || item.name} className="border-b border-brand-teal/5 hover:bg-gray-50">
                    <td className="px-3 py-3"><p className="truncate font-semibold text-brand-dark" title={item.name}>{item.name}</p><p className="mt-0.5 text-[11px] font-medium text-brand-dark-soft">{item.code || 'No code'}</p></td>
                    <td className="px-3 py-3 text-brand-dark-soft">{item.category || 'Uncategorized'}</td>
                    <td className={`px-3 py-3 font-bold ${item.stock <= item.reorderLevel ? 'text-red-600' : 'text-brand-dark'}`}>{item.stock ?? 0}</td>
                    <td className="px-3 py-3"><p className="font-semibold text-brand-dark">{getSalesForItem(item).units || 0} sold</p><p className="mt-0.5 text-[11px] text-brand-dark-soft">PHP {(getSalesForItem(item).revenue || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p></td>
                    <td className="px-3 py-3"><p className="font-semibold text-brand-dark">PHP {Number(item.sellingPrice || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p><p className="mt-0.5 text-[11px] text-brand-dark-soft">Cost: PHP {Number(item.costPrice || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</p></td>
                    <td className="px-3 py-3">
                      <span className={`inline-block rounded-full px-2 py-1 text-xs font-semibold ${item.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-gray-50 text-gray-600'}`}>
                        {item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
          <p className="mt-3 text-right text-[11px] italic text-brand-dark-soft">{items.length} inventory item(s) shown</p>
        </div>
      </div>
      </div>
  );
}
