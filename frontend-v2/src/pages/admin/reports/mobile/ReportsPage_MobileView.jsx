import { ChevronDown, ChevronUp, Download, FileText } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useState } from 'react';
import ReportSectionState from '../../../../components/admin/ReportSectionState';
import SelectDropdown from '../../../../components/reusable-ui/SelectDropdown';
import ReportsViewAllAppointments from '../ReportsViewAllAppointments';
import ReportsViewAllCustomers from '../ReportsViewAllCustomers';
import ReportsViewAllPets from '../ReportsViewAllPets';
import ReportsViewAllServices from '../ReportsViewAllServices';
import ReportsViewAllInventory from '../ReportsViewAllInventory';
import ReportsViewAllStaff from '../ReportsViewAllStaff';
import AppointmentStatusColumnChart from '../AppointmentStatusColumnChart';
import { HorizontalRankingChart, LineTrendChart } from '../ReportCharts';
import StaffOverviewTable from '../components/StaffOverviewTable';

export default function ReportsPage_MobileView({
  loading = false,
  sections: sectionStates = {},
  onRetrySection,
  error = '',
  selMonth = 0,
  selYear = new Date().getFullYear(),
  viewMode = 'monthly',
  setSelMonth,
  setSelYear,
  months = [],
  yearOptions = [],
  periodLabel = '',
  totalAppts = 0,
  totalPending = 0,
  totalApproved = 0,
  totalInProgress = 0,
  totalCompleted = 0,
  totalCancelled = 0,
  totalNoShow = 0,
  totalNewCust = 0,
  apptData = [],
  custData = [],
  petData = [],
  svcData = [],
  addonData = [],
  serviceCancellationData = [],
  staffAttendanceCount = 0,
  staffCommissionCount = 0,
  staffWeekRows = [],
  staffWeek = 0,
  staffWeeks = [],
  onStaffWeekChange,
  inventoryData = [],
  inventorySalesData = [],
  inventorySalesSummary = { units: 0, revenue: 0, bestSeller: '-' },
  openSections = {},
  onToggleSection,
  onCSV,
  onPDF,
  onViewAll,
  onDownloadAll,
  onDownloadAllCSV,
  viewAllModal = {},
  onCloseViewAll,
}) {
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const petTotal = petData.reduce((sum, row) => sum + (row.total || 0), 0);
  const serviceTotal = svcData.reduce((sum, row) => sum + (row.total || 0), 0);
  const serviceTotalFor = (category) => svcData
    .filter((service) => String(service.category || '').toLowerCase() === category)
    .reduce((sum, service) => sum + Number(service.total || 0), 0);
  const serviceEntriesFor = (category) => svcData
    .filter((service) => String(service.category || '').toLowerCase() === category).length;
  const lowStockCount = inventoryData.filter((item) => item.stock <= item.reorderLevel).length;
  const sectionOrder = ['appointments', 'services', 'staff', 'customers', 'pets', 'inventory'];

  const sections = [
    {
      key: 'appointments',
      title: 'Appointments',
      summary: `${totalAppts} total - ${totalPending} pending - ${totalApproved} approved`,
      modalPeriod: 'All Weeks',
      rows: [
        ['Total', totalAppts],
        ['Pending', totalPending],
        ['Approved', totalApproved],
        ['In Progress', totalInProgress],
        ['Completed', totalCompleted],
        ['Cancelled', totalCancelled],
        ['No Show', totalNoShow],
      ],
    },
    {
      key: 'customers',
      title: 'Customers',
      summary: `${totalNewCust} new customers this period`,
      modalPeriod: 'This Month',
      rows: [
        ['New Customers', totalNewCust],
      ],
    },
    {
      key: 'pets',
      title: 'Pets',
      summary: `${petTotal} new pets registered`,
      modalPeriod: 'This Month',
      rows: [
        ['Total New Pets', petTotal],
        ['Dogs', petData.reduce((sum, row) => sum + (row.dogs || 0), 0)],
        ['Cats', petData.reduce((sum, row) => sum + (row.cats || 0), 0)],
        ['Others', petData.reduce((sum, row) => sum + (row.others || 0), 0)],
      ],
    },
    {
      key: 'services',
      title: 'Services',
      summary: `${serviceTotal} service booking${serviceTotal === 1 ? '' : 's'}`,
      modalPeriod: 'All',
      rows: [
        ['Grooming packages', `${serviceEntriesFor('grooming')} · ${serviceTotalFor('grooming')} bookings`],
        ['Daycare durations', `${serviceEntriesFor('daycare')} · ${serviceTotalFor('daycare')} bookings`],
        ['Hotel packages', `${serviceEntriesFor('hotel')} · ${serviceTotalFor('hotel')} bookings`],
        ['Completed', svcData.reduce((sum, row) => sum + (row.completed || 0), 0)],
        ['Cancelled', svcData.reduce((sum, row) => sum + (row.cancelled || 0), 0)],
      ],
    },
    {
      key: 'inventory',
      title: 'Supplies',
      summary: `${inventoryData.length} items tracked - ${lowStockCount} low stock`,
      modalPeriod: 'Current',
      rows: [
        ['Items Tracked', inventoryData.length],
        ['Low Stock', lowStockCount],
        ['Active Items', inventoryData.filter((item) => item.status === 'Active').length],
        ['Units Sold', inventorySalesSummary.units],
        ['Sales Revenue', `PHP ${Number(inventorySalesSummary.revenue || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}`],
        ['Best Seller', inventorySalesSummary.bestSeller],
      ],
    },
    {
      key: 'staff',
      title: 'Staff',
      summary: `${staffAttendanceCount} attendance records`,
      modalPeriod: 'All',
      rows: [],
    },
  ].sort((a, b) => sectionOrder.indexOf(a.key) - sectionOrder.indexOf(b.key));

  return (
    <section className="space-y-4 px-4 pb-10 pt-5 font-poppins">


      <div className="space-y-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold leading-tight text-brand-teal-dark">
            Reports &amp; <span className="text-brand-dark">Records</span>
          </h1>
          <p className="mt-0.5 text-xs text-brand-dark-soft">View, download, and analyze records.</p>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setDownloadMenuOpen((open) => !open)}
            className="inline-flex min-h-[42px] w-full items-center justify-center gap-1.5 rounded-xl bg-brand-teal px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-brand-teal-dark"
          >
            <Download size={14} /> Download
            <ChevronDown size={14} className={`transition-transform ${downloadMenuOpen ? 'rotate-180' : ''}`} />
          </button>
          {downloadMenuOpen && (
            <div className="absolute right-0 top-[calc(100%+0.5rem)] z-20 w-full overflow-hidden rounded-xl border border-brand-teal/20 bg-white p-1.5 shadow-xl">
              <button type="button" disabled={loading || Object.values(sectionStates).some(s => s.error)} onClick={() => { onDownloadAllCSV?.(); setDownloadMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-bold text-brand-dark active:bg-brand-teal/10"><Download size={14} className="text-brand-teal" /> Download Overview (CSV)</button>
              <button type="button" disabled={loading || Object.values(sectionStates).some(s => s.error)} onClick={() => { onDownloadAll?.(); setDownloadMenuOpen(false); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-bold text-brand-dark active:bg-brand-teal/10"><FileText size={14} className="text-brand-teal" /> Download Overview (PDF)</button>
              <p className="border-t border-brand-teal/10 px-3 py-2 text-[11px] text-brand-dark-soft">Detailed Staff attendance and commissions: Staff section.</p>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
          {error}
        </div>
      )}

      <div>
        <p className="mb-1 text-xs font-semibold text-brand-dark-soft">Reporting period</p>
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-brand-teal-light/25 p-3">
          <SelectDropdown value={selMonth} onChange={(value) => setSelMonth?.(Number(value))} options={months.map((month, index) => ({ value: index, label: month }))} className="min-w-0" />
          <SelectDropdown value={selYear} onChange={(value) => setSelYear?.(Number(value))} options={yearOptions.map((year) => ({ value: year, label: String(year) }))} className="min-w-0" />
        </div>
      </div>

      <div className="space-y-3">
        {sections.map((section) => {
          const isOpen = openSections[section.key];
          return (
            <div key={section.key} className="overflow-hidden rounded-lg border border-brand-dark-light/70 bg-white">
              <button
                type="button"
                onClick={() => onToggleSection?.(section.key)}
                className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <div className="min-w-0">
                  <h2 className="text-sm font-extrabold text-brand-dark">{section.title}</h2>
                  <p className="mt-0.5 truncate text-xs text-brand-dark-soft">{sectionStates[section.key]?.loading ? 'Updating…' : sectionStates[section.key]?.error ? 'Unable to update report' : !sectionStates[section.key]?.loaded ? 'Loading…' : section.summary}</p>
                </div>
                {isOpen ? <ChevronUp size={18} className="text-brand-dark-soft" /> : <ChevronDown size={18} className="text-brand-dark-soft" />}
              </button>

              {isOpen && (
                <div className="border-t border-brand-dark-light/70 px-4 py-3">
                  <ReportSectionState state={sectionStates[section.key]} onRetry={() => onRetrySection?.(section.key)}>
                  {section.key === 'appointments' && (
                    <div className="mb-4">
                      <AppointmentStatusColumnChart
                        data={apptData}
                        compact
                        onWeekClick={(week) => onViewAll?.('appointments', week)}
                      />
                    </div>
                  )}
                  {section.key === 'customers' && (
                    <div className="mb-4">
                      <LineTrendChart data={custData} valueKey="new_customers" label="New Customer Trend" compact onPointClick={(week) => onViewAll?.('customers', week)} />
                    </div>
                  )}
                  {section.key === 'pets' && (
                    <div className="mb-4 space-y-3">
                      <LineTrendChart data={petData} valueKey="total" label="Pet Registration Trend" color="#e58b2a" compact onPointClick={(week) => onViewAll?.('pets', week)} />
                    </div>
                  )}
                  {section.key === 'inventory' && inventorySalesData.length > 0 && (
                    <div className="mb-4">
                      <p className="mb-3 text-[10px] font-bold uppercase text-brand-dark-soft">Top Selling Items</p>
                      <HorizontalRankingChart data={inventorySalesData} labelKey="name" valueKey="units" limit={5} valueFormatter={(value) => `${value} sold`} />
                    </div>
                  )}
                  {section.key === 'staff' && <><div className="mb-3 flex justify-end"><div className="w-[230px] max-w-full"><SelectDropdown value={staffWeek} onChange={(value) => onStaffWeekChange?.(Number(value))} options={staffWeeks.map(({ value, label }) => ({ value, label }))} buttonClassName="!rounded-lg !border-brand-teal/20 !px-3 !py-2" textClassName="!text-xs !font-semibold" /></div></div><StaffOverviewTable rows={staffWeekRows} noRecords={staffAttendanceCount === 0 && staffCommissionCount === 0} /></>}
                  {section.key !== 'staff' && <div className="space-y-2">
                    {section.rows.map(([label, value]) => (
                      <div key={label} className="flex items-center justify-between gap-3 border-b border-brand-dark-light/60 pb-2 last:border-b-0 last:pb-0">
                        <span className="text-xs font-semibold text-brand-dark-soft">{label}</span>
                        <span className="text-sm font-extrabold text-brand-dark">{value}</span>
                      </div>
                    ))}
                  </div>}
                  {section.key === 'services' && serviceCancellationData.length > 0 && (
                    <div className="mt-3 rounded-xl border border-red-100 bg-red-50/60 p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-red-600">Cancellation reasons</p>
                      <div className="mt-1 divide-y divide-red-100">
                        {serviceCancellationData.map((item) => <div key={item.reason} className="flex items-center justify-between gap-3 py-1.5 text-xs"><span className="text-brand-dark">{item.reason}</span><span className="font-bold text-red-500">{item.count}</span></div>)}
                      </div>
                    </div>
                  )}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button type="button" disabled={sectionStates[section.key]?.loading || Boolean(sectionStates[section.key]?.error)} onClick={() => onViewAll?.(section.key, section.modalPeriod)} className="col-span-2 inline-flex min-h-[42px] items-center justify-center rounded-xl bg-brand-teal py-2 text-xs font-bold text-white transition-colors hover:bg-brand-teal-dark">
                      View All {section.title}
                    </button>
                    <button type="button" disabled={sectionStates[section.key]?.loading || Boolean(sectionStates[section.key]?.error)} onClick={() => onCSV?.(section.key)} className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-brand-teal/25 bg-white py-2 text-xs font-bold text-brand-teal transition-colors hover:bg-brand-teal/10">
                      <Download size={12} /> CSV
                    </button>
                    <button type="button" disabled={sectionStates[section.key]?.loading || Boolean(sectionStates[section.key]?.error)} onClick={() => onPDF?.(section.key)} className="inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-xl border border-brand-teal/25 bg-white py-2 text-xs font-bold text-brand-teal transition-colors hover:bg-brand-teal/10">
                      <FileText size={12} /> PDF
                    </button>
                  </div>
                  </ReportSectionState>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {viewAllModal.type === 'appointments' && (
        typeof document !== 'undefined' && createPortal(<ReportsViewAllAppointments isOpen={viewAllModal.isOpen} onClose={onCloseViewAll} period={viewAllModal.period} month={viewAllModal.month} year={viewAllModal.year} />, document.body)
      )}
      {viewAllModal.type === 'customers' && (
        typeof document !== 'undefined' && createPortal(<ReportsViewAllCustomers isOpen={viewAllModal.isOpen} onClose={onCloseViewAll} period={viewAllModal.period} month={viewAllModal.month} year={viewAllModal.year} />, document.body)
      )}
      {viewAllModal.type === 'pets' && (
        typeof document !== 'undefined' && createPortal(<ReportsViewAllPets isOpen={viewAllModal.isOpen} onClose={onCloseViewAll} period={viewAllModal.period} month={viewAllModal.month} year={viewAllModal.year} />, document.body)
      )}
      {viewAllModal.type === 'services' && (
        typeof document !== 'undefined' && createPortal(<ReportsViewAllServices isOpen={viewAllModal.isOpen} onClose={onCloseViewAll} services={svcData} pawsomeExtras={addonData} cancellationReasons={serviceCancellationData} period={periodLabel} />, document.body)
      )}
      {viewAllModal.type === 'inventory' && (
        typeof document !== 'undefined' && createPortal(<ReportsViewAllInventory isOpen={viewAllModal.isOpen} onClose={onCloseViewAll} items={inventoryData} salesItems={inventorySalesData} />, document.body)
      )}
      {viewAllModal.type === 'staff' && (
        typeof document !== 'undefined' && createPortal(<ReportsViewAllStaff isOpen={viewAllModal.isOpen} onClose={onCloseViewAll} year={selYear} month={selMonth + 1} view={viewMode} />, document.body)
      )}
    </section>
  );
}
