import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Ban, ChevronDown, ChevronUp, Download, FileText, Filter, Package, Pencil, Printer, Search, ShoppingBag, X } from 'lucide-react';
import { apiFetch } from '../../../../api/apiClient';
import WalkInSaleModal from './WalkInSaleModal';

const NOW = new Date();

const fmt = (n) =>
  Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const saleLabel = (sale) => sale.receipt_number || `Sale #${sale.id}`;

const itemProfit = (item) => {
  if (item.cost_price_snapshot === null || item.cost_price_snapshot === undefined) return null;
  return (Number(item.selling_price || 0) - Number(item.cost_price_snapshot || 0)) * Number(item.quantity || 0);
};

const saleProfit = (sale) => (sale.items || []).reduce((sum, item) => sum + Number(itemProfit(item) || 0), 0);
import { downloadReceiptPDF, getPaymentLabel, getReceivingAccountLabel } from '../receiptPdfUtils';

const fetchMonthlyWalkInSales = async (year, month) => {
  const monthText = String(month).padStart(2, '0');
  const lastDay = new Date(year, month, 0).getDate();
  const startDate = `${year}-${monthText}-01`;
  const endDate = `${year}-${monthText}-${String(lastDay).padStart(2, '0')}`;
  const rows = [];
  let page = 1;
  let lastPage = 1;

  do {
    const response = await apiFetch(`/api/admin/walk-in-sales?start_date=${startDate}&end_date=${endDate}&per_page=100&page=${page}`);
    const json = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(json?.message || 'Failed to load walk-in sales.');
    const paginator = json?.data || {};
    rows.push(...(Array.isArray(paginator.data) ? paginator.data : []));
    lastPage = Number(paginator.last_page || 1);
    page += 1;
  } while (page <= lastPage);

  return rows;
};

function ReceiptPreviewModal({ sale, onClose }) {
  if (!sale) return null;
  const modal = (
    <div className="fixed inset-0 z-[300] flex h-[100dvh] min-h-[100dvh] w-screen items-center justify-center bg-brand-dark/40 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between bg-brand-teal px-7 py-4">
          <h2 className="text-lg font-extrabold text-white">Records</h2>
          <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25">
            <X size={18} strokeWidth={2.5} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto font-poppins">
          <div className="border-b border-brand-teal/10 bg-brand-teal/5 px-8 py-5 text-center">
            <p className="text-base font-extrabold uppercase tracking-wide text-brand-dark leading-tight">The Fur Club Pet Station</p>
            <p className="text-sm font-semibold text-brand-teal mt-0.5">PawsitiveCare</p>
            <p className="mt-1 text-sm font-extrabold text-brand-teal-dark">{saleLabel(sale)}</p>
            <p className="text-xs text-brand-dark-soft mt-0.5">
              {sale.sold_at ? new Date(sale.sold_at).toLocaleString('en-PH') : '-'}
            </p>
          </div>

          <div className="grid grid-cols-2 divide-x divide-brand-teal/10">
            <div className="space-y-4 px-8 py-6">
              <p className="text-xs font-bold uppercase tracking-wide text-brand-dark-soft">Details</p>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-xs text-brand-dark-soft">Customer</p>
                  <p className="font-semibold text-brand-dark">{sale.customer_name || 'Walk-in'}</p>
                </div>
                <div>
                  <p className="text-xs text-brand-dark-soft">Paid From</p>
                  <p className="font-semibold text-brand-dark">{getPaymentLabel(sale.payment_method, sale.payment_channel)}</p>
                </div>
                {sale.payment_method !== 'cash' && sale.payment_received_by && (
                  <div>
                    <p className="text-xs text-brand-dark-soft">Paid To</p>
                    <p className="font-semibold text-brand-dark">{getReceivingAccountLabel(sale.payment_received_by)}</p>
                  </div>
                )}
                {sale.sold_by?.name && (
                  <div>
                    <p className="text-xs text-brand-dark-soft">Served by</p>
                    <p className="font-semibold text-brand-dark">{sale.sold_by.name}</p>
                  </div>
                )}
                {sale.notes && (
                  <div>
                    <p className="text-xs text-brand-dark-soft">Note</p>
                    <p className="text-xs italic text-brand-dark-soft">{sale.notes}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="px-8 py-6">
              <p className="mb-3 text-xs font-bold uppercase tracking-wide text-brand-dark-soft">Items</p>
              <div className="space-y-3">
                {(sale.items || []).map((item, idx) => (
                  <div key={idx} className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-brand-dark leading-snug">{item.item_snapshot_name}</p>
                      <p className="text-xs text-brand-dark-soft">PHP{fmt(item.selling_price)} x {item.quantity}</p>
                    </div>
                    <span className="shrink-0 text-sm font-bold text-brand-dark">PHP{fmt(item.subtotal)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-brand-teal/20 bg-brand-teal-light px-8 py-4">
            <span className="text-base font-extrabold uppercase tracking-wide text-brand-teal-dark">Total</span>
            <span className="text-2xl font-extrabold text-brand-teal-dark">PHP{fmt(sale.total_amount)}</span>
          </div>
        </div>

        <div className="shrink-0 border-t border-brand-teal/10 p-5">
          <button type="button" onClick={() => downloadReceiptPDF(sale)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-teal py-3 text-sm font-bold text-white transition-colors hover:bg-brand-teal-dark">
            <Download size={15} strokeWidth={2.5} />
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
  return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal;
}

function getWeekOfMonth(date) {
  const d = new Date(date);
  const first = new Date(d.getFullYear(), d.getMonth(), 1).getDay();
  return Math.ceil((d.getDate() + first) / 7);
}

export default function InventorySalesReportModal({ isOpen, onClose }) {
  const [sales, setSales] = useState([]);
  const [serviceRetail, setServiceRetail] = useState([]);
  const [loadingServiceRetail, setLoadingServiceRetail] = useState(false);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState('day');
  const [search, setSearch] = useState('');
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [expandedApptIds, setExpandedApptIds] = useState(new Set());
  const [previewSale, setPreviewSale] = useState(null);
  const [editingSale, setEditingSale] = useState(null);
  const [view, setView] = useState('sales');
  const [voidingId, setVoidingId] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const toggleExpanded = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleVoid = async (sale) => {
    if (!window.confirm(`Void ${sale.receipt_number || 'this sale'}? This will restore the supplies stock.`)) return;
    setVoidingId(sale.id);
    try {
      const res = await apiFetch(`/api/admin/walk-in-sales/${sale.id}/void`, { method: 'POST' });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        alert(json?.message || 'Failed to void sale.');
        return;
      }
      setSales((prev) => prev.filter((s) => s.id !== sale.id));
      setExpandedIds((prev) => { const n = new Set(prev); n.delete(sale.id); return n; });
    } catch {
      alert('Failed to void sale. Please try again.');
    } finally {
      setVoidingId(null);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const year = NOW.getFullYear();
    const month = NOW.getMonth() + 1;

    setLoading(true);
    fetchMonthlyWalkInSales(year, month)
      .then(setSales)
      .catch(() => setSales([]))
      .finally(() => setLoading(false));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      setSales([]);
      setServiceRetail([]);
      setPreviewSale(null);
      setEditingSale(null);
      setSearch('');
      setExpandedIds(new Set());
      setExpandedApptIds(new Set());
      setView('sales');
      setFiltersOpen(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || view !== 'service-retail') return;
    if (serviceRetail.length > 0) return;
    const year = NOW.getFullYear();
    const month = NOW.getMonth() + 1;
    setLoadingServiceRetail(true);
    apiFetch(`/api/reports/service-retail-summary?year=${year}&view=monthly&month=${month}`)
      .then((r) => r.json())
      .then((json) => setServiceRetail(Array.isArray(json?.data) ? json.data : []))
      .catch(() => setServiceRetail([]))
      .finally(() => setLoadingServiceRetail(false));
  }, [isOpen, view, serviceRetail.length]);

  const filtered = useMemo(() => {
    const now = new Date();

    // Date-range filter per period
    let periodFiltered = [...sales];
    if (period === 'day') {
      const todayStr = now.toLocaleDateString('en-CA');
      periodFiltered = periodFiltered.filter((s) => new Date(s.sold_at).toLocaleDateString('en-CA') === todayStr);
    } else if (period === 'week') {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);
      periodFiltered = periodFiltered.filter((s) => {
        const d = new Date(s.sold_at);
        return d >= startOfWeek && d <= endOfWeek;
      });
    }

    const sorted = periodFiltered.sort((a, b) => new Date(b.sold_at || 0) - new Date(a.sold_at || 0));
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((sale) => {
      if ((sale.receipt_number || '').toLowerCase().includes(q)) return true;
      if (String(sale.id).includes(q)) return true;
      if ((sale.customer_name || '').toLowerCase().includes(q)) return true;
      if ((sale.items || []).some((item) => (item.item_snapshot_name || '').toLowerCase().includes(q))) return true;
      return false;
    });
  }, [sales, search, period]);

  const grouped = useMemo(() => {
    if (period === 'day') return [{ label: null, sales: filtered }];
    const groups = {};
    filtered.forEach((sale) => {
      const d = new Date(sale.sold_at);
      const key = period === 'week'
        ? d.toLocaleDateString('en-PH', { weekday: 'long', month: 'short', day: 'numeric' })
        : `Week ${getWeekOfMonth(d)}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(sale);
    });
    return Object.entries(groups).map(([label, sales]) => ({ label, sales }));
  }, [filtered, period]);

  const totalRevenue = filtered.reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0);
  const totalProfit = filtered.reduce((sum, sale) => sum + saleProfit(sale), 0);

  if (!isOpen) return null;

  const modal = (
    <>
      <div className="fixed inset-0 z-[200] flex h-[100dvh] min-h-[100dvh] w-screen items-center justify-center bg-brand-dark/40 p-4 backdrop-blur-sm">
        <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
          <div className="flex shrink-0 items-center justify-between bg-brand-teal px-6 py-4">
            <div>
              <h2 className="text-lg font-extrabold text-white">Sales Supplies</h2>
              <p className="text-sm text-white/70">Walk-in sales for this month</p>
            </div>
            <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25">
              <X size={18} strokeWidth={2.5} />
            </button>
          </div>

          <div className="relative shrink-0 border-b border-brand-teal/10 bg-gray-50/60 px-5 py-3">
            <div className="flex items-center gap-2">
              <div className="relative min-w-0 flex-1">
                <Search size={13} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-dark-soft" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search sales, customer, product, pet, service, or records..."
                  className="h-10 w-full rounded-xl border border-brand-teal/20 bg-white py-2 pl-9 pr-9 text-sm text-brand-dark placeholder-brand-dark-soft/60 focus:border-brand-teal focus:outline-none"
                />
                {search && (
                  <button type="button" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-brand-dark-soft hover:text-brand-dark">
                    <X size={13} />
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => setFiltersOpen((open) => !open)}
                className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors ${filtersOpen ? 'border-brand-teal bg-brand-teal text-white' : 'border-brand-teal/25 bg-white text-brand-teal hover:bg-brand-teal/10'}`}
                aria-label="Filter sales"
                aria-expanded={filtersOpen}
              >
                <Filter size={16} strokeWidth={2.5} />
              </button>
            </div>

            {filtersOpen && (
              <div className="absolute right-5 top-[calc(100%-0.25rem)] z-30 w-[min(360px,calc(100%-2.5rem))] space-y-3 rounded-xl border border-brand-teal/20 bg-white p-4 shadow-xl">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-extrabold uppercase tracking-wide text-brand-dark">Filters</p>
                  <button type="button" onClick={() => setFiltersOpen(false)} className="rounded-md p-1 text-brand-dark-soft hover:bg-brand-surface" aria-label="Close filters"><X size={14} /></button>
                </div>
                <div>
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-brand-dark-soft">Period</p>
                  <PeriodDropdown value={period} onChange={setPeriod} />
                </div>
                <div>
                  <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-brand-dark-soft">Record Type</p>
                  <ViewDropdown value={view} onChange={setView} />
                </div>
              </div>
            )}
          </div>

          {!loading && (
            <div className="shrink-0 grid grid-cols-1 gap-2 border-b border-brand-teal/10 bg-brand-teal/5 px-5 py-2 sm:grid-cols-3">
              <span className="text-xs font-bold text-brand-dark">
                {filtered.length} sale{filtered.length !== 1 ? 's' : ''}{search ? ' matching' : ''}
              </span>
              <span className="text-sm font-extrabold text-brand-teal-dark sm:text-center">Revenue: PHP{fmt(totalRevenue)}</span>
              <span className="text-sm font-extrabold text-emerald-700 sm:text-right">Profit: PHP{fmt(totalProfit)}</span>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-5">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-teal border-t-transparent" />
                <p className="mt-3 text-sm text-brand-dark-soft">Loading sales...</p>
              </div>
            ) : view === 'service-retail' ? (
              loadingServiceRetail ? (
                <div className="flex flex-col items-center justify-center py-16">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-teal border-t-transparent" />
                  <p className="mt-3 text-sm text-brand-dark-soft">Loading...</p>
                </div>
              ) : serviceRetail.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Package size={40} className="mb-3 text-brand-teal/25" />
                  <p className="text-sm font-semibold text-brand-dark">No service + retail records</p>
                  <p className="mt-1 text-xs text-brand-dark-soft">No appointments with retail sales found this month.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {serviceRetail.map((appt) => {
                    const open = expandedApptIds.has(appt.id);
                    const retailTotal = (appt.retail_sales || []).reduce((s, sale) => s + Number(sale.total_amount || 0), 0);
                    return (
                      <div key={appt.id} className="overflow-hidden rounded-xl border border-brand-teal/15 bg-white shadow-sm">
                        <button
                          type="button"
                          onClick={() => setExpandedApptIds((prev) => { const n = new Set(prev); n.has(appt.id) ? n.delete(appt.id) : n.add(appt.id); return n; })}
                          className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-gray-50"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-teal/10">
                              <ShoppingBag size={13} className="text-brand-teal" strokeWidth={2.5} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-extrabold text-brand-dark truncate">
                                {appt.pet_name || 'Pet'} — {appt.service_name || 'Service'}
                              </p>
                              <p className="text-[11px] text-brand-dark-soft">
                                {appt.pet_code && <span className="mr-2 font-mono">{appt.pet_code}</span>}
                                {appt.date} · {appt.retail_sales?.length || 0} retail sale{(appt.retail_sales?.length || 0) !== 1 ? 's' : ''}
                              </p>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-3 ml-3">
                            <p className="text-sm font-extrabold text-brand-teal-dark">PHP{fmt(retailTotal)}</p>
                            {open ? <ChevronUp size={16} className="text-brand-dark-soft" /> : <ChevronDown size={16} className="text-brand-dark-soft" />}
                          </div>
                        </button>

                        {open && (
                          <div className="border-t border-brand-teal/10 space-y-2 px-4 py-3">
                            {(appt.retail_sales || []).map((sale) => {
                              const profit = saleProfit(sale);
                              const saleOpen = expandedIds.has(sale.id);
                              return (
                                <div key={sale.id} className="overflow-hidden rounded-xl border border-brand-teal/10 bg-gray-50/60">
                                  <button
                                    type="button"
                                    onClick={() => toggleExpanded(sale.id)}
                                    className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-brand-teal/5"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <FileText size={12} className="shrink-0 text-brand-teal" />
                                      <div className="min-w-0">
                                        <p className="font-mono text-xs font-extrabold text-brand-teal-dark">{saleLabel(sale)}</p>
                                        <p className="text-[10px] text-brand-dark-soft">
                                          {sale.sold_at ? new Date(sale.sold_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : '-'}
                                        </p>
                                      </div>
                                    </div>
                                    <div className="flex shrink-0 items-center gap-2 ml-2">
                                      <div className="text-right">
                                        <p className="text-xs font-extrabold text-brand-teal-dark">PHP{fmt(sale.total_amount)}</p>
                                        <p className="text-[10px] font-semibold text-emerald-700">Profit PHP{fmt(profit)}</p>
                                      </div>
                                      {saleOpen ? <ChevronUp size={13} className="text-brand-dark-soft" /> : <ChevronDown size={13} className="text-brand-dark-soft" />}
                                    </div>
                                  </button>

                                  {saleOpen && (
                                    <div className="border-t border-brand-teal/10 px-3 py-2 space-y-1.5">
                                      {(sale.items || []).map((item, idx) => (
                                        <div key={idx} className="flex items-center justify-between gap-3 text-xs">
                                          <span className="min-w-0 text-brand-dark">
                                            {item.item_snapshot_name}
                                            <span className="ml-1 text-brand-dark-soft">×{item.quantity}</span>
                                          </span>
                                          <span className="shrink-0 font-semibold text-brand-dark">PHP{fmt(item.subtotal)}</span>
                                        </div>
                                      ))}
                                      <div className="flex justify-end pt-1">
                                        <button type="button" onClick={() => setPreviewSale(sale)} className="flex items-center gap-1 rounded-lg bg-brand-teal/10 px-2.5 py-1 text-xs font-bold text-brand-teal hover:bg-brand-teal hover:text-white transition-colors">
                                          <Printer size={10} strokeWidth={2.5} /> View
                                        </button>
                                        <button type="button" onClick={() => setEditingSale(sale)} className="ml-2 flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 hover:bg-amber-500 hover:text-white transition-colors">
                                          <Pencil size={10} strokeWidth={2.5} /> Edit
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FileText size={40} className="mb-3 text-brand-teal/25" />
                <p className="text-sm font-semibold text-brand-dark">{search ? 'No results found' : 'No sales this month'}</p>
                <p className="mt-1 text-xs text-brand-dark-soft">
                  {search ? `No sales match "${search}".` : 'No walk-in sales recorded this month.'}
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {grouped.map(({ label, sales: groupSales }) => {
                  const groupTotal = groupSales.reduce((sum, sale) => sum + Number(sale.total_amount || 0), 0);
                  const groupProfit = groupSales.reduce((sum, sale) => sum + saleProfit(sale), 0);
                  return (
                    <div key={label || 'all'} className="space-y-2">
                      {label && (
                        <div className="flex items-center justify-between rounded-lg bg-brand-teal/5 px-3 py-2">
                          <span className="text-xs font-bold text-brand-teal-dark">{label}</span>
                          <span className="text-xs font-bold text-brand-teal-dark">
                            {groupSales.length} sale{groupSales.length !== 1 ? 's' : ''} · PHP{fmt(groupTotal)} revenue · PHP{fmt(groupProfit)} profit
                          </span>
                        </div>
                      )}

                      {groupSales.map((sale) => {
                        const isOpen = expandedIds.has(sale.id);
                        const profit = saleProfit(sale);
                        return (
                          <div key={sale.id} className="overflow-hidden rounded-xl border border-brand-teal/15 bg-white shadow-sm">
                            <button type="button" onClick={() => toggleExpanded(sale.id)} className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-gray-50">
                              <div className="flex items-center gap-3 min-w-0">
                                <FileText size={14} className="shrink-0 text-brand-teal" />
                                <div className="min-w-0">
                                  <p className="font-mono text-sm font-extrabold text-brand-teal-dark truncate">{saleLabel(sale)}</p>
                                  <p className="text-[11px] text-brand-dark-soft">
                                    {sale.sold_at
                                      ? new Date(sale.sold_at).toLocaleString('en-PH', {
                                          month: 'short',
                                          day: 'numeric',
                                          year: 'numeric',
                                          hour: 'numeric',
                                          minute: '2-digit',
                                          hour12: true,
                                        })
                                      : '-'}
                                  </p>
                                </div>
                              </div>
                              <div className="flex shrink-0 items-center gap-3 ml-3">
                                <div className="text-right">
                                  <p className="text-base font-extrabold text-brand-teal-dark">PHP{fmt(sale.total_amount)}</p>
                                  <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Profit PHP{fmt(profit)}</p>
                                </div>
                                {isOpen
                                  ? <ChevronUp size={16} className="text-brand-dark-soft" />
                                  : <ChevronDown size={16} className="text-brand-dark-soft" />}
                              </div>
                            </button>

                            {isOpen && (
                              <div className="border-t border-brand-teal/10 space-y-3 px-4 py-3">
                                <div className="flex flex-wrap gap-x-6 gap-y-1.5">
                                  <Detail label="Customer" value={sale.customer_name || 'Walk-in'} />
                                  <Detail label="Paid From" value={getPaymentLabel(sale.payment_method, sale.payment_channel)} />
                                  {sale.payment_method !== 'cash' && sale.payment_received_by && (
                                    <Detail label="Paid To" value={getReceivingAccountLabel(sale.payment_received_by)} />
                                  )}
                                  {sale.sold_by?.name && <Detail label="Served by" value={sale.sold_by.name} />}
                                  <Detail label="Profit" value={`PHP${fmt(profit)}`} valueClassName="text-emerald-700" />
                                </div>

                                {sale.items && sale.items.length > 0 && (
                                  <div className="rounded-lg border border-brand-teal/10 bg-gray-50/60 px-3 py-2">
                                    <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-brand-dark-soft">Items</p>
                                    <div className="space-y-1">
                                      {sale.items.map((item, idx) => {
                                        const profitValue = itemProfit(item);
                                        return (
                                          <div key={idx} className="flex items-center justify-between gap-3 text-xs">
                                            <span className="min-w-0 text-brand-dark">
                                              {item.item_snapshot_name}
                                              <span className="ml-1 text-brand-dark-soft">x{item.quantity}</span>
                                            </span>
                                            <span className="shrink-0 font-semibold text-brand-dark">
                                              PHP{fmt(item.subtotal)}
                                              {profitValue !== null && (
                                                <span className="ml-2 text-emerald-700">Profit PHP{fmt(profitValue)}</span>
                                              )}
                                            </span>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                <div className="flex justify-end gap-2">
                                  <button type="button" onClick={() => setPreviewSale(sale)} className="flex items-center gap-1.5 rounded-lg bg-brand-teal/10 px-3 py-1.5 text-xs font-bold text-brand-teal transition-colors hover:bg-brand-teal hover:text-white">
                                    <Printer size={11} strokeWidth={2.5} />
                                    View
                                  </button>
                                  <button type="button" onClick={() => setEditingSale(sale)} className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-700 transition-colors hover:bg-amber-500 hover:text-white">
                                    <Pencil size={11} strokeWidth={2.5} />
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    disabled={voidingId === sale.id}
                                    onClick={() => handleVoid(sale)}
                                    className="flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 transition-colors hover:bg-red-500 hover:text-white disabled:opacity-50"
                                  >
                                    <Ban size={11} strokeWidth={2.5} />
                                    {voidingId === sale.id ? 'Voiding...' : 'Void'}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {previewSale && (
        <ReceiptPreviewModal sale={previewSale} onClose={() => setPreviewSale(null)} />
      )}
      {editingSale && (
        <WalkInSaleModal
          editingSale={editingSale}
          overlayClassName="z-[350]"
          onClose={() => setEditingSale(null)}
          onSaved={(updatedSale) => {
            setSales((prev) => prev.map((sale) => sale.id === updatedSale.id ? updatedSale : sale));
            setServiceRetail((prev) => prev.map((appt) => ({
              ...appt,
              retail_sales: (appt.retail_sales || []).map((sale) => sale.id === updatedSale.id ? updatedSale : sale),
            })));
            setEditingSale(null);
          }}
        />
      )}
    </>
  );
  return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal;
}

function Detail({ label, value, valueClassName = 'text-brand-dark', capitalize = false }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wide text-brand-dark-soft">{label}</p>
      <p className={`text-sm font-semibold ${valueClassName} ${capitalize ? 'capitalize' : ''}`}>{value}</p>
    </div>
  );
}

const VIEW_OPTIONS = [
  { value: 'service-retail', label: 'Service & Supplies Retails' },
  { value: 'sales',          label: 'Walk-in Retails' },
];

function ViewDropdown({ value, onChange }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const selected = VIEW_OPTIONS.find((o) => o.value === value) || VIEW_OPTIONS[0];

  React.useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={`inline-flex h-10 w-full items-center justify-between gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors ${
          open ? 'border-brand-teal bg-brand-teal text-white' : 'border-brand-teal/20 bg-white text-brand-dark hover:border-brand-teal'
        }`}
      >
        <span className="flex min-w-0 items-center gap-2">
          <Package size={13} className="shrink-0" strokeWidth={2.5} />
          <span className="truncate">{selected.label}</span>
        </span>
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={2.5} />
      </button>
      {open && (
        <div className="ui-dropdown-menu absolute left-0 top-full z-20 mt-1 min-w-full py-1">
          {VIEW_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`ui-dropdown-item ${value === opt.value ? 'ui-dropdown-item-active' : ''}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const PERIOD_OPTIONS = [
  { value: 'day',   label: 'Today'      },
  { value: 'week',  label: 'This Week'  },
  { value: 'month', label: 'This Month' },
];

function PeriodDropdown({ value, onChange }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  const selected = PERIOD_OPTIONS.find((o) => o.value === value) || PERIOD_OPTIONS[0];

  React.useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className={`inline-flex h-10 w-full items-center justify-between gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors ${
          open ? 'border-brand-teal bg-brand-teal text-white' : 'border-brand-teal/20 bg-white text-brand-dark hover:border-brand-teal'
        }`}
      >
        <span className="truncate">{selected.label}</span>
        <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} strokeWidth={2.5} />
      </button>
      {open && (
        <div className="ui-dropdown-menu absolute left-0 top-full z-20 mt-1 min-w-full py-1">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`ui-dropdown-item ${value === opt.value ? 'ui-dropdown-item-active' : ''}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
