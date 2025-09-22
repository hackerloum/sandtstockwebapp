import * as XLSX from 'xlsx';

export interface ExcelProduct {
  'Commercial Name': string;
  'Code Name': string;
  'Item Number': string;
  'Current Stock': number;
  'Price': number;
  'Stock Status': string;
}

export const exportProductsToExcel = (products: any[], filename: string = 'products_export') => {
  // Transform products to Excel format
  const excelData: ExcelProduct[] = products.map(product => {
    const stockStatus = getStockStatusText(product);
    
         return {
       'Commercial Name': product.commercial_name || '',
       'Code Name': product.code || '',
       'Item Number': product.item_number || '',
       'Current Stock': product.current_stock || 0,
       'Price': product.price || 0,
       'Stock Status': stockStatus
     };
  });

  // Create workbook and worksheet
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(excelData);

  // Set column widths
  const columnWidths = [
    { wch: 40 }, // Commercial Name
    { wch: 20 }, // Code Name
    { wch: 20 }, // Item Number
    { wch: 15 }, // Current Stock
    { wch: 15 }, // Price
    { wch: 20 }  // Stock Status
  ];
  worksheet['!cols'] = columnWidths;

  // Add conditional formatting for stock status
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  
  // Style the header row
  for (let col = range.s.c; col <= range.e.c; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
    if (!worksheet[cellAddress]) continue;
    
    worksheet[cellAddress].s = {
      font: { bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '366092' } },
      alignment: { horizontal: 'center', vertical: 'center' }
    };
  }

  // Style stock status column and apply conditional formatting
  const stockStatusCol = 5; // Column F (Stock Status)
  const currentStockCol = 3; // Column D (Current Stock)
  
  for (let row = 1; row <= range.e.r; row++) {
    const stockStatusCell = XLSX.utils.encode_cell({ r: row, c: stockStatusCol });
    const currentStockCell = XLSX.utils.encode_cell({ r: row, c: currentStockCol });
    
    if (worksheet[stockStatusCell] && worksheet[currentStockCell]) {
      const currentStock = worksheet[currentStockCell].v;
      const stockStatus = worksheet[stockStatusCell].v;
      
             // Apply conditional formatting based on stock status
       if (stockStatus === 'OUT OF STOCK' || currentStock === 0) {
        worksheet[stockStatusCell].s = {
          font: { bold: true, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: 'C00000' } }, // Red
          alignment: { horizontal: 'center' }
        };
      } else if (stockStatus === 'LOW STOCK') {
        worksheet[stockStatusCell].s = {
          font: { bold: true, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: 'FF6600' } }, // Orange
          alignment: { horizontal: 'center' }
        };
      } else if (stockStatus === 'IN STOCK') {
        worksheet[stockStatusCell].s = {
          font: { bold: true, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: '00B050' } }, // Green
          alignment: { horizontal: 'center' }
        };
      }
      
      // Also color the current stock column
      if (currentStock === 0) {
        worksheet[currentStockCell].s = {
          font: { bold: true, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: 'C00000' } } // Red
        };
      } else if (currentStock <= 5) {
        worksheet[currentStockCell].s = {
          font: { bold: true, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: 'FF6600' } } // Orange
        };
      } else {
        worksheet[currentStockCell].s = {
          font: { bold: true, color: { rgb: 'FFFFFF' } },
          fill: { fgColor: { rgb: '00B050' } } // Green
        };
      }
    }
  }

  // Add the worksheet to the workbook
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Products');

  // Generate filename with timestamp
  const timestamp = new Date().toISOString().split('T')[0];
  const finalFilename = `${filename}_${timestamp}.xlsx`;

  // Write to file
  XLSX.writeFile(workbook, finalFilename);
  
  return finalFilename;
};

// Helper function to get stock status text
const getStockStatusText = (product: any): string => {
  const currentStock = product.current_stock || 0;
  const minStock = product.min_stock || 5;
  
  if (currentStock === 0) {
    return 'OUT OF STOCK';
  } else if (currentStock <= minStock) {
    return 'LOW STOCK';
  } else {
    return 'IN STOCK';
  }
};

// Export function for filtered products only
export const exportFilteredProductsToExcel = (products: any[], filters: any, filename: string = 'filtered_products') => {
  // Apply the same filtering logic as the component
  let filteredProducts = [...products];
  
  // Apply search term filter
  if (filters.searchTerm) {
    const searchLower = filters.searchTerm.toLowerCase();
    filteredProducts = filteredProducts.filter(product =>
      product.code?.toLowerCase().includes(searchLower) ||
      product.commercial_name?.toLowerCase().includes(searchLower) ||
      product.brand?.name?.toLowerCase().includes(searchLower) ||
      product.fragrance_notes?.toLowerCase().includes(searchLower) ||
      product.category?.toLowerCase().includes(searchLower) ||
      product.product_type?.toLowerCase().includes(searchLower)
    );
  }
  
  // Apply status filter
  if (filters.statusFilter !== 'all') {
    filteredProducts = filteredProducts.filter(product => {
      const status = getStockStatusText(product);
      return status === filters.statusFilter;
    });
  }
  
  // Apply category filter
  if (filters.categoryFilter !== 'all') {
    filteredProducts = filteredProducts.filter(product => product.category === filters.categoryFilter);
  }
  
  // Apply product type filter
  if (filters.productTypeFilter !== 'all') {
    filteredProducts = filteredProducts.filter(product => product.product_type === filters.productTypeFilter);
  }
  
  // Apply brand filter
  if (filters.brandFilter !== 'all') {
    filteredProducts = filteredProducts.filter(product => 
      (product.brand?.name || product.brand_id) === filters.brandFilter
    );
  }
  
  // Apply price range filter
  filteredProducts = filteredProducts.filter(product => 
    product.price >= filters.priceRange.min && product.price <= filters.priceRange.max
  );
  
  // Apply stock range filter
  filteredProducts = filteredProducts.filter(product => 
    product.current_stock >= filters.stockRange.min && product.current_stock <= filters.stockRange.max
  );
  
  // Apply tester filter
  if (filters.isTester !== null) {
    filteredProducts = filteredProducts.filter(product => product.is_tester === filters.isTester);
  }
  
  return exportProductsToExcel(filteredProducts, filename);
}; 