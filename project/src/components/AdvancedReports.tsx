import React, { useMemo, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import { Order, Product, PurchaseOrder, StockMovement } from '../types';
import { formatCurrency, formatDate } from '../utils/stockUtils';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './shared/Button';
import { Select } from './shared/Form';
import { EmptyState, PageHeader } from './shared/PageLayout';

interface AdvancedReportsProps {
  products: Product[];
  orders: Order[];
  movements: StockMovement[];
  purchaseOrders: PurchaseOrder[];
}

type ReportType = 'overview' | 'inventory' | 'sales' | 'purchase' | 'movement';

const reportTabs: Array<{ id: ReportType; label: string }> = [
  { id: 'overview', label: 'Overview' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'sales', label: 'Sales' },
  { id: 'purchase', label: 'Purchasing' },
  { id: 'movement', label: 'Movements' }
];

const escapeCsv = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;

export const AdvancedReports: React.FC<AdvancedReportsProps> = ({ products, orders, movements, purchaseOrders }) => {
  const { hasPermission } = useAuth();
  const [days, setDays] = useState('30');
  const [reportType, setReportType] = useState<ReportType>('overview');

  const data = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - Number(days));
    const filteredOrders = orders.filter((order) => new Date(order.created_at) >= start && order.status !== 'cancelled');
    const filteredMovements = movements.filter((movement) => new Date(movement.performed_at) >= start);
    const filteredPOs = purchaseOrders.filter((po) => new Date(po.order_date) >= start);
    const soldItems = filteredOrders.flatMap((order) => order.items || []);
    const salesByProduct = new Map<string, { name: string; quantity: number; revenue: number }>();
    soldItems.forEach((item) => {
      const product = products.find((candidate) => candidate.id === item.product_id);
      const current = salesByProduct.get(item.product_id) || {
        name: item.product_name || product?.commercial_name || 'Unknown product',
        quantity: 0,
        revenue: 0
      };
      current.quantity += Number(item.quantity) || 0;
      current.revenue += Number(item.total_price) || 0;
      salesByProduct.set(item.product_id, current);
    });
    return {
      start,
      orders: filteredOrders,
      movements: filteredMovements,
      purchaseOrders: filteredPOs,
      revenue: filteredOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0),
      inventoryValue: products.reduce((sum, product) => sum + product.current_stock * product.price, 0),
      stockIn: filteredMovements.filter((movement) => movement.movement_type === 'in').reduce((sum, movement) => sum + movement.quantity, 0),
      stockOut: filteredMovements.filter((movement) => movement.movement_type === 'out').reduce((sum, movement) => sum + movement.quantity, 0),
      lowStock: products.filter((product) => product.current_stock <= product.reorder_point).sort((a, b) => a.current_stock - b.current_stock),
      topProducts: [...salesByProduct.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 10)
    };
  }, [days, movements, orders, products, purchaseOrders]);

  const downloadCsv = () => {
    let rows: unknown[][] = [];
    if (reportType === 'inventory' || reportType === 'overview') {
      rows = [['Product', 'Code', 'Category', 'Stock', 'Reorder point', 'Price', 'Stock value'], ...products.map((product) => [product.commercial_name, product.code, product.category, product.current_stock, product.reorder_point, product.price, product.current_stock * product.price])];
    } else if (reportType === 'sales') {
      rows = [['Order', 'Customer', 'Date', 'Status', 'Total'], ...data.orders.map((order) => [order.order_number, order.customer_name, order.created_at, order.status, order.total_amount])];
    } else if (reportType === 'purchase') {
      rows = [['PO', 'Supplier', 'Date', 'Status', 'Total'], ...data.purchaseOrders.map((po) => [po.po_number, po.supplier_name, po.order_date, po.status, po.total_amount])];
    } else {
      rows = [['Date', 'Product', 'Type', 'Quantity', 'Reason'], ...data.movements.map((movement) => [movement.performed_at, products.find((product) => product.id === movement.product_id)?.commercial_name, movement.movement_type, movement.quantity, movement.reason])];
    }
    const csv = rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${reportType}-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!hasPermission('view_reports')) {
    return <EmptyState icon={<FileText className="h-10 w-10" />} title="Access denied" description="You do not have permission to view reports." />;
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports"
        subtitle={`Showing activity since ${formatDate(data.start)}`}
        actions={<div className="flex items-center gap-2"><Select value={days} onChange={(event) => setDays(event.target.value)} aria-label="Report period" options={[{ value: '7', label: 'Last 7 days' }, { value: '30', label: 'Last 30 days' }, { value: '90', label: 'Last 90 days' }, { value: '365', label: 'Last year' }]} /><Button variant="outline" onClick={downloadCsv} icon={<Download className="h-4 w-4" />}>CSV</Button></div>}
      />

      <div className="overflow-x-auto border-b border-gray-200">
        <div className="flex min-w-max gap-1" role="tablist" aria-label="Report type">
          {reportTabs.map((tab) => <button key={tab.id} type="button" role="tab" aria-selected={reportType === tab.id} onClick={() => setReportType(tab.id)} className={`border-b-2 px-4 py-3 text-sm font-medium ${reportType === tab.id ? 'border-emerald-700 text-emerald-800' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>{tab.label}</button>)}
        </div>
      </div>

      <section className="overflow-hidden rounded-md border border-gray-200 bg-white">
        <div className="grid grid-cols-2 divide-x divide-y divide-gray-200 lg:grid-cols-4 lg:divide-y-0">
          {[
            ['Sales', formatCurrency(data.revenue), `${data.orders.length} orders`],
            ['Inventory value', formatCurrency(data.inventoryValue), `${products.length} products`],
            ['Low stock', data.lowStock.length, 'At or below reorder point'],
            ['Stock activity', `${data.stockIn} in / ${data.stockOut} out`, `${data.movements.length} movements`]
          ].map(([label, value, hint]) => <div key={String(label)} className="min-w-0 p-4 sm:p-5"><p className="text-xs font-medium text-gray-500">{label}</p><p className="mt-1 truncate text-lg font-semibold text-gray-900 sm:text-xl">{value}</p><p className="mt-1 truncate text-xs text-gray-500">{hint}</p></div>)}
        </div>
      </section>

      {reportType === 'overview' && <OverviewReport topProducts={data.topProducts} lowStock={data.lowStock} />}
      {reportType === 'inventory' && <InventoryReport products={products} />}
      {reportType === 'sales' && <SalesReport orders={data.orders} />}
      {reportType === 'purchase' && <PurchasingReport purchaseOrders={data.purchaseOrders} />}
      {reportType === 'movement' && <MovementReport movements={data.movements} products={products} />}
    </div>
  );
};

const ReportSection: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
  <section className="overflow-hidden rounded-md border border-gray-200 bg-white">
    <header className="border-b border-gray-200 px-4 py-3"><h2 className="font-semibold text-gray-900">{title}</h2>{subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}</header>
    {children}
  </section>
);

const OverviewReport: React.FC<{ topProducts: Array<{ name: string; quantity: number; revenue: number }>; lowStock: Product[] }> = ({ topProducts, lowStock }) => (
  <div className="grid gap-5 lg:grid-cols-2">
    <ReportSection title="Top products" subtitle="Ranked by sales value">
      {topProducts.length === 0 ? <EmptyState title="No product sales in this period" /> : <div className="divide-y divide-gray-200">{topProducts.map((product, index) => <div key={`${product.name}-${index}`} className="flex items-center justify-between gap-4 px-4 py-3 text-sm"><div className="min-w-0"><p className="truncate font-medium text-gray-900">{product.name}</p><p className="text-xs text-gray-500">{product.quantity} units</p></div><span className="whitespace-nowrap font-semibold text-gray-900">{formatCurrency(product.revenue)}</span></div>)}</div>}
    </ReportSection>
    <ReportSection title="Stock attention" subtitle="Products at or below their reorder point">
      {lowStock.length === 0 ? <EmptyState title="Stock levels look healthy" /> : <div className="divide-y divide-gray-200">{lowStock.slice(0, 10).map((product) => <div key={product.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm"><div className="min-w-0"><p className="truncate font-medium text-gray-900">{product.commercial_name}</p><p className="text-xs text-gray-500">{product.code}</p></div><span className={product.current_stock === 0 ? 'font-semibold text-red-700' : 'font-semibold text-amber-700'}>{product.current_stock} units</span></div>)}</div>}
    </ReportSection>
  </div>
);

const InventoryReport: React.FC<{ products: Product[] }> = ({ products }) => (
  <ReportSection title="Inventory report" subtitle={`${products.length} products`}>
    <ResponsiveTable headers={['Product', 'Category', 'Stock', 'Reorder at', 'Value']} rows={products.map((product) => [<span><span className="block font-medium text-gray-900">{product.commercial_name}</span><span className="text-xs text-gray-500">{product.code}</span></span>, product.category, product.current_stock, product.reorder_point, formatCurrency(product.current_stock * product.price)])} />
  </ReportSection>
);

const SalesReport: React.FC<{ orders: Order[] }> = ({ orders }) => (
  <ReportSection title="Sales report" subtitle={`${orders.length} orders`}>
    {orders.length === 0 ? <EmptyState title="No sales in this period" /> : <ResponsiveTable headers={['Order', 'Customer', 'Date', 'Status', 'Total']} rows={orders.map((order) => [order.order_number, order.customer_name, formatDate(order.created_at), <span className="capitalize">{order.status}</span>, formatCurrency(order.total_amount)])} />}
  </ReportSection>
);

const PurchasingReport: React.FC<{ purchaseOrders: PurchaseOrder[] }> = ({ purchaseOrders }) => (
  <ReportSection title="Purchasing report" subtitle={`${purchaseOrders.length} purchase orders`}>
    {purchaseOrders.length === 0 ? <EmptyState title="No purchase orders in this period" /> : <ResponsiveTable headers={['PO', 'Supplier', 'Date', 'Status', 'Total']} rows={purchaseOrders.map((po) => [po.po_number, po.supplier_name || 'Unknown supplier', formatDate(po.order_date), <span className="capitalize">{po.status}</span>, formatCurrency(po.total_amount)])} />}
  </ReportSection>
);

const MovementReport: React.FC<{ movements: StockMovement[]; products: Product[] }> = ({ movements, products }) => (
  <ReportSection title="Stock movement report" subtitle={`${movements.length} movements`}>
    {movements.length === 0 ? <EmptyState title="No stock movements in this period" /> : <ResponsiveTable headers={['Date', 'Product', 'Type', 'Quantity', 'Reason']} rows={movements.map((movement) => [formatDate(movement.performed_at), products.find((product) => product.id === movement.product_id)?.commercial_name || 'Unknown product', <span className={movement.movement_type === 'in' ? 'font-medium text-emerald-700' : 'font-medium text-red-700'}>{movement.movement_type === 'in' ? 'Stock in' : 'Stock out'}</span>, movement.quantity, movement.reason])} />}
  </ReportSection>
);

const ResponsiveTable: React.FC<{ headers: string[]; rows: React.ReactNode[][] }> = ({ headers, rows }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full divide-y divide-gray-200 text-sm">
      <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500"><tr>{headers.map((header) => <th key={header} className="whitespace-nowrap px-4 py-3">{header}</th>)}</tr></thead>
      <tbody className="divide-y divide-gray-200">{rows.map((row, rowIndex) => <tr key={rowIndex} className="hover:bg-gray-50">{row.map((cell, cellIndex) => <td key={cellIndex} className="whitespace-nowrap px-4 py-3 text-gray-700">{cell}</td>)}</tr>)}</tbody>
    </table>
  </div>
);
