import { getAuthToken } from '../api/apiClient';
import { create } from 'zustand';
import { adminJson, loadAdminResource } from '../api/adminData';

const normalizeOwner = (o) => ({
  _raw: o || {},
  id: o?.id ?? '',
  display_id: o?.display_id ?? '',
  first_name: o?.first_name ?? '',
  last_name: o?.last_name ?? '',
  fullName: [o?.first_name, o?.last_name].filter(Boolean).join(' ').trim() || '',
  email: o?.email || '',
  phone: o?.phone || '',
  address: o?.address || '',
  address_unit_floor: o?.address_unit_floor ?? '',
  address_street: o?.address_street ?? '',
  address_barangay: o?.address_barangay ?? '',
  address_city: o?.address_city ?? '',
  address_province: o?.address_province ?? '',
  address_postal_code: o?.address_postal_code ?? '',
  address_country: o?.address_country ?? 'PH',
  is_active: o?.is_active !== undefined ? Boolean(o.is_active) : true,
  deactivation_reason: o?.deactivation_reason ?? '',
  pets: Array.isArray(o?.pets) ? o.pets : [],
  created_at: o?.created_at ?? '',
});

export const useCustomerStore = create((set, get) => ({
  owners: [],
  loading: true,
  refreshing: false,
  hasLoaded: false,
  cacheUser: null,
  loadError: '',
  search: '',
  filter: 'all',

  setSearch: (search) => set({ search }),
  setFilter: (filter) => set({ filter }),

  fetchOwners: async ({ force = true } = {}) => {
    const cacheUser = getAuthToken();
    if (get().cacheUser !== cacheUser) set({ cacheUser, owners: [], hasLoaded: false });
    set({ loading: !get().hasLoaded, refreshing: get().hasLoaded, loadError: '' });
    try {
      const rows = await loadAdminResource('customers', async () => {
        const data = await adminJson('/api/admin/owners?per_page=100');
        const raw = data?.data?.data ?? data?.data?.owners ?? data?.data ?? data?.owners ?? [];
        return (Array.isArray(raw) ? raw : []).map(normalizeOwner);
      }, { force });
      if (getAuthToken() !== cacheUser) return;
      set({ owners: rows, hasLoaded: true, loading: false, refreshing: false, loadError: '' });
    } catch (error) {
      set({ loading: false, refreshing: false, loadError: error.message || 'Unable to load customers.' });
    }
  },
}));
