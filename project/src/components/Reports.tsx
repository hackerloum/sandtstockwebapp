import React, { useState } from 'react';
import { BarChart3, TrendingUp, TrendingDown, Download, DollarSign } from 'lucide-react';
import { Product, Order, StockMovement } from '../types';
import { formatCurrency, formatDate } from '../utils/stockUtils';

interface ReportsProps {
  products: Product[];
  orders: Order[];
  movements: StockMovement[];
}

export const Reports: React.FC<ReportsProps> = ({ products, orders, movements }) => {
  const [dateRange, setDateRange] = useState('30');

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

  // Calculate metrics
  const totalRevenue = filteredOrders.reduce((sum, order) => sum + order.total_amount, 0);
  const totalOrders = filteredOrders.length;
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  
  const stockIn = filteredMovements
    .filter(m => m.movement_type === 'in')
    .reduce((sum, m) => sum + m.quantity, 0);
  
  const stockOut = filteredMovements
    .filter(m => m.movement_type === 'out')
    .reduce((sum, m) => sum + m.quantity, 0);

  const topProducts = products
    .map(product => {
      const soldQuantity = filteredOrders
        .flatMap(order => order.items || [])
        .filter(item => item.product_id === product.id)
        .reduce((sum, item) => sum + item.quantity, 0);
      
      return { ...product, soldQuantity };
    })
    .sort((a, b) => b.soldQuantity - a.soldQuantity)
    .slice(0, 15); // Show top 15 products

  const lowStockProducts = products
    .filter(product => product.current_stock <= product.min_stock)
    .sort((a, b) => a.current_stock - b.current_stock);

  const categoryStats = products.reduce((acc, product) => {
    if (!acc[product.category]) {
      acc[product.category] = { count: 0, value: 0 };
    }
    acc[product.category].count += 1;
    acc[product.category].value += product.current_stock * product.price;
    return acc;
  }, {} as Record<string, { count: number; value: number }>);

  const exportReport = () => {
    const reportData = {
      dateRange: `${formatDate(startDate)} - ${formatDate(endDate)}`,
      summary: {
        totalRevenue,
        totalOrders,
        averageOrderValue,
        stockIn,
        stockOut
      },
      topProducts,
      lowStockProducts,
      categoryStats
    };

    const dataStr = JSON.stringify(reportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `stock-report-${formatDate(new Date()).replace(/\s/g, '-')}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Reports & Analytics</h2>
        <div className="flex items-center space-x-3">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
          </select>
          <button
            onClick={exportReport}
            className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-md flex items-center space-x-2 transition-colors text-sm"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Revenue</p>
              <p className="text-xl font-semibold text-gray-900 mt-1">{formatCurrency(totalRevenue)}</p>
            </div>
            <div className="bg-green-100 rounded-lg p-2">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Total Orders</p>
              <p className="text-xl font-semibold text-gray-900 mt-1">{totalOrders}</p>
            </div>
            <div className="bg-blue-100 rounded-lg p-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Avg Order Value</p>
              <p className="text-xl font-semibold text-gray-900 mt-1">{formatCurrency(averageOrderValue)}</p>
            </div>
            <div className="bg-purple-100 rounded-lg p-2">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Stock Movement</p>
              <p className="text-xl font-semibold text-gray-900 mt-1">
                {stockIn > stockOut ? '+' : ''}{stockIn - stockOut}
              </p>
            </div>
            <div className="bg-orange-100 rounded-lg p-2">
              <TrendingDown className="w-5 h-5 text-orange-600" />
            </div>
          </div>
        </div>
      </div>

      {/* Sales Summary */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h3 className="text-base font-semibold text-gray-900 mb-3">Sales Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-3 bg-blue-50 rounded-md">
            <p className="text-lg font-semibold text-blue-600">{topProducts.length}</p>
            <p className="text-xs text-gray-600">Products Sold</p>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-md">
            <p className="text-lg font-semibold text-green-600">
              {topProducts.reduce((sum, product) => sum + product.soldQuantity, 0)}
            </p>
            <p className="text-xs text-gray-600">Total Units Sold</p>
          </div>
          <div className="text-center p-3 bg-purple-50 rounded-md">
            <p className="text-lg font-semibold text-purple-600">
              {formatCurrency(topProducts.reduce((sum, product) => sum + (product.soldQuantity * product.price), 0))}
            </p>
            <p className="text-xs text-gray-600">Total Sales Value</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Products */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="text-base font-semibold text-gray-900 mb-3">Top Selling Products</h3>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {topProducts.length > 0 ? (
              <>
                <div className="text-xs text-gray-500 mb-2">
                  Showing {topProducts.length} products (sorted by sales quantity)
                </div>
                {topProducts.map((product, index) => (
                  <div key={product.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-md hover:bg-gray-100 transition-colors">
                    <div className="flex items-center space-x-3">
                      <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium text-blue-600">{index + 1}</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{product.commercial_name}</p>
                        <p className="text-xs text-gray-500">{product.category}</p>
                        <p className="text-xs text-gray-400">Code: {product.code}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-gray-900">{product.soldQuantity} sold</p>
                      <p className="text-xs text-gray-500">{formatCurrency(product.soldQuantity * product.price)}</p>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              <div className="text-center py-4">
                <p className="text-gray-500 text-sm">No products available</p>
              </div>
            )}
          </div>
        </div>

        {/* Low Stock Alert */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="text-base font-semibold text-gray-900 mb-3">Low Stock Alert</h3>
          <div className="space-y-2">
            {lowStockProducts.slice(0, 5).map((product) => (
              <div key={product.id} className="flex items-center justify-between p-3 bg-red-50 rounded-md border border-red-200">
                <div>
                  <p className="text-sm font-medium text-gray-900">{product.commercial_name}</p>
                  <p className="text-xs text-gray-500">{product.category}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-red-600">{product.current_stock} left</p>
                  <p className="text-xs text-gray-500">Min: {product.min_stock}</p>
                </div>
              </div>
            ))}
            {lowStockProducts.length === 0 && (
              <p className="text-gray-500 text-center py-4 text-sm">No low stock items</p>
            )}
          </div>
        </div>
      </div>

      {/* Category Analysis */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h3 className="text-base font-semibold text-gray-900 mb-3">Category Analysis</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(categoryStats).map(([category, stats]) => (
            <div key={category} className="p-3 bg-gray-50 rounded-md">
              <h4 className="text-sm font-medium text-gray-900 mb-1">{category}</h4>
              <div className="space-y-1">
                <p className="text-xs text-gray-600">{stats.count} products</p>
                <p className="text-sm font-medium text-gray-900">Value: {formatCurrency(stats.value)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stock Movement Chart */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <h3 className="text-base font-semibold text-gray-900 mb-3">Stock Movement Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="text-center p-4 bg-green-50 rounded-md">
            <TrendingUp className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <p className="text-lg font-semibold text-green-600">{stockIn}</p>
            <p className="text-xs text-gray-600">Stock In</p>
          </div>
          <div className="text-center p-4 bg-red-50 rounded-md">
            <TrendingDown className="w-8 h-8 text-red-600 mx-auto mb-2" />
            <p className="text-lg font-semibold text-red-600">{stockOut}</p>
            <p className="text-xs text-gray-600">Stock Out</p>
          </div>
        </div>
      </div>
    </div>
  );
};