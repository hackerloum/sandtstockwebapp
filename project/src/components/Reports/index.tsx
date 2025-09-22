import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { Product, Order, StockMovement } from '../../types';
import { formatDate } from '../../utils/stockUtils';
import { PageHeader, PageContainer } from '../shared/PageLayout';
import { Button } from '../shared/Button';
import { Select } from '../shared/Form';
import { SummaryCards } from './SummaryCards';
import { TopProducts } from './TopProducts';
import { LowStockAlert } from './LowStockAlert';
import { CategoryAnalysis } from './CategoryAnalysis';
import { StockMovementSummary } from './StockMovementSummary';

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
    new Date(order.orderDate) >= startDate && new Date(order.orderDate) <= endDate
  );

  const filteredMovements = movements.filter(movement =>
    new Date(movement.date) >= startDate && new Date(movement.date) <= endDate
  );

  // Calculate metrics
  const totalRevenue = filteredOrders.reduce((sum, order) => sum + order.total_amount, 0);
  const totalOrders = filteredOrders.length;
  const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  
  const stockIn = filteredMovements
    .filter(m => m.type === 'in')
    .reduce((sum, m) => sum + m.quantity, 0);
  
  const stockOut = filteredMovements
    .filter(m => m.type === 'out')
    .reduce((sum, m) => sum + m.quantity, 0);

  const topProducts = products
    .map(product => {
      const soldQuantity = filteredOrders
        .flatMap(order => order.items)
        .filter(item => item.productId === product.id)
        .reduce((sum, item) => sum + item.quantity, 0);
      
      return { ...product, soldQuantity };
    })
    .sort((a, b) => b.soldQuantity - a.soldQuantity)
    .slice(0, 5);

  const lowStockProducts = products
    .filter(product => product.currentStock <= product.minStock)
    .sort((a, b) => a.currentStock - b.currentStock);

  const categoryStats = products.reduce((acc, product) => {
    if (!acc[product.category]) {
      acc[product.category] = { count: 0, value: 0 };
    }
    acc[product.category].count += 1;
    acc[product.category].value += product.currentStock * product.price;
    return acc;
  }, {} as Record<string, { count: number; value: number }>);

  const dateRangeOptions = [
    { value: '7', label: 'Last 7 days' },
    { value: '30', label: 'Last 30 days' },
    { value: '90', label: 'Last 90 days' },
    { value: '365', label: 'Last year' }
  ];

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
    <div className="space-y-6">
      <PageHeader
        title="Reports & Analytics"
        actions={
          <div className="flex items-center space-x-4">
            <Select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
              options={dateRangeOptions}
            />
            <Button
              variant="primary"
              icon={<Download className="w-4 h-4" />}
              onClick={exportReport}
            >
              Export
            </Button>
          </div>
        }
      />

      <PageContainer>
        <div className="space-y-6">
          <SummaryCards
            totalRevenue={totalRevenue}
            totalOrders={totalOrders}
            averageOrderValue={averageOrderValue}
            stockIn={stockIn}
            stockOut={stockOut}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <TopProducts products={topProducts} />
            <LowStockAlert products={lowStockProducts} />
          </div>

          <CategoryAnalysis categoryStats={categoryStats} />
          <StockMovementSummary stockIn={stockIn} stockOut={stockOut} />
        </div>
      </PageContainer>
    </div>
  );
};