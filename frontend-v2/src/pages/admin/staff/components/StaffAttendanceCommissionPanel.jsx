import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clock3, Loader2, Pencil, Plus, WalletCards } from 'lucide-react';
import { apiFetch } from '../../../../api/apiClient';
import { useAuthStore } from '../../../../stores/authStore';
import FilterSelect from './FilterSelect';
import AttendanceCorrectionModal from './AttendanceCorrectionModal';

const detailCard = 'rounded-xl border border-brand-dark-light bg-white px-3 py-3 shadow-sm';
const inputClass = 'mt-1 w-full rounded-lg border border-brand-dark-light px-3 py-2.5 text-xs text-brand-dark outline-none focus:border-brand-teal';

const requestJson = async (path, options, failureMessage) => {
  const method = String(options?.method || 'GET').toUpperCase();
  let response;
  try {
    response = await apiFetch(path, options);
  } catch (error) {
    throw new Error(`${failureMessage} (${method} ${path}): ${error.message}`);
  }

  let json = null;
  try {
    json = await response.json();
  } catch {
    if (response.ok) {
      throw new Error(`${failureMessage}: the server returned an invalid response.`);
    }
  }

  if (!response.ok) {
    const detail = json?.message ? `: ${json.message}` : '';
    throw new Error(`${failureMessage} (HTTP ${response.status}${detail}; ${method} ${path})`);
  }
  return json;
};

export default function StaffAttendanceCommissionPanel({ selectedStaff = null, addToast = null }) {
  const user = useAuthStore((state) => state.user);
  const isAdmin = String(user?.role || '').toLowerCase() === 'admin';
  const selectedStaffId = selectedStaff?.id;
  const [today, setToday] = useState(null);
  const [attendanceState, setAttendanceState] = useState(null);
  const [canSelfTimeOut, setCanSelfTimeOut] = useState(false);
  const [attendance, setAttendance] = useState([]);
  const [commissions, setCommissions] = useState([]);
  const [availableAppointments, setAvailableAppointments] = useState([]);
  const [appointmentId, setAppointmentId] = useState('');
  const [commissionRate, setCommissionRate] = useState('0');
  const [serviceAmount, setServiceAmount] = useState('');
  const [commissionAmount, setCommissionAmount] = useState('');
  const [editingCommissionId, setEditingCommissionId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savingCommission, setSavingCommission] = useState(false);
  const [message, setMessage] = useState('');
  const [correctionOpen, setCorrectionOpen] = useState(false);
  const [correctionTimeOut, setCorrectionTimeOut] = useState('');
  const [correctionSaving, setCorrectionSaving] = useState(false);
  const [attendanceAction, setAttendanceAction] = useState('');
  const requestVersion = useRef(0);
  const attendanceActionRef = useRef('');

  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    setLoading(true);
    setMessage('');
    try {
      const staffQuery = selectedStaffId ? `?staff_id=${encodeURIComponent(selectedStaffId)}&per_page=5` : '?per_page=5';
      const todayPath = isAdmin && selectedStaffId
        ? `/api/admin/attendance/today?staff_id=${encodeURIComponent(selectedStaffId)}`
        : '/api/staff/attendance/today';
      const attendancePath = (isAdmin ? '/api/admin/attendance' : '/api/staff/attendance/history') + staffQuery;
      const commissionPath = (isAdmin ? '/api/admin/commissions' : '/api/staff/commissions') + staffQuery;
      const [todayJson, attendanceJson, commissionJson] = await Promise.all([
        requestJson(todayPath, undefined, 'Failed to load attendance records.'),
        requestJson(attendancePath, undefined, 'Failed to load attendance records.'),
        requestJson(commissionPath, undefined, 'Failed to load commission details.'),
      ]);
      if (version !== requestVersion.current) return;
      setToday(todayJson?.data || null);
      setAttendanceState(todayJson?.attendance_state || null);
      setCanSelfTimeOut(Boolean(todayJson?.can_self_time_out));
      setAttendance(attendanceJson?.data?.data || []);
      setCommissions(commissionJson?.data?.data || []);
      if (isAdmin && selectedStaffId) {
        const availablePath = `/api/admin/commissions/available-appointments?staff_id=${encodeURIComponent(selectedStaffId)}`;
        const availableJson = await requestJson(availablePath, undefined, 'Failed to load eligible appointments.');
        if (version !== requestVersion.current) return;
        setAvailableAppointments(availableJson?.data || []);
      } else {
        setAvailableAppointments([]);
      }
    } catch (error) {
      if (version !== requestVersion.current) return;
      setMessage(error.message || 'Unable to load staff activity.');
    } finally {
      if (version === requestVersion.current) setLoading(false);
    }
  }, [isAdmin, selectedStaffId]);

  useEffect(() => { load(); }, [load]);

  const totalCommission = useMemo(() => commissions.reduce((sum, row) => sum + Number(row.commission_amount || 0), 0), [commissions]);
  const latestAttendance = today || attendance[0] || null;
  const onDuty = attendanceState?.status === 'on_duty';
  const needsReview = attendanceState?.status === 'missing_time_out';
  const formatDateTime = (value) => value ? new Date(value).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '--';
  const formatTime = (value) => value ? new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--';
  const appointmentOptions = availableAppointments.map((appointment) => ({ value: appointment.id, label: `${appointment.appointment_code || 'Completed service'} - ${appointment.service?.name || 'Service'} (PHP ${Number(appointment.total_price || 0).toFixed(2)})` }));
  const selectAppointment = (value) => {
    setAppointmentId(value);
    const selected = availableAppointments.find((appointment) => appointment.id === value);
    setServiceAmount(selected ? String(selected.commission_base_amount ?? selected.total_price ?? 0) : '');
    setCommissionRate(selected ? String(selected.effective_rate_percent ?? 0) : '0');
    setCommissionAmount('');
  };

  const notify = (text, type = 'success') => {
    if (addToast) {
      addToast(text, type);
    } else {
      setMessage(text);
    }
  };

  const action = async (kind, path) => {
    if (attendanceActionRef.current) return;

    attendanceActionRef.current = kind;
    setAttendanceAction(kind);
    setMessage('');
    try {
      await requestJson(
        path,
        { method: 'POST' },
        kind === 'time-in' ? 'Unable to record time in.' : 'Unable to record time out.',
      );
      await load();
      window.dispatchEvent(new CustomEvent('staff-summary-refresh'));
      notify(`${kind === 'time-in' ? 'Time in' : 'Time out'} recorded successfully.`);
    } catch (error) {
      notify(error.message || `Unable to record ${kind === 'time-in' ? 'time in' : 'time out'}. Please try again.`, 'error');
    } finally {
      attendanceActionRef.current = '';
      setAttendanceAction('');
    }
  };

  const correctAttendance = async ({ time_out_at, reason }) => {
    setCorrectionSaving(true);
    setMessage('');
    try {
      const path = `/api/admin/attendance/${today?.id}/correct-time-out`;
      await requestJson(path, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ time_out_at, reason }),
      }, 'Unable to correct attendance.');
      setCorrectionOpen(false);
      setCorrectionTimeOut('');
      await load();
      window.dispatchEvent(new CustomEvent('staff-summary-refresh'));
    } catch (error) {
      setMessage(error.message || 'Unable to correct attendance.');
    } finally {
      setCorrectionSaving(false);
    }
  };

  const resetCommissionForm = () => {
    setAppointmentId('');
    setCommissionRate('0');
    setServiceAmount('');
    setCommissionAmount('');
    setEditingCommissionId(null);
  };

  const saveCommission = async () => {
    setSavingCommission(true);
    setMessage('');
    try {
      const path = editingCommissionId ? `/api/admin/commissions/${editingCommissionId}` : '/api/admin/commissions';
      await requestJson(path, {
        method: editingCommissionId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: selectedStaff?.id, appointment_id: appointmentId, rate_percent: Number(commissionRate), service_amount: Number(serviceAmount), commission_amount: commissionAmount === '' ? null : Number(commissionAmount) }),
      }, 'Unable to save commission.');
      resetCommissionForm();
      await load();
      window.dispatchEvent(new CustomEvent('staff-summary-refresh'));
    } catch (error) {
      setMessage(error.message || 'Unable to save commission.');
    } finally {
      setSavingCommission(false);
    }
  };

  const editCommission = (row) => {
    setEditingCommissionId(row.id);
    setAppointmentId(row.appointment_id || '');
    setCommissionRate(String(row.rate_percent || 0));
    setServiceAmount(String(row.service_amount || 0));
    setCommissionAmount(String(row.commission_amount || 0));
  };

  return (
    <section className="overflow-hidden rounded-xl bg-white">
      <div className="grid gap-3 p-1 sm:p-2 lg:grid-cols-[1.2fr_1fr] lg:items-start">
        <div className={`${detailCard} order-1`}>
          <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><WalletCards size={14} className="text-brand-teal" /><p className="text-xs font-extrabold uppercase tracking-wide text-brand-dark">Commission Details</p></div><span className="text-sm font-extrabold text-brand-teal-dark">PHP {totalCommission.toFixed(2)}</span></div>
          {commissions.length ? <div className="space-y-2">{commissions.slice(0, 3).map((row) => <div key={row.id} className="flex items-center justify-between gap-3 border-t border-brand-dark-light pt-2 text-xs"><div className="min-w-0"><p className="truncate font-semibold text-brand-dark">{row.service?.name || 'Completed service'}</p><p className="text-[11px] text-brand-dark-soft">{Number(row.rate_percent).toFixed(2)}% applied</p></div><div className="flex items-center gap-2"><span className="shrink-0 font-bold text-brand-dark">PHP {Number(row.commission_amount).toFixed(2)}</span>{isAdmin && <button type="button" onClick={() => editCommission(row)} aria-label="Edit commission" className="rounded-lg p-1 text-brand-teal-dark hover:bg-brand-surface"><Pencil size={13} /></button>}</div></div>)}</div> : <p className="text-xs text-brand-dark-soft">No earned commissions recorded.</p>}
          {isAdmin && selectedStaff && <div className="mt-4 border-t border-brand-dark-light pt-3"><div className="mb-2 flex items-center justify-between"><p className="text-xs font-extrabold text-brand-dark">{editingCommissionId ? 'Edit commission' : 'Add commission'}</p>{editingCommissionId && <button type="button" onClick={resetCommissionForm} className="text-[11px] font-semibold text-brand-dark-soft hover:text-brand-dark">Cancel</button>}</div>{!editingCommissionId && <><FilterSelect value={appointmentId} onChange={selectAppointment} options={[{ value: '', label: availableAppointments.length ? 'Select completed appointment' : 'No eligible appointments' }, ...appointmentOptions]} widthClass="w-full" />{!availableAppointments.length && <p className="mt-1 text-[11px] text-brand-dark-soft">No completed appointments are available for manual commission.</p>}</>}<div className="mt-2 grid grid-cols-2 gap-2"><label className="text-[11px] font-semibold text-brand-dark-soft">Service amount<input className={inputClass} type="number" min="0" step="0.01" value={serviceAmount} onChange={(event) => setServiceAmount(event.target.value)} /></label><label className="text-[11px] font-semibold text-brand-dark-soft">Rate %<input className={inputClass} type="number" min="0" max="100" step="0.01" value={commissionRate} onChange={(event) => setCommissionRate(event.target.value)} /></label></div><label className="mt-2 block text-[11px] font-semibold text-brand-dark-soft">Commission amount (optional)<input className={inputClass} type="number" min="0" step="0.01" value={commissionAmount} onChange={(event) => setCommissionAmount(event.target.value)} placeholder="Calculated automatically" /></label><button type="button" disabled={savingCommission || !appointmentId || !serviceAmount || !commissionRate} onClick={saveCommission} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-teal px-3 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{editingCommissionId ? <Pencil size={13} /> : <Plus size={13} />}{editingCommissionId ? 'Save commission' : 'Add commission'}</button></div>}
        </div>
        <div className={`${detailCard} order-2`}>
          <div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2"><Clock3 size={14} className="text-brand-teal" /><p className="text-xs font-extrabold uppercase tracking-wide text-brand-dark">Attendance</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${needsReview ? 'bg-amber-50 text-amber-700' : onDuty ? 'bg-emerald-50 text-emerald-700' : 'bg-brand-surface text-brand-dark-soft'}`}>{needsReview ? 'Missing Time Out' : onDuty ? 'On duty' : 'Off duty'}</span></div>
          <div className="space-y-2 text-xs"><DetailRow label="Time in" value={latestAttendance?.time_in_at ? formatDateTime(latestAttendance.time_in_at) : 'No record today'} /><DetailRow label="Time out" value={latestAttendance?.time_out_at ? formatTime(latestAttendance.time_out_at) : onDuty ? 'Active shift' : '--'} /></div>
          <div className="mt-3 flex gap-2"><button type="button" disabled={loading || Boolean(attendanceAction) || onDuty || needsReview} aria-busy={attendanceAction === 'time-in'} onClick={() => action('time-in', isAdmin ? `/api/admin/attendance/${selectedStaff.id}/time-in` : '/api/staff/attendance/time-in')} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand-teal px-3 py-2 text-xs font-bold text-white transition hover:bg-brand-teal-dark disabled:cursor-not-allowed disabled:opacity-50">{attendanceAction === 'time-in' && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}<span>{attendanceAction === 'time-in' ? 'Timing in...' : 'Time in'}</span></button><button type="button" disabled={loading || Boolean(attendanceAction) || (!onDuty && !canSelfTimeOut)} aria-busy={attendanceAction === 'time-out'} onClick={() => action('time-out', isAdmin ? `/api/admin/attendance/${selectedStaff.id}/time-out` : '/api/staff/attendance/time-out')} className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-brand-teal/30 px-3 py-2 text-xs font-bold text-brand-teal-dark transition hover:bg-brand-surface disabled:cursor-not-allowed disabled:opacity-50">{attendanceAction === 'time-out' && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}<span>{attendanceAction === 'time-out' ? 'Timing out...' : 'Time out'}</span></button></div>
          {isAdmin && needsReview && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5"><p className="text-xs font-bold text-amber-800">This attendance record needs review.</p><p className="mt-0.5 text-[11px] text-amber-700">It remains open; no closing-time Time Out was created.</p><button type="button" onClick={() => setCorrectionOpen(true)} className="mt-2 rounded-lg bg-amber-600 px-3 py-2 text-[11px] font-bold text-white hover:bg-amber-700">Correct attendance</button></div>}
          <div className="mt-4 border-t border-brand-dark-light pt-3">
            <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-brand-dark">Recent Attendance</p>
            {attendance.length === 0 ? <p className="text-[11px] text-brand-dark-soft">No attendance history yet.</p> : (
              <div className="space-y-2">
                {attendance.slice(0, 5).map((record) => (
                  <div key={record.id} className="rounded-lg bg-brand-surface px-2.5 py-2 text-[11px]">
                    <div className="flex justify-between gap-2"><span className="font-semibold text-brand-dark">{formatDateTime(record.time_in_at)}</span><span className="text-brand-dark-soft">{record.time_out_at ? formatTime(record.time_out_at) : 'Open shift'}</span></div>
                    <p className="mt-1 text-brand-dark-soft">{record.recording_method?.replaceAll('_', ' ') || 'Attendance'}{record.recorder?.name ? ` · recorded by ${record.recorder.name}` : ''}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {message && <p className="rounded-xl bg-brand-surface px-3 py-2 text-xs font-semibold text-brand-dark lg:col-span-2">{message}</p>}
      </div>
      {correctionOpen && <AttendanceCorrectionModal staffName={selectedStaff?.name} value={correctionTimeOut} onChange={setCorrectionTimeOut} onClose={() => setCorrectionOpen(false)} onSave={correctAttendance} saving={correctionSaving} />}
    </section>
  );
}

function DetailRow({ label, value }) {
  return <div className="flex items-center justify-between gap-3"><span className="font-semibold text-brand-dark-soft">{label}</span><span className="text-right text-brand-dark">{value}</span></div>;
}
