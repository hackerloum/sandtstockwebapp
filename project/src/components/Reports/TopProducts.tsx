import React from 'react';
import { Product } from '../../types';
import { formatCurrency } from '../../utils/stockUtils';
import { PageSection } from '../shared/PageLayout';

interface TopProductsProps {
  products: (Product & { soldQuantity: number })[];
}

export const TopProducts: React.FC<TopProductsProps> = ({ products }) => {
  return (
    <PageSection title="Top Selling Products">
      <div className="space-y-3">
        {products.map((product, index) => (
          <div key={product.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-sm font-medium text-blue-600">{index + 1}</span>
              </div>
              <div>
                <p className="font-medium text-gray-900">{product.name}</p>
                <p className="text-sm text-gray-600">{product.category}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-medium text-gray-900">{product.soldQuantity} sold</p>
              <p className="text-sm text-gray-600">{formatCurrency(product.soldQuantity * product.price)}</p>
            </div>
          </div>
        ))}
      </div>
    </PageSection>
  );
};