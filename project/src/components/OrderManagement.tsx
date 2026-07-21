import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  ChevronDown,
  Edit2,
  Eye,
  Minus,
  Package,
  Plus,
  Printer,
  Search,
  ShoppingCart,
  Trash2,
  UserRound,
  X
} from 'lucide-react';
import { Order, OrderItem, Product } from '../types';
import {
  formatCurrency,
  formatDate,
  generateOrderNumber,
  resolveOrderGrandTotal,
  resolveOrderItemsForDisplay
} from '../utils/stockUtils';
import { printOrderPDFToWindow } from '../utils/pdfUtils';
import { getOrderDestinationLabel, normalizeOrderDestination } from '../utils/orderUtils';

interface OrderManagementProps {
  orders: Order[];
  products: Product[];
  openNewOrderSignal?: number;
  onNewOrderOpened?: () => void;
  onAddOrder: (order: Order) => Order | void | Promise<Order | void>;
  onUpdateOrder: (order: Order) => void | Promise<void>;
  onDeleteOrder: (id: string) => void;
  onUpdateProduct: (product: Product) => void;
}

const isToday = (value: string) => {
  const date = new Date(value);
  const today = new Date();
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
};

const statusStyles: Record<Order['status'], string> = {
  pending: 'bg-amber-50 text-amber-700 ring-amber-200',
  processing: 'bg-blue-50 text-blue-700 ring-blue-200',
  shipped: 'bg-violet-50 text-violet-700 ring-violet-200',
  delivered: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  cancelled: 'bg-red-50 text-red-700 ring-red-200'
};

export const OrderManagement: React.FC<OrderManagementProps> = ({
  orders,
  products,
  openNewOrderSignal = 0,
  onNewOrderOpened,
  onAddOrder,
  onUpdateOrder,
  onDeleteOrder
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);

  useEffect(() => {
    if (openNewOrderSignal > 0) {
      setEditingOrder(null);
      setShowOrderForm(true);
      onNewOrderOpened?.();
    }
  }, [onNewOrderOpened, openNewOrderSignal]);

  const filteredOrders = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return [...orders]
      .filter((order) => {
        const matchesSearch = !normalizedSearch
          || order.order_number.toLowerCase().includes(normalizedSearch)
          || (order.customer_name || '').toLowerCase().includes(normalizedSearch)
          || (order.customer_phone || '').toLowerCase().includes(normalizedSearch);
        const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [orders, searchTerm, statusFilter]);

  const todayOrders = orders.filter((order) => order.status !== 'cancelled' && isToday(order.created_at));
  const todayRevenue = todayOrders.reduce((sum, order) => sum + resolveOrderGrandTotal(order), 0);
  const stats = [
    { label: 'Sales today', value: formatCurrency(todayRevenue) },
    { label: 'Orders today', value: todayOrders.length.toLocaleString() },
    { label: 'Pending', value: orders.filter((order) => order.status === 'pending').length.toLocaleString() },
    { label: 'Completed', value: orders.filter((order) => order.status === 'delivered').length.toLocaleString() }
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">Customer orders</p>
          <h1 className="mt-1 text-2xl font-semibold text-gray-950 sm:text-3xl">Sales</h1>
        </div>
        <button
          type="button"
          onClick={() => {
            setEditingOrder(null);
            setShowOrderForm(true);
          }}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700 sm:w-auto"
        >
          <Plus className="h-5 w-5" />
          New sale
        </button>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="min-w-0 rounded-md border border-gray-200 bg-white p-4">
            <p className="truncate text-xs font-medium text-gray-500 sm:text-sm">{stat.label}</p>
            <p className="mt-1 break-words text-lg font-semibold text-gray-950 sm:text-2xl">{stat.value}</p>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-md border border-gray-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-gray-200 p-4 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              placeholder="Search order, customer, or phone"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="h-11 w-full rounded-md border border-gray-300 bg-white pl-10 pr-3 text-sm text-gray-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-11 rounded-md border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 sm:w-44"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-16 text-center">
            <ShoppingCart className="h-9 w-9 text-gray-300" />
            <p className="mt-3 font-medium text-gray-900">No sales found</p>
            <p className="mt-1 text-sm text-gray-500">Try another search or create a new sale.</p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {['Order', 'Customer', 'Date', 'Status', 'Total', 'Actions'].map((heading) => (
                      <th key={heading} className={`${heading === 'Actions' ? 'text-right' : 'text-left'} px-5 py-3 text-xs font-semibold uppercase text-gray-500`}>
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-5 py-4">
                        <p className="text-sm font-semibold text-gray-900">{order.order_number}</p>
                        <p className="text-xs text-gray-500">{order.items?.length || 0} items</p>
                      </td>
                      <td className="max-w-56 px-5 py-4">
                        <p className="truncate text-sm font-medium text-gray-900">{order.customer_name || 'Walk-in customer'}</p>
                        <p className="truncate text-xs text-gray-500">{order.customer_phone || 'No phone'}</p>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm text-gray-600">{formatDate(order.created_at)}</td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold capitalize ring-1 ring-inset ${statusStyles[order.status]}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-5 py-4 text-sm font-semibold text-gray-950">{formatCurrency(resolveOrderGrandTotal(order))}</td>
                      <td className="whitespace-nowrap px-5 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button type="button" onClick={() => setViewingOrder(order)} className="flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900" title="View sale">
                            <Eye className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => { setEditingOrder(order); setShowOrderForm(true); }} className="flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900" title="Edit sale">
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Delete order ${order.order_number}?`)) onDeleteOrder(order.id);
                            }}
                            className="flex h-9 w-9 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-700"
                            title="Delete sale"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-gray-100 lg:hidden">
              {filteredOrders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => setViewingOrder(order)}
                  className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-4 text-left hover:bg-gray-50"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">{order.order_number}</p>
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ring-1 ring-inset ${statusStyles[order.status]}`}>{order.status}</span>
                    </div>
                    <p className="mt-1 truncate text-sm text-gray-600">{order.customer_name || 'Walk-in customer'}</p>
                    <p className="mt-0.5 text-xs text-gray-500">{formatDate(order.created_at)} · {order.items?.length || 0} items</p>
                  </div>
                  <p className="text-sm font-semibold text-gray-950">{formatCurrency(resolveOrderGrandTotal(order))}</p>
                </button>
              ))}
            </div>
          </>
        )}
      </section>

      {showOrderForm && (
        <OrderForm
          order={editingOrder}
          products={products}
          onSave={async (order) => {
            if (editingOrder) {
              await onUpdateOrder(order);
              return order;
            }
            return await onAddOrder(order);
          }}
          onSaved={() => {
            setShowOrderForm(false);
            setEditingOrder(null);
          }}
          onClose={() => {
            setShowOrderForm(false);
            setEditingOrder(null);
          }}
        />
      )}

      {viewingOrder && (
        <OrderDetailModal
          order={viewingOrder}
          products={products}
          onClose={() => setViewingOrder(null)}
          onUpdateStatus={async (status) => {
            const updatedOrder = { ...viewingOrder, status };
            await onUpdateOrder(updatedOrder);
            setViewingOrder(updatedOrder);
          }}
        />
      )}
    </div>
  );
};

interface OrderFormProps {
  order: Order | null;
  products: Product[];
  onSave: (order: Order) => Order | void | Promise<Order | void>;
  onSaved: () => void;
  onClose: () => void;
}

const OrderForm: React.FC<OrderFormProps> = ({ order, products, onSave, onSaved, onClose }) => {
  const initialItems = useMemo<OrderItem[]>(() => {
    if (!order) return [];
    return resolveOrderItemsForDisplay(
      order,
      products as Parameters<typeof resolveOrderItemsForDisplay>[1]
    ).map((item) => ({
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
  const [orderType, setOrderType] = useState(normalizeOrderDestination(order?.order_type));
  const [notes, setNotes] = useState(order?.notes || '');
  const [orderItems, setOrderItems] = useState<OrderItem[]>(initialItems);
  const [productQuery, setProductQuery] = useState('');
  const [showMore, setShowMore] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const productResults = useMemo(() => {
    const normalizeSearchValue = (value: unknown) => String(value ?? '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
    const queryTerms = normalizeSearchValue(productQuery).split(/\s+/).filter(Boolean);

    return products
      .filter((product) => product.current_stock > 0)
      .filter((product) => {
        const searchableText = [
          product.commercial_name,
          product.code,
          product.item_number,
          product.category,
          product.product_type
        ].map(normalizeSearchValue).join(' ');

        return queryTerms.length === 0
          || queryTerms.every((term) => searchableText.includes(term));
      })
      .sort((a, b) => normalizeSearchValue(a.commercial_name)
        .localeCompare(normalizeSearchValue(b.commercial_name)));
  }, [productQuery, products]);

  const totalAmount = orderItems.reduce((sum, item) => sum + item.total_price, 0);
  const totalUnits = orderItems.reduce((sum, item) => sum + item.quantity, 0);

  const addProduct = (product: Product) => {
    setOrderItems((current) => {
      const existing = current.find((item) => item.product_id === product.id);
      if (existing) {
        return current.map((item) => item.product_id === product.id
          ? { ...item, quantity: item.quantity + 1, total_price: (item.quantity + 1) * item.unit_price }
          : item);
      }
      return [...current, {
        product_id: product.id,
        product_name: product.commercial_name,
        quantity: 1,
        unit_price: product.price,
        total_price: product.price
      }];
    });
  };

  const updateQuantity = (productId: string, nextQuantity: number) => {
    if (nextQuantity < 1) return;
    setOrderItems((current) => current.map((item) => item.product_id === productId
      ? { ...item, quantity: nextQuantity, total_price: nextQuantity * item.unit_price }
      : item));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (orderItems.length === 0 || isSaving) return;
    setSaveError(null);
    setIsSaving(true);
    const printWindow = order ? null : window.open('', '_blank');
    if (printWindow) {
      printWindow.document.title = 'Preparing order PDF';
      const status = printWindow.document.createElement('p');
      status.textContent = 'Preparing printable order...';
      status.style.fontFamily = 'Arial, sans-serif';
      status.style.margin = '40px';
      status.style.color = '#374151';
      printWindow.document.body.appendChild(status);
    }
    try {
      const submittedOrder: Order = {
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
      };
      const savedOrder = await onSave(submittedOrder);
      if (!order) {
        printOrderPDFToWindow(savedOrder || submittedOrder, products, printWindow);
      }
      onSaved();
    } catch (error) {
      printWindow?.close();
      setSaveError(error instanceof Error ? error.message : 'Could not save this sale');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 !mt-0 bg-gray-950/55 lg:p-5">
      <form onSubmit={handleSubmit} className="mx-auto flex h-full max-w-6xl flex-col overflow-hidden bg-white lg:rounded-md lg:shadow-2xl">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-gray-200 px-4 sm:px-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-950">{order ? 'Edit sale' : 'New sale'}</h2>
            <p className="text-xs text-gray-500">{totalUnits} units · {formatCurrency(totalAmount)}</p>
          </div>
          <button type="button" onClick={onClose} disabled={isSaving} className="flex h-10 w-10 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100" title="Close">
            <X className="h-5 w-5" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto lg:grid lg:grid-cols-[minmax(0,1fr)_400px] lg:overflow-hidden">
          <section className="p-4 sm:p-6 lg:overflow-y-auto">
            <div className="mb-4">
              <h3 className="font-semibold text-gray-950">Add products</h3>
              <div className="relative mt-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  autoFocus
                  value={productQuery}
                  onChange={(event) => setProductQuery(event.target.value)}
                  placeholder="Search product name or code"
                  className="h-12 w-full rounded-md border border-gray-300 pl-11 pr-4 text-base text-gray-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </div>
            </div>

            <div className="divide-y divide-gray-100 rounded-md border border-gray-200">
              {productResults.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <Package className="mx-auto h-8 w-8 text-gray-300" />
                  <p className="mt-2 text-sm font-medium text-gray-900">No available products found</p>
                </div>
              ) : productResults.map((product) => {
                const inCart = orderItems.find((item) => item.product_id === product.id)?.quantity || 0;
                return (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => addProduct(product)}
                    className="grid w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-950 sm:text-base">{product.commercial_name}</p>
                      <p className="mt-0.5 text-xs text-gray-500">{product.code} · {product.current_stock} available</p>
                    </div>
                    <p className="whitespace-nowrap text-sm font-semibold text-gray-900">{formatCurrency(product.price)}</p>
                    <span className={`flex h-9 w-9 items-center justify-center rounded-md ${inCart ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-950 text-white'}`}>
                      {inCart ? <span className="text-sm font-bold">{inCart}</span> : <Plus className="h-4 w-4" />}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="border-t border-gray-200 bg-gray-50 p-4 sm:p-6 lg:overflow-y-auto lg:border-l lg:border-t-0">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-950">Sale items</h3>
              <span className="text-sm text-gray-500">{orderItems.length} products</span>
            </div>

            {orderItems.length === 0 ? (
              <div className="mt-4 rounded-md border border-dashed border-gray-300 bg-white px-4 py-10 text-center">
                <ShoppingCart className="mx-auto h-8 w-8 text-gray-300" />
                <p className="mt-2 text-sm text-gray-500">Select a product to begin</p>
              </div>
            ) : (
              <div className="mt-4 space-y-2">
                {orderItems.map((item) => (
                  <div key={item.product_id} className="rounded-md border border-gray-200 bg-white p-3">
                    <div className="flex items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-950">{item.product_name}</p>
                        <p className="mt-0.5 text-xs text-gray-500">{formatCurrency(item.unit_price)} each</p>
                      </div>
                      <p className="whitespace-nowrap text-sm font-semibold text-gray-950">{formatCurrency(item.total_price)}</p>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <div className="flex h-9 items-center rounded-md border border-gray-300 bg-white">
                        <button type="button" onClick={() => updateQuantity(item.product_id, item.quantity - 1)} className="flex h-8 w-9 items-center justify-center text-gray-600 hover:bg-gray-50" title="Decrease quantity">
                          <Minus className="h-4 w-4" />
                        </button>
                        <span className="min-w-9 text-center text-sm font-semibold text-gray-900">{item.quantity}</span>
                        <button type="button" onClick={() => updateQuantity(item.product_id, item.quantity + 1)} className="flex h-8 w-9 items-center justify-center text-gray-600 hover:bg-gray-50" title="Increase quantity">
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                      <button type="button" onClick={() => setOrderItems((current) => current.filter((line) => line.product_id !== item.product_id))} className="flex h-9 w-9 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-700" title="Remove product">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 space-y-3 border-t border-gray-200 pt-5">
              <fieldset>
                <legend className="mb-1.5 text-sm font-medium text-gray-700">Order for</legend>
                <div className="grid grid-cols-2 rounded-md border border-gray-300 bg-white p-1">
                  {(['customer', 'store-to-shop'] as const).map((destination) => (
                    <button
                      key={destination}
                      type="button"
                      onClick={() => setOrderType(destination)}
                      className={`h-10 rounded text-sm font-semibold transition-colors ${
                        orderType === destination
                          ? 'bg-gray-950 text-white'
                          : 'text-gray-600 hover:bg-gray-100 hover:text-gray-950'
                      }`}
                      aria-pressed={orderType === destination}
                    >
                      {getOrderDestinationLabel(destination)}
                    </button>
                  ))}
                </div>
              </fieldset>
              <div>
                <label className="mb-1.5 flex items-center gap-2 text-sm font-medium text-gray-700">
                  <UserRound className="h-4 w-4 text-gray-400" />
                  {orderType === 'store-to-shop' ? 'Shop name' : 'Customer'}
                </label>
                <input value={customerName} onChange={(event) => setCustomerName(event.target.value)} placeholder={orderType === 'store-to-shop' ? 'Shop name' : 'Customer name'} className="h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Phone <span className="font-normal text-gray-400">optional</span></label>
                <input type="tel" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} placeholder="Customer phone" className="h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
              </div>
              <button type="button" onClick={() => setShowMore((value) => !value)} className="flex w-full items-center justify-between rounded-md py-2 text-sm font-medium text-gray-600 hover:text-gray-950">
                More details
                <ChevronDown className={`h-4 w-4 transition-transform ${showMore ? 'rotate-180' : ''}`} />
              </button>
              {showMore && (
                <div className="space-y-3">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">Email</label>
                    <input type="email" value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} className="h-11 w-full rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-gray-700">Notes</label>
                    <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} className="w-full resize-none rounded-md border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
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
            <button type="button" onClick={onClose} disabled={isSaving} className="hidden h-11 rounded-md border border-gray-300 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 sm:block">Cancel</button>
            <button type="submit" disabled={orderItems.length === 0 || isSaving} className="flex h-12 min-w-36 items-center justify-center gap-2 rounded-md bg-emerald-600 px-5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-gray-300">
              {isSaving ? 'Saving...' : <><Check className="h-4 w-4" />{order ? 'Save changes' : 'Save sale'}</>}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
};

interface OrderDetailModalProps {
  order: Order;
  products: Product[];
  onClose: () => void;
  onUpdateStatus: (status: Order['status']) => void | Promise<void>;
}

const OrderDetailModal: React.FC<OrderDetailModalProps> = ({ order, products, onClose, onUpdateStatus }) => {
  const displayItems = resolveOrderItemsForDisplay(
    order,
    products as Parameters<typeof resolveOrderItemsForDisplay>[1]
  );
  const orderGrandTotal = resolveOrderGrandTotal(order);

  return (
    <div className="fixed inset-0 z-50 !mt-0 flex items-end justify-center bg-gray-950/55 sm:items-center sm:p-4">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-md bg-white shadow-2xl sm:max-w-2xl sm:rounded-md">
        <header className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-950">{order.order_number}</h2>
            <p className="text-sm text-gray-500">{formatDate(order.created_at)}</p>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => printOrderPDFToWindow(order, products)} className="flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900" title="Print order PDF">
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">Print</span>
            </button>
            <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100" title="Close" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="space-y-6 p-4 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-md bg-gray-50 p-4">
              <p className="text-xs font-medium uppercase text-gray-500">Order for</p>
              <p className="mt-1 font-semibold text-gray-950">{getOrderDestinationLabel(order.order_type)}</p>
            </div>
            <div className="rounded-md bg-gray-50 p-4">
              <p className="text-xs font-medium uppercase text-gray-500">{normalizeOrderDestination(order.order_type) === 'store-to-shop' ? 'Shop' : 'Customer'}</p>
              <p className="mt-1 font-semibold text-gray-950">{order.customer_name || 'Walk-in customer'}</p>
              {order.customer_phone && <p className="mt-1 text-sm text-gray-600">{order.customer_phone}</p>}
            </div>
            <div className="rounded-md bg-gray-50 p-4">
              <label className="text-xs font-medium uppercase text-gray-500">Status</label>
              <select value={order.status} onChange={(event) => onUpdateStatus(event.target.value as Order['status'])} className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-3 text-sm font-medium capitalize outline-none focus:border-emerald-500">
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>
                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold text-gray-950">Items</h3>
              <span className="text-sm text-gray-500">{displayItems.length} products</span>
            </div>
            <div className="divide-y divide-gray-100 rounded-md border border-gray-200">
              {displayItems.map((item) => (
                <div key={item.key} className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-950">{item.product_name}</p>
                    <p className="mt-0.5 text-xs text-gray-500">{item.quantity} x {formatCurrency(item.unit_price)}</p>
                  </div>
                  <p className="text-sm font-semibold text-gray-950">{formatCurrency(item.total_price)}</p>
                </div>
              ))}
            </div>
          </section>

          {order.notes && (
            <section>
              <h3 className="mb-2 font-semibold text-gray-950">Notes</h3>
              <p className="rounded-md bg-gray-50 p-4 text-sm text-gray-700">{order.notes}</p>
            </section>
          )}

          <div className="flex items-end justify-between border-t border-gray-200 pt-4">
            <p className="text-sm text-gray-500">Order total</p>
            <p className="text-2xl font-semibold text-gray-950">{formatCurrency(orderGrandTotal)}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
