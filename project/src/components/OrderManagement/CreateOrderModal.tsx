import React, { useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  Minus,
  Package,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  UserRound,
  X
} from 'lucide-react';
import { Order, OrderItem, Product } from '../../types';
import {
  formatCurrency,
  generateOrderNumber,
  resolveOrderItemsForDisplay
} from '../../utils/stockUtils';

interface CreateOrderModalProps {
  order: Order | null;
  products: Product[];
  onSave: (order: Order) => void | Promise<void>;
  onClose: () => void;
}

const normalizeSearchValue = (value: unknown) => String(value ?? '')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLocaleLowerCase();

const getProductName = (product: Product) =>
  String(product.commercial_name ?? product.code ?? product.item_number ?? 'Unnamed product').trim()
  || 'Unnamed product';

const searchableProductText = (product: Product) => [
  product.commercial_name,
  product.code,
  product.item_number,
  product.category,
  product.product_type
]
  .map(normalizeSearchValue)
  .filter(Boolean)
  .join(' ');

export const CreateOrderModal: React.FC<CreateOrderModalProps> = ({
  order,
  products,
  onSave,
  onClose
}) => {
  const initialItems = useMemo<OrderItem[]>(() => {
    if (!order) return [];
    return resolveOrderItemsForDisplay(order, products).map((item) => ({
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price
    }));
  }, [order, products]);

  const [customerName, setCustomerName] = useState(order?.customer_name || 'Walk-in customer');
  const [customerPhone, setCustomerPhone] = useState(order?.customer_phone || '');
  const [customerEmail, setCustomerEmail] = useState(order?.customer_email || '');
  const [orderType, setOrderType] = useState(order?.order_type || 'store-to-shop');
  const [notes, setNotes] = useState(order?.notes || '');
  const [orderItems, setOrderItems] = useState<OrderItem[]>(initialItems);
  const [productQuery, setProductQuery] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const catalogById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products]
  );

  const productResults = useMemo(() => {
    const normalizedQuery = normalizeSearchValue(productQuery);
    const terms = normalizedQuery
      .split(/\s+/)
      .filter(Boolean);

    return [...products]
      .filter((product) => {
        const searchable = searchableProductText(product);
        return terms.length === 0 || terms.every((term) => searchable.includes(term));
      })
      .sort((a, b) => {
        const aAvailable = a.current_stock > 0 ? 0 : 1;
        const bAvailable = b.current_stock > 0 ? 0 : 1;
        if (aAvailable !== bAvailable) return aAvailable - bAvailable;

        const aName = normalizeSearchValue(a.commercial_name);
        const bName = normalizeSearchValue(b.commercial_name);
        const aStartsWithQuery = normalizedQuery !== '' && aName.startsWith(normalizedQuery) ? 0 : 1;
        const bStartsWithQuery = normalizedQuery !== '' && bName.startsWith(normalizedQuery) ? 0 : 1;
        return aStartsWithQuery - bStartsWithQuery
          || getProductName(a).localeCompare(getProductName(b));
      });
  }, [productQuery, products]);

  const totalAmount = orderItems.reduce((sum, item) => sum + item.total_price, 0);
  const totalUnits = orderItems.reduce((sum, item) => sum + item.quantity, 0);

  const setQuantity = (productId: string, nextQuantity: number) => {
    const product = catalogById.get(productId);
    const maxQuantity = Math.max(0, product?.current_stock ?? nextQuantity);
    const quantity = Math.min(Math.max(0, nextQuantity), maxQuantity);

    setOrderItems((current) => quantity === 0
      ? current.filter((item) => item.product_id !== productId)
      : current.map((item) => item.product_id === productId
        ? { ...item, quantity, total_price: quantity * item.unit_price }
        : item));
  };

  const addProduct = (product: Product) => {
    if (product.current_stock <= 0) return;

    setOrderItems((current) => {
      const existing = current.find((item) => item.product_id === product.id);
      if (existing) {
        const quantity = Math.min(existing.quantity + 1, product.current_stock);
        return current.map((item) => item.product_id === product.id
          ? { ...item, quantity, total_price: quantity * item.unit_price }
          : item);
      }

      return [...current, {
        product_id: product.id,
        product_name: getProductName(product),
        quantity: 1,
        unit_price: product.price,
        total_price: product.price
      }];
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (orderItems.length === 0 || isSaving) return;

    setSaveError(null);
    setIsSaving(true);
    try {
      await onSave({
        id: order?.id || Date.now().toString(),
        order_number: order?.order_number || generateOrderNumber(),
        customer_name: customerName.trim() || 'Walk-in customer',
        customer_email: customerEmail.trim() || null,
        customer_phone: customerPhone.trim() || null,
        order_type: orderType,
        pickup_by_staff: order?.pickup_by_staff ?? null,
        pickup_person_name: order?.pickup_person_name ?? null,
        pickup_person_phone: order?.pickup_person_phone ?? null,
        items: orderItems,
        total_amount: totalAmount,
        status: order?.status || 'pending',
        notes: notes.trim() || null,
        created_by: order?.created_by || null,
        created_at: order?.created_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save this order');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-950/60 lg:p-5">
      <form
        onSubmit={handleSubmit}
        className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden bg-white lg:rounded-2xl lg:shadow-2xl"
      >
        <header className="flex min-h-16 shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-gray-950">
              {order ? 'Edit order' : 'Create order'}
            </h2>
            <p className="text-xs text-gray-500">{totalUnits} units · {formatCurrency(totalAmount)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-50"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:overflow-hidden">
          <section className="p-4 sm:p-6 lg:overflow-y-auto">
            <div className="mb-4">
              <div className="flex items-end justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-gray-950">Search products</h3>
                  <p className="mt-1 text-sm text-gray-500">Search by name, code, item number, category, or type.</p>
                </div>
                <span className="shrink-0 text-xs font-medium text-gray-500">{productResults.length} found</span>
              </div>
              <div className="relative mt-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  autoFocus
                  value={productQuery}
                  onChange={(event) => setProductQuery(event.target.value)}
                  placeholder="Type a product name or code"
                  className="h-12 w-full rounded-xl border border-gray-300 pl-11 pr-10 text-base text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
                {productQuery && (
                  <button
                    type="button"
                    onClick={() => setProductQuery('')}
                    className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                    title="Clear search"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-gray-200">
              {productResults.length === 0 ? (
                <div className="px-4 py-14 text-center">
                  <Package className="mx-auto h-9 w-9 text-gray-300" />
                  <p className="mt-3 text-sm font-medium text-gray-900">No products match “{productQuery.trim()}”</p>
                  <button type="button" onClick={() => setProductQuery('')} className="mt-2 text-sm font-semibold text-blue-600 hover:text-blue-700">
                    Clear search
                  </button>
                </div>
              ) : productResults.map((product) => {
                const inCart = orderItems.find((item) => item.product_id === product.id)?.quantity || 0;
                const outOfStock = product.current_stock <= 0;
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addProduct(product)}
                    disabled={outOfStock || inCart >= product.current_stock}
                    className="grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-b border-gray-100 px-4 py-3 text-left last:border-b-0 hover:bg-gray-50 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-60"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-950 sm:text-base">{getProductName(product)}</p>
                      <p className="mt-0.5 truncate text-xs text-gray-500">
                        {[product.code, product.item_number].filter(Boolean).join(' · ') || 'No product code'}
                        {' · '}{outOfStock ? 'Out of stock' : `${product.current_stock} available`}
                      </p>
                    </div>
                    <p className="whitespace-nowrap text-sm font-semibold text-gray-900">{formatCurrency(product.price)}</p>
                    <span className={`flex h-9 min-w-9 items-center justify-center rounded-lg px-2 ${inCart ? 'bg-blue-100 text-blue-700' : 'bg-gray-950 text-white'}`}>
                      {inCart ? <span className="text-sm font-bold">{inCart}</span> : <Plus className="h-4 w-4" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="border-t border-gray-200 bg-gray-50 p-4 sm:p-6 lg:overflow-y-auto lg:border-l lg:border-t-0">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-950">Order items</h3>
              <span className="text-sm text-gray-500">{orderItems.length} products</span>
            </div>

            {orderItems.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-gray-300 bg-white px-4 py-10 text-center">
                <ShoppingCart className="mx-auto h-8 w-8 text-gray-300" />
                <p className="mt-2 text-sm text-gray-500">Choose a product to begin</p>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {orderItems.map((item) => {
                  const product = catalogById.get(item.product_id);
                  return (
                    <div key={item.product_id} className="rounded-xl border border-gray-200 bg-white p-3">
                      <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-950">{item.product_name}</p>
                          <p className="mt-0.5 text-xs text-gray-500">{formatCurrency(item.unit_price)} each</p>
                        </div>
                        <p className="whitespace-nowrap text-sm font-semibold text-gray-950">{formatCurrency(item.total_price)}</p>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <div className="flex h-9 items-center rounded-lg border border-gray-300 bg-white">
                          <button type="button" onClick={() => setQuantity(item.product_id, item.quantity - 1)} className="flex h-8 w-9 items-center justify-center text-gray-600 hover:bg-gray-50" title="Decrease quantity">
                            <Minus className="h-4 w-4" />
                          </button>
                          <span className="min-w-9 text-center text-sm font-semibold text-gray-900">{item.quantity}</span>
                          <button
                            type="button"
                            onClick={() => setQuantity(item.product_id, item.quantity + 1)}
                            disabled={Boolean(product && item.quantity >= product.current_stock)}
                            className="flex h-8 w-9 items-center justify-center text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-gray-300"
                            title="Increase quantity"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </div>
                        <button type="button" onClick={() => setQuantity(item.product_id, 0)} className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-700" title="Remove product">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-5 space-y-3 border-t border-gray-200 pt-5">
              <div>
                <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
                  <UserRound className="h-4 w-4 text-gray-400" /> Customer
                </label>
                <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Phone <span className="font-normal text-gray-400">optional</span></label>
                <input type="tel" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="Customer phone" className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
              </div>
              <button type="button" onClick={() => setShowMore((value) => !value)} className="flex w-full items-center justify-between rounded-lg py-2 text-sm font-medium text-gray-600 hover:text-gray-950">
                More details
                <ChevronDown className={`h-4 w-4 transition-transform ${showMore ? 'rotate-180' : ''}`} />
              </button>
              {showMore && (
                <div className="space-y-3">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">Order type</label>
                    <select value={orderType} onChange={(event) => setOrderType(event.target.value)} className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                      <option value="store-to-shop">Local sale</option>
                      <option value="international-to-tanzania">International delivery</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">Email</label>
                    <input type="email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} className="h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">Notes</label>
                    <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="w-full resize-none rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>

        <footer className="shrink-0 border-t border-gray-200 bg-white px-4 py-3 sm:px-6">
          {saveError && <p className="mb-2 text-sm font-medium text-red-700">{saveError}</p>}
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-gray-500">Total</p>
              <p className="truncate text-xl font-semibold text-gray-950">{formatCurrency(totalAmount)}</p>
            </div>
            <button type="button" onClick={onClose} disabled={isSaving} className="hidden h-11 rounded-lg border border-gray-300 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 sm:block">Cancel</button>
            <button type="submit" disabled={orderItems.length === 0 || isSaving} className="flex h-12 min-w-36 items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-300">
              {isSaving ? 'Saving...' : <><Check className="h-4 w-4" />{order ? 'Save changes' : 'Create order'}</>}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
};
