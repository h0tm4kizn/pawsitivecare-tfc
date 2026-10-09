export function groupAttendance(staff, records) {
  const byStaff = new Map();
  for (const record of records) {
    const group = byStaff.get(record.staff_id) || { records: 0, dates: new Set(), completed: 0, seconds: 0, status: record.status_label || '—' };
    group.records += 1;
    if (record.date) group.dates.add(record.date);
    if (record.status === 'completed' && record.duration_seconds != null) {
      group.completed += 1;
      group.seconds += Number(record.duration_seconds);
    }
    byStaff.set(record.staff_id, group);
  }
  return staff.map((person) => {
    const group = byStaff.get(person.id);
    return {
      id: person.id,
      displayId: person.display_id || '—',
      name: person.name,
      records: group?.records || 0,
      days: group?.dates.size || 0,
      completed: group?.completed || 0,
      seconds: group?.seconds || 0,
      status: group?.status || '—',
    };
  });
}

export function groupCommissions(staff, records) {
  const byStaff = new Map();
  for (const record of records) {
    const group = byStaff.get(record.staff_id) || { count: 0, base: 0, amount: 0 };
    group.count += 1;
    group.base += Number(record.commission_base_amount || 0);
    group.amount += Number(record.commission_amount || 0);
    byStaff.set(record.staff_id, group);
  }
  return staff.map((person) => {
    const group = byStaff.get(person.id);
    return {
      id: person.id,
      displayId: person.display_id || '—',
      name: person.name,
      count: group?.count || 0,
      base: group?.base || 0,
      amount: group?.amount || 0,
    };
  });
}
