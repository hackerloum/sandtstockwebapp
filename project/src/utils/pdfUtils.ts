import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Order, Product } from '../types';
import { formatCurrency, formatDate } from './stockUtils';

export const generateOrderPDF = (order: Order, products: Product[]) => {
  // Create A4 document (210mm x 297mm)
  const doc = new jsPDF('p', 'mm', 'a4');
  
  // Set document properties
  doc.setProperties({
    title: `Order ${order.order_number}`,
    subject: 'Order Details',
    author: 'Argeville Stock Tracker',
    creator: 'Argeville Stock Tracker'
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
  doc.text('ARGEVILLE', pageWidth / 2, 20, { align: 'center' });
  
  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('Stock Tracker - Order Details', pageWidth / 2, 30, { align: 'center' });
  
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
  
  if (order.items && order.items.length > 0) {
    const tableData = order.items.map(item => [
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
  doc.text(`Total Amount: ${formatCurrency(order.total_amount)}`, margin + 5, currentY + 12);
  
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
  doc.text('Argeville Stock Tracker System', pageWidth / 2, footerY + 8, { align: 'center' });
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
    author: 'Argeville Stock Tracker',
    creator: 'Argeville Stock Tracker'
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
  doc.text('ARGEVILLE', pageWidth / 2, 20, { align: 'center' });
  
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
      doc.text(`ARGEVILLE - Bulk Orders (Page ${currentPage})`, pageWidth / 2, 15, { align: 'center' });
      
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
    doc.text(`Customer: ${order.customer_name} | Date: ${formatDate(order.created_at)} | Total: ${formatCurrency(order.total_amount)}`, margin, currentY);
    currentY += 15;
    
    // Add order items summary
    if (order.items && order.items.length > 0) {
      const itemSummary = order.items.map(item => 
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
  doc.text('Argeville Stock Tracker System', pageWidth / 2, footerY + 8, { align: 'center' });
  
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