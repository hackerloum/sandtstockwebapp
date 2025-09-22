import React, { useState } from 'react';
import { ArrowLeft, Package, Scissors, Gift, Settings } from 'lucide-react';
import { Product, Brand, Supplier, ProductType } from '../types';
import { FragranceBottleForm, CrimpForm, AccessoriesForm, PackagingForm } from './forms';
import { PageHeader, PageContainer } from './shared/PageLayout';
import { Button } from './shared/Button';

interface AddProductPageProps {
  onSave: (product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => void;
  onBack: () => void;
  brands: Brand[];
  suppliers: Supplier[];
}

export const AddProductPage: React.FC<AddProductPageProps> = ({
  onSave,
  onBack,
  brands,
  suppliers
}) => {
  const [selectedProductType, setSelectedProductType] = useState<ProductType | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const productTypeOptions = [
    {
      type: 'Fragrance Bottles' as ProductType,
      icon: Package,
      description: 'Perfume bottles with fragrance contents',
      color: 'bg-blue-50 border-blue-200 text-blue-900 hover:bg-blue-100'
    },
    {
      type: 'Crimp' as ProductType,
      icon: Scissors,
      description: 'Crimping tools and accessories',
      color: 'bg-green-50 border-green-200 text-green-900 hover:bg-green-100'
    },
    {
      type: 'Accessories' as ProductType,
      icon: Gift,
      description: 'Perfume accessories and tools',
      color: 'bg-purple-50 border-purple-200 text-purple-900 hover:bg-purple-100'
    },
    {
      type: 'Packaging' as ProductType,
      icon: Settings,
      description: 'Packaging materials and boxes',
      color: 'bg-orange-50 border-orange-200 text-orange-900 hover:bg-orange-100'
    }
  ];

  const handleProductTypeSelect = (productType: ProductType) => {
    console.log('handleProductTypeSelect called with:', productType);
    setSelectedProductType(productType);
    setIsFormOpen(true);
    console.log('State updated - selectedProductType:', productType, 'isFormOpen: true');
  };

  const handleSave = (product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => {
    onSave(product);
    onBack();
  };

  const handleClose = () => {
    setIsFormOpen(false);
    setSelectedProductType(null);
    onBack();
  };

  const handleBackToSelection = () => {
    setIsFormOpen(false);
    setSelectedProductType(null);
  };

  if (isFormOpen && selectedProductType) {
    const renderForm = () => {
      switch (selectedProductType) {
        case 'Fragrance Bottles':
          return (
            <FragranceBottleForm
              product={null}
              onSave={handleSave}
              onClose={handleClose}
              isOpen={isFormOpen}
            />
          );
        case 'Crimp':
          return (
            <CrimpForm
              product={null}
              onSave={handleSave}
              onClose={handleClose}
              isOpen={isFormOpen}
            />
          );
        case 'Accessories':
          return (
            <AccessoriesForm
              product={null}
              onSave={handleSave}
              onClose={handleClose}
              isOpen={isFormOpen}
            />
          );
        case 'Packaging':
          return (
            <PackagingForm
              product={null}
              onSave={handleSave}
              onClose={handleClose}
              isOpen={isFormOpen}
            />
          );
        default:
          return null;
    }
  };

  return (
      <PageContainer>
        <PageHeader
          title={`Add New ${selectedProductType}`}
          subtitle={`Create a new ${selectedProductType.toLowerCase()} product`}
          backButton={
            <Button variant="outline" onClick={handleBackToSelection} icon={ArrowLeft}>
              Back to Product Type Selection
            </Button>
          }
        />
        
        {renderForm()}
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Add New Product"
        subtitle="Select the type of product you want to add"
        backButton={
          <Button variant="outline" onClick={onBack} icon={ArrowLeft}>
            Back to Products
          </Button>
        }
      />
      
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-8">
         {productTypeOptions.map((option) => {
           const IconComponent = option.icon;
           return (
             <div
               key={option.type}
               className={`p-6 border-2 rounded-xl cursor-pointer transition-all duration-200 hover:scale-105 hover:shadow-lg ${option.color}`}
               onClick={() => {
                 console.log('Product type selected:', option.type);
                 handleProductTypeSelect(option.type);
               }}
               onKeyDown={(e) => {
                 if (e.key === 'Enter' || e.key === ' ') {
                   e.preventDefault();
                   handleProductTypeSelect(option.type);
                 }
               }}
               tabIndex={0}
               role="button"
               aria-label={`Select ${option.type} product type`}
             >
               <div className="flex flex-col items-center text-center space-y-4">
                 <div className="p-3 bg-white rounded-full shadow-sm">
                   <IconComponent className="w-8 h-8" />
                </div>
                <div>
                   <h3 className="text-lg font-semibold mb-2">{option.type}</h3>
                   <p className="text-sm opacity-80">{option.description}</p>
                </div>
                 <div className="text-xs text-gray-600 mt-2">
                   Click to select
              </div>
            </div>
          </div>
           );
         })}
        </div>
    </PageContainer>
  );
};