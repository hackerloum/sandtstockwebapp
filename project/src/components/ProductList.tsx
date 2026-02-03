import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Search, Plus, Edit2, Trash2, Eye, Package, Filter, X, SortAsc, SortDesc, Clock, Download, RotateCcw } from 'lucide-react';
import { Product } from '../types';
import { getStockStatus, getStockStatusColor, getStatusText, formatCurrency, formatWeight, getUpdatedTimeline, getUpdatedTimelineLabel, getUpdatedTimelineBadgeClass, isNotUpdatedWithin7Days } from '../utils/stockUtils';
import { exportProductsToExcel, exportFilteredProductsToExcel } from '../utils/excelUtils';
import { PageHeader, PageContainer, PageSection, EmptyState } from './shared/PageLayout';
import { Button } from './shared/Button';
import { Table } from './shared/Table';
import { Input, Select } from './shared/Form';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { updateProduct } from '../lib/supabase';

interface ProductListProps {
  products: Product[];
  onAddProduct: () => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (id: string) => void;
  onViewProduct: (product: Product) => void;
  onUpdateProduct?: (product: Product) => void;
}

type SortField = 'commercial_name' | 'code' | 'current_stock' | 'price' | 'created_at' | 'updated_at' | 'product_type';
type SortDirection = 'asc' | 'desc';

interface SearchFilters {
  searchTerm: string;
  statusFilter: string;
  categoryFilter: string;
  productTypeFilter: string;
  brandFilter: string;
  updatedFilter: 'all' | 'today' | 'last_week';
  priceRange: { min: number; max: number };
  stockRange: { min: number; max: number };
  isTester: boolean | null;
}

// Extended Product interface for the component
interface ExtendedProduct extends Product {
  brand?: { name: string } | null;
  supplier?: { name: string } | null;
}

export const ProductList: React.FC<ProductListProps> = ({
  products,
  onAddProduct,
  onEditProduct,
  onDeleteProduct,
  onViewProduct,
  onUpdateProduct
}) => {
  const { hasPermission, user } = useAuth();
  
  // Add debugging for permissions
  console.log('ProductList: Current user:', user?.username, 'Role:', user?.role);
  console.log('ProductList: Edit permission:', hasPermission('edit_product'));
  console.log('ProductList: Delete permission:', hasPermission('delete_product'));
  console.log('ProductList: Add permission:', hasPermission('add_product'));
  
  // Show warning if permissions are missing
  if (!hasPermission('edit_product')) {
    console.warn('ProductList: User does not have edit_product permission - edit buttons will be hidden');
  }
  if (!hasPermission('delete_product')) {
    console.warn('ProductList: User does not have delete_product permission - delete buttons will be hidden');
  }
  if (!hasPermission('add_product')) {
    console.warn('ProductList: User does not have add_product permission - add buttons will be hidden');
  }
  
  // Add debugging for products prop
  console.log('ProductList: Received products:', products);
  console.log('ProductList: Products count:', products?.length || 0);
  
  // Check for products with missing required fields
  const productsWithIssues = products?.filter(p => !p.id || !p.code || !p.commercial_name || !p.category || !p.product_type) || [];
  if (productsWithIssues.length > 0) {
    console.log('ProductList: Products with missing required fields:', productsWithIssues);
  }
  
  const [filters, setFilters] = useState<SearchFilters>({
    searchTerm: '',
    statusFilter: 'all',
    categoryFilter: 'all',
    productTypeFilter: 'all',
    brandFilter: 'all',
    updatedFilter: 'all',
    priceRange: { min: -1e6, max: 10000 },
    stockRange: { min: -1e6, max: 1000 },
    isTester: null
  });

  const [sortField, setSortField] = useState<SortField>('commercial_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [showBulkPriceUpdate, setShowBulkPriceUpdate] = useState(false);
  const [zeroingStaleStock, setZeroingStaleStock] = useState(false);
  const [bulkPriceUpdate, setBulkPriceUpdate] = useState({
    percentage: 0,
    fixedAmount: 0,
    updateType: 'percentage' as 'percentage' | 'fixed'
  });

  // Cast products to ExtendedProduct for brand/supplier access
  const extendedProducts = products as ExtendedProduct[];

  // Export functions
  const handleExportAllProducts = () => {
    try {
      const filename = exportProductsToExcel(extendedProducts, 'all_products');
      console.log(`Exported all products to ${filename}`);
      // Show success message
      alert(`✅ Successfully exported ${extendedProducts.length} products to ${filename}\n\n📊 Excel contains:\n• Commercial Name\n• Code Name\n• Item Number\n• Current Stock\n• Price\n• Stock Status (with colors)`);
    } catch (error) {
      console.error('Error exporting products:', error);
      alert('❌ Failed to export products. Please try again.');
    }
  };

  const handleExportFilteredProducts = () => {
    try {
      const filename = exportFilteredProductsToExcel(extendedProducts, filters, 'filtered_products');
      console.log(`Exported filtered products to ${filename}`);
      // Show success message
      alert(`✅ Successfully exported ${extendedProducts.length} filtered products to ${filename}\n\n📊 Excel contains:\n• Commercial Name\n• Code Name\n• Item Number\n• Current Stock\n• Price\n• Stock Status (with colors)`);
    } catch (error) {
      console.error('Error exporting filtered products:', error);
      alert('❌ Failed to export filtered products. Please try again.');
    }
  };

  // Bulk price update functions
  const handleBulkPriceUpdate = async () => {
    if (!hasPermission('edit_product')) {
      alert('❌ You do not have permission to update product prices.');
      return;
    }

    console.log('User permissions check passed');
    console.log('Current user:', user);
    console.log('Supabase client available:', !!supabase);

    const { percentage, fixedAmount, updateType } = bulkPriceUpdate;
    
    if (updateType === 'percentage' && (percentage === 0 || percentage < -100)) {
      alert('❌ Please enter a valid percentage (must be greater than -100%).');
      return;
    }
    
    if (updateType === 'fixed' && fixedAmount === 0) {
      alert('❌ Please enter a valid fixed amount.');
      return;
    }

    const confirmMessage = updateType === 'percentage' 
      ? `Are you sure you want to update prices by ${percentage > 0 ? '+' : ''}${percentage}% for all ${extendedProducts.length} products?`
      : `Are you sure you want to set ALL product prices to $${fixedAmount}?`;

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      let updatedCount = 0;
      let errors: string[] = [];

      console.log('Bulk price update starting...');
      console.log('Products to update:', extendedProducts.length);
      console.log('Update type:', updateType);
      console.log('Percentage:', percentage);
      console.log('Fixed amount:', fixedAmount);

      for (const product of extendedProducts) {
        try {
          let newPrice = 0;
          
          if (updateType === 'percentage') {
            // For percentage, calculate based on current price
            newPrice = (product.price || 0) * (1 + percentage / 100);
          } else {
            // For fixed amount, use the exact amount entered
            newPrice = fixedAmount;
          }
          
          // Ensure price doesn't go negative
          newPrice = Math.max(0, newPrice);
          
          // Round to 2 decimal places
          newPrice = Math.round(newPrice * 100) / 100;

          console.log(`Updating product ${product.id} (${product.commercial_name}): ${product.price} -> ${newPrice}`);

          // Update the product in the database using the updateProduct function
          const updatedProduct = await updateProduct(product.id, { 
            price: newPrice,
            updated_by: user?.id || null
          });

          if (updatedProduct) {
            console.log(`Successfully updated product ${product.id}`);
            updatedCount++;
          } else {
            console.error(`Failed to update product ${product.id}`);
            errors.push(`${product.commercial_name}: Update failed`);
          }
        } catch (error) {
          console.error(`Exception updating product ${product.id}:`, error);
          errors.push(`${product.commercial_name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      console.log(`Bulk update completed. Updated: ${updatedCount}, Errors: ${errors.length}`);

      if (updatedCount > 0) {
        alert(`✅ Successfully updated prices for ${updatedCount} products!`);
        // Reset the form
        setBulkPriceUpdate({
          percentage: 0,
          fixedAmount: 0,
          updateType: 'percentage'
        });
        setShowBulkPriceUpdate(false);
        // Refresh the page to show updated data
        window.location.reload();
      }

      if (errors.length > 0) {
        console.error('Errors during bulk update:', errors);
        alert(`⚠️ Updated ${updatedCount} products, but ${errors.length} had errors. Check console for details.`);
      }
    } catch (error) {
      console.error('Error during bulk price update:', error);
      alert('❌ Error updating prices. Please try again.');
    }
  };

  const calculateNewPrice = (currentPrice: number) => {
    const { percentage, fixedAmount, updateType } = bulkPriceUpdate;
    let newPrice = 0;
    
    if (updateType === 'percentage') {
      newPrice = (currentPrice || 0) * (1 + percentage / 100);
    } else {
      newPrice = fixedAmount;
    }
    
    return Math.max(0, Math.round(newPrice * 100) / 100);
  };
  
  console.log('ProductList: Extended products:', extendedProducts);
  console.log('ProductList: Extended products count:', extendedProducts?.length || 0);

  // Calculate dynamic ranges based on actual data (include negatives so all products show)
  const minStock = useMemo(() => {
    if (extendedProducts.length === 0) return 0;
    return Math.min(...extendedProducts.map(p => p.current_stock ?? 0));
  }, [extendedProducts]);

  const maxStock = useMemo(() => {
    if (extendedProducts.length === 0) return 1000;
    return Math.max(...extendedProducts.map(p => p.current_stock ?? 0), 1000);
  }, [extendedProducts]);

  const minPrice = useMemo(() => {
    if (extendedProducts.length === 0) return 0;
    return Math.min(...extendedProducts.map(p => p.price ?? 0));
  }, [extendedProducts]);

  const maxPrice = useMemo(() => {
    if (extendedProducts.length === 0) return 10000;
    return Math.max(...extendedProducts.map(p => p.price ?? 0), 10000);
  }, [extendedProducts]);

  // Extract unique values for filters
  const categories = useMemo(() => Array.from(new Set(extendedProducts.map(p => p.category))), [extendedProducts]);
  const productTypes = useMemo(() => Array.from(new Set(extendedProducts.map(p => p.product_type))), [extendedProducts]);
  const brands = useMemo(() => Array.from(new Set(extendedProducts.map(p => p.brand?.name || p.brand_id).filter(Boolean))), [extendedProducts]);
  
  console.log('ProductList: Available categories:', categories);
  console.log('ProductList: Available product types:', productTypes);
  console.log('ProductList: Available brands:', brands);
  console.log('ProductList: Max stock found:', maxStock);
  console.log('ProductList: Max price found:', maxPrice);

  // Update filters with dynamic ranges so all products (including negative stock/price) are included
  useEffect(() => {
    if (extendedProducts.length === 0) return;
    const stockWider = minStock < 0 || maxStock > 1000;
    const priceWider = minPrice < 0 || maxPrice > 10000;
    if (stockWider || priceWider) {
      setFilters(prev => ({
        ...prev,
        priceRange: { min: minPrice, max: maxPrice },
        stockRange: { min: minStock, max: maxStock }
      }));
    }
  }, [extendedProducts.length, minStock, maxStock, minPrice, maxPrice]);

  // Enhanced search functionality
  const filteredProducts = useMemo(() => {
    console.log('ProductList: Filtering products with filters:', filters);
    console.log('ProductList: Starting with', extendedProducts.length, 'products');
    
    const filtered = extendedProducts.filter(product => {
      // Search term matching (multiple fields)
      const searchLower = filters.searchTerm.toLowerCase();
      const matchesSearch = !filters.searchTerm || 
        product.commercial_name.toLowerCase().includes(searchLower) ||
        product.code.toLowerCase().includes(searchLower) ||
        product.item_number.toLowerCase().includes(searchLower) ||
        (product.brand?.name || product.brand_id || '').toLowerCase().includes(searchLower) ||
        (product.fragrance_notes || '').toLowerCase().includes(searchLower) ||
        (product.concentration || '').toLowerCase().includes(searchLower) ||
        (product.gender || '').toLowerCase().includes(searchLower) ||
        (product.season || []).some(s => s.toLowerCase().includes(searchLower));

      // Status filter
      const matchesStatus = filters.statusFilter === 'all' || getStockStatus(product as any) === filters.statusFilter;

      // Category filter
      const matchesCategory = filters.categoryFilter === 'all' || product.category === filters.categoryFilter;

      // Product type filter
      const matchesProductType = filters.productTypeFilter === 'all' || product.product_type === filters.productTypeFilter;

      // Brand filter
      const matchesBrand = filters.brandFilter === 'all' || 
        (product.brand?.name || product.brand_id || '') === filters.brandFilter;

      // Price range filter
      const matchesPrice = product.price >= filters.priceRange.min && product.price <= filters.priceRange.max;

      // Stock range filter
      const matchesStock = product.current_stock >= filters.stockRange.min && product.current_stock <= filters.stockRange.max;

      // Tester filter
      const matchesTester = filters.isTester === null || product.is_tester === filters.isTester;

      // Updated timeline filter (today = updated today; last_week = today, yesterday, or last 7 days)
      const timeline = getUpdatedTimeline(product.updated_at);
      const matchesUpdated =
        filters.updatedFilter === 'all' ||
        (filters.updatedFilter === 'today' && timeline === 'today') ||
        (filters.updatedFilter === 'last_week' && (timeline === 'today' || timeline === 'yesterday' || timeline === 'last_week'));

      const matches = matchesSearch && matchesStatus && matchesCategory && matchesProductType && 
             matchesBrand && matchesPrice && matchesStock && matchesTester && matchesUpdated;
             
      // Debug individual product filtering
      if (!matches) {
        console.log(`ProductList: Product "${product.commercial_name}" (${product.code}) filtered out:`, {
          matchesSearch,
          matchesStatus,
          matchesCategory,
          matchesProductType,
          matchesBrand,
          matchesPrice,
          matchesStock,
          matchesTester,
          product: {
            commercial_name: product.commercial_name,
            code: product.code,
            category: product.category,
            product_type: product.product_type,
            brand: product.brand?.name || product.brand_id,
            price: product.price,
            current_stock: product.current_stock,
            is_tester: product.is_tester
          }
        });
      }

      return matches;
    });
    
    console.log('ProductList: Filtered products count:', filtered.length);
    console.log('ProductList: Products filtered out:', extendedProducts.length - filtered.length);
    return filtered;
  }, [extendedProducts, filters]);

  // Sorting functionality
  const sortedProducts = useMemo(() => {
    return [...filteredProducts].sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // Handle nested objects
      if (sortField === 'commercial_name' && a.brand?.name) {
        aValue = a.brand.name;
        bValue = b.brand?.name || b.brand_id;
      }

      // Handle date comparison for updated_at
      if (sortField === 'updated_at') {
        const aTime = aValue ? new Date(aValue).getTime() : 0;
        const bTime = bValue ? new Date(bValue).getTime() : 0;
        if (aTime < bTime) return sortDirection === 'asc' ? -1 : 1;
        if (aTime > bTime) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      }

      // Handle string comparison
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = bValue.toLowerCase();
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredProducts, sortField, sortDirection]);

  // Search suggestions
  const searchSuggestions = useMemo(() => {
    if (!filters.searchTerm || filters.searchTerm.length < 2) return [];
    
    const suggestions = new Set<string>();
    const searchLower = filters.searchTerm.toLowerCase();
    
    extendedProducts.forEach(product => {
      // Add exact matches first
      if (product.commercial_name.toLowerCase().includes(searchLower)) {
        suggestions.add(product.commercial_name);
      }
      if (product.code.toLowerCase().includes(searchLower)) {
        suggestions.add(product.code);
      }
      if (product.brand?.name && product.brand.name.toLowerCase().includes(searchLower)) {
        suggestions.add(product.brand.name);
      }
      
      // Add partial matches for better suggestions
      const words = product.commercial_name.toLowerCase().split(' ');
      words.forEach(word => {
        if (word.startsWith(searchLower) && word.length > 2) {
          suggestions.add(word);
        }
      });
      
      // Add product type suggestions
      if (product.product_type && product.product_type.toLowerCase().includes(searchLower)) {
        suggestions.add(product.product_type);
      }
      
      // Add category suggestions
      if (product.category && product.category.toLowerCase().includes(searchLower)) {
        suggestions.add(product.category);
      }
    });
    
    // Sort suggestions by relevance (exact matches first, then partial matches)
    const sortedSuggestions = Array.from(suggestions).sort((a, b) => {
      const aExact = a.toLowerCase().startsWith(searchLower);
      const bExact = b.toLowerCase().startsWith(searchLower);
      if (aExact && !bExact) return -1;
      if (!aExact && bExact) return 1;
      return a.localeCompare(b);
    });
    
    return sortedSuggestions.slice(0, 8);
  }, [extendedProducts, filters.searchTerm]);

  // Handle search
  const handleSearch = useCallback((searchTerm: string) => {
    setFilters(prev => ({ ...prev, searchTerm }));
    if (searchTerm && !searchHistory.includes(searchTerm)) {
      setSearchHistory(prev => [searchTerm, ...prev.slice(0, 4)]);
    }
  }, [searchHistory]);

  // Handle search suggestion click
  const handleSuggestionClick = useCallback((suggestion: string) => {
    console.log('ProductList: Clicked suggestion:', suggestion);
    // Clear other filters and set the search term
    setFilters({
      searchTerm: suggestion,
      statusFilter: 'all',
      categoryFilter: 'all',
      productTypeFilter: 'all',
      brandFilter: 'all',
      updatedFilter: 'all',
      priceRange: { min: minPrice, max: maxPrice },
      stockRange: { min: minStock, max: maxStock },
      isTester: null
    });
    if (suggestion && !searchHistory.includes(suggestion)) {
      setSearchHistory(prev => [suggestion, ...prev.slice(0, 4)]);
    }
  }, [searchHistory, minPrice, maxPrice, minStock, maxStock]);

  // Handle sort
  const handleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField]);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setFilters({
      searchTerm: '',
      statusFilter: 'all',
      categoryFilter: 'all',
      productTypeFilter: 'all',
      brandFilter: 'all',
      updatedFilter: 'all',
      priceRange: { min: minPrice, max: maxPrice },
      stockRange: { min: minStock, max: maxStock },
      isTester: null
    });
  }, [minPrice, maxPrice, minStock, maxStock]);

  /** Set current_stock to 0 for all products not updated within the last 7 days (uses updated_at). */
  const handleZeroStockNotUpdated7Days = useCallback(async () => {
    const stale = extendedProducts.filter((p) => isNotUpdatedWithin7Days(p.updated_at));
    if (stale.length === 0) {
      alert('No products found that were not updated in the last 7 days. All products have been updated recently.');
      return;
    }
    const message = `Set current stock to 0 for ${stale.length} product(s) that have not been updated in the last 7 days?\n\nThis uses each product's "Updated" date (updated_at), not the created date.`;
    if (!confirm(message)) return;
    if (!onUpdateProduct) {
      alert('Cannot update products: missing update handler.');
      return;
    }
    setZeroingStaleStock(true);
    try {
      let updated = 0;
      for (const product of stale) {
        const result = await updateProduct(product.id, { current_stock: 0 });
        if (result) {
          onUpdateProduct({ ...product, ...result, current_stock: 0 } as Product);
          updated++;
        }
      }
      alert(`Done. Set stock to 0 for ${updated} product(s) that were not updated in the last 7 days.`);
    } catch (err) {
      console.error('Error zeroing stale stock:', err);
      alert(err instanceof Error ? err.message : 'Failed to update some products. Check console.');
    } finally {
      setZeroingStaleStock(false);
    }
  }, [extendedProducts, onUpdateProduct]);

  const columns = [
    {
      key: 'codes',
      header: 'Codes',
      sortable: true,
      width: '14%',
      render: (product: ExtendedProduct) => {
        const prefix = product.item_number?.substring(0, 2);
        const suffix = product.item_number?.substring(2);
        const getPrefixMeaning = (prefix: string) => {
          switch (prefix) {
            case 'AF': return 'Argeville Fragrance';
            case 'ITM': return 'Item';
            case 'PKG': return 'Packaging';
            case 'AM': return 'Argeville Men';
            case 'TK': return 'Tester Kit';
            default: return 'Unknown';
          }
        };
        
        return (
          <div className="min-w-0">
            <div className="font-medium text-gray-900 truncate" title={product.code}>{product.code}</div>
            <div className="text-xs text-gray-500 truncate" title={product.item_number}>
              {prefix && <span className="font-semibold text-blue-600">{prefix}</span>}
              {suffix}
            </div>
          </div>
        );
      }
    },
    {
      key: 'details',
      header: 'Product',
      sortable: true,
      width: '25%',
      render: (product: ExtendedProduct) => (
        <div className="min-w-0">
          <div className="font-medium text-gray-900 truncate" title={product.commercial_name}>{product.commercial_name}</div>
          <div className="text-xs text-gray-500 truncate">{product.brand?.name || product.brand_id || '—'}</div>
          <div className="text-xs text-gray-400">{product.size}ml • {product.category || '—'}</div>
          {product.product_type && (
            <div className="text-xs text-blue-600 font-medium truncate">{product.product_type}</div>
          )}
        </div>
      )
    },
    {
      key: 'stock',
      header: 'Stock',
      sortable: true,
      width: '10%',
      render: (product: ExtendedProduct) => {
        const currentStock = product.current_stock || 0;
        const minStock = product.min_stock || 5;
        const maxStock = product.max_stock || 50;
        
        // Determine stock status and color
        let stockColor = 'text-green-600';
        let bgColor = 'bg-green-100';
        let borderColor = 'border-green-200';
        
        if (currentStock === 0) {
          stockColor = 'text-red-600';
          bgColor = 'bg-red-100';
          borderColor = 'border-red-200';
        } else if (currentStock <= minStock) {
          stockColor = 'text-orange-600';
          bgColor = 'bg-orange-100';
          borderColor = 'border-orange-200';
        }
        
        return (
          <div className={`p-1.5 rounded border ${borderColor} ${bgColor} min-w-0`}>
            <div className="flex items-baseline justify-between gap-1">
              <span className={`font-bold ${stockColor}`}>{currentStock}</span>
              <span className="text-xs text-gray-500">/ {maxStock}</span>
            </div>
            <div className="text-xs text-gray-600">Min {minStock}</div>
          </div>
        );
      }
    },
    {
      key: 'status',
      header: 'Status',
      width: '12%',
      render: (product: ExtendedProduct) => {
        const status = getStockStatus(product as any);
        const statusColor = getStockStatusColor(status);
        const statusText = getStatusText(status);
        const currentStock = product.current_stock || 0;
        const minStock = product.min_stock || 5;
        
        // Enhanced status display with stock level indicators
        let stockLevelText = '';
        let stockLevelColor = '';
        
        if (currentStock === 0) {
          stockLevelText = 'OUT OF STOCK';
          stockLevelColor = 'bg-red-500 text-white';
        } else if (currentStock <= minStock) {
          stockLevelText = 'LOW STOCK';
          stockLevelColor = 'bg-orange-500 text-white';
        } else if (currentStock <= minStock * 2) {
          stockLevelText = 'MEDIUM STOCK';
          stockLevelColor = 'bg-yellow-500 text-white';
        } else {
          stockLevelText = 'IN STOCK';
          stockLevelColor = 'bg-green-500 text-white';
        }
        
        return (
          <div className="space-y-1 min-w-0">
            <span className={`inline-flex px-1.5 py-0.5 text-xs font-medium rounded border ${statusColor}`}>
              {statusText}
            </span>
            <div className={`inline-flex px-1.5 py-0.5 text-xs font-bold rounded ${stockLevelColor}`}>
              {stockLevelText}
            </div>
          </div>
        );
      }
    },
    {
      key: 'price',
      header: 'Price',
      sortable: true,
      width: '9%',
      render: (product: ExtendedProduct) => (
        <div className="min-w-0">
          <div className="font-medium text-sm">{formatCurrency(product.price)}</div>
        </div>
      )
    },
    {
      key: 'value',
      header: 'Value',
      sortable: true,
      width: '11%',
      render: (product: ExtendedProduct) => (
        <div className="min-w-0">
          <div className="font-medium text-sm">{formatCurrency(product.current_stock * product.price)}</div>
        </div>
      )
    },
    {
      key: 'updated_at',
      header: 'Updated',
      sortable: true,
      width: '13%',
      render: (product: ExtendedProduct) => {
        const timeline = getUpdatedTimeline(product.updated_at);
        const label = getUpdatedTimelineLabel(product.updated_at);
        const badgeClass = getUpdatedTimelineBadgeClass(timeline);
        return (
          <div className="space-y-0.5 min-w-0">
            <span className={`inline-flex px-1.5 py-0.5 text-xs font-medium rounded border ${badgeClass}`}>
              {label}
            </span>
            {product.updated_at && (
              <div className="text-xs text-gray-500 truncate" title={new Date(product.updated_at).toLocaleString()}>
                {new Date(product.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </div>
            )}
          </div>
        );
      }
    }
  ];

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'out', label: 'Out of Stock' },
    { value: 'low', label: 'Low Stock' },
    { value: 'ok', label: 'Normal' },
    { value: 'high', label: 'High Stock' }
  ];

  const categoryOptions = [
    { value: 'all', label: 'All Categories' },
    ...categories.map(category => ({
      value: category,
      label: category
    }))
  ];

  const productTypeOptions = [
    { value: 'all', label: 'All Types' },
    ...productTypes.map(type => ({
      value: type,
      label: type
    }))
  ];

  const brandOptions = [
    { value: 'all', label: 'All Brands' },
    ...brands.map(brand => ({
      value: brand || '',
      label: brand || ''
    })).filter(option => option.value !== '')
  ];

  const hasActiveFilters = filters.searchTerm || 
    filters.statusFilter !== 'all' || 
    filters.categoryFilter !== 'all' || 
    filters.productTypeFilter !== 'all' || 
    filters.brandFilter !== 'all' || 
    filters.updatedFilter !== 'all' ||
    filters.priceRange.min > minPrice || 
    filters.priceRange.max < maxPrice || 
    filters.stockRange.min > minStock || 
    filters.stockRange.max < maxStock || 
    filters.isTester !== null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        subtitle={`${sortedProducts.length} of ${products.length} products`}
        actions={
          <div className="flex items-center space-x-3">
            {/* Export Buttons */}
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                icon={<Download className="w-4 h-4" />}
                onClick={handleExportAllProducts}
                title="Export all products to Excel"
              >
                Export All
              </Button>
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Download className="w-4 h-4" />}
                  onClick={handleExportFilteredProducts}
                  title="Export filtered products to Excel"
                >
                  Export Filtered
                </Button>
              )}
            </div>
            
            {/* Bulk Price Update Button */}
            {hasPermission('edit_product') && (
              <Button
                variant="outline"
                size="sm"
                icon={<Package className="w-4 h-4" />}
                onClick={() => setShowBulkPriceUpdate(true)}
                title="Update prices for all products"
              >
                Bulk Price Update
              </Button>
            )}

            {/* Zero stock for products not updated in 7+ days */}
            {hasPermission('edit_product') && (
              <Button
                variant="outline"
                size="sm"
                icon={<RotateCcw className="w-4 h-4" />}
                onClick={handleZeroStockNotUpdated7Days}
                disabled={zeroingStaleStock}
                title="Set current stock to 0 for products not updated in the last 7 days (uses Updated date)"
              >
                {zeroingStaleStock ? 'Updating…' : 'Zero stock (not updated 7+ days)'}
              </Button>
            )}
            
            {/* Add Product Button */}
            {hasPermission('add_product') ? (
              <Button
                variant="primary"
                icon={<Plus className="w-4 h-4" />}
                onClick={onAddProduct}
              >
                Add Product
              </Button>
            ) : (
              <div className="text-sm text-gray-500 bg-gray-100 px-3 py-2 rounded-lg">
                Add Product permission required
              </div>
            )}
          </div>
        }
      />

      <PageContainer>
        {/* Permission Status */}
        {(!hasPermission('edit_product') || !hasPermission('delete_product') || !hasPermission('add_product')) && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="text-sm text-yellow-800">
              <strong>Permission Notice:</strong> 
              <span className="ml-2">Current role: {user?.role || 'Unknown'}</span>
              {!hasPermission('add_product') && <span className="ml-2">• Cannot add products</span>}
              {!hasPermission('edit_product') && <span className="ml-2">• Cannot edit products</span>}
              {!hasPermission('delete_product') && <span className="ml-2">• Cannot delete products</span>}
              <span className="ml-2">Contact your administrator for access.</span>
            </div>
          </div>
        )}
        
        <PageSection>
          {/* Search and Filters */}
          <div className="space-y-4 mb-6">
            {/* Main Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="Search by name, code, brand, notes, or any product details..."
                value={filters.searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10 pr-10"
              />
              {filters.searchTerm && (
                <button
                  onClick={() => handleSearch('')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Search Suggestions */}
            {searchSuggestions.length > 0 && filters.searchTerm && (
              <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-2">
                <div className="text-xs text-gray-500 mb-2 flex items-center">
                  <Clock className="w-3 h-3 mr-1" />
                  Suggestions
                </div>
                {searchSuggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(suggestion)}
                    className="block w-full text-left px-2 py-1 text-sm hover:bg-gray-100 rounded"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}

            {/* Quick Filters */}
            <div className="flex flex-wrap gap-2">
              <Select
                value={filters.statusFilter}
                onChange={(e) => setFilters(prev => ({ ...prev, statusFilter: e.target.value }))}
                options={statusOptions}
                className="w-32"
              />
              <Select
                value={filters.categoryFilter}
                onChange={(e) => setFilters(prev => ({ ...prev, categoryFilter: e.target.value }))}
                options={categoryOptions}
                className="w-40"
              />
              <Select
                value={filters.productTypeFilter}
                onChange={(e) => setFilters(prev => ({ ...prev, productTypeFilter: e.target.value }))}
                options={productTypeOptions}
                className="w-40"
              />
              <Select
                value={filters.updatedFilter}
                onChange={(e) => setFilters(prev => ({ ...prev, updatedFilter: e.target.value as 'all' | 'today' | 'last_week' }))}
                options={[
                  { value: 'all', label: 'Any update time' },
                  { value: 'today', label: 'Updated today' },
                  { value: 'last_week', label: 'Updated last 7 days' }
                ]}
                className="w-44"
              />
              <Button
                variant="outline"
                size="sm"
                icon={<Filter className="w-4 h-4" />}
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              >
                {showAdvancedFilters ? 'Hide' : 'Advanced'} Filters
              </Button>
              {hasActiveFilters && (
                <Button
                  variant="outline"
                  size="sm"
                  icon={<X className="w-4 h-4" />}
                  onClick={clearFilters}
                >
                  Clear All
                </Button>
              )}
            </div>

            {/* Advanced Filters */}
            {showAdvancedFilters && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                    <Select
                      value={filters.brandFilter}
                      onChange={(e) => setFilters(prev => ({ ...prev, brandFilter: e.target.value }))}
                      options={brandOptions}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price Range</label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Min"
                        value={filters.priceRange.min}
                        onChange={(e) => setFilters(prev => ({ 
                          ...prev, 
                          priceRange: { ...prev.priceRange, min: Number(e.target.value) || 0 }
                        }))}
                        className="w-20"
                      />
                      <span className="self-center text-gray-500">-</span>
                      <Input
                        type="number"
                        placeholder="Max"
                        value={filters.priceRange.max}
                        onChange={(e) => setFilters(prev => ({ 
                          ...prev, 
                          priceRange: { ...prev.priceRange, max: Number(e.target.value) || 10000 }
                        }))}
                        className="w-20"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Stock Range</label>
                    <div className="flex gap-2">
                      <Input
                        type="number"
                        placeholder="Min"
                        value={filters.stockRange.min}
                        onChange={(e) => setFilters(prev => ({ 
                          ...prev, 
                          stockRange: { ...prev.stockRange, min: Number(e.target.value) || 0 }
                        }))}
                        className="w-20"
                      />
                      <span className="self-center text-gray-500">-</span>
                      <Input
                        type="number"
                        placeholder="Max"
                        value={filters.stockRange.max}
                        onChange={(e) => setFilters(prev => ({ 
                          ...prev, 
                          stockRange: { ...prev.stockRange, max: Number(e.target.value) || 1000 }
                        }))}
                        className="w-20"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tester Status</label>
                  <Select
                    value={filters.isTester === null ? 'all' : filters.isTester ? 'true' : 'false'}
                    onChange={(e) => setFilters(prev => ({ 
                      ...prev, 
                      isTester: e.target.value === 'all' ? null : e.target.value === 'true'
                    }))}
                    options={[
                      { value: 'all', label: 'All Products' },
                      { value: 'true', label: 'Tester Only' },
                      { value: 'false', label: 'Non-Tester Only' }
                    ]}
                  />
                </div>
              </div>
            )}

            {/* Search History */}
            {searchHistory.length > 0 && !filters.searchTerm && (
              <div className="flex flex-wrap gap-2">
                <span className="text-sm text-gray-500 flex items-center">
                  <Clock className="w-3 h-3 mr-1" />
                  Recent searches:
                </span>
                {searchHistory.map((term, index) => (
                  <button
                    key={index}
                    onClick={() => handleSuggestionClick(term)}
                    className="text-sm bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded"
                  >
                    {term}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Results Summary */}
          {hasActiveFilters && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="text-sm text-blue-800">
                  Showing {sortedProducts.length} of {products.length} products
                  {filters.searchTerm && (
                    <span> matching "{filters.searchTerm}"</span>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearFilters}
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          )}

          {/* Debug Information (only show if no products found) */}
          {sortedProducts.length === 0 && products.length > 0 && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="text-sm text-yellow-800">
                <strong>Debug Info:</strong> No products found with current filters. 
                Total products available: {products.length}
                <br />
                Active filters: {Object.entries(filters).map(([key, value]) => 
                  value !== '' && value !== 'all' && value !== null && 
                  (typeof value !== 'object' || (value.min !== 0 || value.max !== 10000)) ? 
                  `${key}: ${JSON.stringify(value)}` : null
                ).filter(Boolean).join(', ')}
              </div>
            </div>
          )}

          {/* Stock Summary and Export Options */}
          {sortedProducts.length > 0 && (
            <div className="mb-6 p-4 bg-white border border-gray-200 rounded-lg shadow-sm">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
                {/* Stock Statistics */}
                <div className="grid grid-cols-2 md:grid-cols-7 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {sortedProducts.filter(p => (p.current_stock || 0) > (p.min_stock || 5)).length}
                    </div>
                    <div className="text-sm text-gray-600">In Stock</div>
                    <div className="text-xs text-gray-400">Green</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">
                      {sortedProducts.filter(p => (p.current_stock || 0) > 0 && (p.current_stock || 0) <= (p.min_stock || 5)).length}
                    </div>
                    <div className="text-sm text-gray-600">Low Stock</div>
                    <div className="text-xs text-gray-400">Orange</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {sortedProducts.filter(p => (p.current_stock || 0) === 0).length}
                    </div>
                    <div className="text-sm text-gray-600">Out of Stock</div>
                    <div className="text-xs text-gray-400">Red</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {sortedProducts.length}
                    </div>
                    <div className="text-sm text-gray-600">Total Products</div>
                    <div className="text-xs text-gray-400">All</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-emerald-600">
                      {extendedProducts.filter(p => getUpdatedTimeline(p.updated_at) === 'today').length}
                    </div>
                    <div className="text-sm text-gray-600">Updated today</div>
                    <div className="text-xs text-gray-400">Timeline</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-slate-600">
                      {extendedProducts.filter(p => ['today', 'yesterday', 'last_week'].includes(getUpdatedTimeline(p.updated_at))).length}
                    </div>
                    <div className="text-sm text-gray-600">Last 7 days</div>
                    <div className="text-xs text-gray-400">Timeline</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">
                      ${sortedProducts.reduce((sum, p) => sum + (p.price || 0), 0).toLocaleString()}
                    </div>
                    <div className="text-sm text-gray-600">Total Value</div>
                    <div className="text-xs text-gray-400">Price Sum</div>
                  </div>
                </div>
                
                {/* Quick Export Options */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Download className="w-4 h-4" />}
                    onClick={handleExportAllProducts}
                    className="whitespace-nowrap"
                  >
                    Export All ({sortedProducts.length})
                  </Button>
                  {hasActiveFilters && (
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<Download className="w-4 h-4" />}
                      onClick={handleExportFilteredProducts}
                      className="whitespace-nowrap"
                    >
                      Export Filtered ({sortedProducts.length})
                    </Button>
                  )}
                </div>
              </div>
              
              {/* Color Legend */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="text-sm text-gray-600 mb-2">Color Legend:</div>
                <div className="flex flex-wrap gap-3 text-xs">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-500 rounded"></div>
                    <span>In Stock (Above minimum stock level)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-yellow-500 rounded"></div>
                    <span>Medium Stock (Above minimum but close to low)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-orange-500 rounded"></div>
                    <span>Low Stock (At or below minimum stock level)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-red-500 rounded"></div>
                    <span>Out of Stock (Zero stock)</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Debug Information (show when there's a discrepancy) */}
          {sortedProducts.length > 0 && sortedProducts.length !== products.length && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="text-sm text-blue-800">
                <strong>Debug Info:</strong> Showing {sortedProducts.length} of {products.length} products.
                {filters.searchTerm && (
                  <span> Search term: "{filters.searchTerm}"</span>
                )}
                <br />
                Active filters: {Object.entries(filters).map(([key, value]) => {
                  if (value === '' || value === 'all' || value === null) return null;
                  if (typeof value === 'object') {
                    if (key === 'priceRange' && (value.min > 0 || value.max < maxPrice)) {
                      return `${key}: ${JSON.stringify(value)}`;
                    }
                    if (key === 'stockRange' && (value.min > 0 || value.max < maxStock)) {
                      return `${key}: ${JSON.stringify(value)}`;
                    }
                    if (key !== 'priceRange' && key !== 'stockRange' && (value.min > 0 || value.max < 10000)) {
                      return `${key}: ${JSON.stringify(value)}`;
                    }
                  }
                  return null;
                }).filter(Boolean).join(', ')}
                <br />
                Max stock in data: {maxStock}, Max price in data: {maxPrice}
              </div>
            </div>
          )}

          <Table
            data={sortedProducts}
            columns={columns}
            rowActions={(product) => (
              <div className="flex items-center justify-end space-x-2" onClick={(e) => e.stopPropagation()}>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Eye className="w-4 h-4" />}
                  onClick={() => onViewProduct(product)}
                  title="View Details"
                />
                {hasPermission('edit_product') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Edit2 className="w-4 h-4" />}
                    onClick={() => onEditProduct(product)}
                    title="Edit Product"
                  />
                )}
                {hasPermission('delete_product') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    icon={<Trash2 className="w-4 h-4" />}
                    onClick={() => onDeleteProduct(product.id)}
                    title="Delete Product"
                  />
                )}
              </div>
            )}
            emptyState={
              <EmptyState
                icon={<Package className="w-16 h-16" />}
                title={hasActiveFilters ? "No products found" : "No products yet"}
                description={
                  hasActiveFilters 
                    ? "Try adjusting your search criteria or filters to find what you're looking for."
                    : hasPermission('add_product') 
                      ? "Get started by adding your first product to the inventory."
                      : "No products in inventory. Contact administrator for add product permission."
                }
                action={
                  hasPermission('add_product') ? (
                    <Button
                      variant="primary"
                      icon={<Plus className="w-4 h-4" />}
                      onClick={onAddProduct}
                    >
                      Add Product
                    </Button>
                  ) : (
                    <div className="text-sm text-gray-500">
                      Contact administrator for add product permission
                    </div>
                  )
                }
              />
            }
          />
        </PageSection>
      </PageContainer>

      {/* Bulk Price Update Modal */}
      {showBulkPriceUpdate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Bulk Price Update</h3>
              <button
                onClick={() => setShowBulkPriceUpdate(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Update Type
                </label>
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="updateType"
                      value="percentage"
                      checked={bulkPriceUpdate.updateType === 'percentage'}
                      onChange={(e) => setBulkPriceUpdate(prev => ({ ...prev, updateType: e.target.value as 'percentage' | 'fixed' }))}
                      className="mr-2"
                    />
                    Percentage
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="updateType"
                      value="fixed"
                      checked={bulkPriceUpdate.updateType === 'fixed'}
                      onChange={(e) => setBulkPriceUpdate(prev => ({ ...prev, updateType: e.target.value as 'percentage' | 'fixed' }))}
                      className="mr-2"
                    />
                    Fixed Amount
                  </label>
                </div>
              </div>

              {bulkPriceUpdate.updateType === 'percentage' ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Percentage Change (%)
                  </label>
                  <Input
                    type="number"
                    placeholder="e.g., 10 for +10%, -5 for -5%"
                    value={bulkPriceUpdate.percentage}
                    onChange={(e) => setBulkPriceUpdate(prev => ({ ...prev, percentage: parseFloat(e.target.value) || 0 }))}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Positive for increase, negative for decrease (based on current prices)
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Set All Prices To ($)
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="e.g., 25.99 to set all prices to $25.99"
                    value={bulkPriceUpdate.fixedAmount}
                    onChange={(e) => setBulkPriceUpdate(prev => ({ ...prev, fixedAmount: parseFloat(e.target.value) || 0 }))}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    This will replace ALL product prices with this exact amount
                  </p>
                </div>
              )}

              {/* Preview */}
              <div className="bg-gray-50 p-3 rounded-lg">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Preview</h4>
                <div className="text-xs text-gray-600 space-y-1">
                  <div>Products to update: <strong>{extendedProducts.length}</strong></div>
                  <div>Current total value: <strong>${extendedProducts.reduce((sum, p) => sum + (p.price || 0), 0).toLocaleString()}</strong></div>
                  <div>New total value: <strong>${extendedProducts.reduce((sum, p) => sum + calculateNewPrice(p.price || 0), 0).toLocaleString()}</strong></div>
                  <div>Change: <strong className={bulkPriceUpdate.updateType === 'percentage' ? (bulkPriceUpdate.percentage > 0 ? 'text-green-600' : 'text-red-600') : (bulkPriceUpdate.fixedAmount > 0 ? 'text-green-600' : 'text-red-600')}>
                    {bulkPriceUpdate.updateType === 'percentage' 
                      ? `${bulkPriceUpdate.percentage > 0 ? '+' : ''}${bulkPriceUpdate.percentage}%`
                      : `Set all to $${bulkPriceUpdate.fixedAmount}`
                    }
                  </strong></div>
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowBulkPriceUpdate(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  onClick={handleBulkPriceUpdate}
                  className="flex-1"
                  disabled={
                    (bulkPriceUpdate.updateType === 'percentage' && (bulkPriceUpdate.percentage === 0 || bulkPriceUpdate.percentage < -100)) ||
                    (bulkPriceUpdate.updateType === 'fixed' && bulkPriceUpdate.fixedAmount === 0)
                  }
                >
                  Update All Prices
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};