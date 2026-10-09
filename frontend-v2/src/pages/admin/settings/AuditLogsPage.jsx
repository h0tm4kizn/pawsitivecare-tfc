import AuditLogsPanel from './AuditLogsPanel';

export default function AuditLogsPage() {
  return (
    <div className="mx-auto w-full max-w-[1736px] px-0 pb-10 pt-4">
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold text-brand-teal-dark">
          Activity <span className="text-brand-dark">History</span>
        </h1>
        <p className="text-sm text-brand-dark-soft">Review changes and backups made in the system.</p>
      </div>
      <AuditLogsPanel showClose={false} />
    </div>
  );
}
