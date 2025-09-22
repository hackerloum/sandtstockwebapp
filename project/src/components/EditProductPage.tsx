import React, { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Product, ProductType } from '../types';
import { PageContainer, PageHeader } from './shared/PageLayout';
import { Button } from './shared/Button';
import { FragranceBottleForm, CrimpForm, AccessoriesForm, PackagingForm } from './forms';

interface EditProductPageProps {
  product: Product | null;
  onSave: (product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => void;
  onBack: () => void;
}

export const EditProductPage: React.FC<EditProductPageProps> = ({
  product,
  onSave,
  onBack
}) => {
  const [isFormOpen, setIsFormOpen] = useState(false);

  useEffect(() => {
    if (product) {
      setIsFormOpen(true);
    }
  }, [product]);

  const handleSave = (updatedProduct: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => {
    onSave(updatedProduct);
    setIsFormOpen(false);
    onBack();
  };

  const handleClose = () => {
    setIsFormOpen(false);
    onBack();
  };

  if (!product) {
    return (
      <PageContainer>
        <PageHeader
          title="Edit Product"
          subtitle="Select a product to edit"
          backButton={
            <Button variant="outline" onClick={onBack} icon={ArrowLeft}>
              Back to Products
            </Button>
          }
        />
        <div className="text-center py-12">
          <p className="text-gray-500">No product selected for editing.</p>
        </div>
      </PageContainer>
    );
  }

  const renderForm = () => {
    // Default to Fragrance Bottles if product_type is not set
    const productType = product.product_type || 'Fragrance Bottles';
    
    switch (productType) {
      case 'Fragrance Bottles':
        return (
          <FragranceBottleForm
            product={product}
            onSave={handleSave}
            onClose={handleClose}
            isOpen={isFormOpen}
          />
        );
      case 'Crimp':
        return (
          <CrimpForm
            product={product}
            onSave={handleSave}
            onClose={handleClose}
            isOpen={isFormOpen}
          />
        );
      case 'Accessories':
        return (
          <AccessoriesForm
            product={product}
            onSave={handleSave}
            onClose={handleClose}
            isOpen={isFormOpen}
          />
        );
      case 'Packaging':
        return (
          <PackagingForm
            product={product}
            onSave={handleSave}
            onClose={handleClose}
            isOpen={isFormOpen}
          />
        );
      default:
        return (
          <div className="text-center py-12">
            <p className="text-gray-500">Unknown product type: {productType}</p>
            <Button variant="outline" onClick={onBack} className="mt-4">
              Back to Products
            </Button>
          </div>
        );
    }
  };

  return (
    <PageContainer>
      <PageHeader
        title={`Edit ${product.product_type || 'Product'}`}
        subtitle={`Editing: ${product.commercial_name} (${product.code})`}
        backButton={
          <Button variant="outline" onClick={onBack} icon={ArrowLeft}>
            Back to Products
          </Button>
        }
      />
      {renderForm()}
    </PageContainer>
  );
}; 