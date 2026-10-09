import { getAuthToken } from '../api/apiClient';
import { create } from 'zustand';
import { normalizeStaffType } from '../utils/staffTypes';
import { adminJson, loadAdminResource } from '../api/adminData';

const extractStaffRows = (data) => {
  if (Array.isArray(data?.data?.data)) return data.data.data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.users)) return data.users;
  if (Array.isArray(data)) return data;
  return [];
};

const normalizeStaff = (item) => ({
  id: item?.id ?? '',
  display_id: item?.display_id ?? '',
  name: item?.name ?? '',
  email: item?.email ?? '',
  role: item?.role ?? 'staff',
  staff_type: normalizeStaffType(item?.staff_type),
  contact_number: item?.contact_number ?? item?.phone ?? '',
  is_active: Boolean(item?.is_active),
  status: item?.status ?? (item?.is_active ? 'Active' : 'Inactive'),
  deactivation_reason: item?.deactivation_reason ?? '',
  created_at: item?.created_at ?? '',
});

export const useStaffStore = create((set, get) => ({
  staffList: [],
  loading: true,
  refreshing: false,
  hasLoaded: false,
  cacheUser: null,
  loadError: '',
  search: '',
  typeFilter: 'all',

  setSearch: (search) => set({ search }),
  setTypeFilter: (typeFilter) => set({ typeFilter }),

  fetchStaff: async ({ force = true } = {}) => {
    const cacheUser = getAuthToken();
    if (get().cacheUser !== cacheUser) set({ cacheUser, staffList: [], hasLoaded: false });
    set({ loading: !get().hasLoaded, refreshing: get().hasLoaded, loadError: '' });
    try {
      const rows = await loadAdminResource('staff', async () => {
        const data = await adminJson('/api/admin/staff?per_page=100');
        return extractStaffRows(data).map(normalizeStaff).filter(user => user.role === 'admin' || user.role === 'staff');
      }, { force });
      if (getAuthToken() !== cacheUser) return;
      set({ staffList: rows, hasLoaded: true, loading: false, refreshing: false, loadError: '' });
      return rows;
    } catch (error) {
      set({ loading: false, refreshing: false, loadError: error.message || 'Unable to load staff.' });
      return null;
    }
  },
}));
