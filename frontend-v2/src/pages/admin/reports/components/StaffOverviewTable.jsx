const money = (value) => `PHP ${Number(value || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function StaffOverviewTable({ rows = [], noRecords = false }) {
  return (
    <div>
      {noRecords && <p className="mb-2 rounded-lg border border-brand-teal/10 bg-brand-teal/5 px-3 py-2 text-xs text-brand-dark-soft">No attendance or commission records for this period. Staff totals are shown as zero.</p>}
      <p className="mb-2 text-[11px] text-brand-dark-soft lg:hidden">Scroll sideways to see hours and commission.</p>
      <div className="overflow-x-auto rounded-xl border border-brand-teal/10">
      <table className="min-w-[780px] w-full text-left text-sm">
        <thead className="border-b border-brand-teal/10 bg-gray-50">
          <tr>
            {['Staff ID', 'Staff Name', 'Attendance', 'Completed Shifts', 'Days Worked', 'Hours', 'Commission'].map((label) => (
              <th key={label} className="whitespace-nowrap px-3 py-3 text-xs font-bold uppercase text-brand-dark-soft">{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? rows.map((row) => (
            <tr key={row.id} className="border-b border-brand-teal/5 last:border-b-0 hover:bg-gray-50">
              <td className="whitespace-nowrap px-3 py-3 font-semibold text-brand-dark">{row.displayId}</td>
              <td className="px-3 py-3 font-semibold text-brand-dark">{row.name}</td>
              <td className="px-3 py-3 text-brand-dark">{row.attendanceRecords}</td>
              <td className="px-3 py-3 text-brand-dark">{row.completedShifts}</td>
              <td className="px-3 py-3 text-brand-dark">{row.daysWorked}</td>
              <td className="whitespace-nowrap px-3 py-3 text-brand-dark">{row.hours.toFixed(2)}</td>
              <td className="whitespace-nowrap px-3 py-3 font-semibold text-brand-teal-dark">{money(row.commissionAmount)}</td>
            </tr>
          )) : (
            <tr><td colSpan={7} className="px-3 py-8 text-center text-sm text-brand-dark-soft">No staff members found.</td></tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
