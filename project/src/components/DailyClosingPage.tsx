import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Banknote,
  Check,
  CircleDollarSign,
  Landmark,
  Plus,
  Receipt,
  RefreshCw,
  Save,
  Trash2,
  WalletCards
} from 'lucide-react';
import type { DailyClosing, Expense, Order } from '../types';
import {
  createExpense,
  deleteExpense,
  getDailyClosingWorkspace,
  getErrorMessage,
  saveDailyClosing,
  type ExpenseInput
} from '../lib/supabase';
import { formatCurrency, formatDate, resolveOrderGrandTotal, toMoneyNumber } from '../utils/stockUtils';
import { normalizeOrderDestination } from '../utils/orderUtils';
import { PageHeader } from './shared/PageLayout';

type DailyClosingPageProps = {
  orders: Order[];
};

const expenseTypes: Array<{ value: ExpenseInput['type']; label: string }> = [
  { value: 'operational', label: 'Operational' },
  { value: 'utilities', label: 'Utilities' },
  { value: 'supplies', label: 'Supplies' },
  { value: 'staff', label: 'Staff' },
  { value: 'other', label: 'Other' }
];

const getTanzaniaDateValue = (value: Date | string) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Africa/Dar_es_Salaam',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;
  return year && month && day ? `${year}-${month}-${day}` : '';
};

const getTodayValue = () => getTanzaniaDateValue(new Date());

const parseAmount = (value: string) => Math.max(0, toMoneyNumber(value, 0));

export const DailyClosingPage: React.FC<DailyClosingPageProps> = ({ orders }) => {
  const [date, setDate] = useState(getTodayValue);
  const [closing, setClosing] = useState<DailyClosing | null>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [cashOnHand, setCashOnHand] = useState('0');
  const [bankDeposit, setBankDeposit] = useState('0');
  const [pettyCash, setPettyCash] = useState('0');
  const [notes, setNotes] = useState('');
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseType, setExpenseType] = useState<ExpenseInput['type']>('operational');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addingExpense, setAddingExpense] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const storeOrders = useMemo(
    () => orders.filter((order) =>
      order.status !== 'cancelled'
      && normalizeOrderDestination(order.order_type) === 'store_to_shop'
      && getTanzaniaDateValue(order.created_at) === date
    ),
    [date, orders]
  );
  const storeSales = useMemo(
    () => storeOrders.reduce((sum, order) => sum + resolveOrderGrandTotal(order), 0),
    [storeOrders]
  );
  const expenseTotal = useMemo(
    () => expenses.reduce((sum, expense) => sum + toMoneyNumber(expense.amount, 0), 0),
    [expenses]
  );
  const expectedCash = Math.max(0, storeSales - expenseTotal);
  const accountedCash = parseAmount(cashOnHand) + parseAmount(bankDeposit) + parseAmount(pettyCash);
  const difference = accountedCash - expectedCash;
  const reconciled = Math.abs(difference) < 0.5;

  const loadWorkspace = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getDailyClosingWorkspace(date);
      setClosing(data.closing);
      setExpenses(data.expenses);
      setCashOnHand(String(data.closing?.cash_on_hand ?? 0));
      setBankDeposit(String(data.closing?.bank_deposit ?? 0));
      setPettyCash(String(data.closing?.petty_cash ?? 0));
      setNotes(data.closing?.notes || '');
    } catch (err) {
      setError(getErrorMessage(err) || 'Could not load the daily closing.');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const handleAddExpense = async (event: React.FormEvent) => {
    event.preventDefault();
    const amount = parseAmount(expenseAmount);
    if (!expenseTitle.trim() || amount <= 0) {
      setError('Enter an expense name and an amount greater than zero.');
      return;
    }

    try {
      setAddingExpense(true);
      setError(null);
      setSuccess(null);
      const expense = await createExpense({
        title: expenseTitle.trim(),
        description: expenseDescription.trim() || null,
        amount,
        type: expenseType,
        date
      });
      setExpenses((current) => [expense, ...current]);
      setExpenseTitle('');
      setExpenseDescription('');
      setExpenseAmount('');
      setSuccess('Expense added to this closing.');
    } catch (err) {
      setError(getErrorMessage(err) || 'Could not save the expense.');
    } finally {
      setAddingExpense(false);
    }
  };

  const handleDeleteExpense = async (expense: Expense) => {
    if (!window.confirm(`Delete expense "${expense.title}"?`)) return;
    try {
      setError(null);
      setSuccess(null);
      await deleteExpense(expense.id);
      setExpenses((current) => current.filter((row) => row.id !== expense.id));
      setSuccess('Expense removed.');
    } catch (err) {
      setError(getErrorMessage(err) || 'Could not delete the expense.');
    }
  };

  const handleSaveClosing = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      const saved = await saveDailyClosing({
        date,
        storeToShopSales: storeSales,
        cashOnHand: parseAmount(cashOnHand),
        bankDeposit: parseAmount(bankDeposit),
        pettyCash: parseAmount(pettyCash),
        difference,
        notes: notes.trim() || null
      });
      setClosing(saved);
      setSuccess(reconciled ? 'Daily closing saved and reconciled.' : 'Daily closing saved with a cash difference.');
    } catch (err) {
      setError(getErrorMessage(err) || 'Could not save the daily closing.');
    } finally {
      setSaving(false);
    }
  };

  const metrics = [
    {
      label: 'Store-to-shop sales',
      value: formatCurrency(storeSales),
      detail: `${storeOrders.length} sale${storeOrders.length === 1 ? '' : 's'}`,
      icon: CircleDollarSign,
      tone: 'bg-emerald-50 text-emerald-700'
    },
    {
      label: 'Expenses',
      value: formatCurrency(expenseTotal),
      detail: `${expenses.length} expense${expenses.length === 1 ? '' : 's'}`,
      icon: Receipt,
      tone: 'bg-rose-50 text-rose-700'
    },
    {
      label: 'Expected after expenses',
      value: formatCurrency(expectedCash),
      detail: 'Sales minus expenses',
      icon: WalletCards,
      tone: 'bg-blue-50 text-blue-700'
    },
    {
      label: 'Cash difference',
      value: formatCurrency(difference),
      detail: reconciled ? 'Balanced' : difference < 0 ? 'Short' : 'Over',
      icon: Banknote,
      tone: reconciled ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
    }
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Daily closing"
        subtitle="Close store-to-shop sales, expenses, and cash for one business day"
        actions={
          <>
            <input
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value);
                setSuccess(null);
              }}
              className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm font-medium text-gray-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
            />
            <button
              type="button"
              onClick={loadWorkspace}
              disabled={loading}
              className="flex h-10 w-10 items-center justify-center rounded-md border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 disabled:text-gray-300"
              title="Refresh closing"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </>
        }
      />

      {(error || success) && (
        <div className={`rounded-md border px-4 py-3 text-sm font-medium ${
          error ? 'border-red-200 bg-red-50 text-red-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'
        }`}>
          {error || success}
        </div>
      )}

      <section className="grid grid-cols-2 overflow-hidden rounded-md border border-gray-200 bg-white lg:grid-cols-4">
        {metrics.map(({ label, value, detail, icon: Icon, tone }, index) => (
          <div key={label} className={`min-w-0 p-4 sm:p-5 ${index % 2 !== 0 ? 'border-l border-gray-200' : ''} ${index > 1 ? 'border-t border-gray-200 lg:border-t-0' : ''} ${index === 2 ? 'lg:border-l' : ''}`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase text-gray-500">{label}</p>
                <p className="mt-1 break-words text-lg font-semibold text-gray-950 sm:text-xl">{value}</p>
                <p className="mt-1 text-xs text-gray-500 sm:text-sm">{detail}</p>
              </div>
              <span className={`hidden h-9 w-9 shrink-0 items-center justify-center rounded-md sm:flex ${tone}`}>
                <Icon className="h-5 w-5" />
              </span>
            </div>
          </div>
        ))}
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.72fr)]">
        <section className="rounded-md border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-4 py-4 sm:px-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold text-gray-950">Cash reconciliation</h2>
                <p className="mt-1 text-sm text-gray-500">Count where the expected cash ended the day.</p>
              </div>
              {closing && (
                <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  closing.is_reconciled ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {closing.is_reconciled ? 'Reconciled' : 'Saved open'}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-5 p-4 sm:p-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-gray-700">Cash on hand</span>
                <input type="number" min="0" step="0.01" value={cashOnHand} onChange={(event) => setCashOnHand(event.target.value)} className="h-11 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-gray-700">Bank deposit</span>
                <input type="number" min="0" step="0.01" value={bankDeposit} onChange={(event) => setBankDeposit(event.target.value)} className="h-11 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-gray-700">Petty cash</span>
                <input type="number" min="0" step="0.01" value={pettyCash} onChange={(event) => setPettyCash(event.target.value)} className="h-11 w-full rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
              </label>
            </div>

            <div className="grid gap-3 rounded-md bg-gray-50 p-4 sm:grid-cols-3">
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">Expected</p>
                <p className="mt-1 font-semibold text-gray-950">{formatCurrency(expectedCash)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">Accounted</p>
                <p className="mt-1 font-semibold text-gray-950">{formatCurrency(accountedCash)}</p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase text-gray-500">Difference</p>
                <p className={`mt-1 font-semibold ${reconciled ? 'text-emerald-700' : 'text-amber-700'}`}>{formatCurrency(difference)}</p>
              </div>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-gray-700">Closing notes</span>
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} placeholder="Optional note about shortages, deposits, or the day" className="w-full resize-none rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
            </label>

            <div className="flex flex-col-reverse gap-2 border-t border-gray-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <button type="button" onClick={() => { setCashOnHand(String(expectedCash)); setBankDeposit('0'); setPettyCash('0'); }} className="flex h-10 items-center justify-center gap-2 rounded-md border border-gray-300 px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                <Check className="h-4 w-4" />
                Use expected cash
              </button>
              <button type="button" onClick={handleSaveClosing} disabled={saving || loading} className="flex h-11 items-center justify-center gap-2 rounded-md bg-gray-950 px-5 text-sm font-semibold text-white hover:bg-gray-800 disabled:bg-gray-400">
                <Save className="h-4 w-4" />
                {saving ? 'Saving...' : closing ? 'Update closing' : 'Save closing'}
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-md border border-gray-200 bg-white">
          <div className="border-b border-gray-200 px-4 py-4 sm:px-5">
            <h2 className="font-semibold text-gray-950">Expenses</h2>
            <p className="mt-1 text-sm text-gray-500">Record money spent during this business day.</p>
          </div>

          <form onSubmit={handleAddExpense} className="space-y-3 border-b border-gray-200 p-4 sm:p-5">
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
              <input value={expenseTitle} onChange={(event) => setExpenseTitle(event.target.value)} placeholder="Expense name" className="h-10 min-w-0 rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
              <select value={expenseType} onChange={(event) => setExpenseType(event.target.value as ExpenseInput['type'])} className="h-10 rounded-md border border-gray-300 bg-white px-3 text-sm outline-none focus:border-emerald-500">
                {expenseTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
              <input value={expenseDescription} onChange={(event) => setExpenseDescription(event.target.value)} placeholder="Description (optional)" className="h-10 min-w-0 rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
              <input type="number" min="0" step="0.01" value={expenseAmount} onChange={(event) => setExpenseAmount(event.target.value)} placeholder="Amount" className="h-10 rounded-md border border-gray-300 px-3 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
            </div>
            <button type="submit" disabled={addingExpense} className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-emerald-600 text-sm font-semibold text-white hover:bg-emerald-700 disabled:bg-gray-400">
              <Plus className="h-4 w-4" />
              {addingExpense ? 'Adding...' : 'Add expense'}
            </button>
          </form>

          <div className="max-h-[28rem] overflow-y-auto">
            {expenses.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <Receipt className="mx-auto h-8 w-8 text-gray-300" />
                <p className="mt-2 text-sm font-medium text-gray-700">No expenses for this date</p>
              </div>
            ) : expenses.map((expense) => (
              <div key={expense.id} className="flex items-start gap-3 border-b border-gray-100 px-4 py-3 last:border-b-0 sm:px-5">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-rose-50 text-rose-700">
                  <Receipt className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-gray-950">{expense.title}</p>
                  <p className="mt-0.5 text-xs capitalize text-gray-500">{expense.type.replace(/_/g, ' ')}</p>
                  {expense.description && <p className="mt-1 text-xs text-gray-500">{expense.description}</p>}
                </div>
                <div className="text-right">
                  <p className="whitespace-nowrap text-sm font-semibold text-gray-950">{formatCurrency(expense.amount)}</p>
                  <button type="button" onClick={() => handleDeleteExpense(expense)} className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-700" title="Delete expense">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="rounded-md border border-gray-200 bg-white">
        <div className="flex flex-col gap-1 border-b border-gray-200 px-4 py-4 sm:px-5">
          <h2 className="font-semibold text-gray-950">Store-to-shop sales included</h2>
          <p className="text-sm text-gray-500">Customer sales are excluded from this daily cash closing.</p>
        </div>
        {storeOrders.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <Landmark className="mx-auto h-8 w-8 text-gray-300" />
            <p className="mt-2 text-sm font-medium text-gray-700">No store-to-shop sales for {formatDate(date)}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {storeOrders.map((order) => (
              <div key={order.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 sm:grid-cols-[160px_minmax(0,1fr)_140px] sm:px-5">
                <p className="text-sm font-semibold text-gray-950">{order.order_number}</p>
                <p className="truncate text-sm text-gray-600">{order.customer_name || 'Store sale'}</p>
                <p className="text-right text-sm font-semibold text-gray-950">{formatCurrency(resolveOrderGrandTotal(order))}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
