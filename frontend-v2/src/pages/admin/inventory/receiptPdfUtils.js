const PAYMENT_LABELS = {
  cash: 'Cash',
  ewallet: 'E-Wallet',
  bank: 'Bank Transfer',
};

const EWALLET_LABELS = {
  gcash: 'GCash',
  maya: 'Maya (PayMaya)',
  shopeepay: 'ShopeePay',
  grabpay: 'GrabPay',
};

const BANK_LABELS = {
  bdo: 'BDO Unibank',
  bpi: 'BPI (Bank of the Philippine Islands)',
  metrobank: 'Metrobank',
  unionbank: 'UnionBank',
  pnb: 'PNB (Philippine National Bank)',
  securitybank: 'Security Bank',
  landbank: 'Landbank',
  rcbc: 'RCBC',
  eastwest: 'EastWest Bank',
};

export const fmtCurrency = (n) =>
  Number(n || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const getPaymentLabel = (method, channel) => {
  if (method === 'cash') return 'Cash';
  if (method === 'ewallet') {
    if (channel && EWALLET_LABELS[channel]) return EWALLET_LABELS[channel];
    return channel && channel !== 'other' ? channel : 'E-Wallet';
  }
  if (method === 'bank') {
    if (channel && BANK_LABELS[channel]) return BANK_LABELS[channel];
    return channel && channel !== 'other' ? channel : 'Bank Transfer';
  }
  return PAYMENT_LABELS[method] || method || 'Cash';
};

export const getReceivingAccountLabel = (account) => ({
  cash_register: 'Cash Register',
  gcash: 'GCash',
  bpi: 'BPI',
  bdo: 'BDO',
  maya: 'Maya',
}[account] || account || '-');

export async function printReceiptPDF(sale) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import('jspdf'),
    import('jspdf-autotable'),
  ]);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [80, 200] });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(0, 0, 0);
  doc.text('THE FUR CLUB PET STATION', 40, 10, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.text('PawsitiveCare - Walk-in Sale', 40, 15, { align: 'center' });

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.text(sale.receipt_number || '', 40, 22, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  const soldAt = sale.sold_at ? new Date(sale.sold_at).toLocaleString('en-PH') : '';
  doc.text(soldAt, 40, 27, { align: 'center' });

  doc.setLineWidth(0.2);
  doc.line(5, 30, 75, 30);

  doc.setFontSize(7.5);
  const hasPaidTo = sale.payment_method !== 'cash' && Boolean(sale.payment_received_by);
  doc.text(`Customer: ${sale.customer_name || 'Walk-in'}`, 5, 35);
  doc.text(`Paid From: ${getPaymentLabel(sale.payment_method, sale.payment_channel)}`, 5, 40);
  if (hasPaidTo) doc.text(`Paid To:   ${getReceivingAccountLabel(sale.payment_received_by)}`, 5, 45);
  const detailsOffset = hasPaidTo ? 5 : 0;
  if (sale.reference_number) {
    doc.text(`Ref No:   ${sale.reference_number}`, 5, 45 + detailsOffset);
    doc.text(`Staff:    ${sale.sold_by?.name || '-'}`, 5, 50 + detailsOffset);
    doc.line(5, 53 + detailsOffset, 75, 53 + detailsOffset);
  } else {
    doc.text(`Staff:    ${sale.sold_by?.name || '-'}`, 5, 45 + detailsOffset);
    doc.line(5, 48 + detailsOffset, 75, 48 + detailsOffset);
  }

  const tableStart = (sale.reference_number ? 55 : 50) + detailsOffset;

  const items = (sale.items || []).map((item) => [
    item.product_name || item.item_snapshot_name || '',
    String(item.quantity_used ?? item.quantity),
    `PHP ${fmtCurrency(item.unit_price ?? item.selling_price)}`,
    `PHP ${fmtCurrency(item.line_total ?? item.subtotal)}`,
  ]);

  autoTable(doc, {
    head: [['Item', 'Qty', 'Price', 'Total']],
    body: items,
    startY: tableStart,
    styles: { fontSize: 7, cellPadding: 1.5, textColor: [0, 0, 0] },
    headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', lineWidth: 0.2, lineColor: [0, 0, 0] },
    alternateRowStyles: { fillColor: [255, 255, 255] },
    margin: { left: 5, right: 5 },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: 8, halign: 'center' },
      2: { cellWidth: 14, halign: 'right' },
      3: { cellWidth: 14, halign: 'right' },
    },
  });

  const finalY = doc.lastAutoTable?.finalY ?? 80;
  doc.setLineWidth(0.2);
  doc.line(5, finalY + 2, 75, finalY + 2);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('TOTAL', 5, finalY + 8);
  doc.text(`PHP ${fmtCurrency(sale.total_amount)}`, 75, finalY + 8, { align: 'right' });

  if (sale.notes) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(7);
    doc.text(`Note: ${sale.notes}`, 5, finalY + 15);
  }

  doc.save(`${sale.receipt_number || 'receipt'}.pdf`);
}

export async function downloadReceiptPDF(sale) {
  const receiptTitle = sale.receipt_number || `Sale #${sale.id}`;
  const itemCount = (sale.items || []).length;
  const pageHeight = 120 + itemCount * 10 + (sale.notes ? 14 : 0);
  const { default: jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: [80, pageHeight] });

  const W = 80;
  const LM = 6;
  const RM = W - LM;
  const MID = W / 2;

  const text = (str, x, y, size, style = 'normal', color = [30, 30, 30]) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(str, x, y);
  };

  const textR = (str, y, size, style = 'normal', color = [30, 30, 30]) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(str, RM, y, { align: 'right' });
  };

  const textC = (str, y, size, style = 'normal', color = [30, 30, 30]) => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(str, MID, y, { align: 'center' });
  };

  const solidLine = (y, opacity = 0.25) => {
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
    doc.setGState(new doc.GState({ opacity }));
    doc.line(LM, y, RM, y);
    doc.setGState(new doc.GState({ opacity: 1 }));
  };

  const dashedLine = (y) => {
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.15);
    doc.setLineDashPattern([1.2, 1.2], 0);
    doc.setGState(new doc.GState({ opacity: 0.2 }));
    doc.line(LM, y, RM, y);
    doc.setLineDashPattern([], 0);
    doc.setGState(new doc.GState({ opacity: 1 }));
  };

  let y = 10;
  textC('THE FUR CLUB PET STATION', y, 10, 'bold'); y += 5;
  textC('PawsitiveCare', y, 7.5, 'normal', [91, 188, 193]); y += 4;
  textC('Walk-in Sale Records', y, 7, 'normal', [120, 120, 120]); y += 5;
  solidLine(y); y += 5;

  textC(receiptTitle, y, 9, 'bold', [36, 119, 122]); y += 4.5;
  textC(sale.sold_at ? new Date(sale.sold_at).toLocaleString('en-PH') : '', y, 6.5, 'normal', [140, 140, 140]);
  y += 5;
  dashedLine(y); y += 5;

  const infoRow = (label, value, yPos) => {
    text(label, LM, yPos, 7, 'normal', [140, 140, 140]);
    textR(value, yPos, 7, 'bold');
  };

  infoRow('Customer', sale.customer_name || 'Walk-in', y); y += 4.5;
  infoRow('Paid From', getPaymentLabel(sale.payment_method, sale.payment_channel), y); y += 4.5;
  if (sale.payment_method !== 'cash' && sale.payment_received_by) {
    infoRow('Paid To', getReceivingAccountLabel(sale.payment_received_by), y); y += 4.5;
  }
  if (sale.sold_by?.name) {
    infoRow('Served by', sale.sold_by.name, y);
    y += 4.5;
  }

  dashedLine(y); y += 5;
  text('ITEM', LM, y, 6.5, 'bold', [100, 100, 100]);
  textR('SUBTOTAL', y, 6.5, 'bold', [100, 100, 100]);
  y += 1.5;
  solidLine(y, 0.12); y += 4;

  for (const item of (sale.items || [])) {
    const name = (item.item_snapshot_name || '').length > 30
      ? `${(item.item_snapshot_name || '').substring(0, 28)}...`
      : (item.item_snapshot_name || '');
    text(name, LM, y, 7.5, 'bold');
    textR(`PHP ${fmtCurrency(item.subtotal)}`, y, 7.5, 'bold');
    y += 4;
    text(`  PHP ${fmtCurrency(item.selling_price)} x ${item.quantity} pc${item.quantity > 1 ? 's' : ''}`, LM, y, 6.5, 'normal', [150, 150, 150]);
    y += 4.5;
  }

  solidLine(y, 0.15); y += 5;
  text('TOTAL AMOUNT', LM, y, 8, 'bold');
  textR(`PHP ${fmtCurrency(sale.total_amount)}`, y, 11, 'bold', [36, 119, 122]);
  y += 7;

  if (sale.notes) {
    dashedLine(y); y += 4;
    text(`Note: ${sale.notes}`, LM, y, 6.5, 'italic', [140, 140, 140]);
    y += 5;
  }

  dashedLine(y); y += 5;
  textC('Thank you for your purchase!', y, 7, 'italic', [140, 140, 140]);
  doc.save(`${receiptTitle}.pdf`);
}
