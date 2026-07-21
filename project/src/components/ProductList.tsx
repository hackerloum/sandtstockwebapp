import React, { useCallback, useMemo, useState } from 'react';
import {
  ArrowDownAZ,
  ArrowUpAZ,
  Download,
  Edit2,
  Eye,
  FileText,
  MoreHorizontal,
  Package,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  X
} from 'lucide-react';
import { Product } from '../types';
import { updateProduct } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { exportFilteredProductsToExcel, exportProductsToExcel } from '../utils/excelUtils';
import { downloadInStockInventoryPdf } from '../utils/pdfUtils';
import { formatCurrency, getStockStatus, isNotUpdatedWithin7Days } from '../utils/stockUtils';
import { Button } from './shared/Button';
import { Input, Select } from './shared/Form';
import { Modal } from './shared/Modal';
import { EmptyState, PageHeader } from './shared/PageLayout';

interface ProductListProps {
  products: Product[];
  onAddProduct: () => void;
  onEditProduct: (product: Product) => void;
  onDeleteProduct: (id: string) => void;
  onViewProduct: (product: Product) => void;
  onUpdateProduct?: (product: Product) => void;
}

interface ExtendedProduct extends Product {
  brand?: { name: string } | null;
  supplier?: { name: string } | null;
}

type SortField = 'commercial_name' | 'current_stock' | 'price' | 'updated_at';
type SortDirection = 'asc' | 'desc';

const statusOptions = [
  { value: 'all', label: 'All stock' },
  { value: 'ok', label: 'In stock' },
  { value: 'low', label: 'Low stock' },
  { value: 'out', label: 'Out of stock' },
  { value: 'high', label: 'High stock' }
];

const sortOptions = [
  { value: 'commercial_name', label: 'Name' },
  { value: 'current_stock', label: 'Stock' },
  { value: 'price', label: 'Price' },
  { value: 'updated_at', label: 'Last updated' }
];

const stockPresentation = (product: Product) => {
  const stock = Number(product.current_stock || 0);
  const minimum = Number(product.min_stock || 0);

  if (stock <= 0) {
    return { label: 'Out of stock', className: 'border-red-200 bg-red-50 text-red-700', dot: 'bg-red-500' };
  }
  if (stock <= minimum) {
    return { label: 'Low stock', className: 'border-amber-200 bg-amber-50 text-amber-700', dot: 'bg-amber-500' };
  }
  return { label: 'In stock', className: 'border-emerald-200 bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' };
};

export const ProductList: React.FC<ProductListProps> = ({
  products,
  onAddProduct,
  onEditProduct,
  onDeleteProduct,
  onViewProduct,
  onUpdateProduct
}) => {
  const { hasPermission, user } = useAuth();
  const extendedProducts = products as ExtendedProduct[];
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [productTypeFilter, setProductTypeFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [sortField, setSortField] = useState<SortField>('commercial_name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [showFilters, setShowFilters] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [showBulkPriceUpdate, setShowBulkPriceUpdate] = useState(false);
  const [zeroingStaleStock, setZeroingStaleStock] = useState(false);
  const [bulkPriceUpdate, setBulkPriceUpdate] = useState({
    updateType: 'percentage' as 'percentage' | 'fixed',
    percentage: 0,
    fixedAmount: 0
  });

  const categories = useMemo(
    () => Array.from(new Set(extendedProducts.map((product) => product.category).filter(Boolean))).sort(),
    [extendedProducts]
  );
  const productTypes = useMemo(
    () => Array.from(new Set(extendedProducts.map((product) => product.product_type).filter(Boolean))).sort(),
    [extendedProducts]
  );
  const brands = useMemo(
    () => Array.from(new Set(extendedProducts.map((product) => product.brand?.name || product.brand_id).filter(Boolean) as string[])).sort(),
    [extendedProducts]
  );

  const filteredProducts = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const result = extendedProducts.filter((product) => {
      const searchable = [
        product.commercial_name,
        product.code,
        product.item_number,
        product.category,
        product.product_type,
        product.brand?.name,
        product.brand_id
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return (
        (!term || searchable.includes(term)) &&
        (statusFilter === 'all' || getStockStatus(product as Product) === statusFilter) &&
        (categoryFilter === 'all' || product.category === categoryFilter) &&
        (productTypeFilter === 'all' || product.product_type === productTypeFilter) &&
        (brandFilter === 'all' || (product.brand?.name || product.brand_id) === brandFilter)
      );
    });

    return result.sort((a, b) => {
      let left: string | number = a[sortField] || '';
      let right: string | number = b[sortField] || '';
      if (sortField === 'updated_at') {
        left = left ? new Date(left).getTime() : 0;
        right = right ? new Date(right).getTime() : 0;
      }
      if (typeof left === 'string') left = left.toLowerCase();
      if (typeof right === 'string') right = right.toLowerCase();
      if (left === right) return 0;
      const order = left > right ? 1 : -1;
      return sortDirection === 'asc' ? order : -order;
    });
  }, [brandFilter, categoryFilter, extendedProducts, productTypeFilter, searchTerm, sortDirection, sortField, statusFilter]);

  const summary = useMemo(() => {
    const inStock = extendedProducts.filter((product) => Number(product.current_stock || 0) > Number(product.min_stock || 0)).length;
    const lowStock = extendedProducts.filter((product) => Number(product.current_stock || 0) > 0 && Number(product.current_stock || 0) <= Number(product.min_stock || 0)).length;
    const outOfStock = extendedProducts.filter((product) => Number(product.current_stock || 0) <= 0).length;
    const value = extendedProducts.reduce(
      (total, product) => total + Number(product.current_stock || 0) * Number(product.price || 0),
      0
    );
    return { inStock, lowStock, outOfStock, value };
  }, [extendedProducts]);

  const hasActiveFilters = Boolean(
    searchTerm || statusFilter !== 'all' || categoryFilter !== 'all' || productTypeFilter !== 'all' || brandFilter !== 'all'
  );

  const clearFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setCategoryFilter('all');
    setProductTypeFilter('all');
    setBrandFilter('all');
  };

  const handleDelete = (product: ExtendedProduct) => {
    if (window.confirm(`Delete ${product.commercial_name}? This cannot be undone.`)) {
      onDeleteProduct(product.id);
    }
  };

  const handleExportAll = () => {
    exportProductsToExcel(extendedProducts, 'all_products');
  };

  const handleExportFiltered = () => {
    const filters = {
      searchTerm,
      statusFilter,
      categoryFilter,
      productTypeFilter,
      brandFilter,
      updatedFilter: 'all',
      priceRange: { min: Number.NEGATIVE_INFINITY, max: Number.POSITIVE_INFINITY },
      stockRange: { min: Number.NEGATIVE_INFINITY, max: Number.POSITIVE_INFINITY },
      isTester: null
    };
    exportFilteredProductsToExcel(extendedProducts, filters, 'filtered_products');
  };

  const handleZeroStockNotUpdated7Days = useCallback(async () => {
    const staleProducts = extendedProducts.filter((product) => isNotUpdatedWithin7Days(product.updated_at));
    if (!staleProducts.length) {
      window.alert('All products have been updated within the last 7 days.');
      return;
    }
    if (!window.confirm(`Set stock to 0 for ${staleProducts.length} products not updated in the last 7 days?`)) return;

    setZeroingStaleStock(true);
    try {
      for (const product of staleProducts) {
        const updated = await updateProduct(product.id, { current_stock: 0, updated_by: user?.id || null });
        if (updated && onUpdateProduct) onUpdateProduct({ ...product, ...updated, current_stock: 0 } as Product);
      }
    } finally {
      setZeroingStaleStock(false);
      setShowTools(false);
    }
  }, [extendedProducts, onUpdateProduct, user?.id]);

  const handleBulkPriceUpdate = async () => {
    const { updateType, percentage, fixedAmount } = bulkPriceUpdate;
    if (updateType === 'percentage' && (percentage === 0 || percentage <= -100)) {
      window.alert('Enter a percentage greater than -100.');
      return;
    }
    if (updateType === 'fixed' && fixedAmount < 0) {
      window.alert('Enter a valid price.');
      return;
    }
    if (!window.confirm(`Update prices for all ${extendedProducts.length} products?`)) return;

    for (const product of extendedProducts) {
      const nextPrice = updateType === 'percentage'
        ? Math.max(0, Math.round(Number(product.price || 0) * (1 + percentage / 100) * 100) / 100)
        : fixedAmount;
      const updated = await updateProduct(product.id, { price: nextPrice, updated_by: user?.id || null });
      if (updated && onUpdateProduct) onUpdateProduct({ ...product, ...updated, price: nextPrice } as Product);
    }
    setShowBulkPriceUpdate(false);
    setShowTools(false);
  };

  const ProductActions = ({ product }: { product: ExtendedProduct }) => (
    <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        onClick={() => onViewProduct(product)}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900"
        title="View product"
        aria-label={`View ${product.commercial_name}`}
      >
        <Eye className="h-4 w-4" />
      </button>
      {hasPermission('edit_product') && (
        <button
          type="button"
          onClick={() => onEditProduct(product)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          title="Edit product"
          aria-label={`Edit ${product.commercial_name}`}
        >
          <Edit2 className="h-4 w-4" />
        </button>
      )}
      {hasPermission('delete_product') && (
        <button
          type="button"
          onClick={() => handleDelete(product)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-700"
          title="Delete product"
          aria-label={`Delete ${product.commercial_name}`}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-5" data-product-list="container">
      <PageHeader
        title="Products"
        subtitle={`${products.length} products in inventory`}
        actions={hasPermission('add_product') ? (
          <Button icon={<Plus className="h-4 w-4" />} onClick={onAddProduct}>Add product</Button>
        ) : undefined}
      />

      <section className="overflow-hidden rounded-md border border-gray-200 bg-white">
        <div className="grid grid-cols-2 divide-x divide-y divide-gray-200 sm:grid-cols-4 sm:divide-y-0 lg:grid-cols-[1fr_1fr_1fr_1.35fr]">
          <div className="p-4">
            <p className="text-xs font-medium uppercase text-gray-500">In stock</p>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{summary.inStock}</p>
          </div>
          <div className="p-4">
            <p className="text-xs font-medium uppercase text-gray-500">Low stock</p>
            <p className="mt-1 text-2xl font-semibold text-amber-700">{summary.lowStock}</p>
          </div>
          <div className="p-4">
            <p className="text-xs font-medium uppercase text-gray-500">Out of stock</p>
            <p className="mt-1 text-2xl font-semibold text-red-700">{summary.outOfStock}</p>
          </div>
          <div className="p-4">
            <p className="text-xs font-medium uppercase text-gray-500">Inventory value</p>
            <p className="mt-1 truncate text-lg font-semibold text-gray-900" title={formatCurrency(summary.value)}>{formatCurrency(summary.value)}</p>
          </div>
        </div>
      </section>

      <section className="rounded-md border border-gray-200 bg-white">
        <div className="space-y-3 border-b border-gray-200 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Search name, code, item number, or category"
                className="h-10 pl-9 pr-9"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                options={statusOptions}
                className="h-10 min-w-0 sm:w-36"
                aria-label="Filter by stock status"
              />
              <Button
                variant={showFilters ? 'secondary' : 'outline'}
                icon={<SlidersHorizontal className="h-4 w-4" />}
                onClick={() => setShowFilters((value) => !value)}
                className="h-10"
              >
                Filters
              </Button>
              <div className="relative col-span-2 sm:col-span-1">
                <Button
                  variant="outline"
                  icon={<MoreHorizontal className="h-4 w-4" />}
                  onClick={() => setShowTools((value) => !value)}
                  className="h-10 w-full"
                  aria-expanded={showTools}
                >
                  Tools
                </Button>
                {showTools && (
                  <div className="absolute right-0 z-20 mt-2 w-64 rounded-md border border-gray-200 bg-white p-1.5 shadow-lg">
                    <button type="button" onClick={handleExportAll} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100">
                      <Download className="h-4 w-4 text-gray-500" /> Export all products
                    </button>
                    {hasActiveFilters && (
                      <button type="button" onClick={handleExportFiltered} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100">
                        <Download className="h-4 w-4 text-gray-500" /> Export current results
                      </button>
                    )}
                    <button type="button" onClick={() => downloadInStockInventoryPdf(extendedProducts)} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100">
                      <FileText className="h-4 w-4 text-gray-500" /> Download in-stock PDF
                    </button>
                    {hasPermission('edit_product') && (
                      <>
                        <div className="my-1 border-t border-gray-200" />
                        <button type="button" onClick={() => setShowBulkPriceUpdate(true)} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100">
                          <Package className="h-4 w-4 text-gray-500" /> Update prices
                        </button>
                        <button type="button" disabled={zeroingStaleStock} onClick={handleZeroStockNotUpdated7Days} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50">
                          <RotateCcw className="h-4 w-4 text-gray-500" /> {zeroingStaleStock ? 'Updating stock...' : 'Zero stale stock'}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {showFilters && (
            <div className="grid gap-3 border-t border-gray-200 pt-3 sm:grid-cols-2 lg:grid-cols-4">
              <Select
                value={categoryFilter}
                onChange={(event) => setCategoryFilter(event.target.value)}
                options={[{ value: 'all', label: 'All categories' }, ...categories.map((value) => ({ value, label: value }))]}
                aria-label="Filter by category"
              />
              <Select
                value={productTypeFilter}
                onChange={(event) => setProductTypeFilter(event.target.value)}
                options={[{ value: 'all', label: 'All product types' }, ...productTypes.map((value) => ({ value, label: value }))]}
                aria-label="Filter by product type"
              />
              <Select
                value={brandFilter}
                onChange={(event) => setBrandFilter(event.target.value)}
                options={[{ value: 'all', label: 'All brands' }, ...brands.map((value) => ({ value, label: value }))]}
                aria-label="Filter by brand"
              />
              <div className="flex gap-2">
                <Select
                  value={sortField}
                  onChange={(event) => setSortField(event.target.value as SortField)}
                  options={sortOptions}
                  className="min-w-0 flex-1"
                  aria-label="Sort products"
                />
                <button
                  type="button"
                  onClick={() => setSortDirection((direction) => direction === 'asc' ? 'desc' : 'asc')}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-gray-300 text-gray-600 hover:bg-gray-50"
                  title={sortDirection === 'asc' ? 'Ascending' : 'Descending'}
                >
                  {sortDirection === 'asc' ? <ArrowDownAZ className="h-4 w-4" /> : <ArrowUpAZ className="h-4 w-4" />}
                </button>
              </div>
            </div>
          )}

          <div className="flex min-h-6 items-center justify-between gap-3 text-sm">
            <span className="text-gray-500">Showing {filteredProducts.length} of {products.length}</span>
            {hasActiveFilters && (
              <button type="button" onClick={clearFilters} className="font-medium text-emerald-700 hover:text-emerald-800">Clear filters</button>
            )}
          </div>
        </div>

        {filteredProducts.length === 0 ? (
          <EmptyState
            icon={<Package className="h-8 w-8" />}
            title={products.length ? 'No matching products' : 'No products yet'}
            description={products.length ? 'Try changing your search or filters.' : 'Add your first product to start tracking inventory.'}
            action={products.length ? <Button variant="outline" onClick={clearFilters}>Clear filters</Button> : undefined}
          />
        ) : (
          <>
            <div className="divide-y divide-gray-200 lg:hidden">
              {filteredProducts.map((product) => {
                const stock = stockPresentation(product);
                return (
                  <article
                    key={product.id}
                    data-row-id={product.id}
                    onClick={() => onViewProduct(product)}
                    className="cursor-pointer p-4 transition-colors hover:bg-gray-50"
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h2 className="truncate text-sm font-semibold text-gray-900">{product.commercial_name}</h2>
                        <p className="mt-0.5 truncate text-xs text-gray-500">{product.code} · {product.item_number || 'No item number'}</p>
                      </div>
                      <ProductActions product={product} />
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-3">
                      <div>
                        <p className="text-xs text-gray-500">Stock</p>
                        <p className="mt-0.5 text-sm font-semibold text-gray-900">{product.current_stock || 0}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Price</p>
                        <p className="mt-0.5 truncate text-sm font-semibold text-gray-900">{formatCurrency(product.price || 0)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Status</p>
                        <span className={`mt-1 inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-xs font-medium ${stock.className}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${stock.dot}`} /> {stock.label}
                        </span>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full min-w-[900px] table-fixed">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr className="text-left text-xs font-medium uppercase text-gray-500">
                    <th className="w-[30%] px-4 py-3">Product</th>
                    <th className="w-[16%] px-4 py-3">Type</th>
                    <th className="w-[12%] px-4 py-3">Stock</th>
                    <th className="w-[14%] px-4 py-3">Status</th>
                    <th className="w-[14%] px-4 py-3">Price</th>
                    <th className="w-[14%] px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredProducts.map((product) => {
                    const stock = stockPresentation(product);
                    return (
                      <tr key={product.id} data-row-id={product.id} onClick={() => onViewProduct(product)} className="cursor-pointer hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="truncate text-sm font-semibold text-gray-900">{product.commercial_name}</p>
                          <p className="mt-0.5 truncate text-xs text-gray-500">{product.code} · {product.item_number || 'No item number'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="truncate text-sm text-gray-700">{product.product_type || 'Unspecified'}</p>
                          <p className="truncate text-xs text-gray-500">{product.category || 'No category'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold text-gray-900">{product.current_stock || 0}</p>
                          <p className="text-xs text-gray-500">Min {product.min_stock || 0}</p>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 rounded border px-2 py-1 text-xs font-medium ${stock.className}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${stock.dot}`} /> {stock.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900">{formatCurrency(product.price || 0)}</td>
                        <td className="px-4 py-3"><ProductActions product={product} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <Modal
        isOpen={showBulkPriceUpdate}
        onClose={() => setShowBulkPriceUpdate(false)}
        title="Update product prices"
        size="sm"
        footer={(
          <>
            <Button variant="outline" onClick={() => setShowBulkPriceUpdate(false)}>Cancel</Button>
            <Button onClick={handleBulkPriceUpdate}>Update prices</Button>
          </>
        )}
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600">This change applies to all {products.length} products.</p>
          <Select
            value={bulkPriceUpdate.updateType}
            onChange={(event) => setBulkPriceUpdate((value) => ({ ...value, updateType: event.target.value as 'percentage' | 'fixed' }))}
            options={[
              { value: 'percentage', label: 'Increase or decrease by percentage' },
              { value: 'fixed', label: 'Set one fixed price' }
            ]}
          />
          <Input
            type="number"
            value={bulkPriceUpdate.updateType === 'percentage' ? bulkPriceUpdate.percentage : bulkPriceUpdate.fixedAmount}
            onChange={(event) => {
              const amount = Number(event.target.value);
              setBulkPriceUpdate((value) => value.updateType === 'percentage'
                ? { ...value, percentage: amount }
                : { ...value, fixedAmount: amount });
            }}
            placeholder={bulkPriceUpdate.updateType === 'percentage' ? 'Percentage, for example 10' : 'New price'}
          />
        </div>
      </Modal>
    </div>
  );
};
