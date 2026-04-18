import { Database } from '../types/supabase';
import type { Order, OrderItem, StockMovement } from '../types';

type Product = Database['public']['Tables']['products']['Row'];

/** Timeline bucket for dates (e.g. updated_at or movement performed_at): today, yesterday, last_week, or older */
export type UpdatedTimeline = 'today' | 'yesterday' | 'last_week' | 'older';

/** Per-product movement analytics (outs for demand; ins + outs for “how busy” the SKU is). */
export type ProductMovementAnalytics = {
  productId: string;
  /** Out movement rows summed across all {@link timelineBreakdown} buckets (today … older) */
  timelineOutMovements: number;
  /** Units out summed across all timeline buckets */
  timelineOutQty: number;
  totalInMovements: number;
  /** Every stock movement row (in + out), all time */
  totalMovementsAll: number;
  /** Stock-out rows per timeline bucket */
  timelineBreakdown: Record<
    UpdatedTimeline,
    { movements: number; qty: number }
  >;
  /** Stock-in rows per timeline bucket */
  inTimelineBreakdown: Record<
    UpdatedTimeline,
    { movements: number; qty: number }
  >;
  totalOutMovements: number;
  totalQtyOut: number;
  /** Customer order lines (non-cancelled orders), bucketed by order date — fills gaps when stock-outs aren’t posted */
  salesOrderTimelineBreakdown: Record<
    UpdatedTimeline,
    { movements: number; qty: number }
  >;
  /** Total order lines (rows) across timeline */
  salesOrderLines: number;
  /** Units ordered across all sales order lines */
  salesOrderQty: number;
};

/** @deprecated Use ProductMovementAnalytics */
export type ProductOutVelocity = ProductMovementAnalytics;

const emptyTimelineBreakdown = (): ProductMovementAnalytics['timelineBreakdown'] => ({
  today: { movements: 0, qty: 0 },
  yesterday: { movements: 0, qty: 0 },
  last_week: { movements: 0, qty: 0 },
  older: { movements: 0, qty: 0 }
});

export const emptyMovementAnalytics = (productId: string): ProductMovementAnalytics => ({
  productId,
  timelineOutMovements: 0,
  timelineOutQty: 0,
  totalInMovements: 0,
  totalMovementsAll: 0,
  timelineBreakdown: emptyTimelineBreakdown(),
  inTimelineBreakdown: emptyTimelineBreakdown(),
  totalOutMovements: 0,
  totalQtyOut: 0,
  salesOrderTimelineBreakdown: emptyTimelineBreakdown(),
  salesOrderLines: 0,
  salesOrderQty: 0
});

/** Stock-out lines + sales order lines (combined demand signal for reorder). */
export const effectiveDemandLines = (a: ProductMovementAnalytics): number =>
  a.timelineOutMovements + a.salesOrderLines;

/** Units from stock-outs + units from sales orders. */
export const effectiveDemandQty = (a: ProductMovementAnalytics): number =>
  a.timelineOutQty + a.salesOrderQty;

/** Compact label for outbound counts per timeline bucket (all buckets). */
export const formatOutTimelineSummary = (
  b: ProductMovementAnalytics['timelineBreakdown']
): string => {
  const parts: string[] = [];
  if (b.today.movements || b.today.qty) {
    parts.push(`Today ${b.today.movements}× / ${b.today.qty}u`);
  }
  if (b.yesterday.movements || b.yesterday.qty) {
    parts.push(`Yesterday ${b.yesterday.movements}× / ${b.yesterday.qty}u`);
  }
  if (b.last_week.movements || b.last_week.qty) {
    parts.push(`Last 7d ${b.last_week.movements}× / ${b.last_week.qty}u`);
  }
  if (b.older.movements || b.older.qty) {
    parts.push(`Older ${b.older.movements}× / ${b.older.qty}u`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'No stock-outs recorded';
};

/** Same shape as stock-outs; `movements` = order line count per bucket. */
export const formatSalesOrderTimelineSummary = (
  b: ProductMovementAnalytics['salesOrderTimelineBreakdown']
): string => {
  const parts: string[] = [];
  if (b.today.movements || b.today.qty) {
    parts.push(`Today ${b.today.movements} lines / ${b.today.qty}u`);
  }
  if (b.yesterday.movements || b.yesterday.qty) {
    parts.push(`Yesterday ${b.yesterday.movements} lines / ${b.yesterday.qty}u`);
  }
  if (b.last_week.movements || b.last_week.qty) {
    parts.push(`Last 7d ${b.last_week.movements} lines / ${b.last_week.qty}u`);
  }
  if (b.older.movements || b.older.qty) {
    parts.push(`Older ${b.older.movements} lines / ${b.older.qty}u`);
  }
  return parts.length > 0 ? parts.join(' · ') : 'No sales orders';
};

/**
 * Aggregates stock movements per product: full timelineBreakdown (today … older) for in and out.
 */
export const computeProductMovementAnalytics = (
  movements: Array<
    Pick<StockMovement, 'product_id' | 'movement_type' | 'quantity' | 'performed_at'>
  >
): Map<string, ProductMovementAnalytics> => {
  const map = new Map<string, ProductMovementAnalytics>();

  for (const m of movements) {
    const id = m.product_id;
    if (!map.has(id)) {
      map.set(id, emptyMovementAnalytics(id));
    }
    const row = map.get(id)!;
    const timeline = getUpdatedTimeline(m.performed_at);
    const qty = Number(m.quantity) || 0;

    row.totalMovementsAll += 1;

    if (m.movement_type === 'in') {
      row.totalInMovements += 1;
      row.inTimelineBreakdown[timeline].movements += 1;
      row.inTimelineBreakdown[timeline].qty += qty;
    }

    if (m.movement_type === 'out') {
      row.timelineBreakdown[timeline].movements += 1;
      row.timelineBreakdown[timeline].qty += qty;
      row.totalOutMovements += 1;
      row.totalQtyOut += qty;
    }
  }

  for (const row of map.values()) {
    const b = row.timelineBreakdown;
    row.timelineOutMovements =
      b.today.movements +
      b.yesterday.movements +
      b.last_week.movements +
      b.older.movements;
    row.timelineOutQty = b.today.qty + b.yesterday.qty + b.last_week.qty + b.older.qty;
  }

  return map;
};

export type OrderForDemand = Pick<Order, 'created_at' | 'status'> & {
  items?: Array<Pick<OrderItem, 'product_id' | 'quantity'>>;
};

/**
 * Demand from customer orders (order date timeline). Cancelled orders excluded.
 */
export const computeSalesOrderDemandByProduct = (
  orders: OrderForDemand[]
): Map<
  string,
  {
    breakdown: ProductMovementAnalytics['salesOrderTimelineBreakdown'];
    salesOrderLines: number;
    salesOrderQty: number;
  }
> => {
  const map = new Map<
    string,
    {
      breakdown: ProductMovementAnalytics['salesOrderTimelineBreakdown'];
      salesOrderLines: number;
      salesOrderQty: number;
    }
  >();

  for (const order of orders) {
    if (order.status === 'cancelled') continue;
    const timeline = getUpdatedTimeline(order.created_at);
    for (const item of order.items || []) {
      const id = item.product_id;
      const qty = Number(item.quantity) || 0;
      if (!map.has(id)) {
        map.set(id, {
          breakdown: emptyTimelineBreakdown(),
          salesOrderLines: 0,
          salesOrderQty: 0
        });
      }
      const row = map.get(id)!;
      row.breakdown[timeline].movements += 1;
      row.breakdown[timeline].qty += qty;
      row.salesOrderLines += 1;
      row.salesOrderQty += qty;
    }
  }

  return map;
};

/**
 * Movement analytics plus sales-order demand (same timeline buckets).
 */
export const computeProductDemandAnalytics = (
  movements: Array<
    Pick<StockMovement, 'product_id' | 'movement_type' | 'quantity' | 'performed_at'>
  >,
  orders?: OrderForDemand[]
): Map<string, ProductMovementAnalytics> => {
  const base = computeProductMovementAnalytics(movements);
  const orderMap = orders?.length ? computeSalesOrderDemandByProduct(orders) : null;

  if (!orderMap || orderMap.size === 0) {
    return base;
  }

  for (const [productId, od] of orderMap) {
    if (!base.has(productId)) {
      base.set(productId, emptyMovementAnalytics(productId));
    }
    const row = base.get(productId)!;
    row.salesOrderTimelineBreakdown = od.breakdown;
    row.salesOrderLines = od.salesOrderLines;
    row.salesOrderQty = od.salesOrderQty;
  }

  return base;
};

/** @deprecated Use computeProductMovementAnalytics */
export const computeProductOutVelocity = computeProductMovementAnalytics;

export type ReorderBucket = 'order_now' | 'prioritize_reorder' | 'review_before_order';

export type ReorderEngineRow<
  P extends {
    id: string;
    commercial_name: string;
    current_stock: number;
    min_stock: number;
    max_stock: number;
  }
> = {
  product: P;
  analytics: ProductMovementAnalytics;
  bucket: ReorderBucket;
  /** When false, avoid placing a blind purchase order without human review */
  suggestPurchaseOrder: boolean;
  rationale: string;
  /** Units to order toward mid-point between min and max stock (same as calculateReorderQuantity). */
  suggestedOrderQty: number;
};

const sortOrderNow = (
  a: { analytics: ProductMovementAnalytics },
  b: { analytics: ProductMovementAnalytics }
) => {
  if (effectiveDemandQty(b.analytics) !== effectiveDemandQty(a.analytics)) {
    return effectiveDemandQty(b.analytics) - effectiveDemandQty(a.analytics);
  }
  return effectiveDemandLines(b.analytics) - effectiveDemandLines(a.analytics);
};

const sortPrioritize = (
  a: { analytics: ProductMovementAnalytics },
  b: { analytics: ProductMovementAnalytics }
) => {
  if (effectiveDemandLines(b.analytics) !== effectiveDemandLines(a.analytics)) {
    return effectiveDemandLines(b.analytics) - effectiveDemandLines(a.analytics);
  }
  if (effectiveDemandQty(b.analytics) !== effectiveDemandQty(a.analytics)) {
    return effectiveDemandQty(b.analytics) - effectiveDemandQty(a.analytics);
  }
  return b.analytics.totalMovementsAll - a.analytics.totalMovementsAll;
};

/** Target mid-point between min/max minus current stock (shared with {@link calculateReorderQuantity}). */
export const getSuggestedOrderQuantity = (
  product: Pick<Product, 'current_stock' | 'min_stock' | 'max_stock'>
): number => {
  const targetStock = Math.ceil((product.max_stock + product.min_stock) / 2);
  return Math.max(0, targetStock - product.current_stock);
};

function shouldPrioritizeReorder(
  product: Pick<Product, 'current_stock' | 'min_stock'>,
  a: ProductMovementAnalytics
): boolean {
  if (product.current_stock <= 0) return false;
  if (effectiveDemandLines(a) > 0) return true;
  if (a.totalMovementsAll >= 4) return true;
  if (
    product.current_stock > 0 &&
    product.current_stock <= product.min_stock &&
    (a.totalOutMovements > 0 || a.salesOrderLines > 0)
  ) {
    return true;
  }
  return false;
}

function buildRationale(
  bucket: ReorderBucket,
  a: ProductMovementAnalytics,
  product: Pick<Product, 'current_stock' | 'min_stock'>
): string {
  if (bucket === 'order_now') {
    if (a.timelineOutMovements > 0 && a.salesOrderLines > 0) {
      return 'Out of stock with stock-outs and customer order demand — replenish urgently.';
    }
    if (a.salesOrderLines > 0 && a.timelineOutMovements === 0) {
      return 'Out of stock but customer orders show demand — replenish (post stock-outs to match inventory).';
    }
    return 'Out of stock with stock-outs across the timeline — replenish urgently.';
  }
  if (bucket === 'prioritize_reorder') {
    if (a.timelineOutMovements === 0 && a.salesOrderLines > 0) {
      return 'Demand from sales orders — plan a purchase order before you run out.';
    }
    if (effectiveDemandLines(a) > 0) {
      return 'Sales outs and/or orders in the timeline — plan a purchase order before you run out.';
    }
    if (a.totalMovementsAll >= 4) {
      return 'High stock movement (in/out) overall — keep an eye on levels.';
    }
    if (
      product.current_stock <= product.min_stock &&
      (a.totalOutMovements > 0 || a.salesOrderLines > 0)
    ) {
      return 'Below minimum with past sales or orders — consider reordering.';
    }
    return 'Eligible for planned reorder.';
  }
  if (a.totalMovementsAll === 0 && a.salesOrderLines === 0) {
    return 'At zero with no stock movement or sales order history — confirm the SKU is active before ordering.';
  }
  return 'At zero with no demand from stock-outs or sales orders — do not auto-order; check listings and demand.';
}

/**
 * Reorder engine: urgent (OOS + selling), plan ahead (in stock + velocity), review (OOS + not selling / no activity).
 */
export const buildReorderPlan = <
  P extends {
    id: string;
    commercial_name: string;
    current_stock: number;
    min_stock: number;
    max_stock: number;
  }
>(
  products: P[],
  movements: Array<
    Pick<StockMovement, 'product_id' | 'movement_type' | 'quantity' | 'performed_at'>
  >,
  options?: {
    limitPerBucket?: number;
    orders?: OrderForDemand[];
    /** When true, return every product in each bucket (no cap). */
    unlimited?: boolean;
  }
): {
  orderNow: ReorderEngineRow<P>[];
  prioritizeReorder: ReorderEngineRow<P>[];
  reviewBeforeOrder: ReorderEngineRow<P>[];
} => {
  const limit = options?.unlimited
    ? Number.POSITIVE_INFINITY
    : (options?.limitPerBucket ?? 8);
  const analyticsMap = computeProductDemandAnalytics(movements, options?.orders);

  const orderNow: ReorderEngineRow<P>[] = [];
  const prioritizeReorder: ReorderEngineRow<P>[] = [];
  const reviewBeforeOrder: ReorderEngineRow<P>[] = [];

  for (const product of products) {
    const a = analyticsMap.get(product.id) ?? emptyMovementAnalytics(product.id);
    const oos = product.current_stock <= 0;
    const suggestedOrderQty = getSuggestedOrderQuantity(product);
    const hasDemand = effectiveDemandLines(a) > 0;

    if (oos && hasDemand) {
      orderNow.push({
        product,
        analytics: a,
        bucket: 'order_now',
        suggestPurchaseOrder: true,
        rationale: buildRationale('order_now', a, product),
        suggestedOrderQty
      });
    } else if (oos && !hasDemand) {
      reviewBeforeOrder.push({
        product,
        analytics: a,
        bucket: 'review_before_order',
        suggestPurchaseOrder: false,
        rationale: buildRationale('review_before_order', a, product),
        suggestedOrderQty
      });
    } else if (!oos && shouldPrioritizeReorder(product, a)) {
      prioritizeReorder.push({
        product,
        analytics: a,
        bucket: 'prioritize_reorder',
        suggestPurchaseOrder: true,
        rationale: buildRationale('prioritize_reorder', a, product),
        suggestedOrderQty
      });
    }
  }

  orderNow.sort(sortOrderNow);
  prioritizeReorder.sort(sortPrioritize);
  reviewBeforeOrder.sort((x, y) => {
    const az = x.analytics.totalMovementsAll;
    const bz = y.analytics.totalMovementsAll;
    return az - bz;
  });

  return {
    orderNow: orderNow.slice(0, limit),
    prioritizeReorder: prioritizeReorder.slice(0, limit),
    reviewBeforeOrder: reviewBeforeOrder.slice(0, limit)
  };
};

/**
 * In-stock SKUs with the strongest outbound signal (for simple ranked lists).
 */
export const getRecommendedProductsByOutgoing = <
  P extends { id: string; commercial_name: string; current_stock: number; min_stock: number; max_stock: number }
>(
  products: P[],
  movements: Array<
    Pick<StockMovement, 'product_id' | 'movement_type' | 'quantity' | 'performed_at'>
  >,
  limit = 5,
  orders?: OrderForDemand[]
): Array<{ product: P; stats: ProductMovementAnalytics }> => {
  const velocity = computeProductDemandAnalytics(movements, orders);

  return [...products]
    .map((product) => {
      const stats = velocity.get(product.id) ?? emptyMovementAnalytics(product.id);
      return { product, stats };
    })
    .filter(({ stats }) => effectiveDemandLines(stats) > 0)
    .filter(({ product }) => product.current_stock > 0)
    .sort((a, b) => {
      if (effectiveDemandLines(b.stats) !== effectiveDemandLines(a.stats)) {
        return effectiveDemandLines(b.stats) - effectiveDemandLines(a.stats);
      }
      if (effectiveDemandQty(b.stats) !== effectiveDemandQty(a.stats)) {
        return effectiveDemandQty(b.stats) - effectiveDemandQty(a.stats);
      }
      return b.stats.totalOutMovements - a.stats.totalOutMovements;
    })
    .slice(0, limit);
};

export const getStockStatus = (product: Product) => {
  if (product.current_stock <= 0) return 'out';
  if (product.current_stock <= product.min_stock) return 'low';
  if (product.current_stock >= product.max_stock) return 'high';
  return 'ok';
};

/**
 * Parse money values from DB/API (number, string with commas, numeric strings). Never returns NaN.
 */
export function toMoneyNumber(value: unknown, fallback = 0): number {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : fallback;
  }
  if (typeof value === 'bigint') {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }
  if (typeof value === 'string') {
    const cleaned = value.trim().replace(/,/g, '').replace(/^TSh\s*/i, '');
    if (cleaned === '' || cleaned === '-') return fallback;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

export const formatCurrency = (amount: number | unknown) => {
  const n = toMoneyNumber(amount, 0);
  return new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: 'TZS'
  }).format(n);
};

export const formatDate = (date: string | Date) => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(typeof date === 'string' ? new Date(date) : date);
};

export const getUpdatedTimeline = (updatedAt: string | null | undefined): UpdatedTimeline => {
  if (!updatedAt) return 'older';
  const date = new Date(updatedAt);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);
  const sevenDaysAgo = new Date(startOfToday);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  if (date >= startOfToday) return 'today';
  if (date >= startOfYesterday) return 'yesterday';
  if (date >= sevenDaysAgo) return 'last_week';
  return 'older';
};

export const getUpdatedTimelineLabel = (updatedAt: string | null | undefined): string => {
  const timeline = getUpdatedTimeline(updatedAt);
  switch (timeline) {
    case 'today': return 'Today';
    case 'yesterday': return 'Yesterday';
    case 'last_week': return 'Last 7 days';
    case 'older': return updatedAt ? formatDate(updatedAt) : '—';
  }
};

/** True if product was not updated within the last 7 days (uses updated_at only). */
export const isNotUpdatedWithin7Days = (updatedAt: string | null | undefined): boolean => {
  return getUpdatedTimeline(updatedAt) === 'older';
};

/** Badge style for updated timeline (for use in ProductList) */
export const getUpdatedTimelineBadgeClass = (timeline: UpdatedTimeline): string => {
  switch (timeline) {
    case 'today': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'yesterday': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'last_week': return 'bg-slate-100 text-slate-700 border-slate-200';
    default: return 'bg-gray-100 text-gray-600 border-gray-200';
  }
};

export const formatWeight = (weight: number) => {
  return `${weight.toFixed(3)}kg`;
};

export const calculateReorderQuantity = (product: Product) =>
  getSuggestedOrderQuantity(product);

// Stock status colors
export const getStockStatusColor = (status: string) => {
  switch (status) {
    case 'out':
      return 'text-red-600 bg-red-50';
    case 'low':
      return 'text-yellow-600 bg-yellow-50';
    case 'high':
      return 'text-green-600 bg-green-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
};

// Order status colors
export const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': 
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'processing': 
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'shipped': 
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'customs-clearance': 
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'in-transit-international': 
      return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    case 'arrived-tanzania': 
      return 'bg-cyan-100 text-cyan-800 border-cyan-200';
    case 'delivered': 
      return 'bg-green-100 text-green-800 border-green-200';
    case 'cancelled': 
      return 'bg-red-100 text-red-800 border-red-200';
    default: 
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export const getStatusText = (status: string) => {
  switch (status) {
    case 'out':
      return 'Out of Stock';
    case 'low':
      return 'Low Stock';
    case 'high':
      return 'High Stock';
    default:
      return 'In Stock';
  }
};

export const generateId = () => {
  return Math.random().toString(36).substr(2, 9);
};

export const generateOrderNumber = () => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `ORD${year}${month}${day}${random}`;
};

export const generatePONumber = () => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `PO${year}${month}${day}${random}`;
};

export const logActivity = (
  activities: any[],
  setActivities: (activities: any[]) => void,
  action: string,
  entityType: string,
  entityId: string,
  details: string,
  username?: string
) => {
  const newActivity = {
    id: generateId(),
    action,
    entityType,
    entityId,
    details,
    username,
    timestamp: new Date().toISOString()
  };
  setActivities([newActivity, ...activities]);
};

/** Line row for order detail UI / PDF — names resolved from catalog when missing; supports legacy camelCase keys. */
export type ResolvedOrderLine = {
  key: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
};

/** Quantity: first non‑negative finite value (0 is valid). */
function pickQuantityField(obj: Record<string, unknown>, keys: string[], fallback = 0): number {
  for (const k of keys) {
    if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
    const n = toMoneyNumber(obj[k], NaN);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  return fallback;
}

/**
 * Money on a line: prefer the first **strictly positive** value among keys so we do not lock onto
 * `unit_price: 0` / `total_price: 0` when another field (e.g. `line_total`) holds the real amount.
 */
function pickLineMoney(obj: Record<string, unknown>, keys: string[], fallback = 0): number {
  let lastFinite = fallback;
  for (const k of keys) {
    if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
    const n = toMoneyNumber(obj[k], NaN);
    if (!Number.isFinite(n)) continue;
    if (n > 0) return n;
    lastFinite = n;
  }
  return lastFinite;
}

function embeddedProductLine(raw: Record<string, unknown>): { name: string; code: string } {
  let p = raw.product;
  if (Array.isArray(p)) p = p[0];
  if (!p || typeof p !== 'object') return { name: '', code: '' };
  const o = p as Record<string, unknown>;
  const name = String(o.commercial_name ?? o.name ?? '').trim();
  const code = String(o.code ?? '').trim();
  return { name, code };
}

/**
 * When every line has no amounts stored but the order header has a total (imports / legacy rows),
 * split the header total across lines by quantity for display and PDFs.
 */
/** Best effort header total (snake_case / camelCase / occasional API shapes). */
export function resolveOrderGrandTotal(order: Order): number {
  const o = order as unknown as Record<string, unknown>;
  const candidates: unknown[] = [
    o.total_amount,
    o.totalAmount,
    o['TotalAmount'],
    o['total'],
    o['grand_total'],
    o['GrandTotal']
  ];
  for (const c of candidates) {
    const n = toMoneyNumber(c, 0);
    if (n > 0) return n;
  }
  return 0;
}

function inferLineAmountsFromOrderTotal(lines: ResolvedOrderLine[], orderTotal: number): ResolvedOrderLine[] {
  const total = toMoneyNumber(orderTotal, 0);
  if (total <= 0 || lines.length === 0) return lines;

  const sumLines = lines.reduce((s, l) => s + toMoneyNumber(l.total_price, 0), 0);
  if (sumLines >= 0.01) return lines;

  const positiveIdx = lines
    .map((l, i) => ({ l, i }))
    .filter(({ l }) => l.quantity > 0);
  const sumQty = positiveIdx.reduce((s, { l }) => s + l.quantity, 0);
  if (sumQty <= 0) return lines;

  const totalCents = Math.round(total * 100);
  let allocatedCents = 0;
  const centsByIndex = new Map<number, number>();

  positiveIdx.forEach(({ l, i }, j) => {
    const q = l.quantity;
    const isLast = j === positiveIdx.length - 1;
    const c = isLast ? Math.max(0, totalCents - allocatedCents) : Math.floor((totalCents * q) / sumQty);
    if (!isLast) allocatedCents += c;
    centsByIndex.set(i, c);
  });

  return lines.map((l, i) => {
    const q = Math.max(0, l.quantity);
    if (q === 0) {
      return { ...l, unit_price: 0, total_price: 0 };
    }
    const c = centsByIndex.get(i) ?? 0;
    const total_price = c / 100;
    const unit_price = Math.round((total_price / q) * 100) / 100;
    return { ...l, unit_price, total_price };
  });
}

/**
 * Normalize order line items for display: prefer live product names from `products`,
 * fall back to embedded product join / stored labels, and accept camelCase or alternate price keys.
 */
export function resolveOrderItemsForDisplay(order: Order, products: Product[]): ResolvedOrderLine[] {
  const raw = order.items ?? [];
  const byId = new Map<string, Product>();
  for (const p of products) {
    byId.set(p.id, p);
    byId.set(p.id.toLowerCase(), p);
  }

  const lines = raw.map((item, index) => {
    const r = item as OrderItem &
      Record<string, unknown> & {
        productId?: string;
        productName?: string;
        unitPrice?: number;
        totalPrice?: number;
        price?: number;
      };

    const row = r as Record<string, unknown>;
    const product_id = String(r.product_id || r.productId || '').trim();
    const fromCatalog = product_id
      ? byId.get(product_id) ?? byId.get(product_id.toLowerCase())
      : undefined;
    const embedded = embeddedProductLine(row);

    const nameFromLine = String(r.product_name ?? r.productName ?? '').trim();
    const product_name = (
      fromCatalog?.commercial_name?.trim() ||
      embedded.name ||
      nameFromLine ||
      (embedded.code ? embedded.code : '') ||
      (fromCatalog?.code?.trim() ? fromCatalog.code : '') ||
      (product_id ? `Product (${product_id.slice(0, 8)}…)` : 'Unknown product')
    ).trim() || 'Unknown product';

    const quantity = Math.max(0, pickQuantityField(row, ['quantity', 'qty', 'Quantity'], 0));

    let unit_price = pickLineMoney(row, [
      'unit_price',
      'unitPrice',
      'UnitPrice',
      'sale_price',
      'list_price',
      'price',
      'unit_price_tz',
      'unitPriceTz'
    ]);
    let total_price = pickLineMoney(row, [
      'total_price',
      'totalPrice',
      'TotalPrice',
      'line_total',
      'line_total_price',
      'line_amount',
      'extended_price',
      'subtotal',
      'amount'
    ]);

    if (unit_price === 0 && total_price > 0 && quantity > 0) {
      unit_price = Math.round((total_price / quantity) * 100) / 100;
    }
    if (total_price === 0 && unit_price > 0 && quantity > 0) {
      total_price = Math.round(quantity * unit_price * 100) / 100;
    }

    if (unit_price === 0 && total_price === 0 && fromCatalog && quantity > 0) {
      const list = toMoneyNumber(fromCatalog.price, 0);
      if (list > 0) {
        unit_price = list;
        total_price = Math.round(quantity * list * 100) / 100;
      }
    }

    return {
      key: (r.id && String(r.id)) || `${product_id || 'line'}-${index}`,
      product_id,
      product_name,
      quantity,
      unit_price,
      total_price
    };
  });

  return inferLineAmountsFromOrderTotal(lines, resolveOrderGrandTotal(order));
}