import { create } from 'zustand';
import { EMPTY_ITEM } from '../pages/customer/dashboard/bookingUtils';

const initialState = {
  step: 0,
  error: '',
  booked: false,
  serviceAssessments: {},
  petHealthStatus: {},
  hotelMonth: null,
  hotelUnavailableDates: new Set(),
  hotelClosedDates: new Set(),
  hotelCapacityByDate: {},
  bookingItems: [{ ...EMPTY_ITEM }],
  activeItemIndex: 0,
  form: { pet_id: '', special_instructions: '' },
};

const freshMonth = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
};

export const useCustomerBookingStore = create((set) => ({
  ...initialState,
  hotelMonth: freshMonth(),

  resetBookingState: ({
    step = 0,
    serviceAssessments = {},
    bookingItems = [{ ...EMPTY_ITEM }],
    activeItemIndex = 0,
    form = { pet_id: '', special_instructions: '' },
  } = {}) =>
    set({
      step,
      error: '',
      booked: false,
      serviceAssessments,
      petHealthStatus: {},
      hotelMonth: freshMonth(),
      hotelUnavailableDates: new Set(),
      hotelClosedDates: new Set(),
      hotelCapacityByDate: {},
      bookingItems,
      activeItemIndex,
      form,
    }),

  setStep: (updater) =>
    set((state) => ({
      step: typeof updater === 'function' ? updater(state.step) : updater,
    })),
  setError: (error) => set({ error }),
  setBooked: (booked) => set({ booked }),
  setServiceAssessments: (updater) =>
    set((state) => ({
      serviceAssessments: typeof updater === 'function' ? updater(state.serviceAssessments) : updater,
    })),
  setPetHealthStatus: (updater) =>
    set((state) => ({
      petHealthStatus: typeof updater === 'function' ? updater(state.petHealthStatus) : updater,
    })),
  setHotelMonth: (updater) =>
    set((state) => ({
      hotelMonth: typeof updater === 'function' ? updater(state.hotelMonth) : updater,
    })),
  setHotelUnavailableDates: (dates) => set({ hotelUnavailableDates: dates }),
  setHotelClosedDates: (dates) => set({ hotelClosedDates: dates }),
  setHotelCapacityByDate: (hotelCapacityByDate) => set({ hotelCapacityByDate }),
  setBookingItems: (updater) =>
    set((state) => ({
      bookingItems: typeof updater === 'function' ? updater(state.bookingItems) : updater,
    })),
  setActiveItemIndex: (updater) =>
    set((state) => ({
      activeItemIndex: typeof updater === 'function' ? updater(state.activeItemIndex) : updater,
    })),
  setForm: (updater) =>
    set((state) => ({
      form: typeof updater === 'function' ? updater(state.form) : updater,
    })),
  setItem: (index, fields) =>
    set((state) => ({
      bookingItems: state.bookingItems.map((it, i) => (i === index ? { ...it, ...fields } : it)),
    })),
}));
