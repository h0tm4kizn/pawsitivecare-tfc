import {
  Download,
  FileText,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import ReportSectionState from "../../../../components/admin/ReportSectionState";

const SERVICE_BREAKDOWN_SEGMENTS = [
  {
    key: "grooming",
    label: "Grooming",
    className: "bg-brand-grooming-soft",
    textClassName: "text-brand-grooming",
  },
  {
    key: "daycare",
    label: "Daycare",
    className: "bg-brand-daycare-soft",
    textClassName: "text-brand-daycare",
  },
  {
    key: "hotel",
    label: "Hotel",
    className: "bg-brand-hotel-soft",
    textClassName: "text-brand-hotel",
  },
];

export function CollapsibleSection({
  loadState = {},
  onRetry,
  title,
  icon,
  isOpen,
  onToggle,
  summary,
  onCSV,
  onPDF,
  onViewAll,
  children,
  className = "",
}) {
  return (
    <div
      className={`overflow-hidden rounded-lg border border-brand-dark-light/70 bg-white ${className}`}
    >
      <div
        className={`flex w-full items-center justify-between gap-3 px-4 py-3.5 transition-colors ${isOpen ? "bg-brand-teal/5" : "bg-white hover:bg-gray-50"}`}
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={isOpen}
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-teal/10 text-brand-teal">
            <i className={`fa-solid ${icon}`} />
          </span>
          <div className="min-w-0 text-left">
            <h3 className="text-sm font-bold text-brand-dark">{title}</h3>
            <p className="text-xs text-brand-dark-soft">
              {loadState.loading
                ? "Updating…"
                : loadState.error
                  ? "Unable to update report"
                  : !loadState.loaded
                    ? "Loading…"
                    : summary}
            </p>
          </div>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {onViewAll && (
            <button
              type="button"
              disabled={
                loadState.loading ||
                !loadState.loaded ||
                Boolean(loadState.error)
              }
              onClick={(event) => {
                event.stopPropagation();
                onViewAll();
              }}
              className="flex items-center gap-1.5 rounded-md bg-brand-teal px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-teal-dark"
            >
              <i className="fa-solid fa-list" /> View All
            </button>
          )}
          {onCSV && <button
            type="button"
            disabled={
              loadState.loading || !loadState.loaded || Boolean(loadState.error)
            }
            onClick={(event) => {
              event.stopPropagation();
              onCSV();
            }}
            className="flex items-center gap-1.5 rounded-md border border-brand-teal/20 bg-white px-2.5 py-1.5 text-xs font-semibold text-brand-teal transition-colors hover:bg-brand-teal hover:text-white"
          >
            <Download size={11} /> CSV
          </button>}
          {onPDF && (
            <button
              type="button"
              disabled={
                loadState.loading ||
                !loadState.loaded ||
                Boolean(loadState.error)
              }
              onClick={(event) => {
                event.stopPropagation();
                onPDF();
              }}
              className="flex items-center gap-1.5 rounded-md border border-brand-teal/20 bg-white px-2.5 py-1.5 text-xs font-semibold text-brand-teal transition-colors hover:bg-brand-teal hover:text-white"
            >
              <FileText size={11} /> PDF
            </button>
          )}
          <button
            type="button"
            onClick={onToggle}
            aria-label={`Toggle ${title}`}
            aria-expanded={isOpen}
          >
            {isOpen ? (
              <ChevronUp size={18} className="text-brand-dark-soft" />
            ) : (
              <ChevronDown size={18} className="text-brand-dark-soft" />
            )}
          </button>
        </div>
      </div>
      {isOpen && (
        <div className="border-t border-brand-dark-light/70">
          <ReportSectionState state={loadState} onRetry={onRetry}>
            {children}
          </ReportSectionState>
        </div>
      )}
    </div>
  );
}

export function SectionHeader({ title, description, icon, onCSV, onPDF }) {
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 bg-brand-teal px-4 py-3">
        <h2 className="flex min-w-0 items-center gap-2 text-sm font-bold text-white">
          <i className={`fa-solid ${icon} text-white/70`} />
          <span className="truncate">{title}</span>
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onCSV}
            className="flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/25"
          >
            <Download size={11} /> CSV
          </button>
          <button
            type="button"
            onClick={onPDF}
            className="flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/25"
          >
            <FileText size={11} /> PDF
          </button>
        </div>
      </div>
      {description && (
        <div className="border-b border-brand-teal/10 bg-brand-teal-light/20 px-4 py-2">
          <p className="text-xs font-medium leading-5 text-brand-dark-soft">
            {description}
          </p>
        </div>
      )}
    </>
  );
}

export function ReportTable({ headers, rows }) {
  if (rows.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-brand-dark-soft">
        No records for the selected period.
      </div>
    );
  }
  return (
    <div className="w-full overflow-x-auto">
      <table className="min-w-[680px] table-fixed text-sm">
        <thead>
          <tr className="border-b border-brand-teal/10 bg-gray-50/80">
            {headers.map((header, index) => (
              <th
                key={header}
                className={`${index === 0 ? "w-[28%]" : ""} px-3 py-2.5 text-left text-[10px] font-bold uppercase text-brand-dark-soft`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, rowIndex) => (
            <tr
              key={rowIndex}
              className={`border-b border-brand-teal/8 ${rowIndex % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}
            >
              {cells.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className="min-w-0 px-3 py-2.5 text-sm text-brand-dark"
                >
                  <div className="min-w-0 truncate">{cell}</div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CountPct({ value, pct, tone = "text-brand-dark" }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className={`font-semibold ${tone}`}>{value}</span>
      <span className="text-[10px] font-bold text-brand-dark-soft">({pct})</span>
    </span>
  );
}

export function DetailRow({ label, value, tone = "text-brand-dark" }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm text-brand-dark-soft">{label}</span>
      <span className={`text-sm font-semibold ${tone}`}>{value}</span>
    </div>
  );
}

export function ServiceBreakdownChart({ data, onWeekClick }) {
  const maxTotal = Math.max(
    ...data.map(
      (row) =>
        Number(row.grooming || 0) +
        Number(row.daycare || 0) +
        Number(row.hotel || 0),
    ),
    0,
  );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-xs font-bold uppercase text-brand-dark-soft">
            Service Breakdown
          </h4>
          <p className="mt-0.5 text-xs text-brand-dark-soft">
            Weekly split for appointment service types.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {SERVICE_BREAKDOWN_SEGMENTS.map((segment) => (
            <span
              key={segment.key}
              className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-dark-soft"
            >
              <span className={`h-2.5 w-2.5 rounded-sm ${segment.className}`} />
              {segment.label}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {data.map((row) => {
          const total = SERVICE_BREAKDOWN_SEGMENTS.reduce(
            (sum, segment) => sum + Number(row[segment.key] || 0),
            0,
          );
          return (
            <button
              key={row.period}
              type="button"
              onClick={() => onWeekClick?.(row.period)}
              className="grid w-full grid-cols-[72px_minmax(0,1fr)_40px] items-center gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-brand-teal/5"
            >
              <span className="text-xs font-bold text-brand-dark">
                {row.period}
              </span>
              <span className="flex h-7 overflow-hidden rounded-full bg-brand-dark-light/60">
                {total > 0 ? (
                  SERVICE_BREAKDOWN_SEGMENTS.map((segment) => {
                    const count = Number(row[segment.key] || 0);
                    if (count <= 0) return null;
                    const width = Math.max((count / total) * 100, 3);
                    return (
                      <span
                        key={segment.key}
                        className={`flex h-full min-w-[22px] items-center justify-center text-[10px] font-extrabold ${segment.textClassName} ${segment.className}`}
                        style={{ width: `${width}%` }}
                        title={`${segment.label}: ${count}`}
                      >
                        {width >= 7 || count > 1 ? count : ""}
                      </span>
                    );
                  })
                ) : (
                  <span className="h-full w-full bg-brand-dark-light" />
                )}
              </span>
              <span className="text-right text-xs font-extrabold text-brand-dark">
                {total}
              </span>
            </button>
          );
        })}
      </div>

      {maxTotal === 0 && (
        <p className="mt-3 text-xs font-semibold text-brand-dark-soft">
          No service breakdown data for this period.
        </p>
      )}
    </div>
  );
}
