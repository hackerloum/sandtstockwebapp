import React from 'react';
import { ShoppingCart, Package, Clock, Check, Store, Globe, Printer } from 'lucide-react';
import { Order } from '../../types';
import { generateBulkOrdersPDF } from '../../utils/pdfUtils';
import { Button } from '../shared/Button';

interface OrderStatsProps {
  orders: Order[];
  products?: any[]; // Add products for PDF generation
}

export const OrderStats: React.FC<OrderStatsProps> = ({ orders, products = [] }) => {
  // Handle different order type formats from database
  const deliveryOrders = orders.filter(o => 
    o.order_type === 'delivery' || o.order_type === 'delivery'
  );
  const storeToShopOrders = orders.filter(o => 
    o.order_type === 'storeToShop' || o.order_type === 'store-to-shop'
  );
  const pickupOrders = orders.filter(o => 
    o.order_type === 'pickup'
  );
  const internationalOrders = orders.filter(o => 
    o.order_type === 'international-to-tanzania'
  );

  const handlePrintStats = () => {
    if (orders.length > 0) {
      const doc = generateBulkOrdersPDF(orders, products);
      const filename = `Order_Statistics_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);
    }
  };

  const stats = [
    {
      label: 'Total Orders',
      value: orders.length,
      icon: ShoppingCart,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      label: 'Delivery',
      value: deliveryOrders.length,
      icon: Package,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      label: 'Store to Shop',
      value: storeToShopOrders.length,
      icon: Store,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    },
    {
      label: 'Pickup',
      value: pickupOrders.length,
      icon: Globe,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    },
    {
      label: 'International',
      value: internationalOrders.length,
      icon: Package,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100'
    },
    {
      label: 'Pending',
      value: orders.filter(o => o.status === 'pending').length,
      icon: Clock,
      color: 'text-yellow-600',
      bgColor: 'bg-yellow-100'
    },
    {
      label: 'Processing',
      value: orders.filter(o => o.status === 'processing').length,
      icon: Package,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100'
    },
    {
      label: 'Delivered',
      value: orders.filter(o => o.status === 'delivered').length,
      icon: Check,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    }
  ];

  return (
    <div className="space-y-4">
      {/* Print Button */}
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          icon={<Printer className="w-4 h-4" />}
          onClick={handlePrintStats}
        >
          Print Order Statistics
        </Button>
      </div>
      
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                  <p className={`text-3xl font-bold ${stat.color} mt-1`}>{stat.value}</p>
                </div>
                <div className={`${stat.bgColor} rounded-lg p-3`}>
                  <Icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};