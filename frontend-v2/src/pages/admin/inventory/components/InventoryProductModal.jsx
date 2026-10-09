import { useEffect, useRef, useState } from 'react';
import { Camera, ImagePlus, Plus, ScanLine, Smartphone, Trash2, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import SelectDropdown from '../../../../components/reusable-ui/SelectDropdown';
import BarcodeScannerModal from './BarcodeScannerModal';
import InventoryProductImage from './InventoryProductImage';
import PhoneScanModal from './PhoneScanModal';

const inputClass = 'w-full rounded-xl border border-brand-teal/20 px-3 py-2 text-sm text-brand-dark focus:border-brand-teal focus:outline-none';
const nextBatchCode = (index) => `Batch - ${String(index + 1).padStart(4, '0')}`;

const newBatch = (index = 0) => ({
  id: null,
  clientId: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`,
  batch_code: nextBatchCode(index),
  date_received: '',
  expiration_date: '',
  quantity_available: '5',
});

export default function InventoryProductModal({
  mode = 'add',
  item = null,
  saving = false,
  error = '',
  categories = [],
  nextItemCode = '',
  onClose,
  onSave,
}) {
  const isEdit = mode === 'edit' || Boolean(item?.id);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [phoneScanOpen, setPhoneScanOpen] = useState(false);
  const [hardwareScanReady, setHardwareScanReady] = useState(false);
  const barcodeInputRef = useRef(null);

  const [form, setForm] = useState({
    item_name: '',
    category: '',
    barcode: '',
    cost_price: '80',
    selling_price: '100',
    description: '',
  });
  const [batches, setBatches] = useState([newBatch()]);

  useEffect(() => {
    if (isEdit && item) {
      const initialBatches = Array.isArray(item.batches) && item.batches.length > 0
        ? item.batches.map((batch, index) => ({
            id: batch.id || null,
            clientId: batch.id || `${Date.now()}-${index}`,
            batch_code: batch.batch_code || nextBatchCode(index),
            quantity_available: String(batch.quantity_available ?? 0),
            expiration_date: batch.expiration_date ? String(batch.expiration_date).slice(0, 10) : '',
            date_received: batch.date_received ? String(batch.date_received).slice(0, 10) : '',
          }))
        : [{
            id: null,
            clientId: 'initial',
            batch_code: nextBatchCode(0),
            quantity_available: String(item.stock_quantity ?? 0),
            expiration_date: '',
            date_received: '',
          }];

      setForm({
        item_name: item.item_name || '',
        category: item.category || '',
        barcode: item.barcode || '',
        cost_price: item.cost_price ?? '80',
        selling_price: item.selling_price ?? '',
        description: item.description || '',
      });
      setBatches(initialBatches);
      setImageFile(null);
      setImagePreview('');
    } else {
      setForm({
        item_name: '',
        category: '',
        barcode: '',
        cost_price: '80',
        selling_price: '100',
        description: '',
      });
      setBatches([newBatch()]);
      setImageFile(null);
      setImagePreview('');
    }
  }, [isEdit, item]);

  if (isEdit && !item) return null;

  const setField = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const handleImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setImageFile(file);
    const reader = new FileReader();
    reader.onload = (readerEvent) => setImagePreview(readerEvent.target?.result || '');
    reader.readAsDataURL(file);
    event.target.value = '';
  };

  const prepareHardwareScan = () => {
    setHardwareScanReady(true);
    barcodeInputRef.current?.focus();
    barcodeInputRef.current?.select();
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const preparedBatches = batches
      .filter((batch) => batch.quantity_available !== '')
      .map((batch, index) => ({
        id: batch.id || undefined,
        batch_code: batch.id ? batch.batch_code : (batch.batch_code || nextBatchCode(index)),
        quantity_available: Number(batch.quantity_available || 0),
        date_received: batch.date_received || null,
        expiration_date: batch.expiration_date || null,
      }));

    const totalStock = preparedBatches.reduce((sum, batch) => sum + Number(batch.quantity_available || 0), 0);

    const payload = {
      item_name: form.item_name.trim(),
      category: form.category.trim(),
      barcode: form.barcode.trim() || null,
      cost_price: form.cost_price,
      selling_price: form.selling_price,
      stock_quantity: preparedBatches.length === 0 ? null : totalStock,
      batches: preparedBatches,
      description: form.description.trim() || null,
    };

    if (isEdit) {
      onSave?.(item, payload, imageFile);
    } else {
      onSave?.(payload, imageFile);
    }
  };

  const costPrice = Number(form.cost_price || 0);
  const sellingPrice = Number(form.selling_price || 0);
  const profit = sellingPrice - costPrice;
  const margin = sellingPrice > 0 ? (profit / sellingPrice) * 100 : 0;
  const assignedItemCode = isEdit ? (item?.item_id || 'Auto-generated') : (nextItemCode || 'Will be assigned on save');
  const totalStock = batches.reduce((sum, batch) => sum + Number(batch.quantity_available || 0), 0);

  const previewItem = imagePreview
    ? { ...(item || {}), item_name: form.item_name || 'New product', image_url: imagePreview }
    : item || { item_name: form.item_name || 'New product' };

  const categoryOptions = [
    { value: '', label: 'Select category' },
    ...categories.map((row) => ({ value: row.category, label: row.category })),
  ];
  if (isEdit && item?.category && !categoryOptions.some((opt) => opt.value === item.category)) {
    categoryOptions.push({ value: item.category, label: item.category });
  }

  const isMobileOrTablet =
    typeof navigator !== 'undefined' &&
    (/android|ipad|iphone|ipod|mobile|tablet/i.test(navigator.userAgent) ||
      (typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches));

  const modal = (
    <>
      {scannerOpen && (
        <BarcodeScannerModal
          onScan={(code) => {
            setField('barcode', code);
            setHardwareScanReady(false);
            setScannerOpen(false);
          }}
          onClose={() => setScannerOpen(false)}
        />
      )}
      {phoneScanOpen && (
        <PhoneScanModal
          onScan={(code) => {
            setField('barcode', code);
            setHardwareScanReady(false);
            setPhoneScanOpen(false);
          }}
          onClose={() => setPhoneScanOpen(false)}
        />
      )}
      <div
        className="fixed inset-0 z-[85] flex h-[100dvh] min-h-[100dvh] w-screen items-center justify-center bg-brand-dark/40 p-4 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          className="flex max-h-[84vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between bg-brand-teal px-6 py-4">
            <h2 className="text-base font-extrabold text-white">{isEdit ? 'Edit Supply' : 'Add Supplies'}</h2>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25"
            >
              <X size={16} strokeWidth={2.8} />
            </button>
          </div>
          <div className="h-1 bg-white" />

          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-6 py-5 lg:grid-cols-[minmax(0,1fr)_300px]">
              {error && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600 lg:col-span-2">
                  {error}
                </p>
              )}

              <div className="space-y-4">
                <section className="space-y-4 rounded-xl border border-brand-teal/20 bg-white p-4">
                  <div>
                    <p className="text-sm font-bold text-brand-dark">Product Details</p>
                    <p className="text-[11px] text-brand-dark-soft">Add the product image, barcode, name, and category.</p>
                  </div>
                  <div className="rounded-xl border border-brand-teal/10 bg-brand-teal-light/10 p-3">
                  <label className="mb-2 block text-xs font-bold text-brand-dark">Product Image</label>
                  <div className="flex items-center gap-4">
                    <InventoryProductImage item={previewItem} variant="panel" />
                    <div className="min-w-0">
                      <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-brand-teal px-3 py-2 text-xs font-bold text-white hover:bg-brand-teal-dark">
                        <ImagePlus size={14} strokeWidth={2.5} />
                        {isEdit && item?.image_url ? 'Change Image' : 'Upload Image'}
                        <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                      </label>
                      <p className="mt-1 max-w-[260px] truncate text-[11px] text-brand-dark-soft">
                        {imageFile?.name || (isEdit && item?.image_url ? 'Keep current image' : 'No image selected')}
                      </p>
                    </div>
                  </div>
                  </div>

                <div className="space-y-3">
                  <Field label="Barcode">
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                      <input
                        ref={barcodeInputRef}
                        value={form.barcode}
                        onChange={(event) => {
                          setField('barcode', event.target.value);
                          setHardwareScanReady(false);
                        }}
                        onFocus={() => setHardwareScanReady(true)}
                        onBlur={() => setHardwareScanReady(false)}
                        placeholder={hardwareScanReady ? 'Ready for hardware scanner...' : 'Type or scan barcode'}
                        className={`${inputClass} ${
                          hardwareScanReady ? 'border-brand-teal bg-brand-teal/5 ring-2 ring-brand-teal/20' : ''
                        }`}
                      />
                      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-nowrap">
                        <button
                          type="button"
                          onClick={prepareHardwareScan}
                          className={`inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold transition-colors ${
                            hardwareScanReady
                              ? 'border-brand-teal bg-brand-teal text-white'
                              : 'border-brand-teal/30 bg-brand-teal/5 text-brand-teal hover:bg-brand-teal hover:text-white'
                          }`}
                        >
                          <ScanLine size={14} strokeWidth={2.5} />
                          {hardwareScanReady ? 'Ready' : 'Scan'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setScannerOpen(true)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-brand-teal/30 bg-brand-teal/5 px-3 py-2 text-xs font-bold text-brand-teal transition-colors hover:bg-brand-teal hover:text-white"
                        >
                          <Camera size={14} strokeWidth={2.5} />
                          Camera
                        </button>
                        {!isMobileOrTablet && (
                          <button
                            type="button"
                            onClick={() => setPhoneScanOpen(true)}
                            className="col-span-2 inline-flex items-center justify-center gap-1.5 rounded-xl border border-brand-teal/30 bg-brand-teal/5 px-3 py-2 text-xs font-bold text-brand-teal transition-colors hover:bg-brand-teal hover:text-white sm:col-span-1"
                          >
                            <Smartphone size={14} strokeWidth={2.5} />
                            Phone
                          </button>
                        )}
                      </div>
                    </div>
                    {hardwareScanReady && (
                      <p className="mt-1 text-[11px] font-semibold text-brand-teal">
                        Scan the product barcode with the hardware scanner now.
                      </p>
                    )}
                  </Field>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Product ID">
                      <input
                        value={assignedItemCode}
                        readOnly
                        className={`${inputClass} bg-brand-dark-light/40 text-brand-dark-soft`}
                      />
                    </Field>
                    <Field label="Product Name">
                      <input
                        required
                        value={form.item_name}
                        onChange={(event) => setField('item_name', event.target.value)}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Category">
                      <SelectDropdown
                        value={form.category}
                        onChange={(value) => setField('category', value)}
                        options={categoryOptions}
                        placeholder="Select category"
                        searchable
                        buttonClassName="rounded-xl border-brand-teal/20 bg-white px-3 py-2 text-sm shadow-none hover:border-brand-teal"
                      />
                    </Field>
                  </div>
                </div>
                </section>

                <section className="rounded-xl border border-brand-teal/20 bg-white p-4">
                  <div className="mb-3">
                    <p className="text-sm font-bold text-brand-dark">Pricing</p>
                    <p className="text-[11px] text-brand-dark-soft">Set the cost and selling price. Profit and margin are calculated automatically.</p>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Field label="Cost Price">
                      <input
                        required
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.cost_price}
                        onChange={(event) => setField('cost_price', event.target.value)}
                        className={inputClass}
                      />
                    </Field>
                    <Field label="Selling Price">
                      <input
                        required
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.selling_price}
                        onChange={(event) => setField('selling_price', event.target.value)}
                        className={inputClass}
                      />
                    </Field>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 rounded-xl bg-brand-teal-light/20 px-3 py-2.5 text-xs">
                    <div><p className="font-semibold text-brand-dark-soft">Profit</p><p className="mt-0.5 font-extrabold text-brand-dark">PHP {profit.toFixed(2)}</p></div>
                    <div><p className="font-semibold text-brand-dark-soft">Margin</p><p className="mt-0.5 font-extrabold text-brand-dark">{margin.toFixed(2)}%</p></div>
                  </div>
                </section>

                <div className="rounded-xl border border-brand-teal/20 bg-white p-4">
                  <div className="mb-3">
                    <div>
                      <p className="text-sm font-bold text-brand-dark">Stock &amp; Batches</p>
                      <p className="text-[11px] text-brand-dark-soft">
                        Add stock by received date and expiration date. Each row becomes a separate batch.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBatches((current) => [...current, newBatch(current.length)])}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand-teal px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-brand-teal-dark"
                    >
                      <Plus size={16} strokeWidth={2.7} />
                      Add Another Batch
                    </button>
                  </div>

                  <div className="space-y-2">
                    {batches.map((batch, index) => (
                      <div
                        key={batch.clientId}
                        className="grid gap-2 rounded-xl border border-brand-teal/15 bg-brand-teal-light/10 p-3 sm:grid-cols-[140px_minmax(0,1fr)_minmax(0,1fr)_86px_auto]"
                      >
                        <div>
                          <span className="mb-1 block text-xs font-bold text-brand-dark">Batch</span>
                          <div className="whitespace-nowrap rounded-xl border border-brand-teal/10 bg-white px-3 py-2 text-sm font-semibold text-brand-dark">
                            {batch.batch_code || nextBatchCode(index)}
                          </div>
                        </div>
                        <Field label="Received Date">
                          <input
                            type="date"
                            value={batch.date_received}
                            onChange={(event) =>
                              setBatches((current) =>
                                current.map((row) =>
                                  row.clientId === batch.clientId ? { ...row, date_received: event.target.value } : row
                                )
                              )
                            }
                            className={inputClass}
                          />
                        </Field>
                        <Field label="Expiration Date">
                          <input
                            type="date"
                            value={batch.expiration_date}
                            onChange={(event) =>
                              setBatches((current) =>
                                current.map((row) =>
                                  row.clientId === batch.clientId ? { ...row, expiration_date: event.target.value } : row
                                )
                              )
                            }
                            className={inputClass}
                          />
                        </Field>
                        <Field label="Stock">
                          <input
                            required
                            type="number"
                            min="0"
                            step="1"
                            value={batch.quantity_available}
                            onChange={(event) =>
                              setBatches((current) =>
                                current.map((row) =>
                                  row.clientId === batch.clientId
                                    ? { ...row, quantity_available: event.target.value }
                                    : row
                                )
                              )
                            }
                            className={inputClass}
                          />
                        </Field>
                        <div className="flex items-end">
                          <button
                            type="button"
                            onClick={() =>
                              setBatches((current) =>
                                current.length === 1
                                  ? current
                                  : current.filter((row) => row.clientId !== batch.clientId)
                              )
                            }
                            disabled={batches.length === 1}
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-red-200 bg-white text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label={`Remove Batch - ${String(index + 1).padStart(4, '0')}`}
                          >
                            <Trash2 size={15} strokeWidth={2.6} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <section className="rounded-xl border border-brand-teal/20 bg-white p-4">
                  <Field label="Description">
                    <textarea
                      value={form.description}
                      onChange={(event) => setField('description', event.target.value)}
                      rows={3}
                      className={`${inputClass} resize-none`}
                    />
                  </Field>
                </section>
              </div>

              <aside className="rounded-xl border border-brand-teal/15 bg-brand-teal-light/20 p-4 text-xs">
                <p className="text-sm font-bold text-brand-dark">Summary</p>
                <div className="mt-4 space-y-3">
                  <SummaryRow label="Product ID" value={assignedItemCode} />
                  <SummaryRow label="Product Name" value={form.item_name || '-'} />
                  <SummaryRow label="Barcode" value={form.barcode || '-'} />
                  <SummaryRow label="Category" value={form.category || '-'} />
                  <SummaryRow label="Cost" value={`PHP ${costPrice.toFixed(2)}`} />
                  <SummaryRow label="Price" value={`PHP ${sellingPrice.toFixed(2)}`} />
                  <div className="grid grid-cols-2 gap-2 border-t border-brand-teal/20 pt-3">
                    <div>
                      <p className="font-bold uppercase tracking-wide text-brand-dark-soft">Profit</p>
                      <p className="mt-1 text-base font-extrabold text-brand-dark">PHP {profit.toFixed(2)}</p>
                    </div>
                    <div>
                      <p className="font-bold uppercase tracking-wide text-brand-dark-soft">Margin</p>
                      <p className="mt-1 text-base font-extrabold text-brand-dark">{margin.toFixed(2)}%</p>
                    </div>
                  </div>
                  <div className="border-t border-brand-teal/20 pt-3">
                    <p className="font-bold uppercase tracking-wide text-brand-dark-soft">Batch</p>
                    <div className="mt-2 space-y-2">
                      {batches.map((batch, index) => (
                        <div key={batch.clientId} className="rounded-lg bg-white/70 px-3 py-2">
                          <p className="font-semibold text-brand-dark">
                            {batch.batch_code || nextBatchCode(index)}
                          </p>
                          <p className="text-brand-dark-soft">Received: {batch.date_received || '-'}</p>
                          <p className="text-brand-dark-soft">Exp: {batch.expiration_date || '-'}</p>
                          <p className="text-brand-dark-soft">Stock: {batch.quantity_available || '0'}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2 border-t border-brand-teal/20 pt-3">
                    {batches.map((batch, index) => (
                      <SummaryRow
                        key={batch.clientId}
                        label={`Stock ${String(index + 1).padStart(4, '0')}`}
                        value={batch.quantity_available || '0'}
                      />
                    ))}
                    <SummaryRow label="Overall Stock" value={String(totalStock)} />
                  </div>
                </div>
              </aside>
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-brand-dark-light px-6 py-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-brand-dark-light px-5 py-2.5 text-sm font-medium text-brand-dark-soft transition-colors hover:bg-brand-dark-light"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-brand-teal px-6 py-2.5 text-sm font-bold text-white hover:bg-brand-teal-dark disabled:opacity-60"
              >
                {saving ? 'Saving...' : isEdit ? 'Save Supply' : 'Add Item'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
  return typeof document !== 'undefined' ? createPortal(modal, document.body) : modal;
}

function Field({ label, children }) {
  return (
    <label className="min-w-0">
      <span className="mb-1 block text-xs font-bold text-brand-dark">{label}</span>
      {children}
    </label>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-brand-dark-soft">{label}</span>
      <span className="text-right font-semibold text-brand-dark">{value}</span>
    </div>
  );
}
