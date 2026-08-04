import React from 'react';
import { Brand, InventoryOwner, Product, Supplier } from '../types';
import { AddProductPage } from './AddProductPage';
import { EmptyState, PageHeader } from './shared/PageLayout';

interface EditProductPageProps {
  product: Product | null;
  onSave: (product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => void;
  onBack: () => void;
  brands: Brand[];
  suppliers: Supplier[];
  inventoryOwners: InventoryOwner[];
}

export const EditProductPage: React.FC<EditProductPageProps> = ({ product, onSave, onBack, brands, suppliers, inventoryOwners }) => {
  if (!product) {
    return (
      <div className="space-y-5">
        <PageHeader title="Edit product" subtitle="Select a product to edit" onBack={onBack} />
        <div className="rounded-md border border-gray-200 bg-white">
          <EmptyState title="No product selected" description="Return to Products and choose the edit action for a product." />
        </div>
      </div>
    );
  }

  return (
    <AddProductPage
      product={product}
      onSave={onSave}
      onBack={onBack}
      brands={brands}
      suppliers={suppliers}
      inventoryOwners={inventoryOwners}
    />
  );
};
