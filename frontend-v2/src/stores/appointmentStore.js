import { create } from 'zustand';
import { apiFetch } from '../api/apiClient';
import { adminGet } from '../api/adminData';

let appointmentLoadVersion = 0;
import { useDashboardStore } from './dashboardStore';
import { notifyError, notifySuccess } from '../utils/notify';
import { formatSizeLabel } from '../utils/recordFormatters';
import { db } from '../utils/powersync/db';

const formatStatusUpdateError = (message = '') => {
  const raw = String(message || '').trim();
  if (/today'?s appointments?/i.test(raw)) {
    return 'This action is only allowed on the appointment date. Please use Check In when the pet arrives today.';
  }
  return raw || 'Unable to update appointment status. Please try again.';
};

const toIsoDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toMonthStart = (date = new Date()) => new Date(date.getFullYear(), date.getMonth(), 1);

const readLocalAppointments = async (range) => {
  let timer;
  try {
    return await Promise.race([
      loadAppointmentsFromPowerSync(range),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Local records are not ready.')), 2000); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};

const loadAppointmentsFromPowerSync = async ({ start, end, dateIso }) => {
  const params = [];
  const where = [];
  if (start && end) {
    where.push('a.appointment_date BETWEEN ? AND ?');
    params.push(start, end);
  } else if (dateIso) {
    where.push('a.appointment_date = ?');
    params.push(dateIso);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const rows = await db.getAll(
    `SELECT
       a.*,
       s.name AS service_name,
       s.category AS service_category,
       s.display_id AS service_display_id,
       p.name AS pet_name,
       o.first_name AS owner_first_name,
       o.last_name AS owner_last_name,
       hs.name AS suite_name
     FROM appointments a
     LEFT JOIN services s ON a.service_id = s.id
     LEFT JOIN pets p ON a.pet_id = p.id
     LEFT JOIN owners o ON a.booked_by_owner_id = o.id
     LEFT JOIN hotel_suites hs ON a.hotel_suite_id = hs.id
     ${whereSql}
     ORDER BY a.appointment_date ASC, a.start_time ASC`,
    params
  );

  return rows.map((row, index) =>
    normalizeAppointment({
      ...row,
      service: row.service_id ? {
        id: row.service_id,
        name: row.service_name || '',
        category: row.service_category || '',
        display_id: row.service_display_id || '',
      } : null,
      pet: row.pet_id ? {
        id: row.pet_id,
        name: row.pet_name || '',
        owner: {
          first_name: row.owner_first_name || '',
          last_name: row.owner_last_name || '',
        },
      } : null,
      hotel_suite: row.hotel_suite_id ? {
        id: row.hotel_suite_id,
        name: row.suite_name || '',
      } : null,
    }, index)
  );
};

const extractAppointments = (data) => {
  if (Array.isArray(data?.data?.data)) return data.data.data;
  if (Array.isArray(data?.appointments)) return data.appointments;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data)) return data;
  return [];
};

const formatTime = (value) => {
  const time = String(value || '');
  if (!time) return '';
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  if (Number.isNaN(hour)) return '';
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
};

const getOwnerName = (item) => {
  const owner = item?.owner || item?.pet?.owner;
  if (!owner) return '-';
  const full = `${owner.first_name || ''} ${owner.last_name || ''}`.trim();
  return full || owner.name || '-';
};

const getServiceType = (item) => {
  const status = String(item?.status || '').toLowerCase();
  const service = `${item?.service?.name || item?.service_name || item?.service || ''} ${item?.service?.category || item?.service_category || ''}`.toLowerCase();
  if (status === 'completed') return 'completed';
  if (status.includes('cancel')) return 'cancelled';
  if (status === 'in_progress') return 'in_progress';
  if (service.includes('groom')) return 'grooming';
  if (service.includes('hotel') || service.includes('suite')) return 'hotelsuite';
  if (service.includes('day')) return 'daycare';
  return 'other';
};

const getServiceDisplayName = (item) => {
  const category = String(item?.service?.category || item?.service_category || '').toLowerCase();
  const rawBaseService = item?.service?.name || item?.service_name || item?.service || '-';
  const baseService = String(rawBaseService).replace(/\s*\([^)]*\)\s*$/, '').trim();
  const suiteName = item?.hotel_suite?.name || item?.hotelSuite?.name || item?.suite?.name || '';
  const sizeLabel = formatSizeLabel(item?.size_label || '');

  if (category.includes('hotel') && suiteName) return suiteName;
  if ((category.includes('groom') || category.includes('day')) && sizeLabel) {
    return `${baseService} (${sizeLabel})`;
  }
  return baseService;
};

const isUuidLike = (value) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());

const currentYY = () => String(new Date().getFullYear()).slice(-2);

const getServiceTemplateId = (item) => {
  const category = String(item?.service?.category || item?.service_category || '').toLowerCase();
  const yy = currentYY();
  if (category.includes('groom')) return `GPKG${yy}00`;
  if (category.includes('hotel')) return `HPKG${yy}00`;
  if (category.includes('day')) return `DCPKG${yy}00`;
  return '-';
};

const getServiceDisplayId = (item) => {
  const category = String(item?.service?.category || item?.service_category || '').toLowerCase();
  const sizeLabel = String(item?.size_label || '').trim().toUpperCase();
  const candidates = [
    item?.service_display_id,
    item?.service?.display_id,
    item?.service_id_display,
    item?.service_code,
    item?.service?.package_code,
    item?.service?.display_code,
    item?.service?.service_code,
  ];
  const selected = candidates.find((value) => {
    const text = String(value || '').trim();
    return text && !isUuidLike(text);
  });
  const baseCode = selected || getServiceTemplateId(item);
  if ((category.includes('groom') || category.includes('day')) && sizeLabel) {
    return `${baseCode}-${sizeLabel}`;
  }
  return baseCode;
};

const normalizeAppointment = (item, index) => {
  const dateIso = String(item?.appointment_date || item?.date || '').slice(0, 10);
  const handledByStaff = item?.handledBy || item?.handled_by || item?.handled_by_user || null;
  const handledByName = handledByStaff?.name || handledByStaff?.display_name || null;
  return {
    _raw: item,
    id: item?.id || '-',
    displayId: item?.appointment_code || `#${String(index + 1).padStart(3, '0')}`,
    pet: item?.pet?.name || item?.pet_name || item?.pet || '-',
    owner: getOwnerName(item),
    service: getServiceDisplayName(item),
    serviceDisplayId: getServiceDisplayId(item),
    handledByName,
    dateIso,
    date: dateIso
      ? new Date(`${dateIso}T00:00:00`).toLocaleDateString('en-US', { timeZone: 'Asia/Manila',  month: 'short', day: 'numeric', year: 'numeric' })
      : '',
    time: formatTime(item?.start_time || item?.time || ''),
    status: item?.status || 'approved',
    serviceType: getServiceType(item),
    serviceCategory: item?.service?.category || item?.service_category || '',
  };
};

const patchStatusInList = (list, id, status, mergedRaw = null) =>
  list.map((item) => {
    if (item.id !== id) return item;
    const nextRaw = mergedRaw ? { ...item._raw, ...mergedRaw } : { ...item._raw, status };
    return {
      ...item,
      status,
      _raw: nextRaw,
      handledByName:
        nextRaw?.handledBy?.name ||
        nextRaw?.handled_by_user?.name ||
        nextRaw?.handled_by?.name ||
        item.handledByName ||
        null,
    };
  });

const DAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

const parseShopHours = (shopHours = {}) => {
  const parsed = {};
  DAY_KEYS.forEach((key) => {
    const value = String(shopHours?.[key] || 'Closed');
    if (!value || value.toLowerCase() === 'closed') {
      parsed[key] = { open: '09:00', close: '17:00', closed: true };
      return;
    }
    const match = value.match(/(\d{1,2}):(\d{2})\s*(AM|PM)\s*[-\u2013]\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (!match) {
      parsed[key] = { open: '09:00', close: '17:00', closed: false };
      return;
    }
    const [, h1, m1, p1, h2, m2, p2] = match;
    const to24 = (h, m, period) => {
      let hour = parseInt(h, 10);
      if (period.toUpperCase() === 'PM' && hour !== 12) hour += 12;
      if (period.toUpperCase() === 'AM' && hour === 12) hour = 0;
      return `${String(hour).padStart(2, '0')}:${m}`;
    };
    parsed[key] = { open: to24(h1, m1, p1), close: to24(h2, m2, p2), closed: false };
  });
  return parsed;
};

const toShopHoursPayload = (scheduleEdit = {}) => {
  const body = {};
  const raw = {};
  const to12 = (time) => {
    const [hh, mm] = String(time || '09:00').split(':');
    let hour = parseInt(hh, 10);
    const period = hour >= 12 ? 'PM' : 'AM';
    if (hour > 12) hour -= 12;
    if (hour === 0) hour = 12;
    return `${hour}:${mm} ${period}`;
  };

  DAY_KEYS.forEach((key) => {
    const row = scheduleEdit[key] || { open: '09:00', close: '17:00', closed: true };
    if (row.closed) {
      body[key] = 'Closed';
      raw[key] = { closed: true };
      return;
    }
    body[key] = `${to12(row.open)} - ${to12(row.close)}`;
    raw[key] = { open: row.open, close: row.close, closed: false };
  });

  return { ...body, _raw: raw };
};

export const useAppointmentStore = create((set, get) => ({
  view: 'calendar',
  search: '',
  statusFilter: 'all',
  serviceFilter: 'all',
  sortBy: 'date',
  currentMonth: toMonthStart(),
  selectedDateIso: toIsoDate(new Date()),
  monthAppointments: [],
  todayAppointments: [],
  monthCache: {},
  schedule: { shop_hours: {} },
  scheduleEdit: parseShopHours({}),
  hotelOverview: {
    hotel_total: 0,
    hotel_available: 0,
    hotel_occupied: 0,
    hotel_dogs: 0,
    hotel_cats: 0,
    hotel_species_counts: { dog: 0, cat: 0, unknown: 0 },
    cluster_breakdown: [],
  },
  quickStatusAppointmentId: null,
  activeStatsType: null,
  isManageHoursOpen: false,
  isBookCategoryPickerOpen: false,
  isBookAppointmentOpen: false,
  preSelectedDate: null,
  prefillPet: null,
  appointmentBookingCategory: null,
  hasLoaded: false,
  isLoading: false,
  isUpdatingStatus: false,
  isSavingSchedule: false,
  isSavingManageHours: false,
  error: '',

  setView: (view) => set({ view }),
  setSearch: (search) => set({ search }),
  setStatusFilter: (statusFilter) => set({ statusFilter }),
  setServiceFilter: (serviceFilter) => set({ serviceFilter }),
  setSortBy: (sortBy) => set({ sortBy }),
  setSelectedDateIso: (selectedDateIso) => set({ selectedDateIso }),
  setCurrentMonth: (date) => {
    const parsed = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(parsed.getTime())) return;
    set({ currentMonth: toMonthStart(parsed) });
  },
  setQuickStatusAppointmentId: (quickStatusAppointmentId) => set({ quickStatusAppointmentId }),
  openStatsModal: (activeStatsType) => set({ activeStatsType }),
  closeStatsModal: () => set({ activeStatsType: null }),
  openManageHours: () => set({ isManageHoursOpen: true }),
  closeManageHours: () => set({ isManageHoursOpen: false }),
  openBookAppointment: (preSelectedDate = null, prefillPet = null, appointmentBookingCategory = null) => {
    const category = String(appointmentBookingCategory || '').trim().toLowerCase();
    set({
      isBookCategoryPickerOpen: !category,
      isBookAppointmentOpen: Boolean(category),
      preSelectedDate,
      prefillPet,
      appointmentBookingCategory: category || null,
    });
  },
  selectBookAppointmentCategory: (appointmentBookingCategory) => set({
    isBookCategoryPickerOpen: false,
    isBookAppointmentOpen: true,
    appointmentBookingCategory: String(appointmentBookingCategory || '').trim().toLowerCase() || null,
  }),
  closeBookCategoryPicker: () => set({
    isBookCategoryPickerOpen: false,
    preSelectedDate: null,
    prefillPet: null,
    appointmentBookingCategory: null,
  }),
  closeBookAppointment: () => set({
    isBookCategoryPickerOpen: false,
    isBookAppointmentOpen: false,
    preSelectedDate: null,
    prefillPet: null,
    appointmentBookingCategory: null,
  }),
  setScheduleTime: (dayKey, field, value) => set((state) => ({
    scheduleEdit: {
      ...state.scheduleEdit,
      [dayKey]: {
        ...(state.scheduleEdit[dayKey] || { open: '09:00', close: '17:00', closed: false }),
        [field]: value,
      },
    },
  })),
  toggleScheduleClosed: (dayKey) => set((state) => ({
    scheduleEdit: {
      ...state.scheduleEdit,
      [dayKey]: {
        ...(state.scheduleEdit[dayKey] || { open: '09:00', close: '17:00', closed: false }),
        closed: !state.scheduleEdit?.[dayKey]?.closed,
      },
    },
  })),
  resetScheduleEdit: () => {
    const shopHours = get().schedule?.shop_hours || {};
    set({ scheduleEdit: parseShopHours(shopHours) });
  },
  goToPrevMonth: () => {
    const month = get().currentMonth;
    set({ currentMonth: new Date(month.getFullYear(), month.getMonth() - 1, 1) });
  },
  goToNextMonth: () => {
    const month = get().currentMonth;
    set({ currentMonth: new Date(month.getFullYear(), month.getMonth() + 1, 1) });
  },

  loadSchedule: async () => {
    try {
      const response = await adminGet('/api/clinic/schedule');
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return;
      const schedule = data?.data || { shop_hours: {} };
      set({
        schedule,
        scheduleEdit: parseShopHours(schedule?.shop_hours || {}),
      });
      return true;
    } catch {
      return false;
    }
  },

  loadHotelOverview: async () => {
    try {
      const response = await adminGet('/api/admin/dashboard/overview');
      const data = await response.json().catch(() => ({}));
      if (!response.ok) return;
      const overview = data?.data || {};
      set({
        hotelOverview: {
          hotel_total: Number(overview?.hotel_total || 0),
          hotel_available: Number(overview?.hotel_available || 0),
          hotel_occupied: Number(overview?.hotel_occupied || 0),
          hotel_dogs: Number(overview?.hotel_dogs || overview?.hotel_species_counts?.dog || 0),
          hotel_cats: Number(overview?.hotel_cats || overview?.hotel_species_counts?.cat || 0),
          hotel_species_counts: overview?.hotel_species_counts || { dog: 0, cat: 0, unknown: 0 },
          cluster_breakdown: Array.isArray(overview?.cluster_breakdown) ? overview.cluster_breakdown : [],
        },
      });
    } catch {
      set({
        hotelOverview: {
          hotel_total: 0,
          hotel_available: 0,
          hotel_occupied: 0,
          hotel_dogs: 0,
          hotel_cats: 0,
          hotel_species_counts: { dog: 0, cat: 0, unknown: 0 },
          cluster_breakdown: [],
        },
      });
    }
  },

  saveSchedule: async () => {
    const payload = toShopHoursPayload(get().scheduleEdit);
    set({ isSavingSchedule: true });
    try {
      const response = await apiFetch('/api/admin/clinic/shop-hours', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || 'Failed to save clinic schedule.');
      }
      set((state) => ({
        isSavingSchedule: false,
        schedule: {
          ...state.schedule,
          shop_hours: DAY_KEYS.reduce((acc, key) => {
            acc[key] = payload[key];
            return acc;
          }, {}),
        },
      }));
      return true;
    } catch (error) {
      set({ isSavingSchedule: false });
      notifyError(error.message || 'Unable to save clinic schedule. Please try again.');
      return false;
    }
  },

  saveManageHours: async ({ blockedDates }) => {
    const payloadShopHours = toShopHoursPayload(get().scheduleEdit);
    const cleanedBlockedDates = Array.from(
      new Set(
        (Array.isArray(blockedDates) ? blockedDates : [])
          .map((date) => String(date || '').trim())
          .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date)),
      ),
    ).sort();
    set({ isSavingManageHours: true });
    try {
      const requests = [
        apiFetch('/api/admin/clinic/shop-hours', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadShopHours),
        }),
        apiFetch('/api/admin/clinic/blocked-dates', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dates: cleanedBlockedDates }),
        }),
      ];
      const responses = await Promise.all(requests);
      const failedResponse = responses.find((response) => !response.ok);
      if (failedResponse) {
        const failedData = await failedResponse.json().catch(() => ({}));
        throw new Error(failedData?.message || 'Unable to save manage hours settings. Please try again.');
      }

      set((state) => ({
        isSavingManageHours: false,
        schedule: {
          ...state.schedule,
          blocked_dates: cleanedBlockedDates,
          shop_hours: DAY_KEYS.reduce((acc, key) => {
            acc[key] = payloadShopHours[key];
            return acc;
          }, {}),
        },
      }));
      return true;
    } catch (error) {
      set({ isSavingManageHours: false });
      notifyError(error?.message || 'Unable to save manage hours settings. Please try again.');
      return false;
    }
  },

  loadAppointments: async ({ force = false, search = get().search.trim() } = {}) => {
    const version = ++appointmentLoadVersion;
    const month = get().currentMonth;
    const todayIso = toIsoDate(new Date());
    const start = toIsoDate(new Date(month.getFullYear(), month.getMonth(), 1));
    const end = toIsoDate(new Date(month.getFullYear(), month.getMonth() + 1, 0));
    // Include search term in cache key so filtered results are cached separately
    // from the full month data, and clearing search triggers a fresh unfiltered fetch.
    const searchKey = search ? `:search:${search}` : '';
    const monthKey = `${start}:${end}${searchKey}`;
    const monthCacheEntry = get().monthCache?.[monthKey];
    const hasFreshMonth = !force && monthCacheEntry && Date.now() - monthCacheEntry.ts < 300_000;

    if (hasFreshMonth) {
      set({
        hasLoaded: true,
        monthAppointments: monthCacheEntry.items,
        todayAppointments: monthCacheEntry.items.filter((item) => item.dateIso === todayIso),
        isLoading: false,
        error: '',
      });
      return;
    }

    set({ isLoading: true, error: '' });

    try {
      let monthAppointments = hasFreshMonth ? monthCacheEntry.items : [];

      if (!hasFreshMonth) {
        // Fetch first page; if the month spans multiple pages, fetch the rest in parallel.
        const searchParam = search ? `&search=${encodeURIComponent(search)}` : '';
        const firstRes = await adminGet(`/api/appointments?start_date=${start}&end_date=${end}&per_page=300${searchParam}`);
        const firstData = await firstRes.json().catch(() => ({}));
        if (!firstRes.ok) {
          throw new Error(firstData?.message || 'Failed to load appointments.');
        }
        let rawItems = extractAppointments(firstData);

        // Parallel fetch of remaining pages (mirrors dashboardStore pattern)
        const meta = firstData?.meta || firstData?.data?.meta || {};
        const lastPage = Number(meta?.last_page ?? firstData?.last_page ?? firstData?.data?.last_page ?? 1);
        if (lastPage > 1) {
          const pageRequests = [];
          for (let page = 2; page <= lastPage; page += 1) {
            pageRequests.push(
              adminGet(`/api/appointments?start_date=${start}&end_date=${end}&per_page=300${searchParam}&page=${page}`)
                .then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data?.message || 'Unable to load appointments.'); return data; })
            );
          }
          const pageDataArr = await Promise.all(pageRequests);
          for (const pageData of pageDataArr) {
            rawItems = rawItems.concat(extractAppointments(pageData));
          }
        }

        monthAppointments = rawItems.map((item, index) => normalizeAppointment(item, index));


      }

      // Derive today's appointments from month data — no second API call needed.
      const todayAppointments = monthAppointments.filter((item) => item.dateIso === todayIso);

      if (version !== appointmentLoadVersion) return;
      set({
        hasLoaded: true,
        monthAppointments,
        todayAppointments,
        monthCache: {
          ...get().monthCache,
          [monthKey]: { ts: Date.now(), items: monthAppointments },
        },
        isLoading: false,
        error: '',
      });
    } catch (error) {
      if (version !== appointmentLoadVersion) return;
      try {
        const monthAppointments = await readLocalAppointments({ start, end });
        if (version !== appointmentLoadVersion) return;
        const todayAppointments = monthAppointments.filter((item) => item.dateIso === todayIso);
        set({
          hasLoaded: get().hasLoaded || monthAppointments.length > 0,
          monthAppointments: monthAppointments.length > 0 ? monthAppointments : get().monthAppointments,
          todayAppointments: monthAppointments.length > 0 ? todayAppointments : get().todayAppointments,
          isLoading: false,
          error: monthAppointments.length === 0
            ? (error.message || 'Failed to load appointments.')
            : '',
        });
      } catch {
        if (version !== appointmentLoadVersion) return;
        set({
          monthAppointments: get().monthAppointments,
          todayAppointments: get().todayAppointments,
          isLoading: false,
          error: error.message || 'Failed to load appointments.',
        });
      }
    }
  },

  updateAppointmentStatus: async (appointmentId, status, extra = {}) => {
    if (!appointmentId || get().isUpdatingStatus) return false;
    set({ isUpdatingStatus: true });
    try {
      const response = await apiFetch(`/api/appointments/${appointmentId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...extra }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.message || 'Failed to update appointment status.');
      }

      const payloadAppointment =
        data?.data?.appointment ||
        data?.appointment ||
        data?.data ||
        null;
      const finalStatus =
        (payloadAppointment && typeof payloadAppointment === 'object' && payloadAppointment.status) ||
        status;
      const mergedRaw = {
        ...(payloadAppointment && typeof payloadAppointment === 'object' ? payloadAppointment : {}),
        status: finalStatus,
        ...(extra?.deposit !== undefined ? { deposit: extra.deposit } : {}),
        ...(extra?.reference_number !== undefined ? { reference_number: extra.reference_number } : {}),
        ...(extra?.cancellation_reason !== undefined ? { cancellation_reason: extra.cancellation_reason } : {}),
        ...(extra?.handled_by ? { handled_by: extra.handled_by } : {}),
      };

      set((state) => ({
        monthAppointments: patchStatusInList(state.monthAppointments, appointmentId, finalStatus, mergedRaw),
        todayAppointments: patchStatusInList(state.todayAppointments, appointmentId, finalStatus, mergedRaw),
        quickStatusAppointmentId: null,
      }));

      // Patch the dashboard store in-memory instead of force-reloading from API.
      // This keeps the calendar in sync without triggering an extra network request.
      useDashboardStore.setState((dashState) => ({
        monthAppointments: patchStatusInList(
          dashState.monthAppointments,
          appointmentId,
          finalStatus,
          mergedRaw
        ),
      }));
      notifySuccess('Appointment status updated successfully.');
      return true;
    } catch (error) {
      notifyError(formatStatusUpdateError(error?.message));
      return false;
    } finally {
      set({ isUpdatingStatus: false });
    }
  },
}));
