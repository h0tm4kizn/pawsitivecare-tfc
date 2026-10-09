/* eslint-disable react-hooks/purity */
/* eslint-disable react-refresh/only-export-components */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Minus, Plus, ScanLine, Search, ShoppingBag, ShoppingCart, Smartphone, Trash2, X } from 'lucide-react';
import { apiFetch, apiGet } from '../../../../api/apiClient';
import { SkeletonBlock } from '../../../../components/admin/AdminLoading';
import SelectDropdown from '../../../../components/reusable-ui/SelectDropdown';
import BarcodeScannerModal from './BarcodeScannerModal';
import PhoneScanModal from './PhoneScanModal';

const PAYMENT_OPTIONS = [
  { value: 'cash',    label: 'Cash' },
  { value: 'ewallet', label: 'E-Wallet' },
  { value: 'bank',    label: 'Bank Transfer' },
];

const ONLINE_RECEIVING_OPTIONS = [
  { value: 'gcash', label: 'GCash' },
  { value: 'bpi', label: 'BPI' },
  { value: 'maya', label: 'Maya' },
];

const EWALLET_OPTIONS = [
  { value: 'gcash',      label: 'GCash' },
  { value: 'maya',       label: 'Maya (PayMaya)' },
  { value: 'shopeepay',  label: 'ShopeePay' },
  { value: 'grabpay',    label: 'GrabPay' },
  { value: 'other',      label: 'Other E-Wallet' },
];

const BANK_OPTIONS = [
  { value: 'bdo',           label: 'BDO Unibank' },
  { value: 'bpi',           label: 'BPI (Bank of the Philippine Islands)' },
  { value: 'metrobank',     label: 'Metrobank' },
  { value: 'unionbank',     label: 'UnionBank' },
  { value: 'pnb',           label: 'PNB (Philippine National Bank)' },
  { value: 'securitybank',  label: 'Security Bank' },
  { value: 'landbank',      label: 'Landbank' },
  { value: 'rcbc',          label: 'RCBC' },
  { value: 'eastwest',      label: 'EastWest Bank' },
  { value: 'psbank',        label: 'Philippine Savings Bank (PSBank)' },
  { value: 'aub',           label: 'Asia United Bank (AUB)' },
  { value: 'bankofcommerce', label: 'Bank of Commerce' },
  { value: 'maybank',       label: 'Maybank Philippines' },
  { value: 'gotyme',        label: 'GoTyme Bank' },
  { value: 'maribank',      label: 'MariBank' },
  { value: 'cimb',          label: 'CIMB Bank Philippines' },
  { value: 'uno',           label: 'UNO Digital Bank' },
  { value: 'ownbank',       label: 'OwnBank' },
  { value: 'seabank',       label: 'SeaBank' },
  { value: 'other',         label: 'Other (Please Specify)' },
];

const fmt = (n) =>
  Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const expirationStatus = (date) => {
  if (!date) return { label: 'Valid', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
  const expiry = new Date(`${String(date).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(expiry.getTime())) return { label: 'Valid', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = Math.ceil((expiry.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
  if (days < 0) return { label: 'Expired', className: 'border-red-200 bg-red-50 text-red-600' };
  if (days <= 30) return { label: 'Expiring Soon', className: 'border-amber-200 bg-amber-50 text-amber-700' };
  return { label: 'Valid', className: 'border-emerald-200 bg-emerald-50 text-emerald-700' };
};

const formatExpiry = (date) => {
  if (!date) return '-';
  const value = new Date(`${String(date).slice(0, 10)}T00:00:00`);
  return Number.isNaN(value.getTime()) ? '-' : value.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const sortedBatches = (product) =>
  [...(product?.batches || [])].sort((a, b) => {
    const aDate = a.date_received || '9999-12-31';
    const bDate = b.date_received || '9999-12-31';
    return aDate.localeCompare(bDate) || String(a.batch_code || '').localeCompare(String(b.batch_code || ''));
  });

const plannedBatchDeductions = (product, quantity) => {
  let remaining = Number(quantity || 0);
  const deductions = [];
  for (const batch of sortedBatches(product)) {
    if (remaining <= 0) break;
    const available = Number(batch.quantity_available || 0);
    if (available <= 0) continue;
    const quantityUsed = Math.min(remaining, available);
    deductions.push({ ...batch, quantity_used: quantityUsed });
    remaining -= quantityUsed;
  }
  return deductions;
};

import { printReceiptPDF } from '../receiptPdfUtils';
import WalkInSaleReceiptModal from './WalkInSaleReceiptModal';

export { printReceiptPDF };

export default function WalkInSaleModal({ onClose, onSaved, initialCustomerName = '', hidePayment = false, appointmentId = null, editingSale = null, draftMode = false, overlayClassName = 'z-[120]' }) {
  const [products, setProducts] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [lines, setLines] = useState([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [customerName, setCustomerName] = useState(editingSale?.customer_name || initialCustomerName);
  const [paymentMethod, setPaymentMethod] = useState(editingSale?.payment_method || 'cash');
  const [paymentChannel, setPaymentChannel] = useState(editingSale?.payment_channel || '');
  const [paymentReceivedBy, setPaymentReceivedBy] = useState(editingSale?.payment_received_by || '');
  const [paymentChannelOther, setPaymentChannelOther] = useState('');
  const [referenceNumber, setReferenceNumber] = useState(editingSale?.reference_number || '');
  const [notes, setNotes] = useState(editingSale?.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [mobileTab, setMobileTab] = useState('products');
  const [sortBy, setSortBy] = useState('name_asc');
  const [savedSale, setSavedSale] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [phoneScanOpen, setPhoneScanOpen] = useState(false);
  const [hasCamera, setHasCamera] = useState(null); // null = checking, true/false = result
  const [productSearch, setProductSearch] = useState('');
  const searchInputRef = useRef(null);

  const needsChannel = paymentMethod === 'ewallet' || paymentMethod === 'bank';
  const channelOptions = paymentMethod === 'ewallet' ? EWALLET_OPTIONS : BANK_OPTIONS;

  const handlePaymentMethodChange = (val) => {
    setPaymentMethod(val);
    setPaymentChannel('');
    setPaymentChannelOther('');
    setReferenceNumber('');
    setPaymentReceivedBy('');
  };

  useEffect(() => {
    const load = async () => {
      try {
        const res = await apiGet('/api/admin/inventory?per_page=100', {
          headers: { 'x-skip-dedupe': 'true' },
        });
        const data = await res.json().catch(() => ({}));
        const items = Array.isArray(data?.data?.items) ? data.data.items : [];
        const editingQuantities = (editingSale?.items || []).reduce((acc, item) => {
          const id = item.inventory_id || item.product_id;
          if (id) acc[id] = (acc[id] || 0) + Number(item.quantity || item.quantity_used || 0);
          return acc;
        }, {});
        const editingProductIds = new Set(Object.keys(editingQuantities));
        const adjustedItems = items.map((item) => editingProductIds.has(item.id) && item.stock_quantity !== null
          ? { ...item, stock_quantity: Number(item.stock_quantity || 0) + Number(editingQuantities[item.id] || 0) }
          : item);
        setProducts(adjustedItems.filter((i) => editingProductIds.has(i.id) || (i.is_active && (i.stock_quantity === null || i.stock_quantity > 0))));
        const promoRes = await apiGet('/api/admin/promotions', { headers: { 'x-skip-dedupe': 'true' } });
        const promoPayload = await promoRes.json().catch(() => ({}));
        setPromotions(Array.isArray(promoPayload?.data) ? promoPayload.data : []);
      } finally {
        setLoadingProducts(false);
      }
    };
    load();
  }, [editingSale]);

  useEffect(() => {
    if (!editingSale || loadingProducts || products.length === 0 || lines.length > 0) return;
    const initialLines = (editingSale.items || [])
      .map((item) => {
        const product = products.find((p) => p.id === (item.inventory_id || item.product_id));
        if (!product) return null;
        const quantity = Number(item.quantity || item.quantity_used || 0);
        return { inventory_id: product.id, product, quantity, promotion_id: item.promotion_id || '' };
      })
      .filter(Boolean);
    setLines(initialLines);
  }, [editingSale, lines.length, loadingProducts, products]);

  useEffect(() => {
    const isMobileOrTablet = /android|ipad|iphone|ipod|mobile|tablet/i.test(navigator.userAgent);
    navigator.mediaDevices
      ?.enumerateDevices()
      .then((devices) => {
        const found = devices.some((d) => d.kind === 'videoinput');
        // iOS Safari returns videoinput entries but with empty labels before permission is granted.
        // If no devices found but we're on a mobile/tablet, assume camera exists.
        setHasCamera(found || isMobileOrTablet);
      })
      .catch(() => setHasCamera(isMobileOrTablet));
  }, []);

  const categories = useMemo(() => {
    const cats = [...new Set(products.map((p) => p.category).filter(Boolean))];
    return cats.sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    const base = products.filter((p) => {
      if (activeCategory && p.category !== activeCategory) return false;
      if (q) {
        const searchable = [
          p.item_name,
          p.item_id,
          p.barcode,
          p.category,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!searchable.includes(q)) return false;
      }
      return true;
    });
    return [...base].sort((a, b) => {
      switch (sortBy) {
        case 'name_asc':  return a.item_name.localeCompare(b.item_name);
        case 'name_desc': return b.item_name.localeCompare(a.item_name);
        case 'price_asc': return Number(a.selling_price) - Number(b.selling_price);
        case 'price_desc': return Number(b.selling_price) - Number(a.selling_price);
        default: return 0;
      }
    });
  }, [products, activeCategory, productSearch, sortBy]);

  const getQty = (id) => lines.find((l) => l.inventory_id === id)?.quantity || 0;

  const setQty = (product, delta) => {
    const id = product.id;
    const batchStock = (product.batches || []).reduce((sum, batch) => sum + Number(batch.quantity_available || 0), 0);
    const maxQty = product.stock_quantity ?? batchStock ?? 9999;
    setLines((prev) => {
      const existing = prev.find((l) => l.inventory_id === id);
      if (!existing) {
        if (delta < 1) return prev;
        return [...prev, { inventory_id: id, product, quantity: Math.min(maxQty, 1), promotion_id: '' }];
      }
      const next = Math.max(0, Math.min(maxQty, existing.quantity + delta));
      if (next === 0) return prev.filter((l) => l.inventory_id !== id);
      return prev.map((l) => (l.inventory_id === id ? { ...l, quantity: next } : l));
    });
  };

  const removeLine = (id) => setLines((prev) => prev.filter((l) => l.inventory_id !== id));

  const applicablePromotions = (line) => promotions.filter((promo) => (
    promo?.is_active !== false
    && (promo.inventoryItems || promo.inventory_items || []).some((item) => String(item.id) === String(line.inventory_id))
    && (!promo.starts_on || promo.starts_on <= new Date().toISOString().slice(0, 10))
    && (!promo.ends_on || promo.ends_on >= new Date().toISOString().slice(0, 10))
  ));
  const discountedUnitPrice = (line) => {
    const promo = applicablePromotions(line).find((item) => String(item.id) === String(line.promotion_id));
    return promo ? Math.max(0, promo.discount_type === 'percentage'
      ? Number(line.product.selling_price) * (1 - Number(promo.discount_value || 0) / 100)
      : promo.discount_type === 'fixed'
        ? Number(line.product.selling_price) - Number(promo.discount_value || 0)
        : Math.min(Number(line.product.selling_price), Number(promo.promotional_price || 0))) : Number(line.product.selling_price);
  };
  const total = lines.reduce((sum, l) => sum + discountedUnitPrice(l) * l.quantity, 0);
  const totalItems = lines.reduce((sum, l) => sum + l.quantity, 0);

  const searchScannedBarcode = (code) => {
    setProductSearch(String(code || '').trim());
    setMobileTab('products');
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (lines.length === 0) {
      setError('Add at least one product.');
      return;
    }
    if (!hidePayment && needsChannel && !paymentChannel) {
      setError('Please select a specific payment channel.');
      return;
    }
    if (!hidePayment && needsChannel && paymentChannel === 'other' && !paymentChannelOther.trim()) {
      setError('Please specify the payment channel.');
      return;
    }
    if (!hidePayment && needsChannel && !paymentReceivedBy) {
      setError('Please select where the payment was received.');
      return;
    }
    setSaving(true);
    setError('');
    if (draftMode) {
      const draftId = editingSale?.id || `draft-retail-${Date.now()}`;
      const draftSale = {
        ...(editingSale || {}),
        id: draftId,
        is_draft: true,
        customer_name: customerName.trim() || initialCustomerName || null,
        payment_method: null,
        payment_channel: null,
        reference_number: null,
        notes: notes.trim() || null,
        total_amount: total,
        items: lines.map((line) => ({
          id: `${draftId}-${line.inventory_id}`,
          inventory_id: line.inventory_id,
          product_id: line.inventory_id,
          product_name: line.product.item_name,
          item_snapshot_name: line.product.item_name,
          quantity: line.quantity,
          quantity_used: line.quantity,
          unit_price: line.product.selling_price,
          selling_price: line.product.selling_price,
          line_total: line.product.selling_price * line.quantity,
          subtotal: line.product.selling_price * line.quantity,
        })),
      };
      onSaved?.(draftSale);
      setSaving(false);
      return;
    }
    try {
      const res = await apiFetch(editingSale ? `/api/admin/walk-in-sales/${editingSale.id}` : '/api/admin/walk-in-sales', {
        method: editingSale ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointment_id:   appointmentId || editingSale?.appointment_id || null,
          customer_name:    customerName.trim() || null,
          payment_method:   hidePayment ? null : paymentMethod,
          payment_channel:  hidePayment ? null : (paymentChannel === 'other' ? (paymentChannelOther.trim() || null) : (paymentChannel || null)),
          payment_received_by: hidePayment || paymentMethod === 'cash' ? null : paymentReceivedBy,
          reference_number: hidePayment ? null : (referenceNumber.trim() || null),
          notes:            notes.trim() || null,
          items:   lines.map((l) => ({ inventory_id: l.inventory_id, quantity: l.quantity, promotion_id: l.promotion_id || null })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || data?.errors?.items?.[0] || (editingSale ? 'Failed to update sale.' : 'Failed to record sale.'));
      const saved = data?.data;
      if (hidePayment || editingSale) {
        onSaved?.(saved);
        return;
      }
      setSavedSale(saved);
    } catch (err) {
      setError(err?.message || (editingSale ? 'Failed to update sale.' : 'Failed to record sale.'));
    } finally {
      setSaving(false);
    }
  };

  if (savedSale) {
    return <WalkInSaleReceiptModal sale={savedSale} onDone={() => onSaved?.(savedSale)} />;
  }

  return (
    <>
    {scannerOpen && (
      <BarcodeScannerModal
        onScan={(code) => { setScannerOpen(false); searchScannedBarcode(code); }}
        onClose={() => setScannerOpen(false)}
      />
    )}
    {phoneScanOpen && (
      <PhoneScanModal
        onScan={(code) => { setPhoneScanOpen(false); searchScannedBarcode(code); }}
        onClose={() => setPhoneScanOpen(false)}
      />
    )}
    <div
      className={`fixed inset-0 ${overlayClassName} flex h-[100dvh] min-h-[100dvh] w-screen items-center justify-center bg-brand-dark/45 p-2 backdrop-blur-sm sm:p-4`}
      onClick={onClose}
    >
      <div
        className="flex h-[96dvh] sm:h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between bg-brand-teal px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2">
            <ShoppingCart size={16} className="text-white" strokeWidth={2.5} />
            <h2 className="text-base font-extrabold text-white">{draftMode ? (editingSale ? 'Edit Retail Purchase' : 'Retail Purchase') : (editingSale ? 'Edit Sale Supplies' : 'Walk-in Sale')}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
          >
            <X size={16} strokeWidth={2.8} />
          </button>
        </div>
        <div className="h-1 shrink-0 bg-white" />

        {/* Mobile tab bar */}
        <div className="flex shrink-0 border-b border-brand-teal/20 bg-white sm:hidden">
          <button
            type="button"
            onClick={() => setMobileTab('products')}
            className={`flex-1 py-2.5 text-xs font-bold transition-colors ${
              mobileTab === 'products'
                ? 'border-b-2 border-brand-teal text-brand-teal'
                : 'text-brand-dark-soft'
            }`}
          >
            Menu
          </button>
          <button
            type="button"
            onClick={() => setMobileTab('cart')}
            className={`relative flex-1 py-2.5 text-xs font-bold transition-colors ${
              mobileTab === 'cart'
                ? 'border-b-2 border-brand-teal text-brand-teal'
                : 'text-brand-dark-soft'
            }`}
          >
            Cart
            {totalItems > 0 && (
              <span className="ml-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-brand-teal text-[9px] font-bold text-white">
                {totalItems > 9 ? '9+' : totalItems}
              </span>
            )}
          </button>
        </div>

        {/* Body: two-panel layout */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {/* LEFT - Product browser */}
          <div
            className={`flex min-h-0 w-full flex-col border-r border-brand-teal/10 sm:flex sm:w-3/5 ${
              mobileTab === 'cart' ? 'hidden' : 'flex'
            }`}
          >
            {/* Category + sort dropdowns */}
            <div className="shrink-0 space-y-2 px-4 py-3">
              <div className="flex items-center gap-2 rounded-xl border border-brand-dark/10 bg-white px-3 py-2">
                <Search size={14} className="shrink-0 text-brand-dark-soft" strokeWidth={2.5} />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Search product or barcode..."
                  className="min-w-0 flex-1 bg-transparent text-xs font-semibold text-brand-dark placeholder:text-brand-dark-soft/60 focus:outline-none"
                />
                {productSearch && (
                  <button type="button" onClick={() => setProductSearch('')} className="shrink-0 text-brand-dark-soft hover:text-brand-dark">
                    <X size={13} strokeWidth={2.5} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => searchInputRef.current?.focus()}
                  title="Focus search for hardware scanner"
                  className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-[11px] font-bold text-brand-teal hover:bg-brand-teal/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ScanLine size={13} strokeWidth={2.5} />
                  Scan
                </button>
                <button
                  type="button"
                  onClick={() => setScannerOpen(true)}
                  disabled={hasCamera === false}
                  title={hasCamera === false ? 'No camera found on this device' : 'Scan with camera'}
                  className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-[11px] font-bold text-brand-teal hover:bg-brand-teal/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Camera size={13} strokeWidth={2.5} />
                  Camera
                </button>
                {!(/android|ipad|iphone|ipod|mobile|tablet/i.test(navigator.userAgent) ||
                  (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches)) && (
                  <button
                    type="button"
                    onClick={() => setPhoneScanOpen(true)}
                    title="Scan with phone"
                    className="inline-flex h-7 shrink-0 items-center gap-1 rounded-lg px-2 text-[11px] font-bold text-brand-teal hover:bg-brand-teal/10"
                  >
                    <Smartphone size={13} strokeWidth={2.5} />
                    Phone
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
              <SelectDropdown
                options={[
                  { value: '', label: 'All Categories' },
                  ...categories.map((cat) => ({ value: cat, label: cat })),
                ]}
                value={activeCategory}
                onChange={setActiveCategory}
              />
              <SelectDropdown
                options={[
                  { value: 'name_asc',   label: 'Name A-Z' },
                  { value: 'name_desc',  label: 'Name Z-A' },
                  { value: 'price_asc',  label: 'Price: Low to High' },
                  { value: 'price_desc', label: 'Price: High to Low' },
                ]}
                value={sortBy}
                onChange={setSortBy}
              />
              </div>
            </div>

            {/* Barcode not-found banner */}
            {error && error.includes('not found') && (
              <div className="mx-4 mb-0 mt-0 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700">
                {error}
              </div>
            )}

            {/* Product tiles */}
            <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
              {loadingProducts ? (
                <div role="status" aria-label="Loading retail products" className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <span className="sr-only">Loading retail products</span>
                  {Array.from({ length: 6 }, (_, index) => (
                    <div key={index} className="overflow-hidden rounded-xl border border-brand-teal/15 bg-white shadow-sm">
                      <SkeletonBlock className="aspect-[4/3] w-full rounded-none" />
                      <div className="space-y-2 p-3">
                        <SkeletonBlock className="h-4 w-4/5" />
                        <SkeletonBlock className="h-2.5 w-2/5" />
                        <div className="flex items-center justify-between gap-3 pt-1">
                          <SkeletonBlock className="h-4 w-20" />
                          <div className="flex items-center gap-1.5">
                            <SkeletonBlock className="h-6 w-6 rounded-full" />
                            <SkeletonBlock className="h-3 w-4" />
                            <SkeletonBlock className="h-6 w-6 rounded-full" />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredProducts.length === 0 ? (
                <p className="pt-10 text-center text-xs text-brand-dark-soft">
                  {productSearch ? `No products matching "${productSearch}".` : 'No products in this category.'}
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {filteredProducts.map((product) => {
                    const qty = getQty(product.id);
                    const batches = sortedBatches(product);
                    const batchStock = batches.reduce((sum, batch) => sum + Number(batch.quantity_available || 0), 0);
                    const maxQty = product.stock_quantity ?? batchStock ?? 9999;
                    const isMaxed = qty >= maxQty;
                    return (
                      <div
                        key={product.id}
                        className={`relative overflow-hidden rounded-xl border bg-white shadow-sm ${
                          qty > 0 ? 'border-brand-teal ring-2 ring-brand-teal/20' : 'border-brand-teal/15'
                        } ${isMaxed && qty === 0 ? 'opacity-60' : ''}`}
                      >
                        <div className="aspect-[4/3] w-full overflow-hidden bg-brand-teal/10">
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.item_name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-3xl font-extrabold text-brand-teal/40">
                              {product.item_name?.[0]?.toUpperCase()}
                            </div>
                          )}
                        </div>
                        {qty > 0 && (
                          <span className="absolute right-2 top-2 inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-brand-teal px-2 text-xs font-extrabold text-white shadow">
                            {qty}
                          </span>
                        )}
                        <div className="space-y-1 p-3">
                          <p className="line-clamp-2 min-h-[2.25rem] text-sm font-extrabold leading-snug text-brand-dark">{product.item_name}</p>
                          <p className="truncate text-[10px] font-semibold uppercase tracking-wide text-brand-dark-soft">{product.category || 'Product'}</p>
                          <div className="flex items-center justify-between gap-2 pt-0.5">
                            <p className="text-sm font-extrabold text-brand-teal-dark">PHP {fmt(product.selling_price)}</p>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => setQty(product, -1)}
                                disabled={qty === 0}
                                className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-brand-teal/30 text-brand-teal transition-colors hover:bg-brand-teal hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
                              >
                                <Minus size={10} strokeWidth={3} />
                              </button>
                              <span className="w-5 text-center text-xs font-extrabold text-brand-dark">{qty}</span>
                              <button
                                type="button"
                                onClick={() => setQty(product, 1)}
                                disabled={isMaxed}
                                className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-teal text-white transition-colors hover:bg-brand-teal-dark disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                <Plus size={10} strokeWidth={3} />
                              </button>
                            </div>
                          </div>
                          {!draftMode && (
                            <p className="text-right text-[9px] font-semibold text-brand-dark-soft">
                              {product.stock_quantity === null ? 'Open stock' : `${product.stock_quantity} in stock`}
                            </p>
                          )}
                          {!draftMode && batches.length > 0 && (
                            <div className="mt-2 overflow-hidden rounded-lg border border-brand-dark-light/70">
                              <div className="grid grid-cols-[1fr_54px_72px_70px] bg-brand-teal/5 px-2 py-1 text-[9px] font-bold uppercase text-brand-dark-soft">
                                <span>Batch</span>
                                <span className="text-right">Qty</span>
                                <span className="text-right">Expiry</span>
                                <span className="text-right">Status</span>
                              </div>
                              {batches.slice(0, 3).map((batch) => {
                                const status = expirationStatus(batch.expiration_date);
                                return (
                                  <div key={batch.id} className="grid grid-cols-[1fr_54px_72px_70px] items-center gap-1 border-t border-brand-dark-light/50 px-2 py-1 text-[9px]">
                                    <span className="truncate font-semibold text-brand-dark">{batch.batch_code || '-'}</span>
                                    <span className="text-right text-brand-dark-soft">{batch.quantity_available ?? 0}</span>
                                    <span className="text-right text-brand-dark-soft">{formatExpiry(batch.expiration_date)}</span>
                                    <span className={`justify-self-end rounded-full border px-1.5 py-0.5 font-bold ${status.className}`}>{status.label}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* RIGHT - Cart & checkout */}
          <form
            onSubmit={handleSubmit}
            className={`flex min-h-0 w-full flex-col bg-gray-50/60 sm:flex sm:w-2/5 ${
              mobileTab === 'products' ? 'hidden' : 'flex'
            }`}
          >
            <div className="shrink-0 px-4 pb-2 pt-4">
              <p className="text-[10px] font-extrabold uppercase tracking-wide text-brand-dark">
                Order Summary
              </p>
            </div>

            {/* Cart items */}
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 pb-2">
              {lines.length === 0 ? (
                <div className="flex h-28 flex-col items-center justify-center rounded-xl border border-dashed border-brand-teal/30">
                  <ShoppingBag size={22} className="mb-1 text-brand-teal/30" />
                  <p className="text-xs text-brand-dark-soft">No items yet</p>
                </div>
              ) : (
                lines.map((l) => {
                  const deductions = plannedBatchDeductions(l.product, l.quantity);
                  return (
                    <div
                      key={l.inventory_id}
                      className="rounded-xl border border-brand-teal/15 bg-white px-3 py-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-brand-dark">{l.product.item_name}</p>
                          <p className="text-[10px] text-brand-dark-soft">
                            PHP {fmt(discountedUnitPrice(l))} x {l.quantity}
                          </p>
                          {applicablePromotions(l).length > 0 && (
                            <SelectDropdown
                              value={l.promotion_id || ''}
                              onChange={(value) => setLines((prev) => prev.map((row) => row.inventory_id === l.inventory_id ? { ...row, promotion_id: value || '' } : row))}
                              options={[
                                { value: '', label: 'No promotion' },
                                ...applicablePromotions(l).map((promo) => ({ value: promo.id, label: promo.title })),
                              ]}
                              placeholder="No promotion"
                            />
                          )}
                        </div>
                        <p className="shrink-0 text-xs font-extrabold text-brand-teal-dark">
                          PHP {fmt(discountedUnitPrice(l) * l.quantity)}
                        </p>
                        <button
                          type="button"
                          onClick={() => removeLine(l.inventory_id)}
                          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-red-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <Trash2 size={11} strokeWidth={2.5} />
                        </button>
                      </div>
                      {!draftMode && deductions.length > 0 && (
                        <div className="mt-2 rounded-lg bg-brand-teal/5 px-2 py-1.5">
                          <p className="mb-1 text-[9px] font-bold uppercase tracking-wide text-brand-dark-soft">Batch deduction preview</p>
                          <div className="space-y-1">
                            {deductions.map((batch) => {
                              const status = expirationStatus(batch.expiration_date);
                              return (
                                <div key={batch.id} className="grid grid-cols-[1fr_42px_72px_72px] items-center gap-1 text-[9px]">
                                  <span className="truncate font-semibold text-brand-dark">{batch.batch_code || '-'}</span>
                                  <span className="text-right text-brand-dark-soft">-{batch.quantity_used}</span>
                                  <span className="text-right text-brand-dark-soft">{formatExpiry(batch.expiration_date)}</span>
                                  <span className={`justify-self-end rounded-full border px-1.5 py-0.5 font-bold ${status.className}`}>{status.label}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Subtotal row */}
            {lines.length > 0 && (
              <div className="flex shrink-0 items-center justify-between border-t border-brand-teal/10 px-4 py-2">
                <span className="text-xs font-bold text-brand-dark">Total</span>
                <span className="text-sm font-extrabold text-brand-teal-dark">PHP {fmt(total)}</span>
              </div>
            )}

            {/* Customer / payment fields */}
            <div className="shrink-0 space-y-2 border-t border-brand-teal/10 px-4 pb-4 pt-3">
              {error && !error.includes('not found') && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                  {error}
                </p>
              )}
              <div>
                <label className="mb-1 block text-[10px] font-bold text-brand-dark">
                  Customer Name{' '}
                  {!initialCustomerName && <span className="font-normal text-brand-dark-soft">(optional)</span>}
                </label>
                <input
                  type="text"
                  value={customerName}
                  onChange={(e) => !(initialCustomerName && !editingSale) && setCustomerName(e.target.value)}
                  readOnly={!!initialCustomerName && !editingSale}
                  placeholder="Walk-in customer"
                  className={`w-full rounded-xl border px-3 py-2 text-xs text-brand-dark focus:outline-none ${
                    initialCustomerName && !editingSale
                      ? 'border-brand-teal/20 bg-brand-teal-light/30 font-semibold'
                      : 'border-brand-teal/20 focus:border-brand-teal'
                  }`}
                />
              </div>

              {/* Payment fields - hidden when called from appointment context */}
              {!hidePayment && (
                <>
                  <div>
                    <label className="mb-1 block text-[10px] font-bold text-brand-dark">
                      Paid From Method
                    </label>
                    <SelectDropdown
                      options={PAYMENT_OPTIONS}
                      value={paymentMethod}
                      onChange={handlePaymentMethodChange}
                      className="w-full"
                    />
                  </div>

                  {needsChannel && (
                    <div>
                      <label className="mb-1 block text-[10px] font-bold text-brand-dark">
                        {paymentMethod === 'ewallet' ? 'Paid From E-Wallet' : 'Paid From Bank'}
                      </label>
                      <SelectDropdown
                        options={[{ value: '', label: `- Select ${paymentMethod === 'ewallet' ? 'E-Wallet' : 'Bank'} -` }, ...channelOptions]}
                        value={paymentChannel}
                        onChange={(val) => { setPaymentChannel(val); setPaymentChannelOther(''); }}
                        className="w-full"
                      />
                    </div>
                  )}

                  {needsChannel && paymentChannel === 'other' && (
                    <div>
                      <label className="mb-1 block text-[10px] font-bold text-brand-dark">
                        Please specify
                      </label>
                      <input
                        type="text"
                        value={paymentChannelOther}
                        onChange={(e) => setPaymentChannelOther(e.target.value)}
                        placeholder={paymentMethod === 'ewallet' ? 'e.g. ShopeePay, WeChat Pay...' : 'e.g. Allied Bank, CTBC...'}
                        maxLength={60}
                        className="w-full rounded-xl border border-brand-teal/20 px-3 py-2 text-xs text-brand-dark focus:border-brand-teal focus:outline-none"
                      />
                    </div>
                  )}

                  {needsChannel && <div>
                    <label className="mb-1 block text-[10px] font-bold text-brand-dark">
                      Paid To
                    </label>
                    <SelectDropdown
                      options={[{ value: '', label: '- Select Paid To -' }, ...ONLINE_RECEIVING_OPTIONS]}
                      value={paymentReceivedBy}
                      onChange={setPaymentReceivedBy}
                      className="w-full"
                    />
                  </div>}

                  {needsChannel && (
                    <div>
                      <label className="mb-1 block text-[10px] font-bold text-brand-dark">
                        Reference Number{' '}
                        <span className="font-normal text-brand-dark-soft">(optional)</span>
                      </label>
                      <input
                        type="text"
                        value={referenceNumber}
                        onChange={(e) => setReferenceNumber(e.target.value)}
                        placeholder="Transaction / reference code"
                        className="w-full rounded-xl border border-brand-teal/20 px-3 py-2 text-xs text-brand-dark focus:border-brand-teal focus:outline-none font-mono"
                      />
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="mb-1 block text-[10px] font-bold text-brand-dark">
                  Notes{' '}
                  <span className="font-normal text-brand-dark-soft">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any notes for this sale..."
                  className="w-full resize-none rounded-xl border border-brand-teal/20 px-3 py-2 text-xs text-brand-dark focus:border-brand-teal focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={saving || lines.length === 0}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-teal py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-teal-dark disabled:opacity-50"
              >
                {saving ? 'Processing...' : `${draftMode ? 'Save Purchase' : (editingSale ? 'Save Sale' : 'Record Sale')} - PHP ${fmt(total)}`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
    </>
  );
}
