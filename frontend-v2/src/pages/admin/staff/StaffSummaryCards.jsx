import { useEffect, useState } from 'react';
import { apiFetch } from '../../../api/apiClient';
import StaffStatBox from './StaffStatBox';

const formatCurrency = (value) =>
  `PHP ${Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const formatOnDutyNames = (names) => {
  if (!names.length) return 'No staff currently on duty';
  if (names.length <= 2) return names.join(' · ');
  return `${names.slice(0, 2).join(' · ')} · +${names.length - 2} more`;
};

export default function StaffSummaryCards({ stats, staffLoading = false }) {
  const [summary, setSummary] = useState({
    onDuty: null,
    commission: null,
  });
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState('');

  useEffect(() => {
    let active = true;

    const loadSummary = async () => {
      setSummaryLoading(true);
      setSummaryError('');
      try {
        const [attendanceResponse, commissionResponse] = await Promise.all([
          apiFetch('/api/admin/attendance/summary'),
          apiFetch('/api/admin/commissions/summary'),
        ]);
        const [attendanceJson, commissionJson] = await Promise.all([
          attendanceResponse.json(),
          commissionResponse.json(),
        ]);
        if (!attendanceResponse.ok || !commissionResponse.ok) {
          throw new Error('Unable to load staff summary.');
        }
        if (!active) return;
        setSummary({
          onDuty: attendanceJson?.data || { count: 0, names: [] },
          commission: commissionJson?.data || { amount: 0, staff_name: null },
        });
      } catch (error) {
        if (!active) return;
        setSummaryError(error.message || 'Unable to load staff summary.');
      } finally {
        if (active) setSummaryLoading(false);
      }
    };

    loadSummary();
    const refresh = () => loadSummary();
    window.addEventListener('staff-summary-refresh', refresh);
    const interval = window.setInterval(loadSummary, 30000);

    return () => {
      active = false;
      window.removeEventListener('staff-summary-refresh', refresh);
      window.clearInterval(interval);
    };
  }, []);

  const cardsLoading = staffLoading || summaryLoading;
  const onDutyNames = Array.isArray(summary.onDuty?.names) ? summary.onDuty.names : [];
  const needsReviewCount = Number(summary.onDuty?.needs_review_count || 0);
  const hasCommissionLeader = Boolean(summary.commission?.staff_name);
  const summaryUnavailable = Boolean(summaryError) && !summary.onDuty && !summary.commission;

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
      <StaffStatBox
        loading={staffLoading}
        title="Total Staff"
        value={stats.totalStaff}
        note={`${stats.activeStaff} active - ${stats.inactiveStaff} inactive`}
        modalTitle="Total Staff Overview"
        modalSubtitle="Complete breakdown of all staff accounts."
        tiles={[
          { label: 'Active', value: stats.activeStaff, note: `${stats.activeRate}% of total`, tone: 'emerald' },
          { label: 'Front Desk', value: stats.frontDeskCount, note: 'Front desk staff', tone: 'sky' },
          { label: 'Groomer', value: stats.groomerCount, note: 'Grooming staff', tone: 'amber' },
        ]}
        insight={`${stats.inactiveStaff} staff account(s) are currently inactive and cannot access the system.`}
      />

      <StaffStatBox
        loading={cardsLoading}
        title="Currently On Duty"
        value={summaryUnavailable ? '—' : summary.onDuty?.count ?? 0}
        note={summaryUnavailable ? 'Unable to load summary' : `${formatOnDutyNames(onDutyNames)}${needsReviewCount ? ` · ${needsReviewCount} review` : ''}`}
        modalTitle="Currently On Duty"
        modalSubtitle="Staff with an active time-in record and no time-out."
        tiles={[
          { label: 'On duty', value: summary.onDuty?.count ?? 0, note: 'Active attendance records', tone: 'emerald' },
          ...(needsReviewCount ? [{ label: 'Needs review', value: needsReviewCount, note: 'Missing Time Out records', tone: 'amber' }] : []),
        ]}
        insight={needsReviewCount ? `${needsReviewCount} attendance record(s) need admin review.` : 'Account status is not used to determine whether a staff member is currently on duty.'}
      />

      <StaffStatBox
        loading={cardsLoading}
        title="Top Commission Earner"
        value={summaryUnavailable ? '—' : formatCurrency(summary.commission?.amount)}
        note={summaryUnavailable
          ? 'Unable to load summary'
          : hasCommissionLeader
            ? `${summary.commission.staff_name} · This month`
            : 'No commissions this month'}
        modalTitle="Top Commission Earner"
        modalSubtitle="Highest saved commission total for the current calendar month."
        tiles={[
          { label: 'Total earned', value: formatCurrency(summary.commission?.amount), note: 'Current month', tone: 'emerald' },
        ]}
        insight="The leaderboard uses stored historical commission amounts and does not recalculate them from current rates."
      />
    </div>
  );
}
