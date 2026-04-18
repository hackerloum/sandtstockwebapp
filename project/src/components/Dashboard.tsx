import React, { useMemo, useEffect, useState } from 'react';
import {
  Package, AlertTriangle, TrendingDown, DollarSign,
  ShoppingCart, Clock, BarChart2, Plus, FileText, RefreshCcw, Zap,
  TrendingUp, Ban, FileDown
} from 'lucide-react';
import { Order, Product, StockMovement } from '../types';
import {
  getStockStatus,
  formatCurrency,
  formatDate,
  calculateReorderQuantity,
  buildReorderPlan,
  formatOutTimelineSummary,
  formatSalesOrderTimelineSummary,
  recentWindowDemandQty
} from '../utils/stockUtils';
import { downloadReorderSectionPdf } from '../utils/pdfUtils';
import { getProducts, getStockMovements, getOrders } from '../lib/supabase';

interface DashboardProps {
  onCreatePurchaseOrder?: (productId: string) => void;
  onAddProduct?: () => void;
  onCreateOrder?: () => void;
  onStockCount?: () => void;
  onNavigate?: (tab: string) => void;
  /** Opens the full reorder engine page (all items). */
  onOpenReorderEngine?: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onCreatePurchaseOrder,
  onAddProduct,
  onCreateOrder,
  onStockCount,
  onNavigate,
  onOpenReorderEngine
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [productsData, movementsData, ordersData] = await Promise.all([
          getProducts(),
          getStockMovements(),
          getOrders()
        ]);
        setProducts(productsData || []);
        setMovements(movementsData || []);
        setOrders(Array.isArray(ordersData) ? ordersData : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Basic Stats
  const totalProducts = products?.length || 0;
  const outOfStock = products?.filter(p => getStockStatus(p) === 'out').length || 0;
  const lowStock = products?.filter(p => getStockStatus(p) === 'low').length || 0;
  
  // Inventory Value
  const totalValue = products?.reduce((sum, product) => sum + (product.current_stock * product.price), 0) || 0;
  
  // Top Products by Value
  const topProductsByValue = useMemo(() => {
    if (!products) return [];
    return [...products]
      .sort((a, b) => (b.current_stock * b.price) - (a.current_stock * a.price))
      .slice(0, 5);
  }, [products]);

  // Top Products by Movement (any direction — for recent activity list)
  const topProductsByMovement = useMemo(() => {
    if (!products || !movements) return [];
    const movementCounts = movements.reduce((acc, movement) => {
      acc[movement.product_id] = (acc[movement.product_id] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return [...products]
      .sort((a, b) => (movementCounts[b.id] || 0) - (movementCounts[a.id] || 0))
      .slice(0, 5);
  }, [products, movements]);

  const reorderPlanFull = useMemo(
    () => buildReorderPlan(products, movements, { unlimited: true, orders }),
    [products, movements, orders]
  );

  const reorderPlan = useMemo(
    () => ({
      orderNow: reorderPlanFull.orderNow.slice(0, 8),
      prioritizeReorder: reorderPlanFull.prioritizeReorder.slice(0, 8),
      reviewBeforeOrder: reorderPlanFull.reviewBeforeOrder.slice(0, 8)
    }),
    [reorderPlanFull]
  );

  const stats = [
    {
      title: 'Total Products',
      value: totalProducts,
      icon: Package,
      color: 'bg-blue-500',
      textColor: 'text-blue-600',
      description: 'Total number of unique products'
    },
    {
      title: 'Out of Stock',
      value: outOfStock,
      icon: AlertTriangle,
      color: 'bg-red-500',
      textColor: 'text-red-600',
      description: 'Products with zero stock'
    },
    {
      title: 'Low Stock',
      value: lowStock,
      icon: TrendingDown,
      color: 'bg-yellow-500',
      textColor: 'text-yellow-600',
      description: 'Products below minimum stock level'
    },
    {
      title: 'Total Value',
      value: formatCurrency(totalValue),
      icon: DollarSign,
      color: 'bg-green-500',
      textColor: 'text-green-600',
      description: 'Total inventory value'
    }
  ];

  const quickActions = [
    { 
      title: 'New Order', 
      icon: ShoppingCart, 
      onClick: () => onCreateOrder?.(), 
      color: 'bg-blue-500',
      disabled: !onCreateOrder
    },
    { 
      title: 'Add Product', 
      icon: Plus, 
      onClick: () => onAddProduct?.(), 
      color: 'bg-green-500',
      disabled: !onAddProduct
    },
    { 
      title: 'Purchase Order', 
      icon: FileText, 
      onClick: () => onNavigate?.('purchase-orders'), 
      color: 'bg-purple-500',
      disabled: !onNavigate
    },
    { 
      title: 'Stock Count', 
      icon: RefreshCcw, 
      onClick: () => onStockCount?.(), 
      color: 'bg-orange-500',
      disabled: !onStockCount
    }
  ];

  return (
    <div className="space-y-8">
      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <button
              key={action.title}
              onClick={action.onClick}
              className={`flex items-center space-x-3 p-4 bg-white rounded-xl shadow-sm border border-gray-200 transition-all ${
                action.disabled 
                  ? 'opacity-50 cursor-not-allowed' 
                  : 'hover:shadow-md hover:bg-gray-50 cursor-pointer'
              }`}
              disabled={action.disabled}
            >
              <div className={`${action.color} rounded-lg p-3`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <span className="font-medium text-gray-900">{action.title}</span>
            </button>
          );
        })}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.title} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className={`${stat.color} rounded-lg p-3`}>
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <span className="text-sm text-gray-500">{formatDate(new Date())}</span>
              </div>
              <p className="text-sm font-medium text-gray-600">{stat.title}</p>
              <p className={`text-3xl font-bold ${stat.textColor} mt-1`}>{stat.value}</p>
              <p className="text-sm text-gray-500 mt-2">{stat.description}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Reorder engine: who to stock vs who to verify first */}
        {!loading && products.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:col-span-2">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-amber-500 shrink-0" />
                  Reorder engine
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Demand combines <strong className="font-medium text-gray-700">stock-outs</strong> and{' '}
                  <strong className="font-medium text-gray-700">customer orders</strong> (by order date) across the same
                  timeline. <strong className="font-medium text-gray-700">Order now</strong> is ranked by recent timeline
                  activity first. Suggested quantities scale with demand (up to 100 units per SKU when headroom allows).
                </p>
              </div>
              {onOpenReorderEngine && (
                <button
                  type="button"
                  onClick={onOpenReorderEngine}
                  className="shrink-0 text-sm font-medium text-amber-800 bg-amber-100 hover:bg-amber-200 px-4 py-2 rounded-lg border border-amber-200 transition-colors"
                >
                  View full list
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Order now */}
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Zap className="w-4 h-4 text-emerald-600 shrink-0" />
                    <h4 className="font-semibold text-emerald-900">Order now</h4>
                  </div>
                  <button
                    type="button"
                    title="Download PDF of this list"
                    onClick={() =>
                      downloadReorderSectionPdf('order-now', 'Order now', reorderPlanFull.orderNow)
                    }
                    disabled={reorderPlanFull.orderNow.length === 0}
                    className="inline-flex items-center gap-1 shrink-0 text-xs font-medium text-emerald-900 bg-emerald-100 hover:bg-emerald-200 disabled:opacity-40 disabled:pointer-events-none px-2 py-1 rounded-md border border-emerald-200"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    PDF
                  </button>
                </div>
                <p className="text-xs text-emerald-800/80 mb-3">
                  Out of stock with demand from stock-outs and/or sales orders on the timeline.
                </p>
                {reorderPlan.orderNow.length === 0 ? (
                  <p className="text-sm text-gray-500">None right now.</p>
                ) : (
                  <ul className="space-y-3">
                    {reorderPlan.orderNow.map((row) => (
                      <li
                        key={row.product.id}
                        className="rounded-lg bg-white border border-emerald-100 p-3 text-sm"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium text-gray-900">{row.product.commercial_name}</p>
                          {row.demandPriority === 'critical' && (
                            <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-red-100 text-red-800 border border-red-200">
                              Critical
                            </span>
                          )}
                          {row.demandPriority === 'high' && (
                            <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                              High
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 mt-1">
                          Recent demand (today + last 7d): ~{recentWindowDemandQty(row.analytics)} units
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          Stock-outs: {formatOutTimelineSummary(row.analytics.timelineBreakdown)}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          Sales orders: {formatSalesOrderTimelineSummary(row.analytics.salesOrderTimelineBreakdown)}
                        </p>
                        <p className="text-sm font-medium text-emerald-900 mt-2">
                          Suggested order: {row.suggestedOrderQty} units
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{row.rationale}</p>
                        {onCreatePurchaseOrder && (
                          <button
                            type="button"
                            onClick={() => onCreatePurchaseOrder(row.product.id)}
                            className="mt-2 w-full px-3 py-1.5 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
                          >
                            Create purchase order
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Plan reorder */}
              <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <TrendingUp className="w-4 h-4 text-amber-700 shrink-0" />
                    <h4 className="font-semibold text-amber-950">Plan reorder</h4>
                  </div>
                  <button
                    type="button"
                    title="Download PDF of this list"
                    onClick={() =>
                      downloadReorderSectionPdf(
                        'plan-reorder',
                        'Plan reorder',
                        reorderPlanFull.prioritizeReorder
                      )
                    }
                    disabled={reorderPlanFull.prioritizeReorder.length === 0}
                    className="inline-flex items-center gap-1 shrink-0 text-xs font-medium text-amber-950 bg-amber-100 hover:bg-amber-200 disabled:opacity-40 disabled:pointer-events-none px-2 py-1 rounded-md border border-amber-200"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    PDF
                  </button>
                </div>
                <p className="text-xs text-amber-900/80 mb-3">
                  In stock but selling or moving fast — stay ahead of stock-outs.
                </p>
                {reorderPlan.prioritizeReorder.length === 0 ? (
                  <p className="text-sm text-gray-500">None right now.</p>
                ) : (
                  <ul className="space-y-3">
                    {reorderPlan.prioritizeReorder.map((row) => (
                      <li
                        key={row.product.id}
                        className="rounded-lg bg-white border border-amber-100 p-3 text-sm"
                      >
                        <p className="font-medium text-gray-900">{row.product.commercial_name}</p>
                        <p className="text-gray-600 mt-1">
                          Stock {row.product.current_stock} · Movements (all time) {row.analytics.totalMovementsAll}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          Stock-outs: {formatOutTimelineSummary(row.analytics.timelineBreakdown)}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          Sales orders: {formatSalesOrderTimelineSummary(row.analytics.salesOrderTimelineBreakdown)}
                        </p>
                        <p className="text-sm font-medium text-amber-950 mt-2">
                          Suggested order: {row.suggestedOrderQty} units
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{row.rationale}</p>
                        {onCreatePurchaseOrder && (
                          <button
                            type="button"
                            onClick={() => onCreatePurchaseOrder(row.product.id)}
                            className="mt-2 w-full px-3 py-1.5 text-sm font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700"
                          >
                            Create purchase order
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Do not auto-order */}
              <div className="rounded-xl border border-slate-300 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Ban className="w-4 h-4 text-slate-600 shrink-0" />
                    <h4 className="font-semibold text-slate-900">Do not auto-order</h4>
                  </div>
                  <button
                    type="button"
                    title="Download PDF of this list"
                    onClick={() =>
                      downloadReorderSectionPdf(
                        'do-not-order',
                        'Do not auto-order',
                        reorderPlanFull.reviewBeforeOrder
                      )
                    }
                    disabled={reorderPlanFull.reviewBeforeOrder.length === 0}
                    className="inline-flex items-center gap-1 shrink-0 text-xs font-medium text-slate-800 bg-slate-200 hover:bg-slate-300 disabled:opacity-40 disabled:pointer-events-none px-2 py-1 rounded-md border border-slate-300"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    PDF
                  </button>
                </div>
                <p className="text-xs text-slate-600 mb-3">
                  At zero with no stock-outs and no customer order lines on the timeline — review before buying.
                </p>
                {reorderPlan.reviewBeforeOrder.length === 0 ? (
                  <p className="text-sm text-gray-500">None right now.</p>
                ) : (
                  <ul className="space-y-3">
                    {reorderPlan.reviewBeforeOrder.map((row) => (
                      <li
                        key={row.product.id}
                        className="rounded-lg bg-white border border-slate-200 p-3 text-sm"
                      >
                        <p className="font-medium text-gray-900">{row.product.commercial_name}</p>
                        <p className="text-gray-600 mt-1">
                          Stock 0 · Movements (all time) {row.analytics.totalMovementsAll}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          Stock-outs: {formatOutTimelineSummary(row.analytics.timelineBreakdown)}
                        </p>
                        <p className="text-xs text-gray-600 mt-1">
                          Sales orders: {formatSalesOrderTimelineSummary(row.analytics.salesOrderTimelineBreakdown)}
                        </p>
                        <p className="text-sm text-slate-700 mt-2">
                          Reference qty (if you restock): {row.suggestedOrderQty} units
                        </p>
                        <p className="text-xs text-slate-600 mt-1">{row.rationale}</p>
                        <p className="mt-2 text-xs font-medium text-slate-500 uppercase tracking-wide">
                          No suggested PO — verify first
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Stock Alerts */}
        {(outOfStock > 0 || lowStock > 0) && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <AlertTriangle className="w-5 h-5 text-yellow-500 mr-2" />
                Stock Alerts
              </h3>
              <button className="text-sm text-blue-600 hover:text-blue-800">View All</button>
            </div>
            <div className="space-y-4">
              {products
                .filter(p => ['out', 'low'].includes(getStockStatus(p)))
                .slice(0, 5)
                .map(product => {
                  const reorderQty = calculateReorderQuantity(product);
                  return (
                    <div key={product.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <div className={`w-2 h-2 rounded-full ${
                            getStockStatus(product) === 'out' ? 'bg-red-500' : 'bg-yellow-500'
                          }`} />
                          <p className="font-medium text-gray-900">{product.commercial_name}</p>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          Current: {product.current_stock} | Min: {product.min_stock} | Reorder: {reorderQty}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        {onCreatePurchaseOrder && (
                          <button
                            onClick={() => onCreatePurchaseOrder(product.id)}
                            className="px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100"
                          >
                            Order Stock
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Top Products by Value */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <BarChart2 className="w-5 h-5 text-blue-500 mr-2" />
              Top Products by Value
            </h3>
            <button className="text-sm text-blue-600 hover:text-blue-800">View All</button>
          </div>
          <div className="space-y-4">
            {topProductsByValue.map(product => (
              <div key={product.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900">{product.commercial_name}</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Stock: {product.current_stock} × {formatCurrency(product.price)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">
                    {formatCurrency(product.current_stock * product.price)}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">Total Value</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Clock className="w-5 h-5 text-purple-500 mr-2" />
              Recent Stock Movement
            </h3>
            <button className="text-sm text-blue-600 hover:text-blue-800">View All</button>
          </div>
          <div className="space-y-4">
            {topProductsByMovement.map(product => {
              const productMovements = movements
                .filter(m => m.product_id === product.id)
                .slice(0, 2);
              
              return (
                <div key={product.id} className="p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <p className="font-medium text-gray-900">{product.commercial_name}</p>
                    <p className="text-sm text-gray-500">
                      Current Stock: {product.current_stock}
                    </p>
                  </div>
                  <div className="space-y-2">
                    {productMovements.map((movement, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <div className="flex items-center space-x-2">
                          <div className={`w-2 h-2 rounded-full ${
                            movement.movement_type === 'in' ? 'bg-green-500' : 'bg-red-500'
                          }`} />
                          <span className="text-gray-600">
                            {movement.movement_type === 'in' ? 'Stock In' : 'Stock Out'}: {movement.quantity} units
                          </span>
                        </div>
                        <span className="text-gray-500">{formatDate(movement.performed_at)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};