import assert from 'node:assert/strict';
import test from 'node:test';
import { staffRowsForRange, staffWeekOptions } from '../staffWeeklyReport.js';

test('weekly options use calendar day ranges and include Week 5 only when needed', () => {
  const october = staffWeekOptions(2026, 9);
  assert.deepEqual(october.map(({ from, to }) => [from, to]), [
    ['2026-10-01', '2026-10-31'],
    ['2026-10-01', '2026-10-07'],
    ['2026-10-08', '2026-10-14'],
    ['2026-10-15', '2026-10-21'],
    ['2026-10-22', '2026-10-28'],
    ['2026-10-29', '2026-10-31'],
  ]);
  assert.equal(staffWeekOptions(2026, 1).length, 5);
  assert.equal(staffWeekOptions(2028, 1)[5].to, '2028-02-29');
});

test('weekly rows count saved shifts and commission dates in Manila, including overnight shifts', () => {
  const staff = [{ id: 'a', displayId: 'STF260001', name: 'Alex' }, { id: 'b', displayId: 'STF260002', name: 'Bea' }];
  const attendance = [
    { staff_id: 'a', date: '2026-10-07', status: 'completed', duration_seconds: 3600 },
    { staff_id: 'a', date: '2026-10-08', status: 'completed', duration_seconds: 7200 },
    { staff_id: 'a', date: '2026-10-08', status: 'completed', duration_seconds: 9000 },
    { staff_id: 'a', date: '2026-10-09', status: 'on_duty', duration_seconds: null },
  ];
  const commissions = [
    { staff_id: 'a', earned_at: '2026-10-07T15:59:00Z', commission_amount: 10 },
    { staff_id: 'a', earned_at: '2026-10-07T16:01:00Z', commission_amount: 25 },
    { staff_id: 'a', earned_at: '2026-10-14T15:59:00Z', commission_amount: 15 },
  ];
  const all = staffRowsForRange(staff, attendance, commissions, staffWeekOptions(2026, 9)[0]);
  const weekTwo = staffRowsForRange(staff, attendance, commissions, staffWeekOptions(2026, 9)[2]);
  assert.deepEqual([all[0].attendanceRecords, all[0].commissionAmount], [4, 50]);
  assert.deepEqual([weekTwo[0].attendanceRecords, weekTwo[0].completedShifts, weekTwo[0].daysWorked, weekTwo[0].hours, weekTwo[0].commissionAmount], [3, 2, 2, 4.5, 40]);
  assert.deepEqual([weekTwo[1].attendanceRecords, weekTwo[1].completedShifts, weekTwo[1].daysWorked, weekTwo[1].hours, weekTwo[1].commissionAmount], [0, 0, 0, 0, 0]);
});
