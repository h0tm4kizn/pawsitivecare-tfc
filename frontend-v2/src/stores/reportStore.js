import { create } from 'zustand';
import { adminJson, loadAdminResource } from '../api/adminData';
import { normalizeStaffType } from '../utils/staffTypes';

const NOW       = new Date();
const CURR_YEAR = NOW.getFullYear();
const MONTHS    = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

const buildPeriods = (viewMode) =>
  viewMode === 'yearly' ? MONTHS : ['Week 1', 'Week 2', 'Week 3', 'Week 4'];

const pct = (value, total) =>
  total > 0 ? `${Math.round((Number(value || 0) / total) * 100)}%` : '0%';

const extractRows = (data) => {
  if (Array.isArray(data?.data?.data)) return data.data.data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.users)) return data.users;
  if (Array.isArray(data)) return data;
  return [];
};

const isStaffType = (value) => ['front_desk', 'groomer'].includes(normalizeStaffType(value));
const fetchPaginatedRows = async (path) => {
  const separator = path.includes('?') ? '&' : '?';
  const first = await adminJson(`${path}${separator}page=1`);
  const lastPage = Number(first?.data?.last_page || first?.last_page || 1);
  const pages = await Promise.all(Array.from({ length: Math.max(0, lastPage - 1) }, (_, i) => adminJson(`${path}${separator}page=${i + 2}`)));
  return [first, ...pages].flatMap(extractRows);
};
const fetchStaffReportRows = async (path) => {
  const first = await adminJson(`${path}&per_page=1000&page=1`);
  const lastPage = Number(first?.data?.last_page || 1);
  const pages = await Promise.all(Array.from({ length: Math.max(0, lastPage - 1) }, (_, i) => adminJson(`${path}&per_page=1000&page=${i + 2}`)));
  return { rows: [first, ...pages].flatMap(extractRows), summary: first?.summary || {} };
};
const SECTION_KEYS = ['appointments', 'customers', 'pets', 'services', 'staff', 'inventory'];
let reportVersion = 0;

function normalizeAppointments(apptJson, periods) {
      // Appointments
      const ad       = apptJson?.data || {};
      const apptPeriods = Array.isArray(ad.periods) ? ad.periods : [];
      const apptData = periods.map((period) => {
        const row       = apptPeriods.find((item) => item.period === period) || {};
        const total     = row.total     || 0;
        const pending   = row.pending   || 0;
        const approved  = row.approved  || 0;
        const inProgress = row.in_progress || 0;
        const completed = row.completed || 0;
        const cancelled = row.cancelled || 0;
        const staffRejections = row.staff_rejections || 0;
        const customerCancellations = row.customer_cancellations || 0;
        const noShow    = row.no_show || 0;
        const grooming  = row.grooming  || 0;
        const daycare   = row.daycare   || 0;
        const hotel     = row.hotel     || 0;
        return {
          period, total, pending, approved, in_progress: inProgress, completed, cancelled, staff_rejections: staffRejections, customer_cancellations: customerCancellations, no_show: noShow, grooming, daycare, hotel,
          pending_pct:   pct(pending, total),
          approved_pct:  pct(approved, total),
          in_progress_pct: pct(inProgress, total),
          completed_pct: pct(completed, total),
          cancelled_pct: pct(cancelled, total),
          no_show_pct:   pct(noShow, total),
          grooming_pct:  pct(grooming, total),
          daycare_pct:   pct(daycare, total),
          hotel_pct:     pct(hotel, total),
        };
      });


  return { apptData, snapshot: Boolean(apptJson?.from_cache) };
}

function normalizeCustomers(custJson, periods) {
      const cd       = custJson?.data || {};
      const custPeriods = Array.isArray(cd.periods) ? cd.periods : [];
      let runningCustomers = Number(cd.cumulative || 0) - Number(cd.new || 0);
      const custData = periods.map((period) => {
        const row = custPeriods.find((item) => item.period === period) || {};
        const newCustomers = row.new_customers || 0;
        runningCustomers += newCustomers;
        return {
          period,
          new_customers: newCustomers,
          cumulative: runningCustomers,
        };
      });
      custData.forEach((row) => {
        row.new_pct = pct(row.new_customers, row.cumulative);
      });


  return { custData, snapshot: Boolean(custJson?.from_cache) };
}

function normalizePets(petJson, periods) {
      // Pets
      const pd      = petJson?.data || {};
      const petPeriods = Array.isArray(pd.periods) ? pd.periods : [];
      const petData = periods.map((period) => {
        const row = petPeriods.find((item) => item.period === period) || {};
        return {
          period,
          total:  row.total  || 0,
          dogs:   row.dogs   || 0,
          cats:   row.cats   || 0,
          others: row.others || 0,
        };
      });
      petData.forEach((row) => {
        row.dogs_pct = pct(row.dogs, row.total);
        row.cats_pct = pct(row.cats, row.total);
        row.others_pct = pct(row.others, row.total);
      });


  return { petData, snapshot: Boolean(petJson?.from_cache) };
}

function normalizeServices(svcJson) {
      // Services
      const sd        = svcJson?.data || {};
      const byService = sd.by_service || [];
      const topAddons = sd.top_addons || [];
      const cancellationReasons = sd.cancellation_reasons || [];
      const totalSvc  = byService.reduce((n, s) => n + (s.total || 0), 0);
      const svcData   = byService.map((s) => ({
        service:   s.service_name || 'Unknown',
        category:  s.category || '',
        breakdownType: s.breakdown_type || 'package',
        total:     s.total || 0,
        completed: s.completed || 0,
        cancelled: s.cancelled || 0,
        pct:       totalSvc > 0 ? `${Math.round((s.total / totalSvc) * 100)}%` : '0%',
        icon:      s.category === 'grooming' ? 'fa-scissors' : s.category === 'hotel' ? 'fa-hotel' : 'fa-bone',
        tone:      s.category === 'grooming' ? 'teal' : s.category === 'hotel' ? 'orange' : 'dark',
      }));
      const addonData = topAddons.map((a) => ({
        name:     a.addon_name || 'Unknown',
        category: a.category || '',
        count:    a.count || 0,
      }));
      const serviceCancellationData = cancellationReasons.map((item) => ({
        reason: item.reason || 'No reason provided',
        cancellation_type: item.cancellation_type || 'unknown',
        count: Number(item.count || 0),
      }));


  return { svcData, addonData, serviceCancellationData, snapshot: Boolean(svcJson?.from_cache) };
}

function normalizeStaff(staffJson) {
  const staffData = (staffJson?.data?.by_staff || [])
    .filter((item) => isStaffType(String(item.staff_type || '').toLowerCase()))
    .map((item) => ({
      id: item.user_id,
      display_id: item.display_id,
      name: item.name || 'Unknown',
      email: item.email || '',
      staff_type: normalizeStaffType(item.staff_type),
      total: Number(item.total || 0),
      completed: Number(item.completed || 0),
      cancelled: Number(item.cancelled || 0),
    }));
  return { staffData, snapshot: Boolean(staffJson?.from_cache) };
}

function normalizeInventory(inventoryJson, salesRows) {
      const inventoryRows = Array.isArray(inventoryJson?.data?.items)
        ? inventoryJson.data.items
        : extractRows(inventoryJson);
      const inventoryData = inventoryRows.map((item) => ({
        id: item.id || '',
        code: item.item_id || item.item_code || item.code || '',
        name: item.name || item.item_name || 'Unknown',
        category: item.category?.name || item.category || '',
        stock: Number(item.current_stock ?? item.stock_quantity ?? item.stock ?? 0),
        reorderLevel: Number(item.reorder_level ?? item.minimum_stock ?? 0),
        sellingPrice: Number(item.selling_price ?? item.price ?? 0),
        costPrice: Number(item.cost_price ?? 0),
        status: item.is_active === false || item.is_active === 0 ? 'Inactive' : 'Active',
      }));

      const itemSales = new Map();
      salesRows.forEach((sale) => {
        (sale.items || sale.supply?.supply_items || []).forEach((item) => {
          const name = item.item_snapshot_name || item.product_name || 'Unknown';
          const itemId = item.inventory_id || item.product_id || '';
          const key = itemId ? `id:${itemId}` : `name:${name}`;
          const quantity = Number(item.quantity ?? item.quantity_used ?? 0);
          const revenue = Number(item.subtotal ?? item.line_total ?? 0);
          const cost = Number(item.cost_price_snapshot ?? 0) * quantity;
          const current = itemSales.get(key) || { id: itemId, name, units: 0, revenue: 0, profit: 0 };
          current.units += quantity;
          current.revenue += revenue;
          current.profit += revenue - cost;
          itemSales.set(key, current);
        });
      });
      const inventorySalesData = [...itemSales.values()].sort((a, b) => b.units - a.units || b.revenue - a.revenue);
      const inventorySalesSummary = {
        units: inventorySalesData.reduce((sum, item) => sum + item.units, 0),
        revenue: inventorySalesData.reduce((sum, item) => sum + item.revenue, 0),
        profit: inventorySalesData.reduce((sum, item) => sum + item.profit, 0),
        bestSeller: inventorySalesData[0]?.name || '-',
      };


  return { inventoryData, inventorySalesData, inventorySalesSummary };
}

export const useReportStore = create((set, get) => ({
  // ── filter state ───────────────────────────────────────────────────────────
  viewMode: 'monthly',
  selYear:  CURR_YEAR,
  selMonth: NOW.getMonth(),

  // ── data ──────────────────────────────────────────────────────────────────
  apptData:  [],
  custData:  [],
  petData:   [],
  svcData:   [],
  addonData: [],
  serviceCancellationData: [],
  staffData: [],
  staffAttendanceSummary: {},
  staffOverviewRows: [],
  staffAttendanceRows: [],
  staffCommissionRows: [],
  staffReportFilters: { staffId: 'all', staffType: 'all', serviceId: 'all', status: 'all', appointmentStatus: 'all', from: '', to: '' },
  inventoryData: [],
  inventorySalesData: [],
  inventorySalesSummary: { units: 0, revenue: 0, profit: 0, bestSeller: '-' },

  loading: false,
  error: '',
  offlineSnapshot: false,
  snapshotMessage: '',
  sections: {},
  setViewMode: viewMode => { set({ viewMode }); get().fetchReports(); },
  setSelYear: selYear => { set({ selYear }); get().fetchReports(); },
  setSelMonth: selMonth => { set({ selMonth }); get().fetchReports(); },
  setStaffReportFilters: patch => set(state => ({ staffReportFilters: { ...state.staffReportFilters, ...patch } })),

  fetchReports: async ({ force = false, section } = {}) => {
    const version = ++reportVersion;
    const { viewMode, selYear, selMonth } = get();
    const periods = buildPeriods(viewMode);
    const mode = viewMode === 'yearly' ? 'yearly' : 'monthly';
    const base = `year=${selYear}&view=${mode}${mode === 'monthly' ? `&month=${selMonth + 1}` : ''}`;
    const start = mode === 'yearly' ? `${selYear}-01-01` : `${selYear}-${String(selMonth + 1).padStart(2, '0')}-01`;
    const end = mode === 'yearly' ? `${selYear}-12-31` : `${selYear}-${String(selMonth + 1).padStart(2, '0')}-${new Date(selYear, selMonth + 1, 0).getDate()}`;
    const json = path => adminJson(`/api/reports/${path}?${base}`);
    const loaders = {
      appointments: async () => normalizeAppointments(await json('appointment-summary'), periods),
      customers: async () => normalizeCustomers(await json('customer-registrations'), periods),
      pets: async () => normalizePets(await json('pet-registrations'), periods),
      services: async () => normalizeServices(await json('service-usage')),
      staff: async () => {
        const [activity, attendance, commissions] = await Promise.all([
          json('staff-activity'),
          fetchStaffReportRows(`/api/reports/staff-attendance?${base}`),
          fetchStaffReportRows(`/api/reports/commissions?${base}`),
        ]);
        const attendanceByStaff = new Map();
        for (const row of attendance.rows) {
          const entry = attendanceByStaff.get(row.staff_id) || { records: 0, completed: 0, days: new Set(), seconds: 0 };
          entry.records++;
          if (row.date) entry.days.add(row.date);
          if (row.status === 'completed') {
            entry.completed++;
            entry.seconds += Number(row.duration_seconds || 0);
          }
          attendanceByStaff.set(row.staff_id, entry);
        }
        const commissionByStaff = new Map();
        for (const row of commissions.rows) {
          const entry = commissionByStaff.get(row.staff_id) || { count: 0, amount: 0 };
          entry.count++;
          entry.amount += Number(row.commission_amount || 0);
          commissionByStaff.set(row.staff_id, entry);
        }
        const staffOverviewRows = (activity?.data?.by_staff || []).map((staff) => {
          const shifts = attendanceByStaff.get(staff.user_id);
          const earnings = commissionByStaff.get(staff.user_id);
          return {
            id: staff.user_id,
            displayId: staff.display_id || '—',
            name: staff.name,
            attendanceRecords: shifts?.records || 0,
            completedShifts: shifts?.completed || 0,
            daysWorked: shifts?.days.size || 0,
            hours: Number((Number(shifts?.seconds || 0) / 3600).toFixed(2)),
            commissionRecords: earnings?.count || 0,
            commissionAmount: Number((earnings?.amount || 0).toFixed(2)),
          };
        });
        return { ...normalizeStaff(activity), staffAttendanceSummary: attendance.summary, staffOverviewRows, staffAttendanceRows: attendance.rows, staffCommissionRows: commissions.rows };
      },
      inventory: async () => {
        const [inventory, sales] = await Promise.all([
          loadAdminResource('report-inventory', () => adminJson('/api/admin/inventory?all=1'), { force }),
          fetchPaginatedRows(`/api/admin/walk-in-sales?start_date=${start}&end_date=${end}&per_page=100`),
        ]);
        return normalizeInventory(inventory, sales);
      },
    };
    // Each section publishes its result immediately and keeps its own error.
    // Include unfinished sections when retrying so a newer run cannot strand them.
    const keys = section ? SECTION_KEYS.filter(key => key === section || get().sections[key]?.loading) : SECTION_KEYS;
    set(state => ({ loading: true, sections: { ...state.sections, ...Object.fromEntries(keys.map(key => [key, { ...state.sections[key], loading: true, error: '' }])) } }));
    await Promise.all(keys.map(async key => {
      try {
        const result = await loadAdminResource(`report:${base}:${key}`, loaders[key], { force: force && (!section || section === key) });
        if (version !== reportVersion) return;
        const { snapshot, ...data } = result;
        set(state => ({ ...data, sections: { ...state.sections, [key]: { loading: false, loaded: true, error: '', snapshot, period: base } } }));
      } catch (error) {
        if (version !== reportVersion) return;
        set(state => ({ sections: { ...state.sections, [key]: { ...state.sections[key], loading: false, error: error.message || 'Unable to load this report.' } } }));
      }
    }));
    if (version !== reportVersion) return;
    const snapshot = Object.values(get().sections).some(value => value.snapshot);
    set({ loading: false, offlineSnapshot: snapshot, snapshotMessage: snapshot ? 'Offline snapshot: report data may be stale until reconnect.' : '' });
  },
}));

export { MONTHS, buildPeriods };
