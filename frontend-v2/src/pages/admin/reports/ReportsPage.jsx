import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Download,
  FileText,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import useMediaQuery from "../../../hooks/useMediaQuery";
import {
  useReportStore,
  MONTHS,
  buildPeriods,
} from "../../../stores/reportStore";
import { apiFetch } from "../../../api/apiClient";
import SelectDropdown from "../../../components/reusable-ui/SelectDropdown";
import ReportsViewAllAppointments from "./ReportsViewAllAppointments";
import ReportsViewAllCustomers from "./ReportsViewAllCustomers";
import ReportsViewAllPets from "./ReportsViewAllPets";
import ReportsViewAllServices from "./ReportsViewAllServices";
import ReportsViewAllInventory from "./ReportsViewAllInventory";
import ReportsViewAllStaff from "./ReportsViewAllStaff";
import { downloadStaffReport } from "./staffReportExport";
import ReportsPage_MobileView from "./mobile/ReportsPage_MobileView";
import { formatCancellationReason } from "../../../utils/recordFormatters";
import PetBreedBreakdown from "./components/PetBreedBreakdown";
import StaffOverviewTable from "./components/StaffOverviewTable";
import { staffRowsForRange, staffWeekOptions } from "./staffWeeklyReport";
import {
  CollapsibleSection,
  CountPct,
  DetailRow,
  ReportTable,
  SectionHeader,
  ServiceBreakdownChart,
} from "./components/ReportSectionComponents";
import {
  buildBreedBreakdownRows,
  formatOwnerPets,
  formatPetWithId,
  formatReportBreed,
  formatServiceCategory,
  formatTime12h,
  getSpeciesSortRank,
  getWeekOfMonthLabel,
} from "./reportUtils";
import AppointmentStatusColumnChart from "./AppointmentStatusColumnChart";
import {
  HorizontalRankingChart,
  LineTrendChart,
  StaffPerformanceChart,
} from "./ReportCharts";
import {
  addPDFBarChart,
  addPDFLineChart,
  addPDFMetricLine,
  addPDFNote,
  addPDFSection,
  addPDFStackedChart,
  downloadCSV,
  downloadSectionedCSV,
  makePDFDoc,
  startPDFModule,
} from "./reportExportUtils";

// -- constants -----------------------------------------------------------------

const NOW = new Date();
const CURR_YEAR = NOW.getFullYear();
const SHOP_OPEN_YEAR = 2025;
const YEAR_OPTS = Array.from(
  { length: Math.max(1, CURR_YEAR - SHOP_OPEN_YEAR + 1) },
  (_, i) => CURR_YEAR - i,
);

// -- main page -----------------------------------------------------------------

export default function ReportsPage() {
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  const {
    viewMode,
    selYear,
    selMonth,
    apptData,
    custData,
    petData,
    svcData,
    addonData,
    serviceCancellationData,
    staffData,
    staffOverviewRows,
    staffAttendanceRows,
    staffCommissionRows,
    staffReportFilters,
    inventoryData,
    inventorySalesData,
    inventorySalesSummary,
    loading,
    error,
    offlineSnapshot,
    snapshotMessage,
    sections,
    setSelYear,
    setSelMonth,
    setStaffReportFilters,
    fetchReports,
  } = useReportStore();

  const [openSections, setOpenSections] = useState({
    appointments: true,
    customers: false,
    pets: false,
    services: false,
    inventory: false,
    staff: false,
  });

  const [viewAllModal, setViewAllModal] = useState({
    isOpen: false,
    type: "", // 'appointments', 'customers', 'pets', 'services', 'staff'
    period: "",
    month: "",
    year: "",
  });
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [hotelExtensions, setHotelExtensions] = useState({ summary: { charge_count: 0, extension_charges: 0, extension_payments: 0 }, records: [] });
  const [hotelExtensionError, setHotelExtensionError] = useState('');
  const hotelExtensionParams = `view=${viewMode}&year=${selYear}&month=${selMonth + 1}`;
  const loadHotelExtensions = useCallback(async () => {
    const response = await apiFetch(`/api/reports/hotel-extensions?${hotelExtensionParams}`);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.message || 'Unable to load Hotel extensions.');
    return payload.data || { summary: {}, records: [] };
  }, [hotelExtensionParams]);
  useEffect(() => {
    let active = true;
    setHotelExtensionError('');
    loadHotelExtensions().then((data) => { if (active) setHotelExtensions(data); })
      .catch((error) => { if (active) setHotelExtensionError(error?.message || 'Unable to load Hotel extensions.'); });
    return () => { active = false; };
  }, [loadHotelExtensions]);
  const hotelExtensionHead = ['Appointment', 'Pet', 'Size', 'Scheduled Checkout', 'Actual Checkout', 'Extra Minutes', 'Hours', 'Hourly Rate', 'Extension Charge', 'Payment Amount', 'Method', 'Status', 'Handled By', 'Recorded By', 'Recorded At'];
  const hotelExtensionRows = (report) => (report?.records || []).map((record) => [
    record.appointment_code || '', record.pet_name || '', record.pet_size || '',
    record.scheduled_checkout_at || '', record.actual_checkout_at || '',
    record.extra_minutes, record.billable_hours, record.hourly_rate,
    record.amount, record.payment_amount, record.payment_method || '',
    record.payment_status || '', record.handled_by || '', record.recorded_by || '',
    record.recorded_at || '',
  ]);
  const hotelExtensionPdfHead = ['Appointment', 'Pet / Size', 'Scheduled Checkout', 'Actual Checkout', 'Extra Minutes', 'Hours', 'Rate (PHP)', 'Charge (PHP)', 'Paid (PHP)', 'Payment', 'Handled By', 'Recorded By', 'Recorded At'];
  const hotelExtensionPdfRows = (report) => (report?.records || []).map((record) => [
    record.appointment_code || '', `${record.pet_name || ''} / ${record.pet_size || ''}`,
    record.scheduled_checkout_at || '', record.actual_checkout_at || '',
    record.extra_minutes, record.billable_hours,
    record.hourly_rate, record.amount, record.payment_amount, `${record.payment_status || ''} / ${record.payment_method || ''}`,
    record.handled_by || '', record.recorded_by || '', record.recorded_at || '',
  ]);
  const [staffWeek, setStaffWeek] = useState(0);
  const staffWeeks = useMemo(() => staffWeekOptions(selYear, selMonth), [selYear, selMonth]);
  const staffRange = staffWeeks.find((week) => week.value === staffWeek) || staffWeeks[0];
  const staffWeekRows = useMemo(() => staffRowsForRange(staffOverviewRows, staffAttendanceRows, staffCommissionRows, staffRange), [staffOverviewRows, staffAttendanceRows, staffCommissionRows, staffRange]);
  const staffAttendanceCount = staffWeekRows.reduce((sum, row) => sum + row.attendanceRecords, 0);
  const staffCommissionCount = staffWeekRows.reduce((sum, row) => sum + row.commissionRecords, 0);

  useEffect(() => { setStaffWeek(0); }, [selYear, selMonth]);

  const toggleSection = (section) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const openViewAllModal = (type, period) => {
    if (type === "staff") setStaffReportFilters({ from: staffRange.from, to: staffRange.to });
    setViewAllModal({
      isOpen: true,
      type,
      period,
      month: MONTHS[selMonth],
      year: selYear,
    });
  };

  const closeViewAllModal = () => {
    setViewAllModal({
      isOpen: false,
      type: "",
      period: "",
      month: "",
      year: "",
    });
  };

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const periods = buildPeriods(viewMode);
  const periodLabel =
    viewMode === "yearly" ? String(selYear) : `${MONTHS[selMonth]} ${selYear}`;

  // -- summary totals ------------------------------------------------------
  const totalAppts = apptData.reduce((s, r) => s + (r.total || 0), 0);
  const totalPending = apptData.reduce((s, r) => s + (r.pending || 0), 0);
  const totalApproved = apptData.reduce((s, r) => s + (r.approved || 0), 0);
  const totalInProgress = apptData.reduce(
    (s, r) => s + (r.in_progress || 0),
    0,
  );
  const totalCompleted = apptData.reduce((s, r) => s + (r.completed || 0), 0);
  const totalCancelled = apptData.reduce((s, r) => s + (r.cancelled || 0), 0);
  const totalNoShow = apptData.reduce((s, r) => s + (r.no_show || 0), 0);
  const totalNewCust = custData.reduce((s, r) => s + (r.new_customers || 0), 0);
  const totalServiceBookings = svcData.reduce(
    (s, service) => s + Number(service.total || 0),
    0,
  );
  const serviceUsageByCategory = Object.values(
    svcData.reduce((groups, service) => {
      const category = formatServiceCategory(service.category);
      if (!groups[category])
        groups[category] = { category, total: 0, services: [] };
      groups[category].total += Number(service.total || 0);
      groups[category].services.push(service);
      return groups;
    }, {}),
  )
    .sort((a, b) => a.category.localeCompare(b.category))
    .map((group) => ({
      ...group,
      services: [...group.services].sort((a, b) =>
        String(a.service || "").localeCompare(String(b.service || "")),
      ),
    }));
  const sortedSvcData = serviceUsageByCategory.flatMap(
    (group) => group.services,
  );
  const pawsomeExtrasUsage = addonData.reduce(
    (sum, extra) => sum + Number(extra.count || 0),
    0,
  );
  const serviceBreakdownRows = sortedSvcData.map((service) => [
    formatServiceCategory(service.category),
    service.breakdownType === "duration" ? "Duration" : "Package",
    service.service,
    service.total,
    service.completed,
    service.cancelled,
    service.pct,
  ]);
  const pawsomeExtrasRows = addonData.map((extra) => [extra.name, extra.count]);
  const serviceCancellationRows = serviceCancellationData.map((item) => [
    String(item.cancellation_type || "unknown").replace(/_/g, " "),
    item.reason,
    item.count,
  ]);
  const salesById = new Map(
    inventorySalesData
      .filter((item) => item.id)
      .map((item) => [String(item.id), item]),
  );
  const salesByName = new Map(
    inventorySalesData.map((item) => [item.name, item]),
  );
  const inventoryRows = inventoryData.map((item) => [
    item.code,
    item.name,
    item.category,
    item.stock,
    item.reorderLevel,
    item.sellingPrice,
    item.costPrice,
    item.status,
    (salesById.get(String(item.id)) || salesByName.get(item.name))?.units || 0,
    (salesById.get(String(item.id)) || salesByName.get(item.name))?.revenue ||
      0,
    (salesById.get(String(item.id)) || salesByName.get(item.name))?.profit || 0,
  ]);
  const inventoryExportHead = [
    "Item Code",
    "Item Name",
    "Category",
    "Stock",
    "Reorder Level",
    "Selling Price",
    "Cost Price",
    "Status",
    "Units Sold",
    "Sales Revenue",
    "Sales Profit",
  ];
  const totalSupplyUnits = inventoryData.reduce(
    (sum, item) => sum + Number(item.stock || 0),
    0,
  );
  const lowStockCount = inventoryData.filter(
    (item) => item.stock <= item.reorderLevel,
  ).length;
  const inventorySalesRows = inventorySalesData.map((item) => [
    item.name,
    item.units,
    item.revenue,
    item.profit,
  ]);

  // -- CSV ------------------------------------------------------------------
  const dlCSV = async (section) => {
    if (
      sections[section]?.loading ||
      !sections[section]?.loaded ||
      sections[section]?.error
    )
      return;
    if (section === "staff") {
      try { await downloadStaffReport({ group: "all", format: "csv", view: viewMode, year: selYear, month: selMonth + 1, ...staffReportFilters, from: staffRange.from, to: staffRange.to }); }
      catch (error) { window.alert(error.message || "Unable to export Staff Report."); }
      return;
    }
    if (section === "services") {
      const extensionReport = await loadHotelExtensions();
      const sections = [
        {
          title: "Service Booking Breakdown",
          headers: [
            "Category",
            "Breakdown",
            "Service / Selection",
            "Bookings",
            "Completed",
            "Cancelled",
            "% of All",
          ],
          rows: serviceBreakdownRows,
        },
      ];
      sections.push({ title: 'Hotel Suite Extensions', headers: hotelExtensionHead, rows: hotelExtensionRows(extensionReport) });
      sections.push({ title: 'Hotel Extension Payment Summary', headers: ['Charges', 'Extension Amount', 'Payments Received'], rows: [[extensionReport.summary?.charge_count || 0, extensionReport.summary?.extension_charges || 0, extensionReport.summary?.extension_payments || 0]] });
      if (pawsomeExtrasRows.length > 0)
        sections.push({
          title: "Pawsome Extras - Individual Services",
          headers: ["Individual Service", "Uses"],
          rows: pawsomeExtrasRows,
        });
      if (serviceCancellationRows.length > 0)
        sections.push({
          title: "Cancellation Reasons",
          headers: ["Cancellation Type", "Reason", "Count"],
          rows: serviceCancellationRows,
        });
      downloadSectionedCSV(`service_usage_${periodLabel}.csv`, sections);
      return;
    }

    if (section === "customers") {
      const monthIndex = selMonth + 1;
      const start = `${selYear}-${String(monthIndex).padStart(2, "0")}-01`;
      const end = `${selYear}-${String(monthIndex).padStart(2, "0")}-${String(new Date(selYear, monthIndex, 0).getDate()).padStart(2, "0")}`;
      const sections = [
        {
          title: "Customer Summary",
          headers: ["Period", "New Customers"],
          rows: custData.map((row, index) => [
            periods[index],
            row.new_customers,
          ]),
        },
      ];
      try {
        const response = await apiFetch(
          `/api/owners?start_date=${start}&end_date=${end}&per_page=1000`,
        );
        const payload = await response.json();
        const owners = payload.data?.data || payload.data || [];
        if (owners.length > 0)
          sections.push({
            title: "Customers and Their Pets",
            headers: ["Name", "Email", "Phone", "Pets", "Registration Date"],
            rows: owners.map((owner) => [
              `${owner.first_name || ""} ${owner.last_name || ""}`.trim(),
              owner.email || "",
              owner.phone || "",
              formatOwnerPets(owner),
              owner.created_at?.substring(0, 10) || "",
            ]),
          });
      } catch (error) {
        console.error("Failed to fetch customer pets for CSV:", error);
      }
      downloadSectionedCSV(`customers_${periodLabel}.csv`, sections);
      return;
    }

    if (section === "pets") {
      const monthIndex = selMonth + 1;
      const start = `${selYear}-${String(monthIndex).padStart(2, "0")}-01`;
      const end = `${selYear}-${String(monthIndex).padStart(2, "0")}-${String(new Date(selYear, monthIndex, 0).getDate()).padStart(2, "0")}`;
      const sections = [
        {
          title: "Pet Summary",
          headers: [
            "Period",
            "Total New Pets",
            "Dogs",
            "Dogs %",
            "Cats",
            "Cats %",
            "Others",
            "Others %",
          ],
          rows: petData.map((row, index) => [
            periods[index],
            row.total,
            row.dogs,
            row.dogs_pct,
            row.cats,
            row.cats_pct,
            row.others,
            row.others_pct,
          ]),
        },
      ];
      try {
        const response = await apiFetch(
          `/api/pets?start_date=${start}&end_date=${end}&per_page=1000`,
        );
        const payload = await response.json();
        const pets = payload.data?.data || payload.data || [];
        if (pets.length > 0)
          sections.push({
            title: "Breed Breakdown",
            headers: ["Species", "Breed", "Count"],
            rows: buildBreedBreakdownRows(pets),
          });
      } catch (error) {
        console.error("Failed to fetch breed breakdown for CSV:", error);
      }
      downloadSectionedCSV(`pets_${periodLabel}.csv`, sections);
      return;
    }

    if (section === "inventory") {
      downloadSectionedCSV(`supplies_${periodLabel}.csv`, [
        {
          title: "Supplies Summary",
          headers: ["Total Supplies", "Total Units in Stock"],
          rows: [[inventoryData.length, totalSupplyUnits]],
        },
        {
          title: "Supplies",
          headers: inventoryExportHead,
          rows: inventoryRows,
        },
      ]);
      return;
    }

    if (section === "appointments") {
      const extensionReport = await loadHotelExtensions();
      const monthIndex = selMonth + 1;
      const start = `${selYear}-${String(monthIndex).padStart(2, "0")}-01`;
      const end = `${selYear}-${String(monthIndex).padStart(2, "0")}-${String(new Date(selYear, monthIndex, 0).getDate()).padStart(2, "0")}`;
      const sections = [{
        title: "Appointment Summary",
        headers: ["Period", "Total", "Pending", "Approved", "In Progress", "Completed", "Cancelled", "Staff Rejections", "Customer Cancellations", "No Show"],
        rows: apptData.map((r, i) => [periods[i], r.total, r.pending, r.approved, r.in_progress, r.completed, r.cancelled, r.staff_rejections, r.customer_cancellations, r.no_show]),
      }];
      sections.push({ title: 'Hotel Suite Extensions', headers: hotelExtensionHead, rows: hotelExtensionRows(extensionReport) });
      sections.push({ title: 'Hotel Extension Payment Summary', headers: ['Charges', 'Extension Amount', 'Payments Received'], rows: [[extensionReport.summary?.charge_count || 0, extensionReport.summary?.extension_charges || 0, extensionReport.summary?.extension_payments || 0]] });
      try {
        const response = await apiFetch(`/api/appointments?start_date=${start}&end_date=${end}&status=cancelled&per_page=1000`);
        const payload = await response.json();
        const items = payload.data?.data || payload.data || [];
        sections.push({
          title: "Cancelled Appointment Details",
          headers: ["Appointment", "Date", "Pet", "Service", "Promotion", "Original Price", "Discount", "Final Price", "Cancellation Type", "Reason", "Cancelled By", "Cancelled At"],
          rows: items.map((a) => [
            a.appointment_code || a.id,
            a.appointment_date || "",
            formatPetWithId(a.pet),
            a.service?.name || "",
            a.promotion_title_snapshot || "",
            a.promotion_original_price ?? "",
            a.promotion_discount_amount ?? "",
            a.promotion_final_price ?? a.total_price ?? "",
            a.cancellation_type || "unknown",
            a.cancellation_reason || "No reason provided",
            a.cancelled_by_name || "",
            a.cancelled_at || "",
          ]),
        });
      } catch (error) {
        console.error("Failed to fetch cancelled appointments for CSV:", error);
      }
      downloadSectionedCSV(`appointments_${periodLabel}.csv`, sections);
      return;
    }

    const map = {
      appointments: {
        file: `appointments_${periodLabel}.csv`,
        head: [
          "Period",
          "Total",
          "Pending",
          "Pending %",
          "Approved",
          "Approved %",
          "In Progress",
          "In Progress %",
          "Completed",
          "Completed %",
          "Cancelled",
          "Cancelled %",
          "Staff Rejections",
          "Customer Cancellations",
          "No Show",
          "No Show %",
        ],
        rows: apptData.map((r, i) => [
          periods[i],
          r.total,
          r.pending,
          r.pending_pct,
          r.approved,
          r.approved_pct,
          r.in_progress,
          r.in_progress_pct,
          r.completed,
          r.completed_pct,
          r.cancelled,
          r.cancelled_pct,
          r.staff_rejections,
          r.customer_cancellations,
          r.no_show,
          r.no_show_pct,
        ]),
      },
      customers: {
        file: `customers_${periodLabel}.csv`,
        head: ["Period", "New Customers"],
        rows: custData.map((r, i) => [periods[i], r.new_customers]),
      },
      pets: {
        file: `pets_${periodLabel}.csv`,
        head: [
          "Period",
          "Total New Pets",
          "Dogs",
          "Dogs %",
          "Cats",
          "Cats %",
          "Others",
          "Others %",
        ],
        rows: petData.map((r, i) => [
          periods[i],
          r.total,
          r.dogs,
          r.dogs_pct,
          r.cats,
          r.cats_pct,
          r.others,
          r.others_pct,
        ]),
      },
      staff: {
        file: `staff_activity_${periodLabel}.csv`,
        head: [
          "Staff Name",
          "Email",
          "Type",
          "Total Handled",
          "Completed",
          "Cancelled",
        ],
        rows: staffData.map((r) => [
          r.name,
          r.email,
          r.staff_type,
          r.total,
          r.completed,
          r.cancelled,
        ]),
      },
    };
    const { file, head, rows } = map[section];
    downloadCSV(file, head, rows);
  };

  // -- PDF ------------------------------------------------------------------
  const TITLES = {
    appointments: "Appointment Summary",
    customers: "Customer Registrations",
    pets: "Pet Registrations",
    services: "Service Usage",
    inventory: "Supplies",
    staff: "Staff Activity",
  };

  const getPDFCfg = () => ({
    appointments_status: {
      head: [
        "Period",
        "Total",
        "Pending",
        "Approved",
        "In Progress",
        "Completed",
        "Cancelled",
        "Staff Rejections",
        "Customer Cancellations",
        "No Show",
      ],
      rows: apptData.map((r, i) => [
        periods[i],
        r.total,
        r.pending,
        r.approved,
        r.in_progress,
        r.completed,
        r.cancelled,
        r.staff_rejections,
        r.customer_cancellations,
        r.no_show,
      ]),
    },
    appointments_service: {
      head: ["Period", "Grooming", "Daycare", "Hotel"],
      rows: apptData.map((r, i) => [
        periods[i],
        r.grooming,
        r.daycare,
        r.hotel,
      ]),
    },
    customers: {
      head: ["Period", "New Customers"],
      rows: custData.map((r, i) => [periods[i], r.new_customers]),
    },
    pets: {
      head: ["Period", "Total", "Dogs", "Cats", "Others"],
      rows: petData.map((r, i) => [
        periods[i],
        r.total,
        r.dogs,
        r.cats,
        r.others,
      ]),
    },
    services: {
      head: [
        "Category",
        "Breakdown",
        "Service / Selection",
        "Bookings",
        "Completed",
        "Cancelled",
        "%",
      ],
      rows: serviceBreakdownRows,
    },
    inventory: { head: inventoryExportHead, rows: inventoryRows },
    staff: {
      head: [
        "Staff Name",
        "Email",
        "Type",
        "Total Handled",
        "Completed",
        "Cancelled",
      ],
      rows: staffData.map((r) => [
        r.name,
        r.email,
        r.staff_type,
        r.total,
        r.completed,
        r.cancelled,
      ]),
    },
  });

  const dlPDF = async (section) => {
    if (
      sections[section]?.loading ||
      !sections[section]?.loaded ||
      sections[section]?.error
    )
      return;
    if (section === "staff") {
      try { await downloadStaffReport({ group: "all", format: "pdf", view: viewMode, year: selYear, month: selMonth + 1, ...staffReportFilters, from: staffRange.from, to: staffRange.to }); }
      catch (error) { window.alert(error.message || "Unable to export Staff Report."); }
      return;
    }
    let extensionReport = null;
    if (section === 'appointments' || section === 'services') {
      try { extensionReport = await loadHotelExtensions(); }
      catch (error) { window.alert(error.message || 'Unable to load Hotel extension records.'); return; }
    }
    const {
      doc,
      autoTable,
      y: y0,
    } = await makePDFDoc(`${TITLES[section]} Report`, periodLabel);
    let y = y0;

    if (section === "appointments") {
      const cfg = getPDFCfg();
      const colStyles = { 0: { cellWidth: 28 } };
      y = addPDFMetricLine(doc, "Total Appointments", totalAppts, y);
      y = addPDFLineChart(doc, "Appointment Trend", apptData.map((row, index) => ({ label: periods[index], value: row.total })), y);
      y = addPDFSection(
        doc,
        autoTable,
        "Status Breakdown",
        cfg.appointments_status.head,
        cfg.appointments_status.rows,
        y,
        colStyles,
      );
      y = addPDFMetricLine(doc, 'Hotel Extension Charges', `PHP ${Number(extensionReport?.summary?.extension_charges || 0).toFixed(2)}`, y);
      y = addPDFMetricLine(doc, 'Hotel Extension Payments', `PHP ${Number(extensionReport?.summary?.extension_payments || 0).toFixed(2)}`, y);
      y = addPDFSection(doc, autoTable, 'Hotel Suite Extensions', hotelExtensionPdfHead, hotelExtensionPdfRows(extensionReport), y);
    } else if (section === "services") {
      const cfg = getPDFCfg();
      y = addPDFMetricLine(
        doc,
        "Total Service Bookings",
        totalServiceBookings,
        y,
      );
      y = addPDFBarChart(doc, "Service Booking Mix", serviceUsageByCategory.map((group) => ({ label: group.category, value: group.total })), y, [[155, 93, 229], [34, 166, 179], [243, 156, 61]]);
      y = addPDFSection(
        doc,
        autoTable,
        "Service Booking Breakdown",
        cfg.services.head,
        cfg.services.rows,
        y,
      );
      y = addPDFMetricLine(doc, 'Hotel Extension Charges', `PHP ${Number(extensionReport?.summary?.extension_charges || 0).toFixed(2)}`, y);
      y = addPDFMetricLine(doc, 'Hotel Extension Payments', `PHP ${Number(extensionReport?.summary?.extension_payments || 0).toFixed(2)}`, y);
      y = addPDFSection(doc, autoTable, 'Hotel Suite Extensions', hotelExtensionPdfHead, hotelExtensionPdfRows(extensionReport), y);
      if (pawsomeExtrasRows.length > 0)
        y = addPDFSection(
          doc,
          autoTable,
          "Pawsome Extras - Individual Services",
          ["Individual Service", "Uses"],
          pawsomeExtrasRows,
          y,
        );
      if (serviceCancellationRows.length > 0)
        y = addPDFSection(
          doc,
          autoTable,
          "Cancellation Reasons",
          ["Cancellation Type", "Reason", "Count"],
          serviceCancellationRows,
          y,
        );
    } else if (section === "inventory") {
      const cfg = getPDFCfg();
      y = addPDFMetricLine(doc, "Total Supplies", inventoryData.length, y);
      y = addPDFMetricLine(doc, "Total Units in Stock", totalSupplyUnits, y);
      y = addPDFBarChart(doc, "Top Selling Items", inventorySalesData.map((item) => ({ label: item.name, value: item.units })), y);
      y = addPDFSection(
        doc,
        autoTable,
        "Supplies",
        cfg.inventory.head,
        cfg.inventory.rows,
        y,
      );
    } else {
      const { head, rows } = getPDFCfg()[section];
      if (section === "customers") {
        y = addPDFLineChart(doc, "New Customer Trend", custData.map((row, index) => ({ label: periods[index], value: row.new_customers })), y);
      } else if (section === "pets") {
        y = addPDFLineChart(doc, "Pet Registration Trend", petData.map((row, index) => ({ label: periods[index], value: row.total })), y);
      } else if (section === "staff") {
        y = addPDFStackedChart(doc, "Staff Performance", staffData.map((row) => ({ label: row.name, total: row.total, completed: row.completed, cancelled: row.cancelled })), y);
      }
      y = addPDFSection(
        doc,
        autoTable,
        `${TITLES[section]} - Summary`,
        head,
        rows,
        y,
      );
    }

    // Fetch full monthly list
    try {
      let listData = [];
      let listHead = [];
      let listTitle = "";

      if (section === "appointments") {
        const monthIndex = selMonth + 1;
        const start = `${selYear}-${String(monthIndex).padStart(2, "0")}-01`;
        const lastDay = new Date(selYear, monthIndex, 0).getDate();
        const end = `${selYear}-${String(monthIndex).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

        const response = await apiFetch(
          `/api/appointments?start_date=${start}&end_date=${end}&per_page=1000`,
        );
        const json = await response.json();
        const items = json.data?.data || [];
        listHead = [
          "Week",
          "Date",
          "Check In Time",
          "Check Out Time",
          "Pet",
          "Owner",
          "Service",
          "Status",
          "Promotion",
          "Original Price",
          "Discount",
          "Final Price",
          "Cancellation Type",
          "Cancellation Reason",
          "Cancelled By",
          "Cancelled At",
        ];
        listData = items.map((a) => {
          return [
            getWeekOfMonthLabel(a.appointment_date),
            a.appointment_date,
            formatTime12h(a.check_in_time || a.start_time),
            formatTime12h(a.check_out_time),
            formatPetWithId(a.pet),
            a.pet?.owner
              ? `${a.pet.owner.first_name || ""} ${a.pet.owner.last_name || ""}`.trim()
              : "",
            a.service?.name || "",
            a.status,
            a.promotion_title_snapshot || "",
            a.promotion_original_price ?? "",
            a.promotion_discount_amount ?? "",
            a.promotion_final_price ?? a.total_price ?? "",
            a.cancellation_type || "",
            a.cancellation_reason || "",
            a.cancelled_by_name || "",
            a.cancelled_at || "",
          ];
        });
        listTitle = "Full Monthly Appointments List";
      } else if (section === "customers") {
        const monthIndex = selMonth + 1;
        const start = `${selYear}-${String(monthIndex).padStart(2, "0")}-01`;
        const lastDay = new Date(selYear, monthIndex, 0).getDate();
        const end = `${selYear}-${String(monthIndex).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

        const response = await apiFetch(
          `/api/owners?start_date=${start}&end_date=${end}&per_page=1000`,
        );
        const json = await response.json();
        const items = json.data?.data || json.data || [];
        listHead = ["Name", "Email", "Phone", "Pets", "Registration Date"];
        listData = items.map((c) => [
          `${c.first_name || ""} ${c.last_name || ""}`.trim(),
          c.email || "",
          c.phone || "",
          formatOwnerPets(c),
          c.created_at?.substring(0, 10) || "",
        ]);
        listTitle = "Customers and Their Pets";
      } else if (section === "pets") {
        const monthIndex = selMonth + 1;
        const start = `${selYear}-${String(monthIndex).padStart(2, "0")}-01`;
        const lastDay = new Date(selYear, monthIndex, 0).getDate();
        const end = `${selYear}-${String(monthIndex).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

        const response = await apiFetch(
          `/api/pets?start_date=${start}&end_date=${end}&per_page=1000`,
        );
        const json = await response.json();
        const items = json.data?.data || json.data || [];
        listHead = ["Pet", "Species", "Breed", "Owner", "Registration Date"];
        listData = items.map((p) => [
          formatPetWithId(p),
          p.species_type?.name || "",
          formatReportBreed(p),
          `${p.owner?.first_name || ""} ${p.owner?.last_name || ""}`.trim(),
          p.created_at?.substring(0, 10) || "",
        ]);
        listTitle = "Full Monthly Pets List";

        // Add breed breakdown
        if (items.length > 0) {
          y = addPDFSection(doc, autoTable, listTitle, listHead, listData, y);
          const breedCounts = {};
          items.forEach((p) => {
            const breed = formatReportBreed(p);
            const species = p.species_type?.name || "Unknown";
            const key = `${breed} (${species})`;
            if (!breedCounts[key])
              breedCounts[key] = { breed, species, count: 0 };
            breedCounts[key].count += 1;
          });
          const breedData = Object.values(breedCounts)
            .sort((a, b) => {
              const speciesA = getSpeciesSortRank(a.species);
              const speciesB = getSpeciesSortRank(b.species);
              if (speciesA !== speciesB) return speciesA - speciesB;
              if (b.count !== a.count) return b.count - a.count;
              return a.breed.localeCompare(b.breed);
            })
            .map((item) => [item.species, item.breed, item.count]);
          y = addPDFSection(
            doc,
            autoTable,
            "Breed Breakdown",
            ["Species", "Breed", "Count"],
            breedData,
            y,
          );
          listData = []; // Clear to prevent duplicate
        }
      } else if (section === "staff") {
        const response = await apiFetch(
          "/api/admin/users?role=staff&per_page=1000",
        );
        const json = await response.json();
        const items = json.data?.data || json.data || [];
        listHead = ["Name", "Email", "Role", "Status"];
        listData = items.map((u) => [
          u.name || "",
          u.email || "",
          u.role || "",
          u.status || (u.is_active ? "Active" : "Inactive"),
        ]);
        listTitle = "All Staff List";
      }

      if (listData.length > 0) {
        y = addPDFSection(doc, autoTable, listTitle, listHead, listData, y);
      }

      // Add note for staff section
      if (section === "staff") {
        addPDFNote(
          doc,
          "Note: Total = all appointments assigned to staff member. Completed = appointments successfully finished. Cancelled = appointments that were cancelled.",
          y,
        );
      }
    } catch (err) {
      console.error("Failed to fetch list data for PDF:", err);
    }

    doc.save(`${section}_${periodLabel}.pdf`);
  };

  const downloadAll = async () => {
    if (
      loading ||
      Object.values(sections).some((s) => s.error) ||
      Object.keys(sections).length < 6
    )
      return;
    let extensionReport;
    try { extensionReport = await loadHotelExtensions(); }
    catch (error) { window.alert(error.message || 'Unable to load Hotel extension records.'); return; }
    const {
      doc,
      autoTable,
      y: y0,
    } = await makePDFDoc("Reports Overview", periodLabel);
    const cfg = getPDFCfg();
    let y = y0;
    const apptColStyles = { 0: { cellWidth: 28 } };

    // === APPOINTMENTS SECTION ===
    y = addPDFMetricLine(doc, "Total Appointments", totalAppts, y);
    y = addPDFLineChart(doc, "Appointment Trend", apptData.map((row, index) => ({ label: periods[index], value: row.total })), y);
    y = addPDFSection(
      doc,
      autoTable,
      "Appointments - Status Breakdown",
      cfg.appointments_status.head,
      cfg.appointments_status.rows,
      y,
      apptColStyles,
    );
    y = addPDFMetricLine(doc, 'Hotel Extension Charges', `PHP ${Number(extensionReport.summary?.extension_charges || 0).toFixed(2)}`, y);
    y = addPDFMetricLine(doc, 'Hotel Extension Payments', `PHP ${Number(extensionReport.summary?.extension_payments || 0).toFixed(2)}`, y);
    y = addPDFSection(doc, autoTable, 'Hotel Suite Extensions', hotelExtensionPdfHead, hotelExtensionPdfRows(extensionReport), y);

    // Fetch full lists
    try {
      const monthIndex = selMonth + 1;
      const start = `${selYear}-${String(monthIndex).padStart(2, "0")}-01`;
      const lastDay = new Date(selYear, monthIndex, 0).getDate();
      const end = `${selYear}-${String(monthIndex).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      // Appointments list (right after appointment summaries)
      const apptResponse = await apiFetch(
        `/api/appointments?start_date=${start}&end_date=${end}&per_page=1000`,
      );
      const apptJson = await apptResponse.json();
      const apptItems = apptJson.data?.data || [];
      if (apptItems.length > 0) {
        const apptData = apptItems.map((a) => {
          const checkInTime = formatTime12h(a.check_in_time || a.start_time);
          const checkOutTime = formatTime12h(a.check_out_time);
          return [
            getWeekOfMonthLabel(a.appointment_date),
            a.appointment_date,
            checkInTime,
            checkOutTime,
            formatPetWithId(a.pet),
            a.pet?.owner
              ? `${a.pet.owner.first_name || ""} ${a.pet.owner.last_name || ""}`.trim()
              : "",
            a.service?.name || "",
            a.status,
          ];
        });
        y = addPDFSection(
          doc,
          autoTable,
          "Full Monthly Appointments List",
          [
            "Week",
            "Date",
            "Check In Time",
            "Check Out Time",
            "Pet",
            "Owner",
            "Service",
            "Status",
            "Promotion",
            "Original Price",
            "Discount",
            "Final Price",
          ],
          apptData,
          y,
        );
      }

      // === CUSTOMERS SECTION ===
      y = startPDFModule(doc, "Customers", periodLabel);
      y = addPDFLineChart(doc, "New Customer Trend", custData.map((row, index) => ({ label: periods[index], value: row.new_customers })), y);
      y = addPDFSection(
        doc,
        autoTable,
        "Customers - Summary",
        cfg.customers.head,
        cfg.customers.rows,
        y,
      );

      // Customers list
      const custResponse = await apiFetch(
        `/api/owners?start_date=${start}&end_date=${end}&per_page=1000`,
      );
      const custJson = await custResponse.json();
      const custItems = custJson.data?.data || custJson.data || [];
      if (custItems.length > 0) {
        const custData = custItems.map((c) => [
          `${c.first_name || ""} ${c.last_name || ""}`.trim(),
          c.email || "",
          c.phone || "",
          formatOwnerPets(c),
          c.created_at?.substring(0, 10) || "",
        ]);
        y = addPDFSection(
          doc,
          autoTable,
          "Customers and Their Pets",
          ["Name", "Email", "Phone", "Pets", "Registration Date"],
          custData,
          y,
        );
      }

      // === PETS SECTION ===
      y = startPDFModule(doc, "Pets", periodLabel);
      y = addPDFLineChart(doc, "Pet Registration Trend", petData.map((row, index) => ({ label: periods[index], value: row.total })), y);
      y = addPDFSection(
        doc,
        autoTable,
        "Pets - Summary",
        cfg.pets.head,
        cfg.pets.rows,
        y,
      );

      // Pets list
      const petResponse = await apiFetch(
        `/api/pets?start_date=${start}&end_date=${end}&per_page=1000`,
      );
      const petJson = await petResponse.json();
      const petItems = petJson.data?.data || petJson.data || [];
      if (petItems.length > 0) {
        const petData = petItems.map((p) => [
          formatPetWithId(p),
          p.species_type?.name || "",
          formatReportBreed(p),
          `${p.owner?.first_name || ""} ${p.owner?.last_name || ""}`.trim(),
          p.created_at?.substring(0, 10) || "",
        ]);
        y = addPDFSection(
          doc,
          autoTable,
          "Full Monthly Pets List",
          ["Pet", "Species", "Breed", "Owner", "Registration Date"],
          petData,
          y,
        );

        // Breed breakdown (same as individual pets PDF)
        const breedCounts = {};
        petItems.forEach((p) => {
          const breed = formatReportBreed(p);
          const species = p.species_type?.name || "Unknown";
          const key = `${breed} (${species})`;
          if (!breedCounts[key])
            breedCounts[key] = { breed, species, count: 0 };
          breedCounts[key].count += 1;
        });
        const breedData = Object.values(breedCounts)
          .sort((a, b) => {
            const speciesA = getSpeciesSortRank(a.species);
            const speciesB = getSpeciesSortRank(b.species);
            if (speciesA !== speciesB) return speciesA - speciesB;
            if (b.count !== a.count) return b.count - a.count;
            return a.breed.localeCompare(b.breed);
          })
          .map((item) => [item.species, item.breed, item.count]);
        y = addPDFSection(
          doc,
          autoTable,
          "Breed Breakdown",
          ["Species", "Breed", "Count"],
          breedData,
          y,
        );
      }

      // === SERVICES SECTION ===
      y = startPDFModule(doc, "Services", periodLabel);
      y = addPDFMetricLine(
        doc,
        "Total Service Bookings",
        totalServiceBookings,
        y,
      );
      y = addPDFBarChart(doc, "Service Booking Mix", serviceUsageByCategory.map((group) => ({ label: group.category, value: group.total })), y, [[155, 93, 229], [34, 166, 179], [243, 156, 61]]);
      y = addPDFSection(
        doc,
        autoTable,
        "Service Booking Breakdown",
        cfg.services.head,
        cfg.services.rows,
        y,
      );
      if (pawsomeExtrasRows.length > 0)
        y = addPDFSection(
          doc,
          autoTable,
          "Pawsome Extras - Individual Services",
          ["Individual Service", "Uses"],
          pawsomeExtrasRows,
          y,
        );
      if (serviceCancellationRows.length > 0)
        y = addPDFSection(
          doc,
          autoTable,
          "Cancellation Reasons",
          ["Cancellation Type", "Reason", "Count"],
          serviceCancellationRows,
          y,
        );

      y = startPDFModule(doc, "Supplies", periodLabel);
      y = addPDFMetricLine(doc, "Total Supplies", inventoryData.length, y);
      y = addPDFMetricLine(doc, "Total Units in Stock", totalSupplyUnits, y);
      y = addPDFBarChart(doc, "Top Selling Items", inventorySalesData.map((item) => ({ label: item.name, value: item.units })), y);
      y = addPDFSection(
        doc,
        autoTable,
        "Supplies",
        cfg.inventory.head,
        cfg.inventory.rows,
        y,
      );

      // === STAFF SECTION ===
      y = startPDFModule(doc, "Staff", periodLabel);
      y = addPDFStackedChart(doc, "Staff Performance", staffData.map((row) => ({ label: row.name, total: row.total, completed: row.completed, cancelled: row.cancelled })), y);
      y = addPDFSection(
        doc,
        autoTable,
        "Staff Activity - Summary",
        cfg.staff.head,
        cfg.staff.rows,
        y,
      );

      // Staff list
      const staffResponse = await apiFetch(
        "/api/admin/users?role=staff&per_page=1000",
      );
      const staffJson = await staffResponse.json();
      const staffItems = staffJson.data?.data || staffJson.data || [];
      if (staffItems.length > 0) {
        const staffData = staffItems.map((u) => [
          u.name || "",
          u.email || "",
          u.role || "",
          u.status || (u.is_active ? "Active" : "Inactive"),
        ]);
        y = addPDFSection(
          doc,
          autoTable,
          "All Staff List",
          ["Name", "Email", "Role", "Status"],
          staffData,
          y,
        );
      }

      // Add note after staff section (same as individual staff PDF)
      addPDFNote(
        doc,
        "Note: Total = all appointments assigned to staff member. Completed = appointments successfully finished. Cancelled = appointments that were cancelled.",
        y,
      );
    } catch (err) {
      console.error("Failed to fetch list data for PDF:", err);
    }

    doc.save(`reports_overview_${periodLabel}.pdf`);
  };

  const downloadAllCSV = async () => {
    if (
      loading ||
      Object.values(sections).some((s) => s.error) ||
      Object.keys(sections).length < 6
    )
      return;
    let extensionReport;
    try { extensionReport = await loadHotelExtensions(); }
    catch (error) { window.alert(error.message || 'Unable to load Hotel extension records.'); return; }
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [];
    const addSection = (title, headers, rows) => {
      lines.push(esc(`========== ${title.toUpperCase()} ==========`));
      lines.push(headers.map(esc).join(","));
      rows.forEach((r) => lines.push(r.map(esc).join(",")));
      lines.push("");
      lines.push("");
    };

    addSection(
      "Appointments - Status Breakdown",
      [
        "Period",
        "Total",
        "Pending",
        "Pending %",
        "Approved",
        "Approved %",
        "In Progress",
        "In Progress %",
        "Completed",
        "Completed %",
        "Cancelled",
        "Cancelled %",
        "Staff Rejections",
        "Customer Cancellations",
        "No Show",
        "No Show %",
      ],
      apptData.map((r, i) => [
        periods[i],
        r.total,
        r.pending,
        r.pending_pct,
        r.approved,
        r.approved_pct,
        r.in_progress,
        r.in_progress_pct,
        r.completed,
        r.completed_pct,
        r.cancelled,
        r.cancelled_pct,
        r.staff_rejections,
        r.customer_cancellations,
        r.no_show,
        r.no_show_pct,
      ]),
    );
    addSection('Hotel Suite Extensions', hotelExtensionHead, hotelExtensionRows(extensionReport));
    addSection('Hotel Extension Payment Summary', ['Charges', 'Extension Amount', 'Payments Received'], [[extensionReport.summary?.charge_count || 0, extensionReport.summary?.extension_charges || 0, extensionReport.summary?.extension_payments || 0]]);
    addSection(
      "Customers",
      ["Period", "New Customers"],
      custData.map((r, i) => [periods[i], r.new_customers]),
    );
    addSection(
      "Pets",
      [
        "Period",
        "Total New Pets",
        "Dogs",
        "Dogs %",
        "Cats",
        "Cats %",
        "Others",
        "Others %",
      ],
      petData.map((r, i) => [
        periods[i],
        r.total,
        r.dogs,
        r.dogs_pct,
        r.cats,
        r.cats_pct,
        r.others,
        r.others_pct,
      ]),
    );
    addSection(
      "Service Booking Breakdown",
      [
        "Category",
        "Breakdown",
        "Service / Selection",
        "Bookings",
        "Completed",
        "Cancelled",
        "% of All",
      ],
      serviceBreakdownRows,
    );
    if (pawsomeExtrasRows.length > 0)
      addSection(
        "Pawsome Extras - Individual Services",
        ["Individual Service", "Uses"],
        pawsomeExtrasRows,
      );
    if (serviceCancellationRows.length > 0)
      addSection(
        "Cancellation Reasons",
        ["Cancellation Type", "Reason", "Count"],
        serviceCancellationRows,
      );
    addSection(
      "Supplies Summary",
      ["Total Supplies", "Total Units in Stock"],
      [[inventoryData.length, totalSupplyUnits]],
    );
    addSection("Supplies", inventoryExportHead, inventoryRows);
    addSection(
      "Staff Activity",
      [
        "Staff Name",
        "Email",
        "Type",
        "Total Handled",
        "Completed",
        "Cancelled",
      ],
      staffData.map((r) => [
        r.name,
        r.email,
        r.staff_type,
        r.total,
        r.completed,
        r.cancelled,
      ]),
    );

    try {
      const monthIndex = selMonth + 1;
      const start = `${selYear}-${String(monthIndex).padStart(2, "0")}-01`;
      const lastDay = new Date(selYear, monthIndex, 0).getDate();
      const end = `${selYear}-${String(monthIndex).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      const apptResponse = await apiFetch(
        `/api/appointments?start_date=${start}&end_date=${end}&per_page=1000`,
      );
      const apptItems = (await apptResponse.json()).data?.data || [];
      if (apptItems.length > 0) {
        addSection(
          "Full Monthly Appointments List",
          [
            "Week",
            "Date",
            "Check In Time",
            "Check Out Time",
            "Pet",
            "Owner",
            "Service",
            "Status",
            "Promotion",
            "Original Price",
            "Discount",
            "Final Price",
            "Cancellation Type",
            "Cancellation Reason",
            "Cancelled By",
            "Cancelled At",
          ],
          apptItems.map((a) => {
            const checkIn = formatTime12h(a.check_in_time || a.start_time);
            const checkOut = formatTime12h(a.check_out_time);
            return [
              getWeekOfMonthLabel(a.appointment_date),
              a.appointment_date,
              checkIn,
              checkOut,
              formatPetWithId(a.pet),
              a.pet?.owner
                ? `${a.pet.owner.first_name || ""} ${a.pet.owner.last_name || ""}`.trim()
                : "",
              a.service?.name || "",
              a.status,
              a.promotion_title_snapshot || "",
              a.promotion_original_price ?? "",
              a.promotion_discount_amount ?? "",
              a.promotion_final_price ?? a.total_price ?? "",
              a.cancellation_type || "",
              a.cancellation_reason || "",
              a.cancelled_by_name || "",
              a.cancelled_at || "",
            ];
          }),
        );
      }

      const custResponse = await apiFetch(
        `/api/owners?start_date=${start}&end_date=${end}&per_page=1000`,
      );
      const custItems = (await custResponse.json()).data?.data || [];
      if (custItems.length > 0) {
        addSection(
          "Customers and Their Pets",
          ["Name", "Email", "Phone", "Pets", "Registration Date"],
          custItems.map((c) => [
            `${c.first_name || ""} ${c.last_name || ""}`.trim(),
            c.email || "",
            c.phone || "",
            formatOwnerPets(c),
            c.created_at?.substring(0, 10) || "",
          ]),
        );
      }

      const petResponse = await apiFetch(
        `/api/pets?start_date=${start}&end_date=${end}&per_page=1000`,
      );
      const petItems = (await petResponse.json()).data?.data || [];
      if (petItems.length > 0) {
        addSection(
          "Full Monthly Pets List",
          ["Pet", "Species", "Breed", "Owner", "Registration Date"],
          petItems.map((p) => [
            formatPetWithId(p),
            p.species_type?.name || "",
            formatReportBreed(p),
            `${p.owner?.first_name || ""} ${p.owner?.last_name || ""}`.trim(),
            p.created_at?.substring(0, 10) || "",
          ]),
        );
        addSection(
          "Breed Breakdown",
          ["Species", "Breed", "Count"],
          buildBreedBreakdownRows(petItems),
        );
      }

      const staffResponse = await apiFetch(
        "/api/admin/users?role=staff&per_page=1000",
      );
      const staffItems = (await staffResponse.json()).data?.data || [];
      if (staffItems.length > 0) {
        addSection(
          "All Staff List",
          ["Name", "Email", "Role", "Status"],
          staffItems.map((u) => [
            u.name || "",
            u.email || "",
            u.role || "",
            u.status || (u.is_active ? "Active" : "Inactive"),
          ]),
        );
      }
    } catch (err) {
      console.error("Failed to fetch list data for CSV:", err);
    }

    const blob = new Blob([lines.join("\n")], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), {
      href: url,
      download: `reports_overview_${periodLabel}.csv`,
    });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!isDesktop) {
    return (
      <>
        <ReportsPage_MobileView
          loading={loading}
          sections={sections}
          onRetrySection={(section) => fetchReports({ force: true, section })}
          error={error}
          offlineSnapshot={offlineSnapshot}
          snapshotMessage={snapshotMessage}
          selMonth={selMonth}
          selYear={selYear}
          viewMode={viewMode}
          setSelMonth={setSelMonth}
          setSelYear={setSelYear}
          months={MONTHS}
          yearOptions={YEAR_OPTS}
          periodLabel={periodLabel}
          totalAppts={totalAppts}
          totalPending={totalPending}
          totalApproved={totalApproved}
          totalInProgress={totalInProgress}
          totalCompleted={totalCompleted}
          totalCancelled={totalCancelled}
          totalNoShow={totalNoShow}
          totalNewCust={totalNewCust}
          apptData={apptData}
          custData={custData}
          petData={petData}
          svcData={svcData}
          addonData={addonData}
          serviceCancellationData={serviceCancellationData}
          staffAttendanceCount={staffAttendanceCount}
          staffCommissionCount={staffCommissionCount}
          staffWeekRows={staffWeekRows}
          staffWeek={staffWeek}
          staffWeeks={staffWeeks}
          onStaffWeekChange={setStaffWeek}
          inventoryData={inventoryData}
          inventorySalesData={inventorySalesData}
          inventorySalesSummary={inventorySalesSummary}
          openSections={openSections}
          onToggleSection={toggleSection}
          onCSV={dlCSV}
          onPDF={dlPDF}
          onDownloadAll={downloadAll}
          onDownloadAllCSV={downloadAllCSV}
          onViewAll={openViewAllModal}
          viewAllModal={viewAllModal}
          onCloseViewAll={closeViewAllModal}
        />
      </>
    );
  }

  return (
    <section className="space-y-5 py-4">
      {/* Loading overlay */}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-600">
          {error}
        </div>
      )}

      {offlineSnapshot && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm font-semibold text-amber-700">
          {snapshotMessage ||
            "Offline snapshot: report data may be stale until reconnect."}
        </div>
      )}

      {/* -- Page header -------------------------------------------------- */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold text-brand-teal-dark">
            Reports &amp; <span className="text-brand-dark">Records</span>
          </h1>
          <p className="text-sm text-brand-dark-soft">
            View, download, and analyze all reports and records.
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          <div className="relative">
            <button
              type="button"
              onClick={() => setDownloadMenuOpen((open) => !open)}
              className="flex items-center gap-2 rounded-xl bg-brand-teal px-5 py-2.5 text-sm font-bold text-white shadow-[0_4px_10px_rgba(36,119,122,0.25)] transition-colors hover:bg-brand-teal-dark"
            >
              <Download size={15} /> Download{" "}
              <ChevronDown
                size={15}
                className={`transition-transform ${downloadMenuOpen ? "rotate-180" : ""}`}
              />
            </button>
            {downloadMenuOpen && (
              <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-56 overflow-hidden rounded-xl border border-brand-teal/20 bg-white p-1.5 shadow-xl">
                <button
                  type="button"
                  disabled={
                    loading || Object.values(sections).some((s) => s.error)
                  }
                  onClick={() => {
                    downloadAllCSV();
                    setDownloadMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-bold text-brand-dark transition hover:bg-brand-teal/10"
                >
                  <Download size={14} className="text-brand-teal" /> Download
                  Overview (CSV)
                </button>
                <button
                  type="button"
                  disabled={
                    loading || Object.values(sections).some((s) => s.error)
                  }
                  onClick={() => {
                    downloadAll();
                    setDownloadMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs font-bold text-brand-dark transition hover:bg-brand-teal/10"
                >
                  <FileText size={14} className="text-brand-teal" /> Download
                  Overview (PDF)
                </button>
                <p className="border-t border-brand-teal/10 px-3 py-2 text-[11px] text-brand-dark-soft">Detailed Staff attendance and commissions: Staff section.</p>
              </div>
            )}
          </div>
          <div>
            <p className="mb-1 text-right text-xs font-semibold text-brand-dark-soft">Reporting period</p>
            <div className="flex items-center gap-2">
            <div className="w-[170px]">
              <SelectDropdown
                value={selMonth}
                onChange={(value) => setSelMonth(Number(value))}
                options={MONTHS.map((month, index) => ({
                  value: index,
                  label: month,
                }))}
                buttonClassName="!rounded-lg !border-brand-teal/20 !px-3 !py-1.5"
                textClassName="!text-sm"
              />
            </div>
            <div className="w-[120px]">
              <SelectDropdown
                value={selYear}
                onChange={(value) => setSelYear(Number(value))}
                options={YEAR_OPTS.map((year) => ({
                  value: year,
                  label: String(year),
                }))}
                buttonClassName="!rounded-lg !border-brand-teal/20 !px-3 !py-1.5"
                textClassName="!text-sm"
              />
            </div>
            </div>
          </div>
        </div>
      </div>

      {/* -- Collapsible Report Sections ---------------------------------- */}
      <div className="flex flex-col gap-4">
        {/* -- 1. Appointments ----------------------------------------------- */}
        <CollapsibleSection
          title="Appointments"
          icon="fa-calendar-check"
          loadState={sections.appointments}
          onRetry={() => fetchReports({ force: true, section: "appointments" })}
          isOpen={openSections.appointments}
          onToggle={() => toggleSection("appointments")}
          summary={`${totalAppts} total â€¢ ${totalPending} pending â€¢ ${totalApproved} approved â€¢ ${totalCompleted} completed`}
          onViewAll={() => openViewAllModal("appointments", "All Weeks")}
          onCSV={() => dlCSV("appointments")}
          onPDF={() => dlPDF("appointments")}
          className="order-1"
        >
          <div className="p-4">
            <div className="space-y-4">
              <AppointmentStatusColumnChart
                data={apptData}
                onWeekClick={(week) => openViewAllModal("appointments", week)}
              />
              <div className="rounded-xl border border-brand-dark-light/70 bg-white p-3 text-xs">
                <p className="font-semibold text-brand-dark">Hotel Suite Extended Stays <span className="font-normal text-brand-dark-soft">(by payment recorded date)</span></p>
                <p className={`mt-1 ${hotelExtensionError ? 'text-red-700' : 'text-brand-dark-soft'}`}>{hotelExtensionError || `${hotelExtensions.summary?.charge_count || 0} charges Â· PHP ${Number(hotelExtensions.summary?.extension_charges || 0).toFixed(2)} charged Â· PHP ${Number(hotelExtensions.summary?.extension_payments || 0).toFixed(2)} paid`}</p>
              </div>
            </div>
          </div>
        </CollapsibleSection>

        {/* -- 2. Customers -------------------------------------------------- */}
        <CollapsibleSection
          title="Customers"
          icon="fa-users"
          loadState={sections.customers}
          onRetry={() => fetchReports({ force: true, section: "customers" })}
          isOpen={openSections.customers}
          onToggle={() => toggleSection("customers")}
          summary={`${totalNewCust} new customers this period`}
          onViewAll={() => openViewAllModal("customers", "This Month")}
          onCSV={() => dlCSV("customers")}
          onPDF={() => dlPDF("customers")}
          className="order-4"
        >
          <div className="p-4">
            <LineTrendChart
              data={custData}
              valueKey="new_customers"
              label="New Customer Trend"
              onPointClick={(week) => openViewAllModal("customers", week)}
            />
          </div>
        </CollapsibleSection>

        {/* -- 3. Pets ------------------------------------------------------- */}
        <CollapsibleSection
          title="Pets"
          icon="fa-paw"
          loadState={sections.pets}
          onRetry={() => fetchReports({ force: true, section: "pets" })}
          isOpen={openSections.pets}
          onToggle={() => toggleSection("pets")}
          summary={`${petData.reduce((s, r) => s + r.total, 0)} new pets registered`}
          onViewAll={() => openViewAllModal("pets", "This Month")}
          onCSV={() => dlCSV("pets")}
          onPDF={() => dlPDF("pets")}
          className="order-5"
        >
          <div className="p-4">
            <div className="space-y-4">
              <LineTrendChart
                data={petData}
                valueKey="total"
                label="Pet Registration Trend"
                onPointClick={(week) => openViewAllModal("pets", week)}
                color="#e58b2a"
              />
              {/* Breed Breakdown */}
              <PetBreedBreakdown selMonth={selMonth} selYear={selYear} />
            </div>
          </div>
        </CollapsibleSection>

        {/* -- 4. Services --------------------------------------------------- */}
        <CollapsibleSection
          title="Services"
          icon="fa-scissors"
          loadState={sections.services}
          onRetry={() => fetchReports({ force: true, section: "services" })}
          isOpen={openSections.services}
          onToggle={() => toggleSection("services")}
          summary={`${totalServiceBookings} service booking${totalServiceBookings === 1 ? "" : "s"}`}
          onViewAll={() => openViewAllModal("services", "All")}
          onCSV={() => dlCSV("services")}
          onPDF={() => dlPDF("services")}
          className="order-2"
        >
          <div className="p-4">
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-lg border border-brand-teal/15 bg-brand-teal/5 px-3 py-2">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-brand-dark-soft">
                    Total bookings
                  </p>
                  <p className="mt-0.5 text-lg font-extrabold leading-none text-brand-dark">
                    {totalServiceBookings}
                  </p>
                </div>
                <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-brand-dark-soft">
                    Completed
                  </p>
                  <p className="mt-0.5 text-lg font-extrabold leading-none text-emerald-600">
                    {svcData.reduce(
                      (sum, service) => sum + Number(service.completed || 0),
                      0,
                    )}
                  </p>
                </div>
                <div className="rounded-lg border border-red-100 bg-red-50/60 px-3 py-2">
                  <p className="text-[9px] font-bold uppercase tracking-wide text-brand-dark-soft">
                    Cancelled
                  </p>
                  <p className="mt-0.5 text-lg font-extrabold leading-none text-red-500">
                    {svcData.reduce(
                      (sum, service) => sum + Number(service.cancelled || 0),
                      0,
                    )}
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded-xl border border-brand-dark-light/70">
                <div className="border-b border-brand-dark-light/70 bg-slate-50 px-4 py-3">
                  <h4 className="text-xs font-bold uppercase tracking-wide text-brand-dark">
                    Breakdown
                  </h4>
                </div>
                <div className="overflow-x-auto">
                  <div className="min-w-[560px]">
                    <div className="grid grid-cols-[minmax(220px,1fr)_90px_90px_90px] gap-3 border-b border-brand-dark-light/70 bg-white px-4 py-2 text-[10px] font-bold uppercase tracking-wide text-brand-dark-soft">
                      <span>Service / Package</span>
                      <span className="text-right">Bookings</span>
                      <span className="text-right">Completed</span>
                      <span className="text-right">Cancelled</span>
                    </div>
                    {serviceUsageByCategory.map((group) => (
                      <div key={group.category}>
                        <div className="grid grid-cols-[minmax(220px,1fr)_90px_90px_90px] items-center gap-3 border-b border-brand-dark-light/70 bg-brand-teal/5 px-4 py-2">
                          <span className="text-xs font-extrabold uppercase tracking-wide text-brand-dark">
                            {group.category}
                          </span>
                          <span className="text-right text-xs font-extrabold text-brand-teal">
                            {group.total}
                          </span>
                          <span className="text-right text-xs font-bold text-emerald-600">
                            {group.services.reduce(
                              (sum, service) =>
                                sum + Number(service.completed || 0),
                              0,
                            ) || "â€”"}
                          </span>
                          <span className="text-right text-xs font-bold text-red-500">
                            {group.services.reduce(
                              (sum, service) =>
                                sum + Number(service.cancelled || 0),
                              0,
                            ) || "â€”"}
                          </span>
                        </div>
                        {group.services.map((service) => (
                          <div
                            key={`${group.category}-${service.service}`}
                            className="grid grid-cols-[minmax(220px,1fr)_90px_90px_90px] items-center gap-3 border-b border-brand-dark-light/50 px-4 py-2 last:border-b-0"
                          >
                            <span
                              className="truncate pl-3 text-xs font-semibold text-brand-dark"
                              title={service.service}
                            >
                              {service.service}
                            </span>
                            <span className="text-right text-xs font-bold text-brand-dark">
                              {Number(service.total || 0) || "â€”"}
                            </span>
                            <span className="text-right text-xs font-semibold text-emerald-600">
                              {Number(service.completed || 0) || "â€”"}
                            </span>
                            <span className="text-right text-xs font-semibold text-red-500">
                              {Number(service.cancelled || 0) || "â€”"}
                            </span>
                          </div>
                        ))}
                      </div>
                    ))}
                    {serviceUsageByCategory.length === 0 && (
                      <p className="px-4 py-8 text-center text-sm text-brand-dark-soft">
                        No service usage for this period.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-brand-dark-light/70 bg-white p-4">
                <h4 className="text-xs font-bold uppercase tracking-wide text-brand-dark">Hotel Suite Extensions <span className="font-normal normal-case text-brand-dark-soft">Â· by payment recorded date</span></h4>
                <p className={`mt-1 text-xs ${hotelExtensionError ? 'text-red-700' : 'text-brand-dark-soft'}`}>{hotelExtensionError || `${hotelExtensions.summary?.charge_count || 0} charges Â· PHP ${Number(hotelExtensions.summary?.extension_charges || 0).toFixed(2)} charged Â· PHP ${Number(hotelExtensions.summary?.extension_payments || 0).toFixed(2)} paid`}</p>
                <div className="mt-3 overflow-x-auto">
                  <table className="min-w-[1200px] w-full text-left text-xs">
                    <thead><tr className="border-b border-brand-dark-light text-brand-dark-soft"><th className="py-2">Appointment</th><th>Pet / Size</th><th>Scheduled Checkout</th><th>Actual Checkout</th><th>Extra Time</th><th>Hours</th><th>Rate</th><th>Charge</th><th>Paid</th><th>Payment</th><th>Handled By</th><th>Recorded By</th><th>Recorded At</th></tr></thead>
                    <tbody>{(hotelExtensions.records || []).map((record) => <tr key={record.appointment_code} className="border-b border-brand-dark-light/50">
                      <td className="py-2">{record.appointment_code}</td><td>{record.pet_name} / {record.pet_size}</td>
                      <td>{record.scheduled_checkout_at ? new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(record.scheduled_checkout_at)) : '-'}</td>
                      <td>{record.actual_checkout_at ? new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(record.actual_checkout_at)) : '-'}</td>
                      <td>{record.extra_minutes} minute(s)</td><td>{record.billable_hours}</td>
                      <td>PHP {Number(record.hourly_rate).toFixed(2)}</td><td>PHP {Number(record.amount).toFixed(2)}</td><td>PHP {Number(record.payment_amount).toFixed(2)}</td>
                      <td>{record.payment_status} Â· {record.payment_method}</td><td>{record.handled_by || '-'}</td><td>{record.recorded_by || '-'}</td>
                      <td>{record.recorded_at ? new Intl.DateTimeFormat('en-PH', { timeZone: 'Asia/Manila', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(record.recorded_at)) : '-'}</td>
                    </tr>)}</tbody>
                  </table>
                  {!(hotelExtensions.records || []).length && <p className="py-4 text-center text-brand-dark-soft">No Hotel Suite extensions for this period.</p>}
                </div>
              </div>

              {serviceCancellationData.length > 0 && (
                <div className="rounded-xl border border-red-100 bg-red-50/50 p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wide text-red-600">
                    Cancellation reasons
                  </h4>
                  <div className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                    {serviceCancellationData.map((item) => (
                      <div
                        key={item.reason}
                        className="flex items-center justify-between border-t border-red-100 py-2 text-xs"
                      >
                        <span className="text-brand-dark">
                          {formatCancellationReason(item.reason)}
                        </span>
                        <span className="font-bold text-red-500">
                          {item.count}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-brand-grooming/15 bg-brand-grooming-soft/25 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wide text-brand-grooming">
                      Pawsome Extras
                    </h4>
                    <p className="mt-0.5 text-[11px] text-brand-dark-soft">
                      Individual grooming services, separate from grooming
                      packages.
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-brand-grooming">
                    {pawsomeExtrasUsage} uses
                  </span>
                </div>
                {addonData.length > 0 ? (
                  <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                    {addonData.map((addon) => (
                      <div
                        key={addon.name}
                        className="flex items-center justify-between border-t border-brand-grooming/10 py-2 text-xs"
                      >
                        <span className="font-semibold text-brand-dark">
                          {addon.name}
                        </span>
                        <span className="font-semibold text-brand-grooming">
                          {addon.count}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs italic text-brand-dark-soft">
                    No Pawsome Extras used this period.
                  </p>
                )}
              </div>
            </div>
          </div>
        </CollapsibleSection>

        {/* -- 5. Supplies --------------------------------------------------- */}
        <CollapsibleSection
          title="Supplies"
          icon="fa-boxes-stacked"
          loadState={sections.inventory}
          onRetry={() => fetchReports({ force: true, section: "inventory" })}
          isOpen={openSections.inventory}
          onToggle={() => toggleSection("inventory")}
          summary={`${inventoryData.length} supplies - ${totalSupplyUnits} units in stock - ${lowStockCount} low stock`}
          onViewAll={() => openViewAllModal("inventory", "Current")}
          onCSV={() => dlCSV("inventory")}
          onPDF={() => dlPDF("inventory")}
          className="order-6"
        >
          <div className="grid gap-3 p-4 sm:grid-cols-3">
            <div className="rounded-xl border border-brand-dark-light bg-brand-surface px-4 py-3">
              <p className="text-[10px] font-bold uppercase text-brand-dark-soft">
                Total Supplies
              </p>
              <p className="mt-1 text-2xl font-extrabold text-brand-dark">
                {inventoryData.length}
              </p>
            </div>
            <div className="rounded-xl border border-brand-dark-light bg-brand-surface px-4 py-3">
              <p className="text-[10px] font-bold uppercase text-brand-dark-soft">
                Low Stock
              </p>
              <p className="mt-1 text-2xl font-extrabold text-red-600">
                {lowStockCount}
              </p>
            </div>
            <div className="rounded-xl border border-brand-dark-light bg-brand-surface px-4 py-3">
              <p className="text-[10px] font-bold uppercase text-brand-dark-soft">
                Total Units in Stock
              </p>
              <p className="mt-1 text-2xl font-extrabold text-brand-teal-dark">
                {totalSupplyUnits}
              </p>
            </div>
            <div className="rounded-xl border border-brand-dark-light bg-brand-surface px-4 py-3">
              <p className="text-[10px] font-bold uppercase text-brand-dark-soft">
                Units Sold
              </p>
              <p className="mt-1 text-2xl font-extrabold text-brand-dark">
                {inventorySalesSummary.units}
              </p>
            </div>
            <div className="rounded-xl border border-brand-dark-light bg-brand-surface px-4 py-3">
              <p className="text-[10px] font-bold uppercase text-brand-dark-soft">
                Sales Revenue
              </p>
              <p className="mt-1 text-lg font-extrabold text-brand-teal-dark">
                PHP{" "}
                {inventorySalesSummary.revenue.toLocaleString("en-PH", {
                  minimumFractionDigits: 2,
                })}
              </p>
            </div>
            <div className="rounded-xl border border-brand-dark-light bg-brand-surface px-4 py-3">
              <p className="text-[10px] font-bold uppercase text-brand-dark-soft">
                Best Seller
              </p>
              <p
                className="mt-1 truncate text-sm font-extrabold text-brand-dark"
                title={inventorySalesSummary.bestSeller}
              >
                {inventorySalesSummary.bestSeller}
              </p>
            </div>
          </div>
          <div className="border-t border-brand-dark-light px-4 pb-4">
            <p className="pt-3 text-[10px] font-bold uppercase text-brand-dark-soft">
              Top Selling Items for {periodLabel}
            </p>
            {inventorySalesData.length > 0 ? (
              <div className="mt-3">
                <HorizontalRankingChart
                  data={inventorySalesData}
                  labelKey="name"
                  valueKey="units"
                  limit={5}
                  valueFormatter={(value, item) =>
                    `${value} sold Â· PHP ${item.revenue.toLocaleString("en-PH", { maximumFractionDigits: 0 })}`
                  }
                />
              </div>
            ) : (
              <p className="mt-2 text-xs text-brand-dark-soft">
                No supply sales recorded for this period.
              </p>
            )}
          </div>
        </CollapsibleSection>

        {/* -- 6. Staff ------------------------------------------------------ */}
        <CollapsibleSection
          title="Staff"
          icon="fa-user-tie"
          loadState={sections.staff}
          onRetry={() => fetchReports({ force: true, section: "staff" })}
          isOpen={openSections.staff}
          onToggle={() => toggleSection("staff")}
          summary={`${staffAttendanceCount} attendance records`}
          onViewAll={() => openViewAllModal("staff", "All")}
          onCSV={() => dlCSV("staff")}
          onPDF={() => dlPDF("staff")}
          className="order-3"
        >
          <div className="p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-bold uppercase text-brand-dark-soft">Staff Attendance and Commission</h4>
              <div className="w-[230px] max-w-full"><SelectDropdown value={staffWeek} onChange={(value) => setStaffWeek(Number(value))} options={staffWeeks.map(({ value, label }) => ({ value, label }))} buttonClassName="!rounded-lg !border-brand-teal/20 !px-3 !py-2" textClassName="!text-xs !font-semibold" /></div>
            </div>
            <StaffOverviewTable rows={staffWeekRows} noRecords={staffAttendanceCount === 0 && staffCommissionCount === 0} />
          </div>
        </CollapsibleSection>
      </div>

      {/* View All Modals */}
      {viewAllModal.type === "appointments" &&
        typeof document !== "undefined" &&
        createPortal(
          <ReportsViewAllAppointments
            isOpen={viewAllModal.isOpen}
            onClose={closeViewAllModal}
            period={viewAllModal.period}
            month={viewAllModal.month}
            year={viewAllModal.year}
          />,
          document.body,
        )}
      {viewAllModal.type === "customers" &&
        typeof document !== "undefined" &&
        createPortal(
          <ReportsViewAllCustomers
            isOpen={viewAllModal.isOpen}
            onClose={closeViewAllModal}
            period={viewAllModal.period}
            month={viewAllModal.month}
            year={viewAllModal.year}
          />,
          document.body,
        )}
      {viewAllModal.type === "pets" &&
        typeof document !== "undefined" &&
        createPortal(
          <ReportsViewAllPets
            isOpen={viewAllModal.isOpen}
            onClose={closeViewAllModal}
            period={viewAllModal.period}
            month={viewAllModal.month}
            year={viewAllModal.year}
          />,
          document.body,
        )}
      {viewAllModal.type === "services" &&
        typeof document !== "undefined" &&
        createPortal(
          <ReportsViewAllServices
            isOpen={viewAllModal.isOpen}
            onClose={closeViewAllModal}
            services={sortedSvcData}
            pawsomeExtras={addonData}
            cancellationReasons={serviceCancellationData}
            period={periodLabel}
          />,
          document.body,
        )}
      {viewAllModal.type === "inventory" &&
        typeof document !== "undefined" &&
        createPortal(
          <ReportsViewAllInventory
            isOpen={viewAllModal.isOpen}
            onClose={closeViewAllModal}
            items={inventoryData}
            salesItems={inventorySalesData}
          />,
          document.body,
        )}
      {viewAllModal.type === "staff" &&
        typeof document !== "undefined" &&
        createPortal(
          <ReportsViewAllStaff isOpen={viewAllModal.isOpen} onClose={closeViewAllModal} year={selYear} month={selMonth + 1} view={viewMode} />,
          document.body,
        )}
    </section>
  );
}
