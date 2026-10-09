import { AdminLoadState } from '../../../components/admin/AdminLoading';
import useAdminQuery from '../../../hooks/useAdminQuery';
import { adminJson } from '../../../api/adminData';
import { useEffect, useMemo, useState } from 'react';
import { BarChart2, Plus } from 'lucide-react';
import { apiFetch } from '../../../api/apiClient';
import useMediaQuery from '../../../hooks/useMediaQuery';
import { useSuppliesFeatureEnabled } from '../../../utils/featureFlags';
import InventoryAddModal from './components/InventoryAddModal';
import BarcodeScannerModal from './components/BarcodeScannerModal';
import InventoryDeleteModal from './components/InventoryDeleteModal';
import InventoryEditModal from './components/InventoryEditModal';
import InventoryPanel from './components/InventoryPanel';
import PhoneScanModal from './components/PhoneScanModal';
import InventorySalesReportModal from './components/InventorySalesReportModal';
import WalkInSaleModal from './components/WalkInSaleModal';
import InventoryStatsGrid from './components/InventoryStatsGrid';
import InventoryTable from './components/InventoryTable';
import InventoryToolbar from './components/InventoryToolbar';
import InventoryPage_MobileView from './mobile/InventoryPage_MobileView';
import { useAuthStore } from '../../../stores/authStore';
export default function InventoryPage({ _onNavigate, openWalkInSaleSignal = 0 }) {
  const user = useAuthStore((state) => state.user);
  const canManageInventory = String(user?.role || '').toLowerCase() === 'admin';
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const [suppliesEnabled] = useSuppliesFeatureEnabled();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [addingItem, setAddingItem] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deletingItem, setDeletingItem] = useState(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [phoneScanOpen, setPhoneScanOpen] = useState(false);
  const [savingAdd, setSavingAdd] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [addError, setAddError] = useState('');
  const [editError, setEditError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [salesReportOpen, setSalesReportOpen] = useState(false);
  const [walkInSaleOpen, setWalkInSaleOpen] = useState(false);

  useEffect(() => {
    if (suppliesEnabled && openWalkInSaleSignal > 0) {
      setWalkInSaleOpen(true);
    }
  }, [openWalkInSaleSignal, suppliesEnabled]);

  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => { setPage(1); }, [debouncedSearch, category]);
  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('per_page', '25');
  if (debouncedSearch) params.set('search', debouncedSearch);
  if (category) params.set('category', category);
  const queryString = params.toString();
  const inventoryQuery = useAdminQuery(`inventory:${queryString}`, async () => {
    const json = await adminJson(`/api/admin/inventory${queryString ? `?${queryString}` : ''}`);
    return json.data || {};
  }, {}, { enabled: suppliesEnabled });
  const [actionError, setError] = useState('');
  const { data: inventoryData, loading, refresh: loadInventory } = inventoryQuery;
  const error = actionError || inventoryQuery.error;
  const items = inventoryData.items || [];
  const stats = inventoryData.stats || {};
  const categories = inventoryData.categories || [];
  const pagination = inventoryData.pagination || { current_page: page, last_page: 1, total: items.length };
  const setItems = update => inventoryQuery.setData(data => ({ ...data, items: typeof update === 'function' ? update(data.items || []) : update }));
  useEffect(() => {
    const rows = inventoryData.items || [];
    setSelectedItem(current => rows.find(item => item.id === current?.id) || (isDesktop ? rows[0] : null));
  }, [inventoryData, isDesktop]);

  const subtitle = useMemo(() => {
    const total = Number(stats.total_products || 0);
    return `${total.toLocaleString('en-PH')} products tracked for service add-ons and standalone sales.`;
  }, [stats.total_products]);

  if (!suppliesEnabled) {
    return (
      <div className="px-4 pb-10 pt-4 sm:px-6 md:px-8">
        <div className="rounded-2xl border border-brand-dark-light bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-extrabold text-brand-dark">Supplies & Retail is turned off</p>
          <p className="mt-1 text-xs font-semibold text-brand-dark-soft">Turn it on from Admin Profile settings to use supplies, walk-in sales, and retail purchases.</p>
        </div>
      </div>
    );
  }

  const mergeUpdatedItem = (updatedItem) => {
    setItems((current) => current.map((row) => (row.id === updatedItem.id ? { ...row, ...updatedItem } : row)));
    setSelectedItem((current) => (current?.id === updatedItem.id ? { ...current, ...updatedItem } : current));
  };

  const uploadInventoryImage = async (item, imageFile) => {
    if (!imageFile) return item;
    if (!item?.id) throw new Error('Supplies item is missing after save.');

    const formData = new FormData();
    formData.append('image', imageFile);

    const imageResponse = await apiFetch(`/api/admin/inventory/${item.id}/image`, {
      method: 'POST',
      body: formData,
    });
    const imageData = await imageResponse.json().catch(() => ({}));
    if (!imageResponse.ok) throw new Error(imageData?.message || 'Failed to upload supplies image.');

    return imageData?.data?.item || { ...item, image_url: imageData?.data?.image_url };
  };

  const handleSaveAdd = async (payload, imageFile) => {
    setSavingAdd(true);
    setAddError('');
    setError('');

    try {
      const response = await apiFetch('/api/admin/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || 'Failed to add supplies item.');
      if (data?.queued) {
        setAddingItem(false);
        setError('Offline: supplies creation queued for sync.');
        await loadInventory({ silent: true });
        return;
      }

      const createdItem = await uploadInventoryImage(data?.data, imageFile);
      setAddingItem(false);
      setSelectedItem(createdItem);
      await loadInventory({ silent: true });
    } catch (exception) {
      setAddError(exception?.message || 'Failed to add supplies item.');
    } finally {
      setSavingAdd(false);
    }
  };

  const handleSaveEdit = async (item, payload, imageFile) => {
    if (!item?.id) return;

    setSavingEdit(true);
    setEditError('');
    setError('');

    try {
      const response = await apiFetch(`/api/admin/inventory/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || 'Failed to update supplies item.');
      if (data?.queued) {
        mergeUpdatedItem({ ...(item || {}), ...(payload || {}), updated_at: new Date().toISOString() });
        setEditingItem(null);
        setError('Offline: supplies update queued for sync.');
        return;
      }

      const updatedItem = await uploadInventoryImage(data?.data || item, imageFile);
      mergeUpdatedItem(updatedItem);
      setEditingItem(null);
      await loadInventory({ silent: true });
    } catch (exception) {
      setEditError(exception?.message || 'Failed to save supplies item.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (item) => {
    if (!item?.id) return;

    setDeleting(true);
    setDeleteError('');
    setError('');

    try {
      const response = await apiFetch(`/api/admin/inventory/${item.id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.message || 'Failed to delete supplies item.');

      setDeletingItem(null);
      setItems((current) => current.filter((row) => row.id !== item.id));
      setSelectedItem((current) => (current?.id === item.id ? null : current));

      if (data?.queued) {
        setError('Offline: supplies deletion queued for sync.');
        return;
      }

      await loadInventory({ silent: true });
    } catch (exception) {
      setDeleteError(exception?.message || 'Failed to delete supplies item.');
    } finally {
      setDeleting(false);
    }
  };

  const searchScannedBarcode = (code) => {
    const value = String(code || '').trim();
    if (!value) return;
    setCategory('');
    setSearch(value);
    setSelectedItem(null);
  };

  const modals = (
    <>
      {scannerOpen && (
        <BarcodeScannerModal
          onScan={(code) => {
            setScannerOpen(false);
            searchScannedBarcode(code);
          }}
          onClose={() => setScannerOpen(false)}
        />
      )}

      {phoneScanOpen && (
        <PhoneScanModal
          onScan={(code) => {
            setPhoneScanOpen(false);
            searchScannedBarcode(code);
          }}
          onClose={() => setPhoneScanOpen(false)}
        />
      )}

      {addingItem && canManageInventory && (
        <InventoryAddModal
          saving={savingAdd}
          error={addError}
          categories={categories}
          nextItemCode={stats.next_item_code}
          onClose={() => {
            if (!savingAdd) setAddingItem(false);
          }}
          onSave={handleSaveAdd}
        />
      )}

      {editingItem && canManageInventory && (
        <InventoryEditModal
          item={editingItem}
          saving={savingEdit}
          error={editError}
          categories={categories}
          onClose={() => {
            if (!savingEdit) setEditingItem(null);
          }}
          onSave={handleSaveEdit}
        />
      )}

      {deletingItem && canManageInventory && (
        <InventoryDeleteModal
          item={deletingItem}
          deleting={deleting}
          error={deleteError}
          onClose={() => {
            if (!deleting) setDeletingItem(null);
          }}
          onConfirm={handleDelete}
        />
      )}

      {walkInSaleOpen && (
        <WalkInSaleModal
          onClose={() => setWalkInSaleOpen(false)}
          onSaved={async () => {
            setWalkInSaleOpen(false);
            await loadInventory({ silent: true });
          }}
        />
      )}

      <InventorySalesReportModal
        isOpen={salesReportOpen}
        onClose={() => setSalesReportOpen(false)}
      />
    </>
  );

  if (!isDesktop) {
    return (
      <>
        <InventoryPage_MobileView
          loading={loading}
          refreshing={inventoryQuery.refreshing}
          onRetry={loadInventory}
          error={error}
          items={items}
          stats={stats}
          categories={categories}
          search={search}
          onSearch={setSearch}
          category={category}
          onCategoryChange={setCategory}
          selectedItem={selectedItem}
          onSelectItem={setSelectedItem}
          onScanSearch={() => setScannerOpen(true)}
          onPhoneSearch={() => setPhoneScanOpen(true)}
          onAddItem={canManageInventory ? () => {
            setAddError('');
            setAddingItem(true);
          } : undefined}
          onEditItem={canManageInventory ? (item) => {
            setEditError('');
            setEditingItem(item);
          } : undefined}
          onDeleteItem={canManageInventory ? (item) => {
            setDeleteError('');
            setDeletingItem(item);
          } : undefined}
          onOpenSalesReport={() => setSalesReportOpen(true)}
          pagination={pagination}
          onPageChange={setPage}
        />
        {modals}
      </>
    );
  }

  return (
    <div className="space-y-5 py-4">
      <AdminLoadState loading={inventoryQuery.refreshing || search.trim() !== debouncedSearch} error={error} onRetry={loadInventory} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-brand-teal-dark">
            Supplies <span className="text-brand-dark">Management</span>
          </h1>
          <p className="text-sm text-brand-dark-soft">{subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSalesReportOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-brand-teal bg-white px-5 py-2.5 text-sm font-semibold text-brand-teal-dark transition-colors hover:bg-brand-teal hover:text-white"
          >
            <BarChart2 size={16} strokeWidth={2.5} />
            Sales Supplies
          </button>
          <button
            type="button"
            onClick={() => {
              setAddError('');
              setAddingItem(true);
            }}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-teal px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-teal-dark"
          >
            <Plus size={16} strokeWidth={2.5} />
            Add Item
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px] 2xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-4">
          <InventoryStatsGrid loading={loading} stats={stats} items={items} />

          <InventoryToolbar
            search={search}
            onSearchChange={setSearch}
            category={category}
            onCategoryChange={setCategory}
            categories={categories}
            onScanSearch={() => setScannerOpen(true)}
            onPhoneSearch={() => setPhoneScanOpen(true)}
          />

          <InventoryTable
            items={items}
            loading={loading}
          refreshing={inventoryQuery.refreshing}
          onRetry={loadInventory}
            error={error}
            selectedItem={selectedItem}
            onSelectItem={setSelectedItem}
            pagination={pagination}
            onPageChange={setPage}
          />
        </div>

        <div className="hidden xl:block">
          <InventoryPanel
            item={selectedItem}
            onEdit={canManageInventory ? (item) => {
              setEditError('');
              setEditingItem(item);
            } : undefined}
            onDelete={canManageInventory ? (item) => {
              setDeleteError('');
              setDeletingItem(item);
            } : undefined}
          />
        </div>
      </div>

      {modals}
    </div>
  );
}
