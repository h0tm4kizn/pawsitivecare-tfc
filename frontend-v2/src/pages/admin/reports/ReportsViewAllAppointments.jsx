import { X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../../../api/apiClient';
import { AdminSkeleton } from '../../../components/admin/AdminLoading';
import SelectDropdown from '../../../components/reusable-ui/SelectDropdown';
import { formatStatusLabel } from '../../../utils/recordFormatters';

const getPetIdentifier = (pet) => pet?.pet_id || '';
const getPetName = (pet) => pet?.name || '-';
const normalizeStatus = (status) => String(status || '').toLowerCase().replace(/-/g, '_');
const getWeekOfMonthLabel = (date) => {
  if (!date) return 'Week 1';
  const day = new Date(`${date}T00:00:00`).getDate();
  return `Week ${Math.min(4, Math.max(1, Math.ceil(day / 7)))}`;
};
const formatTime = (value) => {
  if (!value) return '-';
  const [hours = '0', minutes = '00'] = String(value).split(':');
  const hour = Number(hours);
  return `${hour % 12 || 12}:${minutes} ${hour >= 12 ? 'PM' : 'AM'}`;
};

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'no_show', label: 'No Show' },
];
const CANCELLATION_TYPE_OPTIONS = [
  { value: 'all', label: 'All cancellation types' },
  { value: 'staff_rejection', label: 'Admin/Staff rejection' },
  { value: 'customer_cancellation', label: 'Customer cancellation' },
  { value: 'staff_cancellation', label: 'Admin/Staff cancellation' },
];
const WEEK_OPTIONS = [
  { value: 'all', label: 'All Weeks' },
  { value: 'Week 1', label: 'Week 1' },
  { value: 'Week 2', label: 'Week 2' },
  { value: 'Week 3', label: 'Week 3' },
  { value: 'Week 4', label: 'Week 4' },
];
const SORT_OPTIONS = [
  { value: 'week', label: 'Week / Date' },
  { value: 'status', label: 'Status / Date' },
];

const sortAppointments = (items, sortBy) => {
  const sorted = [...items];
  sorted.sort((a, b) => {
    if (sortBy === 'status') {
      const statusCompare = formatStatusLabel(a.status).localeCompare(formatStatusLabel(b.status));
      if (statusCompare !== 0) return statusCompare;
    }
    const dateCompare = String(a.appointment_date || '').localeCompare(String(b.appointment_date || ''));
    if (dateCompare !== 0) return dateCompare;
    return String(a.start_time || '').localeCompare(String(b.start_time || ''));
  });
  return sorted;
};

export default function ReportsViewAllAppointments({ isOpen, onClose, period, month, year }) {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [weekFilter, setWeekFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [cancellationTypeFilter, setCancellationTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('week');
  const [filtersOpen, setFiltersOpen] = useState(false);

  useEffect(() => {
    if (isOpen && month && year) {
      setWeekFilter(period && period !== 'All Weeks' ? period : 'all');
      setStatusFilter('all');
      setCancellationTypeFilter('all');
      setSortBy(period && period !== 'All Weeks' ? 'status' : 'week');
      setFiltersOpen(false);
      fetchAppointments();
    } else {
      setAppointments([]);
    }
  }, [isOpen, period, month, year]);

  const fetchAppointments = async () => {
    setLoading(true);
    setAppointments([]); // Reset to empty array
    try {
      const monthIndex = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].indexOf(month) + 1;
      
      const startDate = `${year}-${String(monthIndex).padStart(2, '0')}-01`;
      const lastDay = new Date(year, monthIndex, 0).getDate();
      const endDate = `${year}-${String(monthIndex).padStart(2, '0')}-${lastDay}`;

      const response = await apiFetch(`/api/appointments?start_date=${startDate}&end_date=${endDate}&per_page=1000`);
      const data = await response.json();

      // Handle paginated response format
      let appointmentsList = [];
      if (data && data.data) {
        // Check if it's paginated (has data.data)
        if (Array.isArray(data.data.data)) {
          appointmentsList = data.data.data;
        } else if (Array.isArray(data.data)) {
          appointmentsList = data.data;
        }
      } else if (Array.isArray(data)) {
        appointmentsList = data;
      }
      
      setAppointments(appointmentsList);
    } catch (error) {
      console.error('Error fetching appointments:', error);
      setAppointments([]);
    } finally {
      setLoading(false);
    }
  };

  const visibleAppointments = useMemo(() => {
    const filtered = appointments.filter((appt) => {
      const weekMatches = weekFilter === 'all' || getWeekOfMonthLabel(appt.appointment_date) === weekFilter;
      const normalized = normalizeStatus(appt.status);
      const statusMatches = statusFilter === 'all' ||
        (statusFilter === 'in_progress'
          ? ['in_progress', 'checkin', 'checked_in'].includes(normalized)
          : normalized === statusFilter);
      const typeMatches = cancellationTypeFilter === 'all'
        || normalizeStatus(appt.cancellation_type) === cancellationTypeFilter;
      return weekMatches && statusMatches && typeMatches;
    });
    return sortAppointments(filtered, sortBy);
  }, [appointments, weekFilter, statusFilter, cancellationTypeFilter, sortBy]);

  if (!isOpen) return null;

  const getStatusColor = (status) => {
    const normalized = String(status || '').toLowerCase().replace(/-/g, '_');
    if (normalized === 'completed') return 'text-emerald-600';
    if (normalized === 'cancelled') return 'text-red-600';
    if (normalized === 'no_show') return 'text-rose-700';
    if (normalized === 'in_progress' || normalized === 'checkin' || normalized === 'checked_in') return 'text-amber-700';
    if (normalized === 'approved') return 'text-blue-600';
    if (normalized === 'pending') return 'text-amber-600';
    return 'text-gray-600';
  };

  return (
    <div className="fixed inset-0 z-[320] flex items-center justify-center p-4 backdrop-blur-sm bg-brand-dark/40 h-[100dvh] min-h-[100dvh] w-screen">
      <div className="relative w-full max-w-5xl max-h-[90vh] overflow-hidden rounded-xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-brand-teal/10 bg-brand-teal px-6 py-4">
          <div>
            <h2 className="text-lg font-extrabold text-white">Appointments</h2>
            <p className="mt-0.5 text-xs font-semibold text-white/80">{month} {year} · {period}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-white transition-colors hover:bg-white/20"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto px-6 pb-5 pt-3" style={{ maxHeight: 'calc(90vh - 80px)' }}>
          {loading ? (
            <AdminSkeleton variant="table" label="Loading appointments" />
          ) : (
            <div className="space-y-3">
              <div className="relative flex justify-end">
                <button type="button" onClick={() => setFiltersOpen((open) => !open)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition-colors ${filtersOpen ? 'border-brand-teal bg-brand-teal text-white' : 'border-brand-teal/25 bg-white text-brand-teal hover:bg-brand-teal/10'}`}>
                  <i className="fa-solid fa-filter text-[11px]" />
                  Filter &amp; Sort
                </button>
                {filtersOpen && (
                  <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 grid w-[min(100%,760px)] grid-cols-1 gap-3 rounded-xl border border-brand-teal/20 bg-white p-4 shadow-xl sm:grid-cols-4">
                    <div><p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-brand-dark-soft">Week</p><SelectDropdown value={weekFilter} onChange={setWeekFilter} options={WEEK_OPTIONS} buttonClassName="!rounded-lg !border-brand-teal/20 !px-2.5 !py-1.5" textClassName="!text-xs !font-semibold" /></div>
                    <div><p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-brand-dark-soft">Status</p><SelectDropdown value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} buttonClassName="!rounded-lg !border-brand-teal/20 !px-2.5 !py-1.5" textClassName="!text-xs !font-semibold" /></div>
                    <div><p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-brand-dark-soft">Sort by</p><SelectDropdown value={sortBy} onChange={setSortBy} options={SORT_OPTIONS} buttonClassName="!rounded-lg !border-brand-teal/20 !px-2.5 !py-1.5" textClassName="!text-xs !font-semibold" /></div>
                    <div><p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-brand-dark-soft">Cancellation type</p><SelectDropdown value={cancellationTypeFilter} onChange={setCancellationTypeFilter} options={CANCELLATION_TYPE_OPTIONS} buttonClassName="!rounded-lg !border-brand-teal/20 !px-2.5 !py-1.5" textClassName="!text-xs !font-semibold" /></div>
                  </div>
                )}
              </div>

              {/* Appointments List */}
              <div className="overflow-x-auto rounded-xl border border-brand-teal/10">
                <table className="min-w-[760px] w-full table-fixed text-sm">
                  <thead>
                    <tr className="border-b border-brand-teal/10 bg-gray-50">
                      <th className="w-[150px] px-4 py-3 text-left text-xs font-bold uppercase text-brand-dark-soft">Schedule</th>
                      <th className="w-[210px] px-4 py-3 text-left text-xs font-bold uppercase text-brand-dark-soft">Pet & Owner</th>
                      <th className="w-[190px] px-4 py-3 text-left text-xs font-bold uppercase text-brand-dark-soft">Service</th>
                      <th className="w-[120px] px-4 py-3 text-left text-xs font-bold uppercase text-brand-dark-soft">Status</th>
                      <th className="w-[190px] px-4 py-3 text-left text-xs font-bold uppercase text-brand-dark-soft">Promotion / price</th>
                      <th className="w-[220px] px-4 py-3 text-left text-xs font-bold uppercase text-brand-dark-soft">Cancellation details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!Array.isArray(visibleAppointments) || visibleAppointments.length === 0 ? (
                      <tr className="border-b border-brand-teal/5">
                        <td colSpan="6" className="px-3 py-8 text-center text-sm text-brand-dark-soft">
                          No appointments found for this period.
                        </td>
                      </tr>
                    ) : (
                      visibleAppointments.map((appt) => (
                        <tr key={appt.id} className="border-b border-brand-teal/5 hover:bg-gray-50">
                          <td className="px-4 py-3 text-brand-dark">
                            <p className="text-sm font-bold">{appt.appointment_date ? new Date(appt.appointment_date).toLocaleDateString('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' }) : '-'}</p>
                            <p className="mt-0.5 text-xs font-semibold text-brand-dark-soft">{formatTime(appt.check_in_time || appt.start_time)}{appt.check_out_time ? ` – ${formatTime(appt.check_out_time)}` : ''}</p>
                          </td>
                          <td className="px-4 py-3 text-brand-dark">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-bold leading-tight text-brand-dark">{getPetName(appt.pet)}</p>
                              <p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-wide text-brand-dark-soft">
                                {getPetIdentifier(appt.pet) || 'No pet ID'} · {appt.pet?.owner ? `${appt.pet.owner.first_name || ''} ${appt.pet.owner.last_name || ''}`.trim() || appt.pet.owner.email || '-' : '-'}
                              </p>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-xs font-semibold text-brand-dark">
                            <span className="line-clamp-2">{appt.service?.name || '-'}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-bold ${getStatusColor(appt.status)}`}>
                              {formatStatusLabel(appt.status)}
                            </span>
                          </td>
                          <td className="px-4 py-3 align-top text-[11px] leading-snug text-brand-dark">
                            {appt.promotion_title_snapshot ? (
                              <>
                                <span className="block font-bold">{appt.promotion_title_snapshot}</span>
                                <span className="block text-brand-dark-soft">
                                  PHP {Number(appt.promotion_original_price || 0).toFixed(2)} - PHP {Number(appt.promotion_discount_amount || 0).toFixed(2)}
                                </span>
                                <span className="block font-bold text-brand-teal-dark">PHP {Number(appt.promotion_final_price || appt.total_price || 0).toFixed(2)}</span>
                              </>
                            ) : <span className="text-brand-dark-soft">No promotion</span>}
                            {appt.hotel_extension_charge && <span className="mt-1 block border-t border-brand-dark-light pt-1 font-semibold text-brand-teal-dark">
                              Hotel extension: PHP {Number(appt.hotel_extension_charge.amount || 0).toFixed(2)} · {appt.hotel_extension_charge.payment_status || 'unpaid'}
                            </span>}
                          </td>
                          <td className="px-4 py-3 align-top text-[11px] leading-snug text-brand-dark">
                            <span
                              className="block overflow-hidden"
                              style={{
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                              }}
                            >
                              {appt.status === 'cancelled' ? (
                                <>
                                  <span className="block font-bold">{String(appt.cancellation_type || 'Cancellation').replace(/_/g, ' ')}</span>
                                  <span className="block">{appt.cancellation_reason || 'No reason provided'}</span>
                                  {appt.cancelled_by_name && <span className="block text-[10px] text-brand-dark-soft">By: {appt.cancelled_by_name}</span>}
                                  {appt.cancelled_at && <span className="block text-[10px] text-brand-dark-soft">{new Date(appt.cancelled_at).toLocaleString()}</span>}
                                </>
                              ) : (appt.notes || appt.special_instructions || '-')}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-right text-[11px] italic text-brand-dark-soft">
                {visibleAppointments.length} of {appointments.length} appointments shown
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
