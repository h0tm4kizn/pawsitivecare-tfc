import { Search } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AdminLoadState } from '../../../components/admin/AdminLoading';
import useMediaQuery from '../../../hooks/useMediaQuery';
import { useStaffStore } from '../../../stores/staffStore';
import { useAuthStore } from '../../../stores/authStore';
import AddStaffModal from './components/AddStaffModal';
import EditStaffModal from './components/EditStaffModal';
import ActionConfirmModal from './components/ActionConfirmModal';
import FilterSelect from './components/FilterSelect';
import StaffTable from './components/StaffTable';
import ViewStaffPanel from './components/ViewStaffPanel';
import StaffQrAttendanceScanner from './components/StaffQrAttendanceScanner';
import StaffManagementActions from './components/StaffManagementActions';
import StaffPage_MobileView from './mobile/StaffPage_MobileView';
import StaffSummaryCards from './StaffSummaryCards';
import useStaffActions from './hooks/useStaffActions';
import { formatStaffId } from './staffUiUtils';
import { STAFF_TYPES } from '../../../utils/staffTypes';

const STAFF_FILTER_DROPDOWN_OPTIONS = [
  { value: 'all', label: 'All Staff' },
  { value: STAFF_TYPES.FRONT_DESK, label: 'Front Desk' },
  { value: STAFF_TYPES.GROOMER, label: 'Groomer' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

let toastSeq = 0;

export default function StaffPage() {
  const isDesktop = useMediaQuery('(min-width: 1024px)');
  const user = useAuthStore((state) => state.user);
  const isAdmin = String(user?.role || '').toLowerCase() === 'admin';
  const staffList = useStaffStore((state) => state.staffList);
  const loading = useStaffStore((state) => state.loading);
  const refreshing = useStaffStore((state) => state.refreshing);
  const loadError = useStaffStore((state) => state.loadError);
  const search = useStaffStore((state) => state.search);
  const typeFilter = useStaffStore((state) => state.typeFilter);
  const setSearch = useStaffStore((state) => state.setSearch);
  const setTypeFilter = useStaffStore((state) => state.setTypeFilter);
  const fetchStaff = useStaffStore((state) => state.fetchStaff);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [actionTarget, setActionTarget] = useState(null);
  const [actionMenuFor, setActionMenuFor] = useState(null);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [searchValue, setSearchValue] = useState(search);
  const actionMenuRef = useRef(null);

  const addToast = useCallback((msg, type = 'success') => {
    const id = ++toastSeq;
    setToasts((prev) => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const { handleConfirmAction } = useStaffActions({
    addToast,
    fetchStaff,
    selectedStaff,
    setSelectedStaff,
    setActionTarget,
  });

  useEffect(() => { fetchStaff({ force: false }); }, [fetchStaff]);
  useEffect(() => { setSearchValue(search); }, [search]);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchValue), 220);
    return () => clearTimeout(timer);
  }, [searchValue, setSearch]);

  useEffect(() => {
    const onDocMouseDown = (event) => {
      if (actionMenuRef.current && !actionMenuRef.current.contains(event.target)) {
        setActionMenuFor(null);
      }
    };
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, []);

  useEffect(() => {
    if (!selectedStaff?.id) return;
    const updated = staffList.find((row) => row.id === selectedStaff.id);
    if (updated) {
      setSelectedStaff((prev) => (prev ? { ...updated, _formattedStaffId: prev._formattedStaffId } : null));
    }
  }, [staffList, selectedStaff?.id]);

  const totalStaff = staffList.length;
  const activeStaff = staffList.filter((s) => s.is_active).length;
  const inactiveStaff = staffList.filter((s) => !s.is_active).length;
  const frontDeskList = staffList.filter((s) => s.staff_type === STAFF_TYPES.FRONT_DESK);
  const groomerList = staffList.filter((s) => s.staff_type === STAFF_TYPES.GROOMER);
  const activeRate = totalStaff ? ((activeStaff / totalStaff) * 100).toFixed(1) : '0.0';

  const stats = {
    totalStaff,
    activeStaff,
    inactiveStaff,
    frontDeskCount: frontDeskList.length,
    groomerCount: groomerList.length,
    activeRate,
  };

  const filtered = useMemo(() => {
    let list = staffList;
    if (typeFilter === STAFF_TYPES.FRONT_DESK) list = list.filter((s) => s.staff_type === STAFF_TYPES.FRONT_DESK);
    else if (typeFilter === STAFF_TYPES.GROOMER) list = list.filter((s) => s.staff_type === STAFF_TYPES.GROOMER);
    else if (typeFilter === 'active') list = list.filter((s) => s.is_active);
    else if (typeFilter === 'inactive') list = list.filter((s) => !s.is_active);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (s) => String(s.name || '').toLowerCase().includes(q)
          || String(s.email || '').toLowerCase().includes(q)
          || String(s.display_id || '').toLowerCase().includes(q)
          || String(s.contact_number || '').toLowerCase().includes(q),
      );
    }

    return [...list].sort((a, b) => {
      const aTime = new Date(a?.created_at || 0).getTime();
      const bTime = new Date(b?.created_at || 0).getTime();
      if (aTime !== bTime) return bTime - aTime;

      const aId = formatStaffId(a, 0);
      const bId = formatStaffId(b, 0);
      const idCompare = bId.localeCompare(aId, undefined, { numeric: true, sensitivity: 'base' });
      if (idCompare !== 0) return idCompare;

      return String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' });
    });
  }, [staffList, typeFilter, search]);

  const openEdit = (staff) => {
    setActionMenuFor(null);
    setSelectedStaff(null);
    setEditTarget(staff);
  };

  const pickAction = (staff, action) => {
    setActionTarget({ ...staff, action });
    setSelectedStaff(null);
  };

  return (
    <>
      <div className="fixed right-4 top-4 z-[200] flex flex-col gap-2">
        {toasts.map((toast) => (
          <div key={toast.id} className={`rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-lg ${toast.type === 'error' ? 'bg-red-500' : 'bg-brand-teal'}`}>
            {toast.msg}
          </div>

        ))}
      </div>

      {!isDesktop ? (
        <StaffPage_MobileView
          loading={loading}
          refreshing={refreshing}
          onRetry={() => fetchStaff()}
          loadError={loadError}
          searchValue={searchValue}
          onSearchValue={setSearchValue}
          typeFilter={typeFilter}
          onTypeFilter={setTypeFilter}
          filterOptions={STAFF_FILTER_DROPDOWN_OPTIONS}
          rows={filtered}
          selectedStaff={selectedStaff}
          onSelectStaff={setSelectedStaff}
          onEditStaff={openEdit}
          onPickAction={pickAction}
          onAddStaff={() => setIsAddOpen(true)}
          onScanStaff={() => setIsQrScannerOpen(true)}
          isAdmin={isAdmin}
          stats={stats}
          staffOptions={staffList}
          addToast={addToast}
        />
      ) : (
        <section className="space-y-5 py-4 font-poppins">
          <AdminLoadState loading={refreshing} error={loadError} onRetry={() => fetchStaff()} />
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-extrabold text-brand-teal-dark">
                Staff <span className="text-brand-dark">Management</span>
              </h1>
              <p className="text-sm font-medium text-brand-dark-soft">Manage staff accounts and their system access permissions</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StaffManagementActions
                staff={staffList}
                onAddStaff={() => setIsAddOpen(true)}
                onAttendance={() => setIsQrScannerOpen(true)}
                canManage={isAdmin}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_400px]">
            <div className="space-y-4 xl:col-span-3">
              {isAdmin && <StaffSummaryCards stats={stats} staffLoading={loading} />}

              <div className="flex flex-wrap items-center gap-3">
                <div className="relative min-w-[160px] flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-dark-soft/60" />
                  <input
                    value={searchValue}
                    onChange={(event) => setSearchValue(event.target.value)}
                    placeholder="Search staff..."
                    className="w-full rounded-xl border border-brand-teal/30 bg-white py-2.5 pl-9 pr-4 text-sm text-brand-dark focus:border-brand-teal focus:outline-none"
                  />
                </div>
                <FilterSelect
                  value={typeFilter}
                  onChange={setTypeFilter}
                  options={STAFF_FILTER_DROPDOWN_OPTIONS}
                  widthClass="min-w-[170px]"
                />
              </div>

              <StaffTable
                error={loadError}
                loading={loading}
          refreshing={refreshing}
          onRetry={() => fetchStaff()}
                rows={filtered}
                selectedStaffId={selectedStaff?.id}
                onToggleSelect={(staff) => setSelectedStaff((prev) => (prev?.id === staff.id ? null : staff))}
                onEdit={openEdit}
                readOnly={!isAdmin}
                actionMenuFor={actionMenuFor}
                setActionMenuFor={setActionMenuFor}
                actionMenuRef={actionMenuRef}
                onPickAction={pickAction}
              />
            </div>

            <div className="hidden xl:block">
              <ViewStaffPanel staff={selectedStaff} onEdit={openEdit} addToast={addToast} readOnly={!isAdmin} />
            </div>
          </div>
        </section>
      )}

      <AddStaffModal
        isOpen={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        existingStaff={staffList}
        onSaved={async (msg, createdStaffId) => {
          addToast(msg);
          const refreshedStaff = await fetchStaff();
          if (createdStaffId) {
            const createdStaff = refreshedStaff?.find((row) => row.id === createdStaffId);
            if (createdStaff) setSelectedStaff(createdStaff);
          }
        }}
      />

      {isQrScannerOpen && <StaffQrAttendanceScanner onClose={() => setIsQrScannerOpen(false)} />}

      {editTarget && (
        <EditStaffModal
          staff={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={(msg) => { addToast(msg); setEditTarget(null); fetchStaff(); }}
        />
      )}

      {actionTarget && (
        <ActionConfirmModal
          staff={actionTarget}
          action={actionTarget.action}
          onClose={() => setActionTarget(null)}
          onConfirm={({ reason, action }) => handleConfirmAction({ target: actionTarget, reason, action })}
        />
      )}
    </>
  );
}
