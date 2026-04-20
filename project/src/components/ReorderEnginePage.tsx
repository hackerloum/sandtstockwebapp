import React, { useMemo } from 'react';
import { Zap, TrendingUp, Ban, FileDown } from 'lucide-react';
import { IncomingByProductSummary, Order, Product, StockMovement } from '../types';
import {
  buildReorderPlan,
  formatOutTimelineSummary,
  formatSalesOrderTimelineSummary,
  recentWindowDemandQty
} from '../utils/stockUtils';
import { downloadReorderSectionPdf } from '../utils/pdfUtils';
import { PageHeader } from './shared/PageLayout';

interface ReorderEnginePageProps {
  products: Product[];
  movements: StockMovement[];
  orders: Order[];
  incomingByProduct?: IncomingByProductSummary[];
  loading?: boolean;
  onBack: () => void;
  onCreatePurchaseOrder?: (productId: string) => void;
}

export const ReorderEnginePage: React.FC<ReorderEnginePageProps> = ({
  products,
  movements,
  orders,
  incomingByProduct,
  loading,
  onBack,
  onCreatePurchaseOrder
}) => {
  const incomingMap = useMemo(
    () => new Map((incomingByProduct ?? []).map((x) => [x.product_id, x] as const)),
    [incomingByProduct]
  );

  const reorderPlan = useMemo(
    () => buildReorderPlan(products, movements, { unlimited: true, orders, incomingByProduct: incomingMap }),
    [products, movements, orders, incomingMap]
  );

  if (loading) {
    return (
      <div>
        <PageHeader title="Reorder engine" onBack={onBack} />
        <p className="text-sm text-gray-500">Loading…</p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Reorder engine"
        subtitle="Full list: stock-outs and sales orders by timeline. Order now is sorted by recent demand first. Suggested quantities scale with demand (up to 100 units per SKU when headroom allows). Use PDF per column for printable lists."
        onBack={onBack}
      />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <Zap className="w-4 h-4 text-emerald-600 shrink-0" />
              <h2 className="font-semibold text-emerald-900">Order now</h2>
              <span className="text-xs font-medium text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
                {reorderPlan.orderNow.length}
              </span>
            </div>
            <button
              type="button"
              title="Download PDF of this list"
              onClick={() =>
                downloadReorderSectionPdf('order-now', 'Order now', reorderPlan.orderNow)
              }
              disabled={reorderPlan.orderNow.length === 0}
              className="inline-flex items-center gap-1 shrink-0 text-xs font-medium text-emerald-900 bg-emerald-100 hover:bg-emerald-200 disabled:opacity-40 disabled:pointer-events-none px-2 py-1 rounded-md border border-emerald-200"
            >
              <FileDown className="w-3.5 h-3.5" />
              PDF
            </button>
          </div>
          <p className="text-xs text-emerald-800/80 mb-3">
            Out of stock with demand from stock-outs and/or sales orders.
          </p>
          {reorderPlan.orderNow.length === 0 ? (
            <p className="text-sm text-gray-500">None.</p>
          ) : (
            <ul className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
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
                  {row.incomingShipment && (
                    <p className="text-xs text-blue-700 mt-1">
                      Incoming: {row.incomingShipment.total_incoming_kg.toFixed(2)} kg
                      {row.incomingShipment.earliest_arrival_date
                        ? ` · ETA ${row.incomingShipment.earliest_arrival_date}`
                        : ''}
                    </p>
                  )}
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

        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <TrendingUp className="w-4 h-4 text-amber-700 shrink-0" />
              <h2 className="font-semibold text-amber-950">Plan reorder</h2>
              <span className="text-xs font-medium text-amber-900 bg-amber-100 px-2 py-0.5 rounded-full shrink-0">
                {reorderPlan.prioritizeReorder.length}
              </span>
            </div>
            <button
              type="button"
              title="Download PDF of this list"
              onClick={() =>
                downloadReorderSectionPdf('plan-reorder', 'Plan reorder', reorderPlan.prioritizeReorder)
              }
              disabled={reorderPlan.prioritizeReorder.length === 0}
              className="inline-flex items-center gap-1 shrink-0 text-xs font-medium text-amber-950 bg-amber-100 hover:bg-amber-200 disabled:opacity-40 disabled:pointer-events-none px-2 py-1 rounded-md border border-amber-200"
            >
              <FileDown className="w-3.5 h-3.5" />
              PDF
            </button>
          </div>
          <p className="text-xs text-amber-900/80 mb-3">In stock with ongoing demand or movement.</p>
          {reorderPlan.prioritizeReorder.length === 0 ? (
            <p className="text-sm text-gray-500">None.</p>
          ) : (
            <ul className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
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
                  {row.incomingShipment && (
                    <p className="text-xs text-blue-700 mt-1">
                      Incoming: {row.incomingShipment.total_incoming_kg.toFixed(2)} kg
                      {row.incomingShipment.earliest_arrival_date
                        ? ` · ETA ${row.incomingShipment.earliest_arrival_date}`
                        : ''}
                    </p>
                  )}
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

        <div className="rounded-xl border border-slate-300 bg-slate-50 p-4">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <Ban className="w-4 h-4 text-slate-600 shrink-0" />
              <h2 className="font-semibold text-slate-900">Do not auto-order</h2>
              <span className="text-xs font-medium text-slate-700 bg-slate-200 px-2 py-0.5 rounded-full shrink-0">
                {reorderPlan.reviewBeforeOrder.length}
              </span>
            </div>
            <button
              type="button"
              title="Download PDF of this list"
              onClick={() =>
                downloadReorderSectionPdf(
                  'do-not-order',
                  'Do not auto-order',
                  reorderPlan.reviewBeforeOrder
                )
              }
              disabled={reorderPlan.reviewBeforeOrder.length === 0}
              className="inline-flex items-center gap-1 shrink-0 text-xs font-medium text-slate-800 bg-slate-200 hover:bg-slate-300 disabled:opacity-40 disabled:pointer-events-none px-2 py-1 rounded-md border border-slate-300"
            >
              <FileDown className="w-3.5 h-3.5" />
              PDF
            </button>
          </div>
          <p className="text-xs text-slate-600 mb-3">
            At zero with no stock-outs and no order lines on the timeline — verify first.
          </p>
          {reorderPlan.reviewBeforeOrder.length === 0 ? (
            <p className="text-sm text-gray-500">None.</p>
          ) : (
            <ul className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
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
                  {row.incomingShipment && (
                    <p className="text-xs text-blue-700 mt-1">
                      Incoming: {row.incomingShipment.total_incoming_kg.toFixed(2)} kg
                      {row.incomingShipment.earliest_arrival_date
                        ? ` · ETA ${row.incomingShipment.earliest_arrival_date}`
                        : ''}
                    </p>
                  )}
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
  );
};
