import { AdminSkeleton } from '../../../components/admin/AdminLoading';
import { lazy } from 'react';
import BookAppointment from '../appointment/BookAppointment';

export const AppointmentPage = lazy(() => import('../appointment/AppointmentPage'));
export const StaffPage = lazy(() => import('../staff/StaffPage'));
export const CustomerPage = lazy(() => import('../appointment/customer/CustomerPage'));
export const PetsPage = lazy(() => import('../pets/PetsPage'));
export const InventoryPage = lazy(() => import('../inventory/InventoryPage'));
export const WalkInSaleModal = lazy(() => import('../inventory/components/WalkInSaleModal'));
export const ServicePage = lazy(() => import('../service/ServicePage'));
export const ReportsPage = lazy(() => import('../reports/ReportsPage'));
export const SettingsBackupPage = lazy(() => import('../settings/SettingsBackupPage'));
export const AuditLogsPage = lazy(() => import('../settings/AuditLogsPage'));
export const SettingsPage = lazy(() => import('../settings/SettingsPage'));
export { BookAppointment };
export const CancellationReasonModal = lazy(() => import('../../../components/modals/CancellationReasonModal'));
export const AppointmentDetailsModal = lazy(() => import('../appointment/AppointmentDetailsModal'));
export const ViewAllAppointmentToday = lazy(() => import('../appointment/ViewAllAppointmentToday'));

const SkeletonBlock = ({ className = '' }) => (
  <div className={`animate-pulse rounded-lg bg-brand-surface ${className}`} aria-hidden="true" />
);

const PAGE_TITLES = {
  appointment: 'Appointment Scheduling', staff: 'Staff Management', customer: 'Customer Management',
  pets: 'Pet Management', service: 'Service Management', inventory: 'Supplies Management',
  reports: 'Reports & Records', settings: 'Settings', backup: 'Backup & Data', 'audit-logs': 'Activity History',
};
export const AdminPageFallback = ({ page }) => (
  <div className="space-y-4 px-4 py-6" aria-busy="true">
    <h1 className="text-2xl font-extrabold text-brand-teal-dark">{PAGE_TITLES[page] || 'Loading page…'}</h1>
    {!['reports', 'backup'].includes(page) && <AdminSkeleton variant="cards" label="Loading statistics" />}
    <AdminSkeleton variant={page === 'appointment' ? 'calendar' : 'table'} label={`Loading ${PAGE_TITLES[page] || 'page'}`} />
  </div>
);

export function StatGridSkeleton() {
  return (
    <>
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="rounded-xl bg-white p-4 shadow-[0_6px_12px_rgba(23,53,81,0.08)]">
          <SkeletonBlock className="h-3 w-24" />
          <SkeletonBlock className="mt-4 h-8 w-16" />
          <SkeletonBlock className="mt-4 h-3 w-full" />
        </div>
      ))}
    </>
  );
}
