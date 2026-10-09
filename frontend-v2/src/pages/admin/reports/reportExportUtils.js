const PDF_BLACK = [0, 0, 0];
const PDF_DARK = PDF_BLACK;
const PDF_BORDER = PDF_BLACK;
const PAGE_W = 210;

export const downloadCSV = (filename, headers, rows) => {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [
    headers.map(esc).join(","),
    ...rows.map((r) => r.map(esc).join(",")),
  ];
  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), {
    href: url,
    download: filename,
  });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const downloadSectionedCSV = (filename, sections) => {
  const esc = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  const lines = [];
  sections.forEach(({ title, headers, rows }) => {
    lines.push(esc(title));
    lines.push(headers.map(esc).join(","));
    rows.forEach((row) => lines.push(row.map(esc).join(",")));
    lines.push("");
  });
  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const loadPdfTools = async () => {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  return { jsPDF, autoTable };
};

const loadImageAsBase64 = (src) =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      canvas.getContext("2d").drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = reject;
    img.src = src;
  });

export const makePDFDoc = async (subtitle, periodLabel) => {
  const { jsPDF, autoTable } = await loadPdfTools();
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  try {
    const logoData = await loadImageAsBase64("/assets/paw-realteal.webp");
    doc.addImage(logoData, "PNG", PAGE_W - 26, 3, 14, 14);
  } catch {
    // The PDF should still export if the logo asset cannot be loaded.
  }

  doc.setDrawColor(...PDF_BLACK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(...PDF_BLACK);
  doc.text("PAWSITIVECARE — THE FUR CLUB PET STATION", 14, 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_BLACK);
  doc.text(`${subtitle}  |  ${periodLabel}`, 14, 18);
  doc.setLineWidth(0.3);
  doc.line(14, 25, PAGE_W - 14, 25);
  return { doc, autoTable, y: 34 };
};

export const addPDFSection = (
  doc,
  autoTable,
  title,
  head,
  body,
  startY,
  columnStyles = {},
) => {
  const pageH = doc.internal.pageSize.height;
  const needsNewPage = startY + 30 > pageH - 20;

  if (needsNewPage) {
    doc.addPage();
    startY = 20;
  }

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_BLACK);
  doc.text(title.toUpperCase(), 14, startY);

  autoTable(doc, {
    head: [head],
    body,
    startY: startY + 3,
    styles: {
      fontSize: 7,
      cellPadding: 1.5,
      textColor: PDF_DARK,
      lineColor: PDF_BORDER,
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: PDF_DARK,
      fontStyle: "bold",
      lineColor: PDF_BORDER,
      lineWidth: 0.2,
    },
    alternateRowStyles: { fillColor: [255, 255, 255] },
    margin: { left: 14, right: 14 },
    columnStyles,
  });

  return (doc.lastAutoTable?.finalY ?? startY + 10) + 8;
};

export const startPDFModule = (doc, title, periodLabel) => {
  doc.addPage();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...PDF_BLACK);
  doc.text(title.toUpperCase(), 14, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(periodLabel, 14, 22);
  doc.setLineWidth(0.3);
  doc.line(14, 27, PAGE_W - 14, 27);
  return 36;
};

export const addPDFNote = (doc, noteText, startY) => {
  const pageH = doc.internal.pageSize.height;
  const needsNewPage = startY + 15 > pageH - 20;

  if (needsNewPage) {
    doc.addPage();
    startY = 20;
  }

  doc.setFontSize(7);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(...PDF_BLACK);
  const lines = doc.splitTextToSize(noteText, PAGE_W - 28);
  doc.text(lines, 14, startY);

  return startY + lines.length * 3 + 5;
};

export const addPDFMetricLine = (doc, label, value, startY) => {
  const pageH = doc.internal.pageSize.height;
  const needsNewPage = startY + 12 > pageH - 20;

  if (needsNewPage) {
    doc.addPage();
    startY = 20;
  }

  doc.setDrawColor(...PDF_BLACK);
  doc.setLineWidth(0.2);
  doc.rect(14, startY - 4, PAGE_W - 28, 10);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_BLACK);
  doc.text(label.toUpperCase(), 17, startY + 2.5);
  doc.text(String(value), PAGE_W - 17, startY + 2.5, { align: "right" });

  return startY + 14;
};

const ensurePDFChartSpace = (doc, startY, height = 58) => {
  if (startY + height > doc.internal.pageSize.height - 18) {
    doc.addPage();
    return 20;
  }
  return startY;
};

export const addPDFLineChart = (doc, title, rows, startY) => {
  startY = ensurePDFChartSpace(doc, startY, 62);
  const x = 18;
  const y = startY + 8;
  const width = PAGE_W - 36;
  const height = 38;
  const values = rows.map((row) => Number(row.value || 0));
  const maximum = Math.max(...values, 1);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_BLACK);
  doc.text(title.toUpperCase(), 14, startY);
  doc.setDrawColor(190, 205, 205);
  doc.setLineWidth(0.2);
  [0, 0.5, 1].forEach((ratio) => {
    const lineY = y + height * ratio;
    doc.line(x, lineY, x + width, lineY);
  });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.text(String(maximum), x - 3, y + 1, { align: "right" });
  doc.text("0", x - 3, y + height + 1, { align: "right" });

  const points = rows.map((row, index) => ({
    x: rows.length <= 1 ? x + width / 2 : x + (width * index) / (rows.length - 1),
    y: y + height - (height * Number(row.value || 0)) / maximum,
    label: row.label,
    value: Number(row.value || 0),
  }));
  doc.setDrawColor(36, 119, 122);
  doc.setLineWidth(0.8);
  points.slice(1).forEach((point, index) => doc.line(points[index].x, points[index].y, point.x, point.y));
  points.forEach((point) => {
    doc.setFillColor(255, 255, 255);
    doc.circle(point.x, point.y, 1.8, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.text(String(point.value), point.x, Math.max(y - 1, point.y - 3), { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.text(String(point.label), point.x, y + height + 5, { align: "center" });
  });
  return y + height + 11;
};

export const addPDFBarChart = (doc, title, rows, startY, colors = [[36, 119, 122]]) => {
  const visibleRows = rows.slice(0, 7);
  const chartHeight = 17 + visibleRows.length * 8;
  startY = ensurePDFChartSpace(doc, startY, chartHeight);
  const labelX = 18;
  const barX = 64;
  const barWidth = PAGE_W - barX - 25;
  const maximum = Math.max(...visibleRows.map((row) => Number(row.value || 0)), 1);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_BLACK);
  doc.text(title.toUpperCase(), 14, startY);
  visibleRows.forEach((row, index) => {
    const rowY = startY + 7 + index * 8;
    const value = Number(row.value || 0);
    const color = colors[index % colors.length];
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...PDF_BLACK);
    doc.text(String(row.label), labelX, rowY + 3, { maxWidth: barX - labelX - 3 });
    doc.setFillColor(232, 238, 238);
    doc.roundedRect(barX, rowY, barWidth, 4, 1, 1, "F");
    if (value > 0) {
      doc.setFillColor(...color);
      doc.roundedRect(barX, rowY, Math.max(1.5, (barWidth * value) / maximum), 4, 1, 1, "F");
    }
    doc.setFont("helvetica", "bold");
    doc.text(String(value), PAGE_W - 18, rowY + 3, { align: "right" });
  });
  return startY + chartHeight;
};

export const addPDFStackedChart = (doc, title, rows, startY) => {
  const visibleRows = rows.slice(0, 8);
  const chartHeight = 18 + visibleRows.length * 9;
  startY = ensurePDFChartSpace(doc, startY, chartHeight);
  const labelX = 18;
  const barX = 64;
  const barWidth = PAGE_W - barX - 30;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(title.toUpperCase(), 14, startY);
  visibleRows.forEach((row, index) => {
    const rowY = startY + 8 + index * 9;
    const total = Math.max(Number(row.total || 0), 1);
    const completed = Number(row.completed || 0);
    const cancelled = Number(row.cancelled || 0);
    const completedWidth = (barWidth * completed) / total;
    const cancelledWidth = (barWidth * cancelled) / total;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(...PDF_BLACK);
    doc.text(String(row.label), labelX, rowY + 3, { maxWidth: barX - labelX - 3 });
    doc.setFillColor(220, 226, 229);
    doc.roundedRect(barX, rowY, barWidth, 4, 1, 1, "F");
    if (completedWidth > 0) {
      doc.setFillColor(16, 185, 129);
      doc.rect(barX, rowY, completedWidth, 4, "F");
    }
    if (cancelledWidth > 0) {
      doc.setFillColor(248, 113, 113);
      doc.rect(barX + completedWidth, rowY, cancelledWidth, 4, "F");
    }
    doc.setFont("helvetica", "bold");
    doc.text(`${Math.round((completed / total) * 100)}% · ${Number(row.total || 0)}`, PAGE_W - 18, rowY + 3, { align: "right" });
  });
  return startY + chartHeight;
};
