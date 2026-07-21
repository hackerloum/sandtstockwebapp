import React, { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpDown,
  Boxes,
  FileText,
  Package,
  Plus,
  ShoppingCart,
  WalletCards
} from 'lucide-react';
import { IncomingByProductSummary, Order, Product, StockMovement } from '../types';
import { formatCurrency, formatDate, resolveOrderGrandTotal } from '../utils/stockUtils';

interface DashboardProps {
  products: Product[];
  movements: StockMovement[];
  orders: Order[];
  loading?: boolean;
  onCreatePurchaseOrder?: (productId: string) => void;
  onAddProduct?: () => void;
  onCreateOrder?: () => void;
  onStockCount?: () => void;
  onNavigate?: (tab: string) => void;
  incomingByProduct?: IncomingByProductSummary[];
  onOpenReorderEngine?: () => void;
}

const isToday = (value: string | Date) => {
  const date = new Date(value);
  const today = new Date();
  return date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate();
};

export const Dashboard: React.FC<DashboardProps> = ({
  products,
  movements,
  orders,
  loading = false,
  onCreatePurchaseOrder,
  onAddProduct,
  onStockCount,
  onNavigate
}) => {
  const recentOrders = useMemo(
    () => [...orders]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 6),
    [orders]
  );

  const todayOrders = useMemo(
    () => orders.filter((order) => order.status !== 'cancelled' && isToday(order.created_at)),
    [orders]
  );

  const stockAttention = useMemo(
    () => products
      .filter((product) => product.current_stock <= product.min_stock)
      .sort((a, b) => a.current_stock - b.current_stock)
      .slice(0, 6),
    [products]
  );

  const inventoryValue = useMemo(
    () => products.reduce((sum, product) => sum + (product.current_stock * product.price), 0),
    [products]
  );

  const todayRevenue = todayOrders.reduce((sum, order) => sum + resolveOrderGrandTotal(order), 0);
  const pendingOrders = orders.filter((order) => order.status === 'pending').length;
  const todayMovements = movements.filter((movement) => isToday(movement.performed_at)).length;

  const stats = [
    { label: 'Sales today', value: formatCurrency(todayRevenue), icon: WalletCards, tone: 'text-emerald-700 bg-emerald-50' },
    { label: 'Orders today', value: todayOrders.length.toLocaleString(), icon: ShoppingCart, tone: 'text-blue-700 bg-blue-50' },
    { label: 'Pending orders', value: pendingOrders.toLocaleString(), icon: FileText, tone: 'text-amber-700 bg-amber-50' },
    { label: 'Inventory value', value: formatCurrency(inventoryValue), icon: Boxes, tone: 'text-violet-700 bg-violet-50' }
  ];

  if (loading && products.length === 0 && orders.length === 0) {
    return (
      <div className="space-y-5" aria-label="Loading dashboard">
        <div className="h-20 animate-pulse rounded-md bg-gray-200" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <div key={item} className="h-28 animate-pulse rounded-md bg-gray-200" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <header>
        <div>
          <p className="text-sm font-medium text-gray-500">{formatDate(new Date())}</p>
          <h1 className="mt-1 text-2xl font-semibold text-gray-950 sm:text-3xl">Business overview</h1>
          <p className="mt-1 text-sm text-gray-500">{todayMovements} stock changes recorded today</p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="min-w-0 rounded-md border border-gray-200 bg-white p-4 sm:p-5">
              <div className={`mb-4 flex h-9 w-9 items-center justify-center rounded-md ${stat.tone}`}>
                <Icon className="h-4 w-4" />
              </div>
              <p className="truncate text-xs font-medium text-gray-500 sm:text-sm">{stat.label}</p>
              <p className="mt-1 break-words text-lg font-semibold text-gray-950 sm:text-2xl">{stat.value}</p>
            </div>
          );
        })}
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-gray-900">Quick actions</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Products', icon: Package, action: () => onNavigate?.('products') },
            { label: 'Add product', icon: Plus, action: onAddProduct },
            { label: 'Stock update', icon: ArrowUpDown, action: onStockCount },
            { label: 'Reports', icon: FileText, action: () => onNavigate?.('monthly-reports') }
          ].map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                type="button"
                onClick={action.action}
                className="flex min-h-16 items-center gap-3 rounded-md border border-gray-200 bg-white px-4 text-left text-sm font-medium text-gray-800 hover:border-gray-300 hover:bg-gray-50"
              >
                <Icon className="h-5 w-5 shrink-0 text-gray-500" />
                <span>{action.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <section className="min-w-0 overflow-hidden rounded-md border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4 sm:px-5">
            <div>
              <h2 className="font-semibold text-gray-950">Recent sales</h2>
              <p className="mt-0.5 text-sm text-gray-500">Latest customer orders</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate?.('orders')}
              className="flex items-center gap-1 text-sm font-medium text-emerald-700 hover:text-emerald-800"
            >
              View all
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          {recentOrders.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-gray-500">No sales yet</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {recentOrders.map((order) => (
                <div key={order.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3.5 sm:grid-cols-[130px_minmax(0,1fr)_120px_auto] sm:px-5">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{order.order_number}</p>
                    <p className="text-xs text-gray-500 sm:hidden">{formatDate(order.created_at)}</p>
                  </div>
                  <p className="hidden truncate text-sm text-gray-700 sm:block">{order.customer_name || 'Walk-in customer'}</p>
                  <p className="hidden text-sm text-gray-500 sm:block">{formatDate(order.created_at)}</p>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-950">{formatCurrency(resolveOrderGrandTotal(order))}</p>
                    <p className="text-xs capitalize text-gray-500">{order.status}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="min-w-0 overflow-hidden rounded-md border border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-4 sm:px-5">
            <div>
              <h2 className="font-semibold text-gray-950">Stock attention</h2>
              <p className="mt-0.5 text-sm text-gray-500">{stockAttention.length} priority items shown</p>
            </div>
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          {stockAttention.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-gray-500">Stock levels look healthy</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {stockAttention.map((product) => (
                <div key={product.id} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                  <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${product.current_stock === 0 ? 'bg-red-500' : 'bg-amber-500'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{product.commercial_name}</p>
                    <p className="text-xs text-gray-500">{product.current_stock} in stock / minimum {product.min_stock}</p>
                  </div>
                  {onCreatePurchaseOrder && (
                    <button
                      type="button"
                      onClick={() => onCreatePurchaseOrder(product.id)}
                      className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-50"
                    >
                      Purchase
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
