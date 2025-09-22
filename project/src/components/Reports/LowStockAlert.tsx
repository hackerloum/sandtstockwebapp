import React from 'react';
import { Product } from '../../types';
import { PageSection } from '../shared/PageLayout';

interface LowStockAlertProps {
  products: Product[];
}

export const LowStockAlert: React.FC<LowStockAlertProps> = ({ products }) => {
  return (
    <PageSection title="Low Stock Alert">
      <div className="space-y-3">
        {products.slice(0, 5).map((product) => (
          <div key={product.id} className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-200">
            <div>
              <p className="font-medium text-gray-900">{product.name}</p>
              <p className="text-sm text-gray-600">{product.category}</p>
            </div>
            <div className="text-right">
              <p className="font-medium text-red-600">{product.currentStock} left</p>
              <p className="text-sm text-gray-600">Min: {product.minStock}</p>
            </div>
          </div>
        ))}
        {products.length === 0 && (
          <p className="text-gray-500 text-center py-4">No low stock items</p>
        )}
      </div>
    </PageSection>
  );
};