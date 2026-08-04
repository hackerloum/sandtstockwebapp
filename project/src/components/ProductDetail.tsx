import React from 'react';
import { CalendarDays, Edit2, Package, Truck, Weight } from 'lucide-react';
import { InventoryOwner, Product } from '../types';
import { formatCurrency, getStockStatus, getStatusText } from '../utils/stockUtils';
import { Button } from './shared/Button';
import { Modal } from './shared/Modal';

interface ProductDetailProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (product: Product) => void;
  inventoryOwners: InventoryOwner[];
}

interface ExtendedProduct extends Product {
  brand?: { name: string } | null;
  supplier?: { name: string } | null;
}

const displayDate = (value: string | null | undefined) => {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not recorded';
  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

const statusClasses: Record<string, string> = {
  out: 'border-red-200 bg-red-50 text-red-700',
  low: 'border-amber-200 bg-amber-50 text-amber-700',
  high: 'border-blue-200 bg-blue-50 text-blue-700',
  ok: 'border-emerald-200 bg-emerald-50 text-emerald-700'
};

const DetailItem = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="min-w-0">
    <dt className="text-xs font-medium uppercase text-gray-500">{label}</dt>
    <dd className="mt-1 break-words text-sm font-medium text-gray-900">{value || 'Not set'}</dd>
  </div>
);

const ownerToneClass = (ownerType?: string | null) => (
  ownerType === 'company'
    ? 'border-sky-200 bg-sky-50 text-sky-700'
    : 'border-violet-200 bg-violet-50 text-violet-700'
);

export const ProductDetail: React.FC<ProductDetailProps> = ({
  product,
  isOpen,
  onClose,
  onEdit,
  inventoryOwners
}) => {
  if (!product) return null;

  const extendedProduct = product as ExtendedProduct;
  const status = getStockStatus(product);
  const stock = Number(product.current_stock || 0);
  const minimum = Number(product.min_stock || 0);
  const maximum = Number(product.max_stock || 0);
  const stockValue = stock * Number(product.price || 0);
  const stockPercent = maximum > 0 ? Math.min(Math.max((stock / maximum) * 100, 0), 100) : 0;
  const season = Array.isArray(product.season) && product.season.length ? product.season.join(', ') : 'Not set';
  const ownerStocks = (product.owner_stocks || []).filter((stock) => Number(stock.quantity || 0) > 0);
  const defaultOwner = inventoryOwners.find((owner) => owner.is_default) || inventoryOwners[0] || null;

  const handleEdit = () => {
    onClose();
    onEdit?.(product);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Product details"
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Close</Button>
          {onEdit && (
            <Button icon={<Edit2 className="h-4 w-4" />} onClick={handleEdit}>Edit product</Button>
          )}
        </>
      }
    >
      <div className="space-y-6">
        <section className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="break-words text-xl font-semibold text-gray-950 sm:text-2xl">{product.commercial_name}</h2>
            <p className="mt-1 text-sm text-gray-500">
              {[product.code, product.item_number].filter(Boolean).join(' · ')}
            </p>
            <p className="mt-2 text-sm text-gray-600">
              {[product.product_type, product.category].filter(Boolean).join(' · ')}
            </p>
          </div>
          <span className={`inline-flex w-fit shrink-0 items-center rounded border px-2.5 py-1 text-xs font-medium ${statusClasses[status] || statusClasses.ok}`}>
            {getStatusText(status)}
          </span>
        </section>

        <section className="grid grid-cols-2 overflow-hidden rounded-md border border-gray-200 sm:grid-cols-3">
          <div className="border-b border-r border-gray-200 p-4 sm:border-b-0">
            <p className="text-xs font-medium uppercase text-gray-500">Current stock</p>
            <p className="mt-1 text-xl font-semibold text-gray-950">{stock}</p>
          </div>
          <div className="border-b border-gray-200 p-4 sm:border-b-0 sm:border-r">
            <p className="text-xs font-medium uppercase text-gray-500">Unit price</p>
            <p className="mt-1 truncate text-base font-semibold text-gray-950" title={formatCurrency(product.price || 0)}>
              {formatCurrency(product.price || 0)}
            </p>
          </div>
          <div className="col-span-2 p-4 sm:col-span-1">
            <p className="text-xs font-medium uppercase text-gray-500">Stock value</p>
            <p className="mt-1 truncate text-base font-semibold text-gray-950" title={formatCurrency(stockValue)}>
              {formatCurrency(stockValue)}
            </p>
          </div>
        </section>

        <section className="rounded-md border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-gray-950">Owner stock</h3>
            <p className="text-xs text-gray-500">Total stock is split below</p>
          </div>
          <div className="mt-3 divide-y divide-gray-100 rounded-md border border-gray-200">
            {ownerStocks.length === 0 ? (
              <div className="px-4 py-6 text-sm text-gray-500">
                No owner split recorded yet. Default owner: {defaultOwner?.name || 'Company'}.
              </div>
            ) : ownerStocks.map((stock) => (
              <div key={stock.owner_id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className={`inline-flex items-center gap-2 rounded border px-2.5 py-1.5 ${ownerToneClass(stock.owner?.owner_type || inventoryOwners.find((owner) => owner.id === stock.owner_id)?.owner_type)}`}>
                  <span className="text-sm font-medium text-gray-900">
                    {stock.owner?.name || inventoryOwners.find((owner) => owner.id === stock.owner_id)?.name || 'Owner'}
                  </span>
                  <span className="text-xs font-semibold">
                    {stock.quantity}
                  </span>
                </div>
                <p className="text-xs uppercase tracking-wide text-gray-500">
                  {stock.owner?.owner_type || inventoryOwners.find((owner) => owner.id === stock.owner_id)?.owner_type || 'person'}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold text-gray-950">Product information</h3>
          <dl className="mt-3 grid grid-cols-2 gap-x-5 gap-y-5 sm:grid-cols-3">
            <DetailItem label="Brand" value={extendedProduct.brand?.name || product.brand_id || 'Not set'} />
            <DetailItem label="Supplier" value={extendedProduct.supplier?.name || 'Argeville'} />
            <DetailItem label="Size" value={product.size ? `${product.size} ml` : 'Not set'} />
            <DetailItem label="Concentration" value={product.concentration || 'Not set'} />
            <DetailItem label="Gender" value={product.gender || 'Not set'} />
            <DetailItem label="Season" value={season} />
            <DetailItem label="Tester" value={product.is_tester ? 'Yes' : 'No'} />
            <DetailItem label="Reorder point" value={`${Number(product.reorder_point || 0)} units`} />
          </dl>
        </section>

        {product.fragrance_notes && (
          <section className="border-t border-gray-200 pt-5">
            <h3 className="text-sm font-semibold text-gray-950">Description and notes</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-600">{product.fragrance_notes}</p>
          </section>
        )}

        <section className="border-t border-gray-200 pt-5">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-950">Inventory levels</h3>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-200">
            <div
              className={`h-full rounded-full ${status === 'out' ? 'bg-red-500' : status === 'low' ? 'bg-amber-500' : 'bg-emerald-600'}`}
              style={{ width: `${stockPercent}%` }}
            />
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-3">
            <DetailItem label="Minimum" value={`${minimum} units`} />
            <DetailItem label="Current" value={`${stock} units`} />
            <DetailItem label="Maximum" value={maximum ? `${maximum} units` : 'Not set'} />
          </dl>
        </section>

        {product.product_type === 'Fragrance Bottles' && (
          <section className="border-t border-gray-200 pt-5">
            <div className="flex items-center gap-2">
              <Weight className="h-4 w-4 text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-950">Weight</h3>
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-3">
              <DetailItem label="Gross" value={`${Number(product.gross_weight || 0)} kg`} />
              <DetailItem label="Tare" value={`${Number(product.tare_weight || 0)} kg`} />
              <DetailItem label="Net" value={`${Number(product.net_weight || 0)} kg`} />
            </dl>
          </section>
        )}

        <section className="grid gap-4 border-t border-gray-200 pt-5 sm:grid-cols-2">
          <div className="flex items-start gap-3">
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
            <div>
              <p className="text-xs font-medium uppercase text-gray-500">Updated</p>
              <p className="mt-1 text-sm font-medium text-gray-900">{displayDate(product.updated_at)}</p>
              <p className="mt-1 text-xs text-gray-500">Created {displayDate(product.created_at)}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Truck className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
            <div>
              <p className="text-xs font-medium uppercase text-gray-500">Supply</p>
              <p className="mt-1 text-sm font-medium text-gray-900">{extendedProduct.supplier?.name || 'Argeville'}</p>
              <p className="mt-1 text-xs text-gray-500">Reorder at {Number(product.reorder_point || 0)} units</p>
            </div>
          </div>
        </section>
      </div>
    </Modal>
  );
};
