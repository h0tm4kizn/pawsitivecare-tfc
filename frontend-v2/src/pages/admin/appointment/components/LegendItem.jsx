export default function LegendItem({ dotClass, label }) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
      <span>{label}</span>
    </div>
  );
}

