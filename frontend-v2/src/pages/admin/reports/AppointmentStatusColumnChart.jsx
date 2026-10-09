import { LineTrendChart, StatusSummary } from "./ReportCharts";

const STATUS_SEGMENTS = [
  { key: "pending", label: "Pending", color: "bg-amber-400" },
  { key: "approved", label: "Approved", color: "bg-sky-400" },
  { key: "in_progress", label: "In Progress", color: "bg-orange-400" },
  { key: "completed", label: "Completed", color: "bg-emerald-500" },
  { key: "cancelled", label: "Cancelled", color: "bg-red-400" },
  { key: "no_show", label: "No Show", color: "bg-rose-600" },
];

export default function AppointmentStatusColumnChart({
  data = [],
  onWeekClick,
  compact = false,
}) {
  const total = data.reduce((sum, row) => sum + Number(row.total || 0), 0);
  const statusItems = STATUS_SEGMENTS.map((segment) => ({
    ...segment,
    value: data.reduce((sum, row) => sum + Number(row[segment.key] || 0), 0),
  }));

  return (
    <div>
      <LineTrendChart
        data={data}
        valueKey="total"
        label=""
        onPointClick={onWeekClick}
        compact={compact}
      />
      <div className="mt-4">
        <h4
          className={`${compact ? "mb-2 text-[10px]" : "mb-3 text-xs"} font-bold uppercase tracking-wide text-brand-dark-soft`}
        >
          Status Summary
        </h4>
        <StatusSummary items={statusItems} total={total} compact={compact} />
      </div>
    </div>
  );
}

export { STATUS_SEGMENTS as APPOINTMENT_STATUS_SEGMENTS };
