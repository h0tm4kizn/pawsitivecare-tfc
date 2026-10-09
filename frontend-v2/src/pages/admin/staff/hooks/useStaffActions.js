import { useCallback } from 'react';
import { apiFetch } from '../../../../api/apiClient';

export default function useStaffActions({ addToast, fetchStaff, selectedStaff, setSelectedStaff, setActionTarget }) {
  const handleConfirmAction = useCallback(async ({ target, reason, action }) => {
    if (!target?.id) return;
    const staffId = target.id;
    let res;

    if (action === 'deactivate') {
      res = await apiFetch(`/api/admin/staff/${staffId}/deactivate`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, deactivation_reason: reason }),
      });

      if (!res.ok && [404, 405].includes(res.status)) {
        res = await apiFetch(`/api/admin/staff/${staffId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: false, reason, deactivation_reason: reason }),
        });
      }
    } else {
      res = await apiFetch(`/api/admin/staff/${staffId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason, deletion_reason: reason }),
      });
    }

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const msg = data?.errors ? Object.values(data.errors).flat().join(' ') : data?.message;
      throw new Error(msg || `Failed to ${action}.`);
    }

    if (action === 'delete') {
      addToast('Staff deleted.');
      if (selectedStaff?.id === staffId) setSelectedStaff(null);
    } else {
      addToast('Staff deactivated.');
    }

    setActionTarget(null);
    await fetchStaff();
  }, [addToast, fetchStaff, selectedStaff?.id, setActionTarget, setSelectedStaff]);

  return { handleConfirmAction };
}
