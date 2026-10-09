import { apiFetch } from '../../../api/apiClient';

export async function downloadStaffReport({ group = 'all', format, view = 'monthly', year, month, from = '', to = '', staffId = 'all', staffType = 'all', serviceId = 'all', status = 'all', appointmentStatus = 'all' }) {
  const params = new URLSearchParams({ group, format, view, year: String(year) });
  if (view === 'monthly') params.set('month', String(month));
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (staffId !== 'all') params.set('staff_id', staffId);
  if (staffType !== 'all') params.set('staff_type', staffType);
  if ((group === 'commission' || group === 'all') && serviceId !== 'all') params.set('service_id', serviceId);
  if ((group === 'attendance' || group === 'all') && status !== 'all') params.set('status', status);
  if ((group === 'activity' || group === 'all') && appointmentStatus !== 'all') params.set('appointment_status', appointmentStatus);
  const response = await apiFetch(`/api/reports/staff-export?${params}`);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || 'Unable to export the Staff report.');
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const serverFilename = response.headers.get('Content-Disposition')?.match(/filename="?([^";]+)"?/i)?.[1];
  link.download = serverFilename || `staff_${group}_${year}${view === 'monthly' ? `-${String(month).padStart(2, '0')}` : ''}.${format}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
