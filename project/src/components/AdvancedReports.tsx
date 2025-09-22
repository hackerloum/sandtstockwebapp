import React, { useState, useMemo } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Download, DollarSign, Package, FileText } from 'lucide-react';
import { Product, Order, StockMovement, PurchaseOrder } from '../types';
import { formatCurrency, formatDate } from '../utils/stockUtils';
import { useAuth } from '../contexts/AuthContext';

interface AdvancedReportsProps {
  products: Product[];
  orders: Order[];
  movements: StockMovement[];
  purchaseOrders: PurchaseOrder[];
}

export const AdvancedReports: React.FC<AdvancedReportsProps> = ({
  products,
  orders,
  movements,
  purchaseOrders
}) => {
  const { hasPermission } = useAuth();
  const [dateRange, setDateRange] = useState('30');
  const [reportType, setReportType] = useState('overview');
  const [sortBy, setSortBy] = useState<'revenue' | 'quantity'>('revenue');

  const getDateRange = (days: number) => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    return { startDate, endDate };
  };

  const { startDate, endDate } = getDateRange(parseInt(dateRange));

  // Filter data by date range
  const filteredOrders = orders.filter(order => 
    new Date(order.created_at) >= startDate && new Date(order.created_at) <= endDate
  );

  const filteredMovements = movements.filter(movement =>
    new Date(movement.performed_at) >= startDate && new Date(movement.performed_at) <= endDate
  );

  const filteredPOs = purchaseOrders.filter(po =>
    new Date(po.order_date) >= startDate && new Date(po.order_date) <= endDate
  );

  // Advanced Analytics
  const analytics = useMemo(() => {
    const totalRevenue = filteredOrders.reduce((sum, order) => sum + order.total_amount, 0);
    const totalOrders = filteredOrders.length;
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
    
    const inventoryValue = products.reduce((sum, product) => 
      sum + (product.current_stock * product.price), 0
    );

    // Calculate inventory turnover (COGS / Average Inventory)
    const soldItems = filteredOrders.flatMap(order => order.items || []);
    const cogs = soldItems.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const inventoryTurnover = inventoryValue > 0 ? cogs / inventoryValue : 0;

    // Top products by revenue
    const productSales = soldItems.reduce((acc, item) => {
      if (!acc[item.product_id]) {
        acc[item.product_id] = {
          productId: item.product_id,
          productName: item.product_name,
          quantitySold: 0,
          revenue: 0
        };
      }
      acc[item.product_id].quantitySold += item.quantity;
      acc[item.product_id].revenue += item.total_price;
      return acc;
    }, {} as Record<string, any>);

    const topProducts = Object.values(productSales)
      .sort((a: any, b: any) => sortBy === 'revenue' ? b.revenue - a.revenue : b.quantitySold - a.quantitySold)
      .slice(0, 15); // Show top 15 products

    // Sales trend (daily)
    const salesByDate = filteredOrders.reduce((acc, order) => {
      const date = new Date(order.created_at).toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = { sales: 0, orders: 0 };
      }
              acc[date].sales += order.total_amount;
      acc[date].orders += 1;
      return acc;
    }, {} as Record<string, { sales: number; orders: number }>);

    const salesTrend = Object.entries(salesByDate)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Category performance
    const categoryStats = products.reduce((acc, product) => {
      if (!acc[product.category]) {
        acc[product.category] = { sales: 0, profit: 0, products: 0 };
      }
      acc[product.category].products += 1;
      
      const productSales = soldItems
        .filter(item => item.product_id === product.id)
        .reduce((sum, item) => sum + item.total_price, 0);
      
      acc[product.category].sales += productSales;
      acc[product.category].profit += productSales * 0.3; // Assuming 30% profit margin
      
      return acc;
    }, {} as Record<string, any>);

    const categoryPerformance = Object.entries(categoryStats)
      .map(([category, stats]) => ({ category, ...stats }))
      .sort((a: any, b: any) => b.sales - a.sales);

    // Stock movement analysis
    const stockIn = filteredMovements
      .filter(m => m.movement_type === 'in')
      .reduce((sum, m) => sum + m.quantity, 0);
    
    const stockOut = filteredMovements
      .filter(m => m.movement_type === 'out')
      .reduce((sum, m) => sum + m.quantity, 0);

    const stockAdjustments = 0; // No adjustment type in current schema

    // Low stock and reorder analysis
    const lowStockProducts = products.filter(p => p.current_stock <= p.min_stock);
    const reorderProducts = products.filter(p => p.current_stock <= p.reorder_point);
    const outOfStockProducts = products.filter(p => p.current_stock === 0);

    // Supplier performance
    const supplierStats = filteredPOs.reduce((acc, po) => {
      const supplierName = po.supplier_name || 'Unknown Supplier';
      if (!acc[supplierName]) {
        acc[supplierName] = {
          orders: 0,
          totalValue: 0,
          onTimeDeliveries: 0,
          totalDeliveries: 0
        };
      }
      acc[supplierName].orders += 1;
      acc[supplierName].totalValue += po.total_amount;
      
      if (po.status === 'received') {
        acc[supplierName].totalDeliveries += 1;
        if (po.actual_delivery_date && po.expected_delivery_date) {
          if (new Date(po.actual_delivery_date) <= new Date(po.expected_delivery_date)) {
            acc[supplierName].onTimeDeliveries += 1;
          }
        }
      }
      
      return acc;
    }, {} as Record<string, any>);

    return {
      totalRevenue,
      totalOrders,
      averageOrderValue,
      inventoryValue,
      inventoryTurnover,
      topProducts,
      salesTrend,
      categoryPerformance,
      stockIn,
      stockOut,
      stockAdjustments,
      lowStockProducts,
      reorderProducts,
      outOfStockProducts,
      supplierStats
    };
  }, [products, filteredOrders, filteredMovements, filteredPOs]);

  const exportReport = () => {
    const reportData = {
      reportType,
      dateRange: `${formatDate(startDate)} - ${formatDate(endDate)}`,
      generatedAt: new Date().toISOString(),
      analytics,
      filters: {
        category: 'all',
        supplier: 'all'
      }
    };

    const dataStr = JSON.stringify(reportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `advanced-report-${reportType}-${formatDate(new Date()).replace(/\s/g, '-')}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const exportToCSV = () => {
    let csvContent = '';
    
    if (reportType === 'inventory') {
      csvContent = 'Product Name,Category,Current Stock,Min Stock,Reorder Point,Price,Value,Status\n';
      products.forEach(product => {
        const status = product.current_stock === 0 ? 'Out of Stock' :
                      product.current_stock <= product.min_stock ? 'Low Stock' :
                      product.current_stock <= product.reorder_point ? 'Reorder' : 'Normal';
        csvContent += `"${product.commercial_name}","${product.category}",${product.current_stock},${product.min_stock},${product.reorder_point},${product.price},${product.current_stock * product.price},"${status}"\n`;
      });
    } else if (reportType === 'sales') {
      csvContent = 'Order Number,Customer,Date,Total,Status\n';
      filteredOrders.forEach(order => {
        csvContent += `"${order.order_number}","${order.customer_name}","${formatDate(order.created_at)}",${order.total_amount},"${order.status}"\n`;
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${reportType}-report-${formatDate(new Date()).replace(/\s/g, '-')}.csv`);
    link.click();
  };

  if (!hasPermission('view_reports')) {
    return (
      <div className="text-center py-12">
        <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
        <p className="text-gray-600">You don't have permission to view reports.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Advanced Reports & Analytics</h2>
        <div className="flex items-center space-x-4">
          <select
            value={reportType}
            onChange={(e) => setReportType(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="overview">Overview</option>
            <option value="inventory">Inventory Analysis</option>
            <option value="sales">Sales Performance</option>
            <option value="purchase">Purchase Analysis</option>
            <option value="movement">Stock Movement</option>
          </select>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
          </select>
          <button
            onClick={exportReport}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
          >
            <Download className="w-4 h-4" />
            <span>JSON</span>
          </button>
          <button
            onClick={exportToCSV}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
          >
            <FileText className="w-4 h-4" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Key Metrics Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Revenue</p>
              <p className="text-3xl font-bold text-green-600 mt-1">{formatCurrency(analytics.totalRevenue)}</p>
              <p className="text-sm text-gray-500 mt-1">
                {analytics.totalOrders} orders
              </p>
            </div>
            <div className="bg-green-500 rounded-lg p-3">
              <DollarSign className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Inventory Value</p>
              <p className="text-3xl font-bold text-blue-600 mt-1">{formatCurrency(analytics.inventoryValue)}</p>
              <p className="text-sm text-gray-500 mt-1">
                {products.length} products
              </p>
            </div>
            <div className="bg-blue-500 rounded-lg p-3">
              <Package className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Inventory Turnover</p>
              <p className="text-3xl font-bold text-purple-600 mt-1">{analytics.inventoryTurnover.toFixed(2)}x</p>
              <p className="text-sm text-gray-500 mt-1">
                Annual rate
              </p>
            </div>
            <div className="bg-purple-500 rounded-lg p-3">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Avg Order Value</p>
              <p className="text-3xl font-bold text-orange-600 mt-1">{formatCurrency(analytics.averageOrderValue)}</p>
              <p className="text-sm text-gray-500 mt-1">
                Per transaction
              </p>
            </div>
            <div className="bg-orange-500 rounded-lg p-3">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Report Content Based on Type */}
      {reportType === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Top Products */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Top Selling Products</h3>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Sort by:</span>
                <button
                  onClick={() => setSortBy('revenue')}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    sortBy === 'revenue' 
                      ? 'bg-blue-100 text-blue-700 font-medium' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Revenue
                </button>
                <button
                  onClick={() => setSortBy('quantity')}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    sortBy === 'quantity' 
                      ? 'bg-blue-100 text-blue-700 font-medium' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  Quantity
                </button>
              </div>
            </div>
            
            {/* Top 3 Summary */}
            {analytics.topProducts.length > 0 && (
              <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                <h4 className="text-sm font-medium text-blue-900 mb-2">🏆 Top Performers</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {analytics.topProducts.slice(0, 3).map((product: any, index: number) => (
                    <div key={product.productId} className="text-center p-2 bg-white rounded border">
                      <p className="text-xs font-medium text-gray-600">#{index + 1}</p>
                      <p className="text-sm font-semibold text-gray-900 truncate">{product.productName}</p>
                      <p className="text-xs text-green-600 font-medium">{product.quantitySold} units</p>
                      <p className="text-xs text-blue-600 font-medium">{formatCurrency(product.revenue)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="space-y-3 max-h-96 overflow-y-auto">
              <div className="text-xs text-gray-500 mb-2">
                Showing {analytics.topProducts.length} products (sorted by {sortBy === 'revenue' ? 'revenue' : 'quantity sold'})
              </div>
              {analytics.topProducts.map((product: any, index: number) => (
                <div key={product.productId} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                  <div className="flex items-center space-x-3 flex-1">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-blue-600">{index + 1}</span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{product.productName}</p>
                      <div className="flex items-center space-x-4 mt-1">
                        <p className="text-xs text-gray-500">ID: {product.productId}</p>
                        <p className="text-xs text-gray-500">Sold: <span className="font-medium text-green-600">{product.quantitySold}</span></p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">{formatCurrency(product.revenue)}</p>
                    <p className="text-xs text-gray-500">Revenue</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Stock Alerts */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Stock Alerts</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
                <span className="text-sm font-medium text-red-800">Out of Stock</span>
                <span className="text-lg font-bold text-red-600">{analytics.outOfStockProducts.length}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <span className="text-sm font-medium text-yellow-800">Low Stock</span>
                <span className="text-lg font-bold text-yellow-600">{analytics.lowStockProducts.length}</span>
              </div>
              <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200">
                <span className="text-sm font-medium text-orange-800">Reorder Point</span>
                <span className="text-lg font-bold text-orange-600">{analytics.reorderProducts.length}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {reportType === 'inventory' && (
        <div className="space-y-6">
          {/* Inventory Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
              <Package className="w-12 h-12 text-blue-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-blue-600">{products.length}</p>
              <p className="text-sm text-gray-600">Total Products</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
              <TrendingDown className="w-12 h-12 text-red-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-red-600">{analytics.lowStockProducts.length}</p>
              <p className="text-sm text-gray-600">Low Stock Items</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
              <DollarSign className="w-12 h-12 text-green-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-green-600">{formatCurrency(analytics.inventoryValue)}</p>
              <p className="text-sm text-gray-600">Total Value</p>
            </div>
          </div>

          {/* Category Performance */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Category Performance</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {analytics.categoryPerformance.map((category: any) => (
                <div key={category.category} className="p-4 bg-gray-50 rounded-lg">
                  <h4 className="font-medium text-gray-900 mb-2">{category.category}</h4>
                  <div className="space-y-1">
                    <p className="text-sm text-gray-600">{category.products} products</p>
                    <p className="text-sm font-medium text-gray-900">Sales: {formatCurrency(category.sales)}</p>
                    <p className="text-sm text-green-600">Est. Profit: {formatCurrency(category.profit)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {reportType === 'sales' && (
        <div className="space-y-6">
          {/* Sales Trend Chart Placeholder */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Sales Trend</h3>
            <div className="h-64 bg-gray-50 rounded-lg flex items-center justify-center">
              <div className="text-center">
                <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Sales trend visualization would go here</p>
                <p className="text-sm text-gray-400 mt-2">
                  {analytics.salesTrend.length} data points available
                </p>
              </div>
            </div>
          </div>

          {/* Recent Orders */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Orders</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredOrders.slice(0, 10).map((order) => (
                    <tr key={order.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {order.order_number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {order.customer_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(order.total_amount)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                          {order.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {reportType === 'movement' && (
        <div className="space-y-6">
          {/* Movement Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
              <TrendingUp className="w-12 h-12 text-green-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-green-600">{analytics.stockIn}</p>
              <p className="text-sm text-gray-600">Stock In</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
              <TrendingDown className="w-12 h-12 text-red-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-red-600">{analytics.stockOut}</p>
              <p className="text-sm text-gray-600">Stock Out</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
              <Package className="w-12 h-12 text-orange-600 mx-auto mb-2" />
              <p className="text-2xl font-bold text-orange-600">{analytics.stockAdjustments}</p>
              <p className="text-sm text-gray-600">Adjustments</p>
            </div>
          </div>

          {/* Recent Movements */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Stock Movements</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Product</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredMovements.slice(0, 10).map((movement) => {
                    const product = products.find(p => p.id === movement.product_id);
                    return (
                      <tr key={movement.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(movement.performed_at)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {product?.commercial_name || 'Unknown Product'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                            movement.movement_type === 'in' ? 'bg-green-100 text-green-800' :
                            movement.movement_type === 'out' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {movement.movement_type}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {movement.quantity}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {movement.reason}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};