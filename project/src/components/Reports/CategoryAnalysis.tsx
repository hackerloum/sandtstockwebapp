import React from 'react';
import { formatCurrency } from '../../utils/stockUtils';
import { PageSection } from '../shared/PageLayout';

interface CategoryStats {
  count: number;
  value: number;
}

interface CategoryAnalysisProps {
  categoryStats: Record<string, CategoryStats>;
}

export const CategoryAnalysis: React.FC<CategoryAnalysisProps> = ({ categoryStats }) => {
  return (
    <PageSection title="Category Analysis">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(categoryStats).map(([category, stats]) => (
          <div key={category} className="p-4 bg-gray-50 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-2">{category}</h4>
            <div className="space-y-1">
              <p className="text-sm text-gray-600">{stats.count} products</p>
              <p className="text-sm font-medium text-gray-900">Value: {formatCurrency(stats.value)}</p>
            </div>
          </div>
        ))}
      </div>
    </PageSection>
  );
};