import React from 'react';
import { BarChart3, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import { formatCurrency } from '../../utils/stockUtils';

interface SummaryCardsProps {
  totalRevenue: number;
  totalOrders: number;
  averageOrderValue: number;
  stockIn: number;
  stockOut: number;
}

export const SummaryCards: React.FC<SummaryCardsProps> = ({
  totalRevenue,
  totalOrders,
  averageOrderValue,
  stockIn,
  stockOut
}) => {
  const cards = [
    {
      title: 'Total Revenue',
      value: formatCurrency(totalRevenue),
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-500'
    },
    {
      title: 'Total Orders',
      value: totalOrders.toString(),
      icon: BarChart3,
      color: 'text-blue-600',
      bgColor: 'bg-blue-500'
    },
    {
      title: 'Avg Order Value',
      value: formatCurrency(averageOrderValue),
      icon: TrendingUp,
      color: 'text-purple-600',
      bgColor: 'bg-purple-500'
    },
    {
      title: 'Stock Movement',
      value: `${stockIn > stockOut ? '+' : ''}${stockIn - stockOut}`,
      icon: TrendingDown,
      color: 'text-orange-600',
      bgColor: 'bg-orange-500'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.title} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{card.title}</p>
                <p className={`text-3xl font-bold ${card.color} mt-1`}>{card.value}</p>
              </div>
              <div className={`${card.bgColor} rounded-lg p-3`}>
                <Icon className="w-6 h-6 text-white" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};