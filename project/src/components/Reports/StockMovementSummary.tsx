import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { PageSection } from '../shared/PageLayout';

interface StockMovementSummaryProps {
  stockIn: number;
  stockOut: number;
}

export const StockMovementSummary: React.FC<StockMovementSummaryProps> = ({
  stockIn,
  stockOut
}) => {
  return (
    <PageSection title="Stock Movement Summary">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="text-center p-6 bg-green-50 rounded-lg">
          <TrendingUp className="w-12 h-12 text-green-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-green-600">{stockIn}</p>
          <p className="text-sm text-gray-600">Stock In</p>
        </div>
        <div className="text-center p-6 bg-red-50 rounded-lg">
          <TrendingDown className="w-12 h-12 text-red-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-red-600">{stockOut}</p>
          <p className="text-sm text-gray-600">Stock Out</p>
        </div>
      </div>
    </PageSection>
  );
};