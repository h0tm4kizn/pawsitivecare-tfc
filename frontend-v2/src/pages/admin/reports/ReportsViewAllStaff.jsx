import { X } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '../../../api/apiClient';
import { AdminSkeleton } from '../../../components/admin/AdminLoading';
import SelectDropdown from '../../../components/reusable-ui/SelectDropdown';
import ReportsTableFilterSort from './ReportsTableFilterSort';
import { useReportStore } from '../../../stores/reportStore';
import { groupAttendance, groupCommissions } from './staffReportGroups';

const money = (value) => `PHP ${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateLabel = (value) => value ? new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(`${String(value).slice(0, 10)}T00:00:00+08:00`)) : '—';
const dateTimeLabel = (value) => value ? new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : '—';
const timeLabel = (value) => value ? new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(value)) : '—';
const manilaDateKey = (value) => {
  if (!value) return '';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value)).map(({ type, value: part }) => [type, part]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};
const durationLabel = (seconds) => seconds == null ? '—' : `${Math.floor(Number(seconds) / 3600) ? `${Math.floor(Number(seconds) / 3600)}h ` : ''}${Math.floor((Number(seconds) % 3600) / 60)}m`;
const monthLabel = (year, month, view) => view === 'yearly' ? String(year) : new Intl.DateTimeFormat('en-PH', { month: 'long', year: 'numeric' }).format(new Date(year, month - 1, 1));

const TAB_OPTIONS = [['attendance', 'Attendance'], ['activity', 'Appointment Activity'], ['commission', 'Commissions']];

async function reportJson(path) {
  const response = await apiFetch(path);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message || 'Unable to load Staff Reports.');
  return payload;
}

async function allReportRows(endpoint, params) {
  const first = await reportJson(`/api/reports/${endpoint}?${params}&per_page=1000&page=1`);
  const lastPage = Number(first.data?.last_page || 1);
  const extra = await Promise.all(Array.from({ length: Math.max(0, lastPage - 1) }, (_, index) => reportJson(`/api/reports/${endpoint}?${params}&per_page=1000&page=${index + 2}`)));
  return [first, ...extra].flatMap((page) => page.data?.data || []);
}

export default function ReportsViewAllStaff({ isOpen, onClose, year = new Date().getFullYear(), month = new Date().getMonth() + 1, view = 'monthly' }) {
  const [tab, setTab] = useState('attendance');
  const [options, setOptions] = useState({ staff: [], services: [] });
  const [rows, setRows] = useState([]);
  const [expandedId, setExpandedId] = useState(null);
  const [details, setDetails] = useState({ rows: [], page: 1, lastPage: 1, loading: false, error: '' });
  const detailRequest = useRef(0);
  const staffReportFilters = useReportStore((state) => state.staffReportFilters);
  const setStaffReportFilters = useReportStore((state) => state.setStaffReportFilters);
  const { staffId, staffType, serviceId, status, appointmentStatus = 'all', from, to } = staffReportFilters;
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    apiFetch('/api/reports/staff-options').then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || 'Unable to load report filters.');
      if (active) setOptions(payload.data || { staff: [], services: [] });
    }).catch((failure) => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [isOpen]);

  useEffect(() => { detailRequest.current++; setPage(1); setExpandedId(null); }, [tab, staffId, staffType, serviceId, status, appointmentStatus, from, to, year, month, view]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setLoading(true);
    setError('');
    setRows([]);
    const params = new URLSearchParams({ view, year: String(year), month: String(month) });
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (staffId !== 'all') params.set('staff_id', staffId);
    if (staffType !== 'all') params.set('staff_type', staffType);
    if (tab === 'attendance' && status !== 'all') params.set('status', status);
    if (tab === 'activity' && appointmentStatus !== 'all') params.set('appointment_status', appointmentStatus);
    if (tab === 'commission' && serviceId !== 'all') params.set('service_id', serviceId);
    const request = tab === 'activity'
      ? reportJson(`/api/reports/staff-activity?${params}`).then((payload) => payload.data?.by_staff || [])
      : allReportRows(tab === 'attendance' ? 'staff-attendance' : 'commissions', params);
    request.then((items) => { if (active) setRows(items); })
      .catch((failure) => { if (active) setError(failure.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isOpen, tab, year, month, view, staffId, staffType, serviceId, status, appointmentStatus, from, to]);

  const roster = useMemo(() => options.staff.filter((person) => (staffId === 'all' || String(person.id) === staffId) && (staffType === 'all' || person.staff_type === staffType)), [options.staff, staffId, staffType]);
  const groupedRows = useMemo(() => tab === 'attendance'
    ? groupAttendance(roster, rows)
    : tab === 'commission'
      ? groupCommissions(roster, rows)
      : rows.map((row) => ({ id: row.user_id, displayId: row.display_id || '—', name: row.name, total: row.total, completed: row.completed, cancelled: row.cancelled, noShow: row.no_show || 0 })), [tab, roster, rows]);
  const lastPage = Math.max(1, Math.ceil(groupedRows.length / 25));
  const visibleRows = groupedRows.slice((page - 1) * 25, page * 25);

  const loadActivityDetails = async (id, detailPage) => {
    const request = ++detailRequest.current;
    setDetails((current) => ({ ...current, loading: true, error: '' }));
    const params = new URLSearchParams({ view, year: String(year), month: String(month), staff_id: String(id), page: String(detailPage), per_page: '50' });
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    if (staffType !== 'all') params.set('staff_type', staffType);
    if (appointmentStatus !== 'all') params.set('appointment_status', appointmentStatus);
    try {
      const payload = await reportJson(`/api/reports/staff-activity-details?${params}`);
      if (request !== detailRequest.current) return;
      setDetails({ rows: payload.data?.data || [], page: payload.data?.current_page || 1, lastPage: payload.data?.last_page || 1, loading: false, error: '' });
    } catch (failure) {
      if (request !== detailRequest.current) return;
      setDetails((current) => ({ ...current, loading: false, error: failure.message }));
    }
  };
  const expand = (row) => {
    if (expandedId === row.id) { detailRequest.current++; setExpandedId(null); return; }
    detailRequest.current++;
    setExpandedId(row.id);
    setDetails({ rows: [], page: 1, lastPage: 1, loading: tab === 'activity', error: '' });
    if (tab === 'activity') loadActivityDetails(row.id, 1);
  };

  if (!isOpen) return null;

  const headers = tab === 'activity'
    ? ['Staff ID', 'Staff Name', 'Assigned Appointments', 'Completed', 'Cancelled', 'No-Show']
    : tab === 'attendance'
      ? ['Staff ID', 'Staff Name', 'Attendance Records', 'Days Worked', 'Completed Shifts', 'Total Hours', 'Status']
      : ['Staff ID', 'Staff Name', 'Commissioned Activities', 'Commission Base Total', 'Total Commission Earned'];
  const cells = (row) => tab === 'activity'
    ? [row.displayId, row.name, row.total, row.completed, row.cancelled, row.noShow]
    : tab === 'attendance'
      ? [row.displayId, row.name, row.records, row.days, row.completed, durationLabel(row.seconds), row.status]
      : [row.displayId, row.name, row.count, money(row.base), money(row.amount)];
  const selectedDetails = rows.filter((row) => row.staff_id === expandedId);
  const detailHeaders = tab === 'attendance' ? ['Date', 'Time In', 'Time Out', 'Duration', 'Status'] : tab === 'activity' ? ['Date', 'Appointment', 'Service', 'Status'] : ['Date', 'Appointment', 'Service', 'Commission Base', 'Rate (%)', 'Commission Earned'];
  const detailCells = tab === 'attendance'
    ? selectedDetails.map((row) => [dateLabel(row.date), timeLabel(row.time_in), row.time_out ? <span className="inline-flex flex-col"><span>{timeLabel(row.time_out)}</span>{manilaDateKey(row.time_out) !== row.date && <span className="text-[10px] text-brand-dark-soft">{dateLabel(manilaDateKey(row.time_out))}</span>}</span> : '—', durationLabel(row.duration_seconds), row.status_label])
    : tab === 'activity'
      ? details.rows.map((row) => [dateLabel(row.date), row.appointment_code || '—', row.service || '—', String(row.status || '—').replaceAll('_', ' ')])
      : selectedDetails.map((row) => [dateTimeLabel(row.earned_at), row.appointment?.appointment_code || '—', row.service?.name || '—', money(row.commission_base_amount), `${Number(row.rate_percent || 0).toFixed(2)}%`, money(row.commission_amount)]);
  const filterOptions = [
    { value: 'all', label: 'All staff' },
    ...options.staff.map((item) => ({ value: String(item.id), label: `${item.name}${item.display_id ? ` (${item.display_id})` : ''}` })),
  ];

  return (
    <div className="fixed inset-0 z-[320] flex h-[100dvh] w-screen items-center justify-center bg-brand-dark/40 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[90dvh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
        <header className="flex shrink-0 items-center justify-between border-b border-brand-teal/10 bg-brand-teal px-6 py-4">
          <div><h2 className="text-lg font-bold text-white">Staff Reports</h2><p className="text-sm text-white/80">{monthLabel(year, month, view)} · Asia/Manila</p></div>
          <button type="button" onClick={onClose} aria-label="Close Staff Reports" className="rounded-lg p-2 text-white transition-colors hover:bg-white/20"><X size={20} /></button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-5 pt-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1 rounded-lg bg-brand-surface p-1">
              {TAB_OPTIONS.map(([value, label]) => <button key={value} type="button" onClick={() => setTab(value)} aria-pressed={tab === value} className={`min-h-9 rounded-lg px-3 py-2 text-xs font-bold ${tab === value ? 'bg-white text-brand-teal-dark shadow-sm' : 'text-brand-dark-soft hover:text-brand-dark'}`}>{label}</button>)}
            </div>
          <ReportsTableFilterSort panelClassName="w-[calc(100vw-3rem)] max-w-[760px] sm:grid-cols-3">
            <Filter label="Staff"><SelectDropdown value={staffId} onChange={(value) => setStaffReportFilters({ staffId: value })} searchable options={filterOptions} buttonClassName="!rounded-lg !border-brand-teal/20 !px-2.5 !py-1.5" textClassName="!text-xs !font-semibold" /></Filter>
            <Filter label="Staff type"><SelectDropdown value={staffType} onChange={(value) => setStaffReportFilters({ staffType: value })} options={[{ value: 'all', label: 'All types' }, { value: 'front_desk', label: 'Front Desk' }, { value: 'groomer', label: 'Groomer' }]} buttonClassName="!rounded-lg !border-brand-teal/20 !px-2.5 !py-1.5" textClassName="!text-xs !font-semibold" /></Filter>
            {tab === 'attendance' && <Filter label="Status"><SelectDropdown value={status} onChange={(value) => setStaffReportFilters({ status: value })} options={[{ value: 'all', label: 'All statuses' }, { value: 'on_duty', label: 'On Duty' }, { value: 'missing_time_out', label: 'Missing Time Out' }, { value: 'completed', label: 'Completed' }]} buttonClassName="!rounded-lg !border-brand-teal/20 !px-2.5 !py-1.5" textClassName="!text-xs !font-semibold" /></Filter>}
            {tab === 'activity' && <Filter label="Appointment status"><SelectDropdown value={appointmentStatus} onChange={(value) => setStaffReportFilters({ appointmentStatus: value })} options={[{ value: 'all', label: 'All statuses' }, { value: 'pending', label: 'Pending' }, { value: 'approved', label: 'Approved' }, { value: 'in_progress', label: 'In Progress' }, { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled' }, { value: 'no_show', label: 'No-Show' }]} buttonClassName="!rounded-lg !border-brand-teal/20 !px-2.5 !py-1.5" textClassName="!text-xs !font-semibold" /></Filter>}
            {tab === 'commission' && <Filter label="Service"><SelectDropdown value={serviceId} onChange={(value) => setStaffReportFilters({ serviceId: value })} options={[{ value: 'all', label: 'All services' }, ...options.services.map((item) => ({ value: String(item.id), label: item.name }))]} buttonClassName="!rounded-lg !border-brand-teal/20 !px-2.5 !py-1.5" textClassName="!text-xs !font-semibold" /></Filter>}
            <Filter label="From"><input type="date" value={from} onChange={(event) => setStaffReportFilters({ from: event.target.value })} className="w-full rounded-lg border border-brand-teal/20 bg-white px-2.5 py-1.5 text-xs text-brand-dark" /></Filter>
            <Filter label="To"><input type="date" value={to} onChange={(event) => setStaffReportFilters({ to: event.target.value })} className="w-full rounded-lg border border-brand-teal/20 bg-white px-2.5 py-1.5 text-xs text-brand-dark" /></Filter>
          </ReportsTableFilterSort>
          </div>
          {(from || to) && <p className="text-right text-xs text-brand-dark-soft">Selected range: {from || 'period start'} to {to || 'period end'}</p>}
          {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

          {loading ? <AdminSkeleton variant="table" label={`Loading staff ${tab}`} /> : <>
            <p className="text-[11px] text-brand-dark-soft sm:hidden">Scroll the table sideways to see all columns.</p>
            <div className="overflow-x-auto rounded-xl border border-brand-teal/10">
              <table className="min-w-[700px] w-full table-auto text-left text-sm">
                <thead className="border-b border-brand-teal/10 bg-gray-50"><tr>{headers.map((header) => <th key={header} className="whitespace-nowrap px-3 py-3 text-xs font-bold uppercase text-brand-dark-soft">{header}</th>)}</tr></thead>
                <tbody>{visibleRows.length ? visibleRows.map((row) => <StaffSummaryRow key={row.id} row={row} cells={cells(row)} colSpan={headers.length} expanded={expandedId === row.id} onExpand={() => expand(row)} detailHeaders={detailHeaders} detailCells={detailCells} detailState={details} onDetailPage={(next) => loadActivityDetails(row.id, next)} />) : <tr><td colSpan={headers.length} className="px-3 py-8 text-center text-sm text-brand-dark-soft">No staff members match the selected filters.</td></tr>}</tbody>
              </table>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 text-[11px] text-brand-dark-soft"><span>{groupedRows.length} staff member(s)</span>{lastPage > 1 && <div className="flex items-center gap-2"><button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-lg border border-brand-teal/20 px-3 py-1.5 text-xs font-semibold text-brand-teal disabled:opacity-40">Previous</button><span>Page {page} of {lastPage}</span><button type="button" disabled={page >= lastPage} onClick={() => setPage(page + 1)} className="rounded-lg border border-brand-teal/20 px-3 py-1.5 text-xs font-semibold text-brand-teal disabled:opacity-40">Next</button></div>}</div>
          </>}
        </div>
      </div>
    </div>
  );
}

function StaffSummaryRow({ row, cells, colSpan, expanded, onExpand, detailHeaders, detailCells, detailState, onDetailPage }) {
  return <>
    <tr className="border-b border-brand-teal/5 hover:bg-gray-50">
      {cells.map((cell, index) => <td key={index} className="whitespace-nowrap px-3 py-3 text-sm text-brand-dark">{index === 1 ? <button type="button" aria-expanded={expanded} aria-label={`${expanded ? 'Hide' : 'View'} ${row.name} details`} onClick={onExpand} className="font-semibold text-brand-teal-dark underline-offset-2 hover:underline">{cell} <span aria-hidden="true">{expanded ? '▴' : '▾'}</span></button> : cell ?? '—'}</td>)}
    </tr>
    {expanded && <tr><td colSpan={colSpan} className="bg-brand-surface/40 px-3 py-4">
      <p className="mb-2 text-xs font-bold text-brand-dark">{row.name} · Detailed records</p>
      {detailState.loading ? <p className="text-xs text-brand-dark-soft">Loading details…</p> : detailState.error ? <p role="alert" className="text-xs text-red-700">{detailState.error}</p> : <div className="overflow-x-auto rounded-lg border border-brand-teal/10 bg-white"><table className="min-w-[580px] w-full text-left text-xs"><thead className="bg-gray-50"><tr>{detailHeaders.map((header) => <th key={header} className="whitespace-nowrap px-3 py-2 font-bold text-brand-dark-soft">{header}</th>)}</tr></thead><tbody>{detailCells.length ? detailCells.map((detail, index) => <tr key={index} className="border-t border-brand-teal/5">{detail.map((cell, cellIndex) => <td key={cellIndex} className="whitespace-nowrap px-3 py-2 text-brand-dark">{cell ?? '—'}</td>)}</tr>) : <tr><td colSpan={detailHeaders.length} className="px-3 py-4 text-center text-brand-dark-soft">No detailed records for this staff member.</td></tr>}</tbody></table></div>}
      {detailState.lastPage > 1 && <div className="mt-2 flex items-center justify-end gap-2 text-xs"><button type="button" disabled={detailState.page <= 1} onClick={() => onDetailPage(detailState.page - 1)} className="rounded border border-brand-teal/20 px-2 py-1 disabled:opacity-40">Previous</button><span>Page {detailState.page} of {detailState.lastPage}</span><button type="button" disabled={detailState.page >= detailState.lastPage} onClick={() => onDetailPage(detailState.page + 1)} className="rounded border border-brand-teal/20 px-2 py-1 disabled:opacity-40">Next</button></div>}
    </td></tr>}
  </>;
}

function Filter({ label, children }) { return <div className="min-w-0"><p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-brand-dark-soft">{label}</p>{children}</div>; }
