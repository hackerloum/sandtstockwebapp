import React, { useMemo, useEffect, useState } from 'react';
import {
  Package, AlertTriangle, TrendingDown, DollarSign,
  ShoppingCart, Clock, BarChart2, Plus, FileText, RefreshCcw
} from 'lucide-react';
import { Product, StockMovement } from '../types';
import { getStockStatus, formatCurrency, formatDate, calculateReorderQuantity } from '../utils/stockUtils';
import { getProducts, getStockMovements } from '../lib/supabase';

interface DashboardProps {
  onCreatePurchaseOrder?: (productId: string) => void;
  onAddProduct?: () => void;
  onCreateOrder?: () => void;
  onStockCount?: () => void;
  onNavigate?: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  onCreatePurchaseOrder,
  onAddProduct,
  onCreateOrder,
  onStockCount,
  onNavigate
}) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [productsData, movementsData] = await Promise.all([
          getProducts(),
          getStockMovements()
        ]);
        setProducts(productsData || []);
        setMovements(movementsData || []);
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

  // Top Products by Movement
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