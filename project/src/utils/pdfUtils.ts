import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Order, Product } from '../types';
import {
  formatCurrency,
  formatDate,
  getStockStatus,
  getStatusText,
  resolveOrderGrandTotal,
  resolveOrderItemsForDisplay,
  effectiveDemandQty,
  recentWindowDemandQty,
  MAX_SUGGESTED_REORDER_UNITS,
  type ReorderEngineRow
} from './stockUtils';

/** Title and PDF metadata author/creator for all exports from this module. */
const PDF_BRAND = 'S&T Stock';

export const generateOrderPDF = (order: Order, products: Product[]) => {
  // Create A4 document (210mm x 297mm)
  const doc = new jsPDF('p', 'mm', 'a4');
  
  // Set document properties
  doc.setProperties({
    title: `Order ${order.order_number}`,
    subject: 'Order Details',
    author: PDF_BRAND,
    creator: PDF_BRAND
  });

  // A4 dimensions in mm
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 20;
  const contentWidth = pageWidth - (2 * margin);
  
  let currentY = margin;

  // Add company header with logo placeholder
  doc.setFillColor(66, 139, 202);
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text(PDF_BRAND, pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('Order details', pageWidth / 2, 30, { align: 'center' });
  
  // Reset text color for content
  doc.setTextColor(0, 0, 0);
  currentY = 50;

  // Add order information section
  doc.setFillColor(248, 250, 252);
  doc.rect(margin, currentY, contentWidth, 25, 'F');
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(`Order: ${order.order_number}`, margin + 5, currentY + 8);
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Date: ${formatDate(order.created_at)}`, margin + 5, currentY + 18);
  
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(`Type: ${getOrderTypeLabel(order.order_type)}`, margin + 80, currentY + 8);
  doc.text(`Status: ${order.status.charAt(0).toUpperCase() + order.status.slice(1)}`, margin + 80, currentY + 18);
  
  currentY += 35;

  // Add customer information section
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Customer Information', margin, currentY);
  currentY += 8;
  
  doc.setFillColor(248, 250, 252);
  doc.rect(margin, currentY, contentWidth, 25, 'F');
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Name: ${order.customer_name}`, margin + 5, currentY + 8);
  doc.text(`Email: ${order.customer_email || 'N/A'}`, margin + 5, currentY + 18);
  doc.text(`Phone: ${order.customer_phone || 'N/A'}`, margin + 80, currentY + 8);
  
  currentY += 35;

  // Add order items table
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Order Items', margin, currentY);
  currentY += 8;
  
  const displayItems = resolveOrderItemsForDisplay(order, products);
  if (displayItems.length > 0) {
    const tableData = displayItems.map(item => [
      item.product_name,
      item.quantity.toString(),
      formatCurrency(item.unit_price),
      formatCurrency(item.total_price)
    ]);
    
    autoTable(doc, {
      startY: currentY,
      head: [['Product', 'Quantity', 'Unit Price', 'Total']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: [66, 139, 202],
        textColor: 255,
        fontSize: 10,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 9
      },
      margin: { left: margin, right: margin },
      styles: {
        cellPadding: 3
      },
      columnStyles: {
        0: { cellWidth: 80 }, // Product name
        1: { cellWidth: 25, halign: 'center' }, // Quantity
        2: { cellWidth: 30, halign: 'right' }, // Unit price
        3: { cellWidth: 30, halign: 'right' }  // Total
      }
    });
    
    // Get the final Y position after the table
    currentY = (doc as any).lastAutoTable.finalY + 10;
  }
  
  // Add total amount section
  doc.setFillColor(240, 249, 255);
  doc.rect(margin, currentY, contentWidth, 20, 'F');
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(
    `Total Amount: ${formatCurrency(resolveOrderGrandTotal(order) || order.total_amount)}`,
    margin + 5,
    currentY + 12
  );
  
  currentY += 30;

  // Add notes if available
  if (order.notes) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Notes:', margin, currentY);
    currentY += 8;
    
    doc.setFillColor(255, 255, 240);
    doc.rect(margin, currentY, contentWidth, 20, 'F');
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    const notesLines = doc.splitTextToSize(order.notes, contentWidth - 10);
    doc.text(notesLines, margin + 5, currentY + 8);
    
    currentY += 25;
  }

  // Add pickup information if it's a pickup order
  if (order.order_type === 'pickup' && order.pickup_person_name) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Pickup Information:', margin, currentY);
    currentY += 8;
    
    doc.setFillColor(240, 255, 240);
    doc.rect(margin, currentY, contentWidth, 20, 'F');
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Pickup Person: ${order.pickup_person_name}`, margin + 5, currentY + 8);
    if (order.pickup_person_phone) {
      doc.text(`Phone: ${order.pickup_person_phone}`, margin + 5, currentY + 18);
    }
    
    currentY += 25;
  }

  // Add footer
  const footerY = pageHeight - 20;
  doc.setFillColor(66, 139, 202);
  doc.rect(0, footerY, pageWidth, 20, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated on ${new Date().toLocaleDateString()} at ${new Date().toLocaleTimeString()}`, margin, footerY + 8);
  doc.text(PDF_BRAND, pageWidth / 2, footerY + 8, { align: 'center' });
  doc.text(`Order ID: ${order.id}`, pageWidth - margin, footerY + 8, { align: 'right' });
  
  return doc;
};

export const printOrderPDF = (order: Order, products: Product[]) => {
  try {
    console.log('Starting PDF generation for order:', order.order_number);
    console.log('Order data:', order);
    console.log('Products count:', products.length);
    
    const doc = generateOrderPDF(order, products);
    
    // Generate filename
    const filename = `Order_${order.order_number}_${formatDate(order.created_at).replace(/\//g, '-')}.pdf`;
    console.log('Generated filename:', filename);
    
    // Save the PDF
    doc.save(filename);
    
    // Show success message
    console.log(`PDF generated successfully: ${filename}`);
    alert(`PDF generated successfully: ${filename}`);
    return true;
  } catch (error) {
    console.error('Error generating PDF:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      order: order,
      productsCount: products.length
    });
    alert(`Error generating PDF: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`);
    return false;
  }
};

export const printOrderPDFToWindow = (order: Order, products: Product[]) => {
  try {
    const doc = generateOrderPDF(order, products);
    
    // Open PDF in new window for printing
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    
    const printWindow = window.open(pdfUrl);
    if (printWindow) {
      printWindow.onload = () => {
        printWindow.print();
      };
    } else {
      // Fallback: download the PDF
      doc.save(`Order_${order.order_number}_print.pdf`);
    }
    
    console.log('PDF opened for printing');
    return true;
  } catch (error) {
    console.error('Error generating PDF for printing:', error);
    alert('Error generating PDF for printing. Please try again.');
    return false;
  }
};

export const generateBulkOrdersPDF = (orders: Order[], products: Product[]) => {
  const doc = new jsPDF('p', 'mm', 'a4');
  
  doc.setProperties({
    title: `Bulk Orders - ${orders.length} orders`,
    subject: 'Bulk Order Details',
    author: PDF_BRAND,
    creator: PDF_BRAND
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 20;
  const contentWidth = pageWidth - (2 * margin);
  
  let currentY = margin;
  let currentPage = 1;

  // Add company header
  doc.setFillColor(66, 139, 202);
  doc.rect(0, 0, pageWidth, 40, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(PDF_BRAND, pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text(`Bulk Orders - ${orders.length} orders`, pageWidth / 2, 30, { align: 'center' });
  
  doc.setTextColor(0, 0, 0);
  currentY = 50;

  // Process each order
  orders.forEach((order, index) => {
    // Check if we need a new page
    if (currentY > pageHeight - 100) {
      doc.addPage();
      currentPage++;
      currentY = margin;
      
      // Add header to new page
      doc.setFillColor(66, 139, 202);
      doc.rect(0, 0, pageWidth, 30, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text(`${PDF_BRAND} — Bulk orders (page ${currentPage})`, pageWidth / 2, 15, { align: 'center' });
      
      doc.setTextColor(0, 0, 0);
      currentY = 40;
    }

    // Add order header
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`Order ${index + 1}: ${order.order_number}`, margin, currentY);
    currentY += 8;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(
      `Customer: ${order.customer_name} | Date: ${formatDate(order.created_at)} | Total: ${formatCurrency(resolveOrderGrandTotal(order) || order.total_amount)}`,
      margin,
      currentY
    );
    currentY += 15;
    
    // Add order items summary
    const bulkLines = resolveOrderItemsForDisplay(order, products);
    if (bulkLines.length > 0) {
      const itemSummary = bulkLines.map(item => 
        `${item.product_name} (${item.quantity} × ${formatCurrency(item.unit_price)})`
      ).join(', ');
      
      const itemLines = doc.splitTextToSize(`Items: ${itemSummary}`, contentWidth);
      doc.text(itemLines, margin, currentY);
      currentY += (itemLines.length * 5) + 10;
    }
    
    // Add separator
    if (index < orders.length - 1) {
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, currentY, pageWidth - margin, currentY);
      currentY += 15;
    }
  });

  // Add footer
  const footerY = pageHeight - 20;
  doc.setFillColor(66, 139, 202);
  doc.rect(0, footerY, pageWidth, 20, 'F');
  
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(`Generated on ${new Date().toLocaleDateString()} | Total Orders: ${orders.length}`, margin, footerY + 8);
  doc.text(PDF_BRAND, pageWidth / 2, footerY + 8, { align: 'center' });
  
  return doc;
};

const getOrderTypeLabel = (type: string) => {
  switch (type) {
    case 'delivery':
      return 'Delivery';
    case 'storeToShop':
    case 'store-to-shop':
      return 'Store to Shop';
    case 'pickup':
      return 'Pickup';
    case 'international-to-tanzania':
      return 'International to Tanzania';
    default:
      return type || 'Unknown';
  }
};

export type ReorderSectionPdfSlug = 'order-now' | 'plan-reorder' | 'do-not-order';

function truncateReorderRationale(text: string, max = 120): string {
  const t = text.replace(/\s+/g, ' ').trim();
  return t.length <= max ? t : `${t.slice(0, max - 1)}…`;
}

/** Per-unit net weight (kg) × suggested units; returns null when weight is missing or invalid. */
function suggestedOrderKg(
  suggestedUnits: number,
  netWeightKgPerUnit: number | null | undefined
): number | null {
  const w = netWeightKgPerUnit == null ? NaN : Number(netWeightKgPerUnit);
  if (!Number.isFinite(w) || w <= 0) return null;
  const u = Number(suggestedUnits);
  if (!Number.isFinite(u) || u <= 0) return null;
  return u * w;
}

function formatSuggestedKgCell(kg: number | null): string {
  return kg == null ? '—' : kg.toFixed(2);
}

/**
 * Downloads a PDF listing one reorder-engine section (Order now, Plan reorder, or Do not auto-order).
 */
export function downloadReorderSectionPdf<
  P extends {
    code: string;
    commercial_name: string;
    current_stock: number;
    min_stock: number;
    max_stock: number;
    net_weight: number;
  }
>(slug: ReorderSectionPdfSlug, sectionTitle: string, rows: ReorderEngineRow<P>[]): void {
  if (rows.length === 0) return;

  const doc = new jsPDF('l', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 12;
  let y = 14;

  doc.setProperties({
    title: `${sectionTitle} — Reorder list`,
    subject: 'Reorder engine export',
    author: PDF_BRAND
  });

  doc.setFillColor(66, 139, 202);
  doc.rect(0, 0, pageWidth, 24, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text(PDF_BRAND, pageWidth / 2, 11, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(sectionTitle, pageWidth / 2, 19, { align: 'center' });

  doc.setTextColor(0, 0, 0);
  y = 32;
  doc.setFontSize(8);
  doc.text(
    `Generated ${formatDate(new Date())} · ${rows.length} line(s) · Demand units = stock-outs + sales orders · Recent = today+yesterday+last 7d · Suggested cap ${MAX_SUGGESTED_REORDER_UNITS} u per SKU (and max stock headroom) · Sugg (kg) = suggested units × net weight (kg/unit)`,
    margin,
    y
  );
  y += 6;

  const showPriority = slug === 'order-now';

  const totalSuggestedKg = rows.reduce((sum, row) => {
    const kg = suggestedOrderKg(row.suggestedOrderQty, row.product.net_weight);
    return kg == null ? sum : sum + kg;
  }, 0);
  const totalIncomingKg = rows.reduce((sum, row) => sum + (row.incomingShipment?.total_incoming_kg ?? 0), 0);

  const head = showPriority
    ? [
        [
          '#',
          'Priority',
          'Product',
          'Code',
          'Stock',
          'Demand (u)',
          'Recent (u)',
          'Sugg (u)',
          'Sugg (kg)',
          'Incoming (kg)',
          'ETA',
          'Rationale'
        ]
      ]
    : [[
        '#',
        'Product',
        'Code',
        'Stock',
        'Demand (u)',
        'Recent (u)',
        'Sugg (u)',
        'Sugg (kg)',
        'Incoming (kg)',
        'ETA',
        'Rationale'
      ]];

  const body = rows.map((row, idx) => {
    const p = row.product;
    const a = row.analytics;
    const shortRat = truncateReorderRationale(row.rationale);
    const kgLine = suggestedOrderKg(row.suggestedOrderQty, p.net_weight);
    const pr = row.demandPriority
      ? row.demandPriority === 'critical'
        ? 'Critical'
        : row.demandPriority === 'high'
          ? 'High'
          : 'Standard'
      : '—';
    if (showPriority) {
      return [
        String(idx + 1),
        pr,
        p.commercial_name,
        p.code,
        String(p.current_stock),
        String(effectiveDemandQty(a)),
        String(recentWindowDemandQty(a)),
        String(row.suggestedOrderQty),
        formatSuggestedKgCell(kgLine),
        row.incomingShipment ? row.incomingShipment.total_incoming_kg.toFixed(2) : '—',
        row.incomingShipment?.earliest_arrival_date ?? '—',
        shortRat
      ];
    }
    return [
      String(idx + 1),
      p.commercial_name,
      p.code,
      String(p.current_stock),
      String(effectiveDemandQty(a)),
      String(recentWindowDemandQty(a)),
      String(row.suggestedOrderQty),
      formatSuggestedKgCell(kgLine),
      row.incomingShipment ? row.incomingShipment.total_incoming_kg.toFixed(2) : '—',
      row.incomingShipment?.earliest_arrival_date ?? '—',
      shortRat
    ];
  });

  autoTable(doc, {
    startY: y,
    head,
    body,
    theme: 'grid',
    headStyles: { fillColor: [66, 139, 202], textColor: 255, fontSize: 8, fontStyle: 'bold' },
    bodyStyles: { fontSize: 7 },
    margin: { left: margin, right: margin },
    styles: { cellPadding: 1.5, overflow: 'linebreak' },
    columnStyles: showPriority
      ? {
          0: { cellWidth: 9, halign: 'center' },
          1: { cellWidth: 16 },
          2: { cellWidth: 38 },
          3: { cellWidth: 20 },
          4: { cellWidth: 12, halign: 'right' },
          5: { cellWidth: 16, halign: 'right' },
          6: { cellWidth: 16, halign: 'right' },
          7: { cellWidth: 14, halign: 'right' },
          8: { cellWidth: 14, halign: 'right' },
          9: { cellWidth: 16, halign: 'right' },
          10: { cellWidth: 16 },
          11: { cellWidth: 42 }
        }
      : {
          0: { cellWidth: 9, halign: 'center' },
          1: { cellWidth: 38 },
          2: { cellWidth: 20 },
          3: { cellWidth: 14, halign: 'right' },
          4: { cellWidth: 14, halign: 'right' },
          5: { cellWidth: 14, halign: 'right' },
          6: { cellWidth: 14, halign: 'right' },
          7: { cellWidth: 14, halign: 'right' },
          8: { cellWidth: 16, halign: 'right' },
          9: { cellWidth: 16 },
          10: { cellWidth: 66 }
        }
  });

  const tableBottom = (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
  let summaryY = tableBottom + 8;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(`Total suggested weight (this list): ${totalSuggestedKg.toFixed(2)} kg`, margin, summaryY);
  summaryY += 5;
  doc.text(`Total incoming (from uploaded invoices): ${totalIncomingKg.toFixed(2)} kg`, margin, summaryY);
  summaryY += 5;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  doc.text(
    'Rows with no net weight on the product show "—" in Sugg (kg) and are excluded from the total.',
    margin,
    summaryY
  );

  const safeSlug = slug.replace(/[^a-z0-9-]+/gi, '-');
  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`reorder-${safeSlug}-${stamp}.pdf`);
}

/** Product as loaded in the UI (optional joined `brand` for PDF columns). */
export type ProductRowForInventoryPdf = Product & { brand?: { name?: string } | null };

/**
 * Downloads a landscape PDF listing every SKU with current stock &gt; 0,
 * with professional header/summary/footer and totals (units + inventory value in TZS).
 */
export function downloadInStockInventoryPdf(products: ProductRowForInventoryPdf[]): void {
  const inStock = [...products]
    .filter((p) => (Number(p.current_stock) || 0) > 0)
    .sort((a, b) =>
      (a.commercial_name || '').localeCompare(b.commercial_name || '', undefined, { sensitivity: 'base' })
    );

  const doc = new jsPDF('l', 'mm', 'a4');
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;
  const contentWidth = pageWidth - 2 * margin;

  const totalUnits = inStock.reduce((sum, p) => sum + (Number(p.current_stock) || 0), 0);
  const totalValue = inStock.reduce(
    (sum, p) => sum + (Number(p.current_stock) || 0) * (Number(p.price) || 0),
    0
  );

  doc.setProperties({
    title: 'In-stock inventory',
    subject: 'Products with quantity on hand',
    author: PDF_BRAND,
    creator: PDF_BRAND
  });

  doc.setFillColor(66, 139, 202);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(17);
  doc.setFont('helvetica', 'bold');
  doc.text(PDF_BRAND, pageWidth / 2, 13, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text('In-stock inventory report', pageWidth / 2, 22, { align: 'center' });

  doc.setTextColor(0, 0, 0);
  let y = 34;

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(margin, y, contentWidth, 24, 'FD');

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text(`SKUs in stock: ${inStock.length}`, margin + 4, y + 10);
  doc.text(`Total units on hand: ${totalUnits.toLocaleString('en-TZ')}`, margin + 4, y + 18);

  doc.text(`Total inventory value: ${formatCurrency(totalValue)}`, margin + contentWidth * 0.5, y + 14);

  y += 30;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Generated ${formatDate(new Date())} · Amounts in TZS · Status uses minimum stock rules (Low = at or below min).`,
    margin,
    y
  );
  y += 8;
  doc.setTextColor(0, 0, 0);

  const drawFooter = (pageNumber: number) => {
    const barTop = pageHeight - 11;
    doc.setFillColor(66, 139, 202);
    doc.rect(0, barTop, pageWidth, 11, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    const midY = barTop + 7;
    doc.text(PDF_BRAND, margin, midY);
    doc.text(`Page ${pageNumber}`, pageWidth / 2, midY, { align: 'center' });
    const rightLine = `${inStock.length} SKUs · ${totalUnits.toLocaleString('en-TZ')} u · ${formatCurrency(totalValue)}`;
    doc.text(rightLine, pageWidth - margin, midY, { align: 'right' });
  };

  if (inStock.length === 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'italic');
    doc.text('No products currently have quantity on hand (all levels are zero).', margin, y + 4);
    drawFooter(1);
    doc.save(`In-stock_inventory_${new Date().toISOString().slice(0, 10)}.pdf`);
    return;
  }

  const head = [
    ['#', 'Code', 'Product', 'Type', 'Category', 'Brand', 'Qty', 'Min', 'Unit', 'Line value', 'Status']
  ];

  const body = inStock.map((p, idx) => {
    const q = Number(p.current_stock) || 0;
    const unit = Number(p.price) || 0;
    const lineVal = q * unit;
    const brand = (p.brand?.name || '').trim() || '—';
    const status = getStatusText(getStockStatus(p));
    return [
      String(idx + 1),
      String(p.code || ''),
      String(p.commercial_name || ''),
      String(p.product_type || '—'),
      String(p.category || '—'),
      brand,
      String(q),
      String(p.min_stock ?? ''),
      formatCurrency(unit),
      formatCurrency(lineVal),
      status
    ];
  });

  autoTable(doc, {
    startY: y,
    head,
    body,
    theme: 'striped',
    headStyles: {
      fillColor: [66, 139, 202],
      textColor: 255,
      fontSize: 8,
      fontStyle: 'bold'
    },
    bodyStyles: { fontSize: 7, cellPadding: 1.6 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    margin: { left: margin, right: margin, bottom: 14 },
    styles: { lineColor: [226, 232, 240], lineWidth: 0.1 },
    columnStyles: {
      0: { cellWidth: 9, halign: 'center' },
      1: { cellWidth: 20 },
      2: { cellWidth: 46, overflow: 'linebreak' },
      3: { cellWidth: 24, overflow: 'linebreak' },
      4: { cellWidth: 22, overflow: 'linebreak' },
      5: { cellWidth: 22, overflow: 'linebreak' },
      6: { cellWidth: 12, halign: 'right' },
      7: { cellWidth: 11, halign: 'right' },
      8: { cellWidth: 26, halign: 'right' },
      9: { cellWidth: 28, halign: 'right' },
      10: { cellWidth: 22 }
    },
    didDrawPage: (data) => {
      drawFooter(data.pageNumber);
    }
  });

  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`In-stock_inventory_${stamp}.pdf`);
}
