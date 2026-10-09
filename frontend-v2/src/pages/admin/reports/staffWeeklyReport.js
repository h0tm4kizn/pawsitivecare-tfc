const dateOnly = (year, month, day) => `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

export function staffWeekOptions(year, monthIndex) {
  const month = monthIndex + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthName = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'Asia/Manila' }).format(new Date(Date.UTC(year, monthIndex, 1)));
  const options = [{ value: 0, label: `All Weeks: ${monthName} 1–${lastDay}, ${year}`, from: dateOnly(year, month, 1), to: dateOnly(year, month, lastDay) }];
  for (let week = 1; week <= 5; week++) {
    const first = (week - 1) * 7 + 1;
    if (first > lastDay) break;
    const last = Math.min(first + 6, lastDay);
    options.push({ value: week, label: `Week ${week}: ${monthName} ${first}–${last}, ${year}`, from: dateOnly(year, month, first), to: dateOnly(year, month, last) });
  }
  return options;
}

const manilaDate = (value) => {
  if (!value) return '';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(value)).map(({ type, value: part }) => [type, part]));
  return `${parts.year}-${parts.month}-${parts.day}`;
};

export function staffRowsForRange(staff, attendance, commissions, { from, to }) {
  const attendanceByStaff = new Map();
  for (const row of attendance) {
    if (!row.date || row.date < from || row.date > to) continue;
    const group = attendanceByStaff.get(row.staff_id) || { records: 0, completed: 0, dates: new Set(), seconds: 0 };
    group.records++;
    group.dates.add(row.date);
    if (row.status === 'completed' && row.duration_seconds != null) {
      group.completed++;
      group.seconds += Number(row.duration_seconds);
    }
    attendanceByStaff.set(row.staff_id, group);
  }
  const commissionByStaff = new Map();
  for (const row of commissions) {
    const date = manilaDate(row.earned_at);
    if (!date || date < from || date > to) continue;
    const group = commissionByStaff.get(row.staff_id) || { count: 0, amount: 0 };
    group.count++;
    group.amount += Number(row.commission_amount || 0);
    commissionByStaff.set(row.staff_id, group);
  }
  return staff.map((person) => {
    const shifts = attendanceByStaff.get(person.id);
    const earnings = commissionByStaff.get(person.id);
    return {
      id: person.id,
      displayId: person.displayId,
      name: person.name,
      attendanceRecords: shifts?.records || 0,
      completedShifts: shifts?.completed || 0,
      daysWorked: shifts?.dates.size || 0,
      hours: Number(((shifts?.seconds || 0) / 3600).toFixed(2)),
      commissionRecords: earnings?.count || 0,
      commissionAmount: Number((earnings?.amount || 0).toFixed(2)),
    };
  });
}
