import React from 'react';
import { FileText, Package, Send, Check } from 'lucide-react';
import { PurchaseOrder } from '../../types';

interface POStatsProps {
  purchaseOrders: PurchaseOrder[];
}

export const POStats: React.FC<POStatsProps> = ({ purchaseOrders }) => {
  const stats = [
    {
      label: 'Total POs',
      value: purchaseOrders.length,
      icon: FileText,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      label: 'Draft',
      value: purchaseOrders.filter(po => po.status === 'draft').length,
      icon: Package,
      color: 'text-gray-600',
      bgColor: 'bg-gray-100'
    },
    {
      label: 'Sent',
      value: purchaseOrders.filter(po => po.status === 'sent').length,
      icon: Send,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100'
    },
    {
      label: 'Received',
      value: purchaseOrders.filter(po => po.status === 'received').length,
      icon: Check,
      color: 'text-green-600',
      bgColor: 'bg-green-100'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
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
  );
};