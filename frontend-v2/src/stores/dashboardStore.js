import { create } from 'zustand';
import { adminGet } from '../api/adminData';
const monthInflightRequests = new Map();

const readAppointmentResponse = async (response) => {
  if ([502, 503, 504].includes(response.status)) {
    throw new Error('The appointment server is unavailable. Please try again shortly.');
  }
  let data;
  try {
    data = await response.clone().json();
  } catch {
    throw new Error(`The appointment server returned an invalid response (HTTP ${response.status}). Please try again.`);
  }
  if (!response.ok) {
    throw new Error(data?.message || 'Unable to load appointments.');
  }
  return data;
};

const toMonthStart = (date = new Date()) => new Date(date.getFullYear(), date.getMonth(), 1);
const toIsoDate = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const extractAppointments = (responseData) => {
  if (Array.isArray(responseData?.data?.data)) return responseData.data.data;
  if (Array.isArray(responseData?.data)) return responseData.data;
  if (Array.isArray(responseData?.appointments)) return responseData.appointments;
  if (Array.isArray(responseData)) return responseData;
  return [];
};

const getPaginationMeta = (responseData) => {
  const meta = responseData?.meta || responseData?.data?.meta || {};
  const currentPage = Number(meta?.current_page ?? responseData?.current_page ?? responseData?.data?.current_page ?? 1);
  const lastPage = Number(meta?.last_page ?? responseData?.last_page ?? responseData?.data?.last_page ?? 1);
  return {
    currentPage: Number.isFinite(currentPage) ? currentPage : 1,
    lastPage: Number.isFinite(lastPage) ? lastPage : 1,
  };
};

const formatServiceCategory = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized.includes('hotel')) return 'Hotel';
  if (normalized.includes('day')) return 'Daycare';
  if (normalized.includes('groom')) return 'Grooming';
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const getOwnerName = (item) => {
  const owner = item?.owner || item?.pet?.owner;
  if (!owner) return '—';
  const fullName = `${owner.first_name || ''} ${owner.last_name || ''}`.trim();
  return fullName || owner.name || '—';
};

const getServiceType = (item) => {
  const status = String(item?.status || '').toLowerCase();
  const serviceName = String(item?.service?.name || item?.service_name || item?.service || '').toLowerCase();
  const category = String(item?.service?.category || item?.service_category || '').toLowerCase();
  const raw = `${serviceName} ${category}`;

  if (status === 'completed') return 'completed';
  if (status.includes('cancel')) return 'cancelled';
  if (status === 'in_progress') return 'in_progress';
  if (raw.includes('groom')) return 'grooming';
  if (raw.includes('hotel') || raw.includes('suite')) return 'hotelsuite';
  if (raw.includes('day')) return 'daycare';
  return 'other';
};

const formatTime = (timeValue) => {
  const time = String(timeValue || '');
  if (!time) return '';
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  if (Number.isNaN(hour)) return '';
  return `${hour % 12 || 12}:${m} ${hour >= 12 ? 'PM' : 'AM'}`;
};

const normalizeAppt = (item, index) => {
  const rawDate = String(item?.appointment_date || item?.date || '').slice(0, 10);
  const dateLabel = rawDate
    ? new Date(`${rawDate}T00:00:00`).toLocaleDateString('en-US', { timeZone: 'Asia/Manila',  month: 'short', day: 'numeric', year: 'numeric' })
    : '';
  const serviceCategory = item?.service?.category || item?.service_category || '';

  return {
    _raw: item,
    id: item?.id || '—',
    displayId: item?.appointment_code || `#${String(index + 1).padStart(3, '0')}`,
    petId: item?.pet?.pet_id || '-',
    pet: item?.pet?.name || item?.pet_name || item?.pet || '—',
    owner: getOwnerName(item),
    service: item?.service?.name || item?.service_name || item?.service || '—',
    serviceCategory,
    serviceCategoryLabel: formatServiceCategory(serviceCategory),
    handledByName: item?.handledBy?.name || item?.handled_by?.name || item?.handled_by_user?.name || item?.handled_by_name || null,
    dateIso: rawDate,
    date: dateLabel,
    time: formatTime(item?.start_time || item?.time || ''),
    status: item?.status || 'pending',
    serviceType: getServiceType(item),
  };
};

export const useDashboardStore = create((set, get) => ({
  calendarMonth: toMonthStart(),
  selectedCalendarDate: toIsoDate(new Date()),
  calendarSearch: '',
  monthAppointments: [],
  pendingAppointments: [],
  monthCache: {},
  appointmentsLoading: false,
  appointmentsError: '',

  setCalendarMonth: (date) => {
    set({ calendarMonth: toMonthStart(date) });
  },

  setSelectedCalendarDate: (dateIso) => {
    set({ selectedCalendarDate: dateIso });
  },

  setCalendarSearch: (value) => {
    set({ calendarSearch: value });
  },

  goToPreviousMonth: () => {
    const current = get().calendarMonth;
    set({ calendarMonth: new Date(current.getFullYear(), current.getMonth() - 1, 1) });
  },

  goToNextMonth: () => {
    const current = get().calendarMonth;
    set({ calendarMonth: new Date(current.getFullYear(), current.getMonth() + 1, 1) });
  },

  goToCurrentMonth: () => {
    set({ calendarMonth: toMonthStart() });
  },

  loadMonthAppointments: async ({ force = false, silent = false } = {}) => {
    const month = get().calendarMonth;
    const startDate = toIsoDate(new Date(month.getFullYear(), month.getMonth(), 1));
    const endDate = toIsoDate(new Date(month.getFullYear(), month.getMonth() + 1, 0));
    const cacheKey = `${startDate}:${endDate}`;
    const cacheEntry = get().monthCache?.[cacheKey];

    if (!force && cacheEntry && Date.now() - cacheEntry.ts < 300_000) {
      set({
        monthAppointments: cacheEntry.items,
        pendingAppointments: cacheEntry.pendingItems || get().pendingAppointments,
        appointmentsLoading: silent ? get().appointmentsLoading : false,
        appointmentsError: '',
      });
      return;
    }

    if (!silent) {
      set({ appointmentsLoading: true, appointmentsError: '' });
    }

    try {
      const basePath = `/api/appointments?start_date=${startDate}&end_date=${endDate}&per_page=120`;
      const firstPageKey = `${cacheKey}:page:1`;
      const firstPageRequest = monthInflightRequests.get(firstPageKey) || adminGet(basePath);
      monthInflightRequests.set(firstPageKey, firstPageRequest);
      const response = await firstPageRequest.finally(() => monthInflightRequests.delete(firstPageKey));
      const data = await readAppointmentResponse(response);
      let rawItems = extractAppointments(data);
      const { currentPage, lastPage } = getPaginationMeta(data);

      if (lastPage > currentPage) {
        const pageRequests = [];
        for (let page = currentPage + 1; page <= lastPage; page += 1) {
          const pageKey = `${cacheKey}:page:${page}`;
          const pageRequest = monthInflightRequests.get(pageKey) || adminGet(`${basePath}&page=${page}`);
          monthInflightRequests.set(pageKey, pageRequest);
          pageRequests.push(pageRequest.finally(() => monthInflightRequests.delete(pageKey)));
        }
        const pageResponses = await Promise.all(pageRequests);
        for (const pageResponse of pageResponses) {
          const pageData = await readAppointmentResponse(pageResponse);
          rawItems = rawItems.concat(extractAppointments(pageData));
        }
      }

      const items = rawItems.map((item, index) => normalizeAppt(item, index));
      let pendingItems = get().pendingAppointments;
      try {
        const pendingResponse = await adminGet('/api/appointments?status=pending&per_page=120');
        const pendingData = await readAppointmentResponse(pendingResponse);
        pendingItems = extractAppointments(pendingData).map((item, index) => normalizeAppt(item, index));
      } catch {
        // Keep the calendar result available if the separate pending query fails.
      }
      set({
        monthAppointments: items,
        pendingAppointments: pendingItems,
        monthCache: {
          ...get().monthCache,
          [cacheKey]: { ts: Date.now(), items, pendingItems },
        },
        appointmentsLoading: silent ? get().appointmentsLoading : false,
        appointmentsError: '',
      });
    } catch (error) {
      set({
        appointmentsLoading: silent ? get().appointmentsLoading : false,
        appointmentsError: error.message || 'Unable to load appointments.',
      });
    }
  },
}));
