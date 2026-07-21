import React, { useState } from 'react';
import { Package, Scissors, Gift, Settings } from 'lucide-react';
import { Product, Brand, Supplier, ProductType } from '../types';
import { FragranceBottleForm, CrimpForm, AccessoriesForm, PackagingForm } from './forms';
import { PageHeader } from './shared/PageLayout';

interface AddProductPageProps {
  onSave: (product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => void;
  onBack: () => void;
  brands: Brand[];
  suppliers: Supplier[];
}

export const AddProductPage: React.FC<AddProductPageProps> = ({
  onSave,
  onBack
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
      <div className="space-y-5">
        <PageHeader
          title={`Add New ${selectedProductType}`}
          subtitle={`Create a new ${selectedProductType.toLowerCase()} product`}
          onBack={handleBackToSelection}
        />
        
        {renderForm()}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Add New Product"
        subtitle="Choose a product type to continue"
        onBack={onBack}
      />
      
      <section className="rounded-md border border-gray-200 bg-white p-4 sm:p-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
         {productTypeOptions.map((option) => {
           const IconComponent = option.icon;
           return (
             <button
               type="button"
               key={option.type}
               className={`min-h-36 rounded-md border p-5 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2 ${option.color}`}
               onClick={() => {
                 handleProductTypeSelect(option.type);
               }}
             >
               <span className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-current/10 bg-white/80">
                 <IconComponent className="h-5 w-5" />
               </span>
               <span className="mt-4 block text-base font-semibold">{option.type}</span>
               <span className="mt-1 block text-sm leading-5 opacity-80">{option.description}</span>
             </button>
           );
         })}
        </div>
      </section>
    </div>
  );
};
