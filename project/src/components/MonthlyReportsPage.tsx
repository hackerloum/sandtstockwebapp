import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Banknote,
  CalendarDays,
  CheckCircle,
  Download,
  FileJson,
  Package,
  Receipt,
  RefreshCw,
  ShoppingCart,
  TrendingDown,
  TrendingUp
} from 'lucide-react';
import type { DailyClosing, MonthlyReportData, Order, Product } from '../types';
import { formatCurrency, formatDate, resolveOrderItemsForDisplay, toMoneyNumber } from '../utils/stockUtils';
import { getLatestMonthlyReportMonth, getMonthlyReportData } from '../lib/supabase';
import { PageHeader } from './shared/PageLayout';

type MonthlyReportsPageProps = {
  orders: Order[];
  products: Product[];
};

type MetricCardProps = {
  label: string;
  value: string;
  detail: string;
  icon: React.ElementType;
  tone: 'emerald' | 'blue' | 'rose' | 'amber' | 'slate' | 'violet';
};

const emptyReportData: MonthlyReportData = {
  dailyClosings: [],
  expenses: [],
  monthlyBalanceClosings: [],
  vendorPurchases: [],
  priceOverrides: []
};

const toneClasses: Record<MetricCardProps['tone'], string> = {
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  blue: 'bg-blue-50 text-blue-700 border-blue-200',
  rose: 'bg-rose-50 text-rose-700 border-rose-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  slate: 'bg-slate-50 text-slate-700 border-slate-200',
  violet: 'bg-violet-50 text-violet-700 border-violet-200'
};

const getCurrentMonthValue = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const getMonthBounds = (monthValue: string) => {
  const safeMonthValue = /^\d{4}-\d{2}$/.test(monthValue) ? monthValue : getCurrentMonthValue();
  const [year, month] = safeMonthValue.split('-').map(Number);
  const start = new Date(year, month - 1, 1);
  const next = new Date(year, month, 1);
  const end = new Date(next);
  end.setDate(end.getDate() - 1);
  const toDateOnly = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  return {
    start,
    next,
    end,
    monthStart: toDateOnly(start),
    nextMonthStart: toDateOnly(next),
    label: start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  };
};

const isWithinMonth = (dateValue: string | null | undefined, start: Date, next: Date) => {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  return date >= start && date < next;
};

const sumBy = <T,>(rows: T[], selector: (row: T) => unknown) =>
  rows.reduce((sum, row) => sum + toMoneyNumber(selector(row), 0), 0);

const getDailyClosingTotal = (row: DailyClosing) => {
  const salesTotal = toMoneyNumber(row.box_product_sales, 0) + toMoneyNumber(row.oil_sales, 0);
  if (salesTotal > 0) return salesTotal;

  const cashBreakdownTotal =
    toMoneyNumber(row.cash_on_hand_box, 0) +
    toMoneyNumber(row.cash_on_hand_oil, 0) +
    toMoneyNumber(row.cash_on_hand_perfume, 0);
  if (cashBreakdownTotal > 0) return cashBreakdownTotal;

  return toMoneyNumber(row.cash_on_hand, 0);
};

const csvEscape = (value: unknown) => {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

const downloadTextFile = (filename: string, content: string, mimeType: string) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
};

const MetricCard: React.FC<MetricCardProps> = ({ label, value, detail, icon: Icon, tone }) => (
  <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase text-gray-500">{label}</p>
        <p className="mt-2 text-2xl font-semibold text-gray-900 break-words">{value}</p>
        <p className="mt-1 text-sm text-gray-500">{detail}</p>
      </div>
      <div className={`shrink-0 rounded-lg border p-2 ${toneClasses[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
    </div>
  </div>
);

export const MonthlyReportsPage: React.FC<MonthlyReportsPageProps> = ({ orders, products }) => {
  const [monthValue, setMonthValue] = useState(getCurrentMonthValue);
  const [reportData, setReportData] = useState<MonthlyReportData>(emptyReportData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const month = useMemo(() => getMonthBounds(monthValue), [monthValue]);

  useEffect(() => {
    let isActive = true;

    getLatestMonthlyReportMonth()
      .then((latestMonth) => {
        if (isActive && latestMonth) {
          setMonthValue(latestMonth);
        }
      })
      .catch((err) => {
        console.error('Latest monthly report month lookup failed:', err);
      });

    return () => {
      isActive = false;
    };
  }, []);

  const loadReport = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getMonthlyReportData(month.monthStart, month.nextMonthStart);
      setReportData(data);
    } catch (err) {
      console.error('Monthly report load failed:', err);
      setError(err instanceof Error ? err.message : 'Failed to load monthly report data');
      setReportData(emptyReportData);
    } finally {
      setLoading(false);
    }
  }, [month.monthStart, month.nextMonthStart]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const monthlyOrders = useMemo(
    () =>
      orders.filter((order) =>
        order.status !== 'cancelled' && isWithinMonth(order.created_at, month.start, month.next)
      ),
    [orders, month.start, month.next]
  );

  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  const analytics = useMemo(() => {
    const totalOrderRevenue = sumBy(monthlyOrders, (order) => order.total_amount);
    const dailyClosingSales = sumBy(reportData.dailyClosings, getDailyClosingTotal);
    const totalExpenses = sumBy(reportData.expenses, (expense) => expense.amount);
    const approvedExpenses = sumBy(
      reportData.expenses.filter((expense) => expense.is_approved),
      (expense) => expense.amount
    );
    const payrollExpenses = sumBy(
      reportData.expenses.filter((expense) => expense.is_payroll),
      (expense) => expense.amount
    );
    const vendorSpend = sumBy(reportData.vendorPurchases, (purchase) => purchase.amount);
    const cashOnHand = sumBy(reportData.dailyClosings, (row) => row.cash_on_hand);
    const cashBox = sumBy(reportData.dailyClosings, (row) => row.cash_on_hand_box);
    const cashOil = sumBy(reportData.dailyClosings, (row) => row.cash_on_hand_oil);
    const cashPerfume = sumBy(reportData.dailyClosings, (row) => row.cash_on_hand_perfume);
    const bankDeposits = sumBy(reportData.dailyClosings, (row) => row.bank_deposit);
    const pettyCash = sumBy(reportData.dailyClosings, (row) => row.petty_cash);
    const closingTotal = cashOnHand + bankDeposits + pettyCash;
    const netAfterCosts = dailyClosingSales - totalExpenses - vendorSpend;
    const latestMonthlyClosing = reportData.monthlyBalanceClosings[reportData.monthlyBalanceClosings.length - 1] || null;

    const expensesByType = Object.entries(
      reportData.expenses.reduce<Record<string, { count: number; total: number }>>((acc, expense) => {
        const key = expense.type || 'other';
        if (!acc[key]) acc[key] = { count: 0, total: 0 };
        acc[key].count += 1;
        acc[key].total += toMoneyNumber(expense.amount, 0);
        return acc;
      }, {})
    )
      .map(([type, stats]) => ({ type, ...stats }))
      .sort((a, b) => b.total - a.total);

    const orderTypeStats = Object.entries(
      monthlyOrders.reduce<Record<string, { count: number; total: number }>>((acc, order) => {
        const key = order.order_type || 'standard';
        if (!acc[key]) acc[key] = { count: 0, total: 0 };
        acc[key].count += 1;
        acc[key].total += toMoneyNumber(order.total_amount, 0);
        return acc;
      }, {})
    )
      .map(([type, stats]) => ({ type, ...stats }))
      .sort((a, b) => b.total - a.total);

    const orderStatusStats = Object.entries(
      monthlyOrders.reduce<Record<string, { count: number; total: number }>>((acc, order) => {
        const key = order.status || 'unknown';
        if (!acc[key]) acc[key] = { count: 0, total: 0 };
        acc[key].count += 1;
        acc[key].total += toMoneyNumber(order.total_amount, 0);
        return acc;
      }, {})
    )
      .map(([status, stats]) => ({ status, ...stats }))
      .sort((a, b) => b.total - a.total);

    const productSales = new Map<string, { name: string; code: string; quantity: number; revenue: number }>();
    monthlyOrders.forEach((order) => {
      resolveOrderItemsForDisplay(order, products).forEach((item) => {
        const product = productById.get(item.product_id);
        const key = item.product_id || item.product_name;
        const current = productSales.get(key) || {
          name: product?.commercial_name || item.product_name,
          code: product?.code || '',
          quantity: 0,
          revenue: 0
        };
        current.quantity += toMoneyNumber(item.quantity, 0);
        current.revenue += toMoneyNumber(item.total_price, 0);
        productSales.set(key, current);
      });
    });

    const topProducts = Array.from(productSales.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);

    return {
      totalOrderRevenue,
      dailyClosingSales,
      totalExpenses,
      approvedExpenses,
      payrollExpenses,
      vendorSpend,
      cashOnHand,
      cashBox,
      cashOil,
      cashPerfume,
      bankDeposits,
      pettyCash,
      closingTotal,
      netAfterCosts,
      latestMonthlyClosing,
      expensesByType,
      orderTypeStats,
      orderStatusStats,
      topProducts,
      unreconciledClosings: reportData.dailyClosings.filter((row) => !row.is_reconciled).length,
      approvedExpenseCount: reportData.expenses.filter((expense) => expense.is_approved).length
    };
  }, [monthlyOrders, products, productById, reportData]);

  const exportJson = () => {
    downloadTextFile(
      `monthly-report-${monthValue}.json`,
      JSON.stringify({ month: month.label, analytics, reportData, orders: monthlyOrders }, null, 2),
      'application/json;charset=utf-8'
    );
  };

  const exportCsv = () => {
    const lines = [
      ['Section', 'Date', 'Name', 'Type', 'Amount', 'Notes'].map(csvEscape).join(','),
      ...reportData.dailyClosings.map((row) =>
        [
          'Daily closing',
          row.date,
          'Closing',
          row.is_reconciled ? 'reconciled' : 'open',
          getDailyClosingTotal(row),
          row.notes || ''
        ].map(csvEscape).join(',')
      ),
      ...reportData.expenses.map((expense) =>
        ['Expense', expense.date, expense.title, expense.type, expense.amount, expense.description || '']
          .map(csvEscape)
          .join(',')
      ),
      ...reportData.vendorPurchases.map((purchase) =>
        [
          'Vendor purchase',
          purchase.purchase_date,
          purchase.vendor_name,
          purchase.invoice_reference || '',
          purchase.amount,
          purchase.notes || ''
        ].map(csvEscape).join(',')
      ),
      ...monthlyOrders.map((order) =>
        ['Order', order.created_at, order.order_number, order.status, order.total_amount, order.customer_name]
          .map(csvEscape)
          .join(',')
      )
    ];
    downloadTextFile(`monthly-report-${monthValue}.csv`, lines.join('\n'), 'text/csv;charset=utf-8');
  };

  const largestExpenseTotal = Math.max(1, ...analytics.expensesByType.map((row) => row.total));

  return (
    <div className="space-y-5">
      <PageHeader
        title="Monthly reports"
        subtitle={`${month.label} financial summary from daily closings, expenses, vendor purchases, and sales`}
        actions={
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative">
            <CalendarDays className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="month"
              value={monthValue}
              onChange={(event) => setMonthValue(event.target.value)}
              className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 sm:w-44"
            />
          </div>
          <button
            onClick={loadReport}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-gray-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={exportCsv}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
          >
            <Download className="h-4 w-4" />
            CSV
          </button>
          <button
            onClick={exportJson}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            <FileJson className="h-4 w-4" />
            JSON
          </button>
        </div>
        }
      />

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            <span className="font-medium">{error}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Daily closing cash"
          value={formatCurrency(analytics.dailyClosingSales)}
          detail={`${reportData.dailyClosings.length} closing records`}
          icon={Banknote}
          tone="emerald"
        />
        <MetricCard
          label="Order revenue"
          value={formatCurrency(analytics.totalOrderRevenue)}
          detail={`${monthlyOrders.length} non-cancelled orders`}
          icon={ShoppingCart}
          tone="blue"
        />
        <MetricCard
          label="Expenses"
          value={formatCurrency(analytics.totalExpenses)}
          detail={`${analytics.approvedExpenseCount}/${reportData.expenses.length} approved`}
          icon={Receipt}
          tone="rose"
        />
        <MetricCard
          label="Net after costs"
          value={formatCurrency(analytics.netAfterCosts)}
          detail={`Minus expenses and vendor purchases`}
          icon={analytics.netAfterCosts >= 0 ? TrendingUp : TrendingDown}
          tone={analytics.netAfterCosts >= 0 ? 'emerald' : 'amber'}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Vendor purchases"
          value={formatCurrency(analytics.vendorSpend)}
          detail={`${reportData.vendorPurchases.length} purchase records`}
          icon={Package}
          tone="violet"
        />
        <MetricCard
          label="Cash and deposits"
          value={formatCurrency(analytics.closingTotal)}
          detail={`Cash ${formatCurrency(analytics.cashOnHand)} | Bank ${formatCurrency(analytics.bankDeposits)}`}
          icon={Banknote}
          tone="slate"
        />
        <MetricCard
          label="Payroll"
          value={formatCurrency(analytics.payrollExpenses)}
          detail={`${reportData.expenses.filter((expense) => expense.is_payroll).length} payroll expenses`}
          icon={Receipt}
          tone="amber"
        />
        <MetricCard
          label="Reconciliation"
          value={`${reportData.dailyClosings.length - analytics.unreconciledClosings}/${reportData.dailyClosings.length}`}
          detail={`${analytics.unreconciledClosings} daily closings open`}
          icon={analytics.unreconciledClosings === 0 ? CheckCircle : AlertCircle}
          tone={analytics.unreconciledClosings === 0 ? 'emerald' : 'amber'}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4 lg:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-semibold text-gray-900">Cash Breakdown</h3>
            <span className="text-sm text-gray-500">{month.monthStart} to {formatDate(month.end)}</span>
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ['Box cash', analytics.cashBox],
              ['Oil cash', analytics.cashOil],
              ['Perfume cash', analytics.cashPerfume],
              ['Legacy cash on hand', analytics.cashOnHand],
              ['Bank deposits', analytics.bankDeposits],
              ['Petty cash', analytics.pettyCash]
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-md bg-gray-50 p-3">
                <p className="text-xs font-medium uppercase text-gray-500">{label}</p>
                <p className="mt-1 text-lg font-semibold text-gray-900">{formatCurrency(value)}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <h3 className="text-base font-semibold text-gray-900">Monthly Closing</h3>
          {analytics.latestMonthlyClosing ? (
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">Opening total</span>
                <span className="font-medium text-gray-900">{formatCurrency(analytics.latestMonthlyClosing.opening_total)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">Closing total</span>
                <span className="font-medium text-gray-900">{formatCurrency(analytics.latestMonthlyClosing.closing_total)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">Closing box</span>
                <span className="font-medium text-gray-900">{formatCurrency(analytics.latestMonthlyClosing.closing_box)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">Closing oil</span>
                <span className="font-medium text-gray-900">{formatCurrency(analytics.latestMonthlyClosing.closing_oil)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-500">Closing perfume</span>
                <span className="font-medium text-gray-900">{formatCurrency(analytics.latestMonthlyClosing.closing_perfume)}</span>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-gray-500">No monthly balance closing recorded for this month.</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <h3 className="text-base font-semibold text-gray-900">Expenses By Type</h3>
          <div className="mt-4 space-y-3">
            {analytics.expensesByType.length > 0 ? (
              analytics.expensesByType.map((row) => (
                <div key={row.type}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium capitalize text-gray-700">{row.type.replace(/_/g, ' ')}</span>
                    <span className="text-gray-900">{formatCurrency(row.total)} ({row.count})</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-gray-100">
                    <div
                      className="h-2 rounded-full bg-rose-500"
                      style={{ width: `${Math.max(5, (row.total / largestExpenseTotal) * 100)}%` }}
                    />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No expenses recorded for this month.</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <h3 className="text-base font-semibold text-gray-900">Sales Breakdown</h3>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <p className="text-xs font-medium uppercase text-gray-500">By order type</p>
              <div className="mt-2 space-y-2">
                {analytics.orderTypeStats.length > 0 ? analytics.orderTypeStats.map((row) => (
                  <div key={row.type} className="flex justify-between gap-3 text-sm">
                    <span className="capitalize text-gray-600">{row.type.replace(/-/g, ' ')}</span>
                    <span className="font-medium text-gray-900">{formatCurrency(row.total)}</span>
                  </div>
                )) : <p className="text-sm text-gray-500">No orders.</p>}
              </div>
            </div>
            <div>
              <p className="text-xs font-medium uppercase text-gray-500">By status</p>
              <div className="mt-2 space-y-2">
                {analytics.orderStatusStats.length > 0 ? analytics.orderStatusStats.map((row) => (
                  <div key={row.status} className="flex justify-between gap-3 text-sm">
                    <span className="capitalize text-gray-600">{row.status.replace(/-/g, ' ')}</span>
                    <span className="font-medium text-gray-900">{row.count}</span>
                  </div>
                )) : <p className="text-sm text-gray-500">No orders.</p>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="border-b border-gray-200 p-4">
          <h3 className="text-base font-semibold text-gray-900">Daily Closing Detail</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {['Date', 'Box cash', 'Oil cash', 'Perfume cash', 'Cash total', 'Bank', 'Petty cash', 'Status', 'Notes'].map((heading) => (
                  <th key={heading} className="px-4 py-3 text-left font-medium text-gray-500">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {reportData.dailyClosings.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 font-medium text-gray-900">{formatDate(row.date)}</td>
                  <td className="px-4 py-3 text-gray-700">{formatCurrency(row.cash_on_hand_box)}</td>
                  <td className="px-4 py-3 text-gray-700">{formatCurrency(row.cash_on_hand_oil)}</td>
                  <td className="px-4 py-3 text-gray-700">{formatCurrency(row.cash_on_hand_perfume)}</td>
                  <td className="px-4 py-3 text-gray-700">{formatCurrency(getDailyClosingTotal(row))}</td>
                  <td className="px-4 py-3 text-gray-700">{formatCurrency(row.bank_deposit)}</td>
                  <td className="px-4 py-3 text-gray-700">{formatCurrency(row.petty_cash)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${row.is_reconciled ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                      {row.is_reconciled ? 'Reconciled' : 'Open'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{row.notes || '-'}</td>
                </tr>
              ))}
              {reportData.dailyClosings.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-gray-500">No daily closings found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="border-b border-gray-200 p-4">
            <h3 className="text-base font-semibold text-gray-900">Expense Detail</h3>
          </div>
          <div className="max-h-96 overflow-auto">
            {reportData.expenses.length > 0 ? reportData.expenses.map((expense) => (
              <div key={expense.id} className="border-b border-gray-100 p-4 last:border-b-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">{expense.title}</p>
                    <p className="mt-1 text-sm text-gray-500">
                      {formatDate(expense.date)} | {expense.type.replace(/_/g, ' ')}
                    </p>
                    {expense.description && <p className="mt-1 text-sm text-gray-500">{expense.description}</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{formatCurrency(expense.amount)}</p>
                    <p className={`mt-1 text-xs font-medium ${expense.is_approved ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {expense.is_approved ? 'Approved' : 'Pending'}
                    </p>
                  </div>
                </div>
              </div>
            )) : (
              <p className="p-6 text-center text-sm text-gray-500">No expenses found.</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="border-b border-gray-200 p-4">
            <h3 className="text-base font-semibold text-gray-900">Vendor Purchases</h3>
          </div>
          <div className="max-h-96 overflow-auto">
            {reportData.vendorPurchases.length > 0 ? reportData.vendorPurchases.map((purchase) => (
              <div key={purchase.id} className="border-b border-gray-100 p-4 last:border-b-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900">{purchase.vendor_name}</p>
                    <p className="mt-1 text-sm text-gray-500">
                      {formatDate(purchase.purchase_date)}
                      {purchase.invoice_reference ? ` | ${purchase.invoice_reference}` : ''}
                    </p>
                    {purchase.notes && <p className="mt-1 text-sm text-gray-500">{purchase.notes}</p>}
                  </div>
                  <p className="font-semibold text-gray-900">{formatCurrency(purchase.amount)}</p>
                </div>
              </div>
            )) : (
              <p className="p-6 text-center text-sm text-gray-500">No vendor purchases found.</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <h3 className="text-base font-semibold text-gray-900">Top Products This Month</h3>
          <div className="mt-4 space-y-3">
            {analytics.topProducts.length > 0 ? analytics.topProducts.map((product, index) => (
              <div key={`${product.code}-${product.name}`} className="flex items-center justify-between gap-3 rounded-md bg-gray-50 p-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">{product.name}</p>
                    <p className="text-xs text-gray-500">{product.quantity} units {product.code ? `| ${product.code}` : ''}</p>
                  </div>
                </div>
                <p className="shrink-0 text-sm font-semibold text-gray-900">{formatCurrency(product.revenue)}</p>
              </div>
            )) : (
              <p className="text-sm text-gray-500">No sold products found for this month.</p>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-4">
          <h3 className="text-base font-semibold text-gray-900">Price Override Detail</h3>
          <div className="mt-4 max-h-80 space-y-3 overflow-auto">
            {reportData.priceOverrides.length > 0 ? reportData.priceOverrides.map((override) => {
              const product = productById.get(override.product_id);
              return (
                <div key={override.id} className="rounded-md bg-gray-50 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-gray-900">{product?.commercial_name || 'Unknown product'}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {override.applied_at ? formatDate(override.applied_at) : 'No date'} | {override.customer_phone}
                      </p>
                      {override.reason && <p className="mt-1 text-xs text-gray-500">{override.reason}</p>}
                    </div>
                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(override.custom_price)}</p>
                  </div>
                </div>
              );
            }) : (
              <p className="text-sm text-gray-500">No price overrides found for this month.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
