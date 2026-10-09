import assert from 'node:assert/strict';
import test from 'node:test';
import { groupAttendance, groupCommissions } from '../staffReportGroups.js';

const staff = [
  { id: 'staff-a', display_id: 'STF260001', name: 'Alex' },
  { id: 'staff-b', display_id: 'STF260002', name: 'Bea' },
];

test('attendance groups all saved entries by staff and counts distinct dates', () => {
  const rows = groupAttendance(staff, [
    { staff_id: 'staff-a', date: '2026-10-09', status: 'on_duty', status_label: 'On Duty', duration_seconds: null },
    { staff_id: 'staff-a', date: '2026-10-08', status: 'completed', status_label: 'Completed Shift', duration_seconds: 7200 },
    { staff_id: 'staff-a', date: '2026-10-08', status: 'completed', status_label: 'Completed Shift', duration_seconds: 1800 },
  ]);
  assert.deepEqual(rows[0], { id: 'staff-a', displayId: 'STF260001', name: 'Alex', records: 3, days: 2, completed: 2, seconds: 9000, status: 'On Duty' });
  assert.equal(rows[1].records, 0);
  assert.equal(rows[1].status, '—');
});

test('commission groups saved amounts without using appointment counts', () => {
  const rows = groupCommissions(staff, [
    { staff_id: 'staff-a', commission_base_amount: 800, commission_amount: 100 },
    { staff_id: 'staff-a', commission_base_amount: 200, commission_amount: 25 },
  ]);
  assert.deepEqual(rows[0], { id: 'staff-a', displayId: 'STF260001', name: 'Alex', count: 2, base: 1000, amount: 125 });
  assert.equal(rows[1].count, 0);
  assert.equal(rows[1].amount, 0);
});
