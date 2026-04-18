import { Database } from '../types/supabase';
import type { StockMovement } from '../types';

type Product = Database['public']['Tables']['products']['Row'];

/** Timeline bucket for dates (e.g. updated_at or movement performed_at): today, yesterday, last_week, or older */
export type UpdatedTimeline = 'today' | 'yesterday' | 'last_week' | 'older';

/** Per-product movement analytics (outs for demand; ins + outs for “how busy” the SKU is). */
export type ProductMovementAnalytics = {
  productId: string;
  /** Out movements in today + yesterday + last_week */
  recentOutMovements: number;
  recentQtyOut: number;
  /** In movements in that same recent window */
  recentInMovements: number;
  /** All movement rows (in + out) in the recent window */
  recentTotalMovements: number;
  /** All movement rows all-time */
  totalMovementsAll: number;
  timelineBreakdown: Record<
    UpdatedTimeline,
    { movements: number; qty: number }
  >;
  totalOutMovements: number;
  totalQtyOut: number;
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
  recentOutMovements: 0,
  recentQtyOut: 0,
  recentInMovements: 0,
  recentTotalMovements: 0,
  totalMovementsAll: 0,
  timelineBreakdown: emptyTimelineBreakdown(),
  totalOutMovements: 0,
  totalQtyOut: 0
});

/**
 * Aggregates stock movements per product: outbound timeline buckets plus recent in/out counts.
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
    const isRecent = timeline !== 'older';
    const qty = Number(m.quantity) || 0;

    row.totalMovementsAll += 1;
    if (isRecent) {
      row.recentTotalMovements += 1;
      if (m.movement_type === 'in') {
        row.recentInMovements += 1;
      }
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
    row.recentOutMovements =
      b.today.movements + b.yesterday.movements + b.last_week.movements;
    row.recentQtyOut = b.today.qty + b.yesterday.qty + b.last_week.qty;
  }

  return map;
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
};

const sortOrderNow = (
  a: { analytics: ProductMovementAnalytics },
  b: { analytics: ProductMovementAnalytics }
) => {
  if (b.analytics.recentQtyOut !== a.analytics.recentQtyOut) {
    return b.analytics.recentQtyOut - a.analytics.recentQtyOut;
  }
  return b.analytics.recentOutMovements - a.analytics.recentOutMovements;
};

const sortPrioritize = (
  a: { analytics: ProductMovementAnalytics },
  b: { analytics: ProductMovementAnalytics }
) => {
  if (b.analytics.recentOutMovements !== a.analytics.recentOutMovements) {
    return b.analytics.recentOutMovements - a.analytics.recentOutMovements;
  }
  if (b.analytics.recentQtyOut !== a.analytics.recentQtyOut) {
    return b.analytics.recentQtyOut - a.analytics.recentQtyOut;
  }
  return b.analytics.recentTotalMovements - a.analytics.recentTotalMovements;
};

function shouldPrioritizeReorder(
  product: Pick<Product, 'current_stock' | 'min_stock'>,
  a: ProductMovementAnalytics
): boolean {
  if (product.current_stock <= 0) return false;
  if (a.recentOutMovements > 0) return true;
  if (a.recentTotalMovements >= 4) return true;
  if (
    product.current_stock > 0 &&
    product.current_stock <= product.min_stock &&
    a.totalOutMovements > 0
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
    return 'Out of stock with recent stock-outs — replenish urgently.';
  }
  if (bucket === 'prioritize_reorder') {
    if (a.recentOutMovements > 0) {
      return 'Recent sales activity — plan a purchase order before you run out.';
    }
    if (a.recentTotalMovements >= 4) {
      return 'High movement (stock in/out) in the last 7 days — keep an eye on levels.';
    }
    if (product.current_stock <= product.min_stock && a.totalOutMovements > 0) {
      return 'Below minimum with past sales — consider reordering.';
    }
    return 'Eligible for planned reorder.';
  }
  if (a.recentTotalMovements === 0 && a.totalMovementsAll === 0) {
    return 'At zero with no movement history — confirm the SKU is active before ordering.';
  }
  if (a.recentTotalMovements === 0) {
    return 'At zero with no activity in the last 7 days — stale listing; confirm demand before ordering.';
  }
  if (a.recentOutMovements === 0 && a.recentTotalMovements > 0) {
    return 'At zero with no recent sales outs — do not auto-order; check transfers, adjustments, or demand.';
  }
  return 'At zero with no recent stock-outs — verify demand or discontinuation before restocking.';
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
  options?: { limitPerBucket?: number }
): {
  orderNow: ReorderEngineRow<P>[];
  prioritizeReorder: ReorderEngineRow<P>[];
  reviewBeforeOrder: ReorderEngineRow<P>[];
} => {
  const limit = options?.limitPerBucket ?? 8;
  const analyticsMap = computeProductMovementAnalytics(movements);

  const orderNow: ReorderEngineRow<P>[] = [];
  const prioritizeReorder: ReorderEngineRow<P>[] = [];
  const reviewBeforeOrder: ReorderEngineRow<P>[] = [];

  for (const product of products) {
    const a = analyticsMap.get(product.id) ?? emptyMovementAnalytics(product.id);
    const oos = product.current_stock <= 0;

    if (oos && a.recentOutMovements > 0) {
      orderNow.push({
        product,
        analytics: a,
        bucket: 'order_now',
        suggestPurchaseOrder: true,
        rationale: buildRationale('order_now', a, product)
      });
    } else if (oos && a.recentOutMovements === 0) {
      reviewBeforeOrder.push({
        product,
        analytics: a,
        bucket: 'review_before_order',
        suggestPurchaseOrder: false,
        rationale: buildRationale('review_before_order', a, product)
      });
    } else if (!oos && shouldPrioritizeReorder(product, a)) {
      prioritizeReorder.push({
        product,
        analytics: a,
        bucket: 'prioritize_reorder',
        suggestPurchaseOrder: true,
        rationale: buildRationale('prioritize_reorder', a, product)
      });
    }
  }

  orderNow.sort(sortOrderNow);
  prioritizeReorder.sort(sortPrioritize);
  reviewBeforeOrder.sort((x, y) => {
    const az = x.analytics.recentTotalMovements + x.analytics.totalMovementsAll;
    const bz = y.analytics.recentTotalMovements + y.analytics.totalMovementsAll;
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
  limit = 5
): Array<{ product: P; stats: ProductMovementAnalytics }> => {
  const velocity = computeProductMovementAnalytics(movements);

  return [...products]
    .map((product) => {
      const stats = velocity.get(product.id) ?? emptyMovementAnalytics(product.id);
      return { product, stats };
    })
    .filter(({ stats }) => stats.totalOutMovements > 0)
    .filter(({ product }) => product.current_stock > 0)
    .sort((a, b) => {
      if (b.stats.recentOutMovements !== a.stats.recentOutMovements) {
        return b.stats.recentOutMovements - a.stats.recentOutMovements;
      }
      if (b.stats.recentQtyOut !== a.stats.recentQtyOut) {
        return b.stats.recentQtyOut - a.stats.recentQtyOut;
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

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: 'TZS'
  }).format(amount);
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

export const calculateReorderQuantity = (product: Product) => {
  const targetStock = Math.ceil((product.max_stock + product.min_stock) / 2);
  return Math.max(0, targetStock - product.current_stock);
};

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