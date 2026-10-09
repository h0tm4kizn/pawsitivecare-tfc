import StaffAttendanceCommissionPanel from './StaffAttendanceCommissionPanel';
import StaffQRCode from './StaffQRCode';

export default function StaffHomeAttendance({ user }) {
  return (
    <section className="mx-auto grid w-full max-w-[1800px] grid-cols-1 gap-4 px-3 pb-4 sm:px-4 md:px-6 lg:grid-cols-[minmax(240px,0.7fr)_minmax(0,1.3fr)] lg:px-8">
      <div className="rounded-xl border border-brand-teal/20 bg-white p-4 shadow-[0_6px_12px_rgba(23,53,81,0.08)]">
        <h2 className="mb-3 text-sm font-extrabold text-brand-dark">My Staff QR Code</h2>
        <StaffQRCode
          staffId={user?.display_id}
          staffName={user?.name}
          credentialEndpoint="/api/staff/qr-credential"
          size={176}
        />
      </div>
      <div className="min-w-0 rounded-xl border border-brand-teal/20 bg-white p-3 shadow-[0_6px_12px_rgba(23,53,81,0.08)]">
        <StaffAttendanceCommissionPanel />
      </div>
    </section>
  );
}
