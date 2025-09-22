import React, { useState, useEffect } from 'react';
import { Product, ProductType } from '../../types';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { FormField, Input, Select, TextArea } from '../shared/Form';
import { checkProductExists } from '../../lib/supabase';

interface PackagingFormProps {
  product: Product | null;
  onSave: (product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => void;
  onClose: () => void;
  isOpen: boolean;
}

export const PackagingForm: React.FC<PackagingFormProps> = ({
  product,
  onSave,
  onClose,
  isOpen
}) => {
  const [formData, setFormData] = useState({
    code: '',
    item_number_prefix: 'PKG',
    item_number_suffix: '',
    commercial_name: '',
    product_type: 'Packaging' as ProductType,
    brand_id: '',
    category: 'Boxes',
    concentration: '',
    size: 0,
    gross_weight: 0.1,
    tare_weight: 0.05,
    net_weight: 0.05,
    fragrance_notes: '',
    gender: '',
    season: [] as string[],
    is_tester: false,
    current_stock: 0,
    min_stock: 5,
    max_stock: 50,
    reorder_point: 10,
    price: 0,
    supplier_id: 'ARGEVILLE'
  });

  const [isCheckingCode, setIsCheckingCode] = useState(false);
  const [codeExists, setCodeExists] = useState<{ exists: boolean; product?: any } | null>(null);

  // Update form data when product prop changes (for editing)
  useEffect(() => {
    if (product) {
      setFormData({
        code: product.code || '',
        item_number_prefix: product.item_number?.substring(0, 3) || 'PKG',
        item_number_suffix: product.item_number?.substring(3) || '',
        commercial_name: product.commercial_name || '',
        product_type: 'Packaging' as ProductType,
        brand_id: product.brand_id || '',
        category: product.category || 'Boxes',
        concentration: product.concentration || '',
        size: product.size || 0,
        gross_weight: product.gross_weight || 0.1,
        tare_weight: product.tare_weight || 0.05,
        net_weight: product.net_weight || 0.05,
        fragrance_notes: product.fragrance_notes || '',
        gender: product.gender || '',
        season: product.season || [],
        is_tester: product.is_tester || false,
        current_stock: product.current_stock || 0,
        min_stock: product.min_stock || 5,
        max_stock: product.max_stock || 50,
        reorder_point: product.reorder_point || 10,
        price: product.price || 0,
        supplier_id: product.supplier_id || 'ARGEVILLE'
      });
      setCodeExists(null);
    }
  }, [product]);

  // Check if code exists when code changes
  useEffect(() => {
    const checkCode = async () => {
      if (formData.code && formData.code.length >= 2 && !product) {
        setIsCheckingCode(true);
        try {
          const productId = product ? (product as Product).id : undefined;
          const existingProduct = await checkProductExists(formData.code, productId);
          setCodeExists({
            exists: !!existingProduct,
            product: existingProduct
          });
        } catch (error) {
          console.error('Error checking code:', error);
          setCodeExists(null);
        } finally {
          setIsCheckingCode(false);
        }
      } else {
        setCodeExists(null);
      }
    };

    const timeoutId = setTimeout(checkCode, 500); // Debounce for 500ms
    return () => clearTimeout(timeoutId);
  }, [formData.code, product]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate required fields
    if (!formData.code || !formData.commercial_name || !formData.item_number_suffix) {
      alert('Please fill in all required fields: Code Name, Packaging Name, and Item Number Suffix');
      return;
    }
    
    if (formData.current_stock < 0) {
      alert('Initial stock quantity cannot be negative');
      return;
    }
    
    if (formData.price < 0) {
      alert('Price cannot be negative');
      return;
    }

    // Check if product already exists
    if (!product) {
      const existingProduct = await checkProductExists(formData.code);
      if (existingProduct) {
        alert(`A product with code "${formData.code}" already exists:\n\nName: ${existingProduct.commercial_name}\nType: ${existingProduct.product_type}\n\nPlease use a different code.`);
        return;
      }
    }
    
    console.log('Submitting packaging product:', formData);
    
    const productData = {
      ...formData,
      item_number: formData.item_number_prefix + formData.item_number_suffix,
      created_by: null,
      updated_by: null
    };

    const { item_number_prefix, item_number_suffix, ...finalData } = productData;
    console.log('Final product data:', finalData);
    onSave(finalData);
  };

  const packagingTypeOptions = [
    { value: 'Boxes', label: 'Boxes' },
    { value: 'Bags', label: 'Bags' },
    { value: 'Wrapping Paper', label: 'Wrapping Paper' },
    { value: 'Ribbons', label: 'Ribbons' },
    { value: 'Tissue Paper', label: 'Tissue Paper' },
    { value: 'Labels', label: 'Labels' },
    { value: 'Stickers', label: 'Stickers' },
    { value: 'Other Packaging', label: 'Other Packaging' }
  ];

  const materialOptions = [
    { value: 'Cardboard', label: 'Cardboard' },
    { value: 'Paper', label: 'Paper' },
    { value: 'Plastic', label: 'Plastic' },
    { value: 'Fabric', label: 'Fabric' },
    { value: 'Metal', label: 'Metal' },
    { value: 'Wood', label: 'Wood' }
  ];

  const sizeOptions = [
    { value: 'Small', label: 'Small' },
    { value: 'Medium', label: 'Medium' },
    { value: 'Large', label: 'Large' },
    { value: 'Extra Large', label: 'Extra Large' },
    { value: 'Custom', label: 'Custom Size' }
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={product ? `Edit ${product.product_type}` : 'Add New Packaging'}
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            {product ? 'Update Packaging' : 'Add Packaging'}
          </Button>
        </>
      }
    >
      <form className="space-y-6">
        {/* Initial Stock Section */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">Initial Stock Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Initial Stock Quantity" required>
              <Input
                type="number"
                value={formData.current_stock}
                onChange={(e) => setFormData(prev => ({ ...prev, current_stock: parseInt(e.target.value) || 0 }))}
                min="0"
                placeholder="Enter initial stock quantity"
                className="text-lg font-medium"
              />
              <p className="text-sm text-gray-600 mt-1">This will be the starting stock level for this packaging</p>
            </FormField>
            
            <FormField label="Price per Unit" required>
              <Input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
                min="0"
                step="0.01"
                placeholder="Enter price per unit"
                className="text-lg font-medium"
              />
            </FormField>
          </div>
        </div>

        {/* Packaging Details */}
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-orange-900 mb-4">Packaging Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Code Name" required>
              <div className="relative">
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  placeholder="e.g., PKG001"
                  className={`${codeExists?.exists ? 'border-red-300 focus:border-red-500' : ''}`}
                />
                {isCheckingCode && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                  </div>
                )}
              </div>
              {codeExists?.exists && (
                <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-red-800">
                        Product code already exists
                      </h3>
                      <div className="mt-1 text-sm text-red-700">
                        <p>A product with code "{formData.code}" already exists:</p>
                        <p className="font-medium">{codeExists.product?.commercial_name} ({codeExists.product?.product_type})</p>
                        <p className="mt-1">Please use a different code.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </FormField>
            
            <FormField label="Packaging Name" required>
              <Input
                value={formData.commercial_name}
                onChange={(e) => setFormData(prev => ({ ...prev, commercial_name: e.target.value }))}
                placeholder="e.g., Gift Box"
              />
            </FormField>

            <FormField label="Brand ID" required>
              <Input
                value={formData.brand_id}
                onChange={(e) => setFormData(prev => ({ ...prev, brand_id: e.target.value }))}
                placeholder="e.g., BRAND001"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            <FormField label="Packaging Type" required>
              <Select
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                options={packagingTypeOptions}
              />
            </FormField>

            <FormField label="Material">
              <Select
                value={formData.concentration || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, concentration: e.target.value }))}
                options={materialOptions}
              />
            </FormField>

            <FormField label="Size">
              <Select
                value={formData.gender || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value }))}
                options={sizeOptions}
              />
            </FormField>
          </div>
        </div>

        {/* Specifications */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-green-900 mb-4">Specifications</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Weight (kg)" required>
              <Input
                type="number"
                value={formData.gross_weight}
                onChange={(e) => setFormData(prev => ({ ...prev, gross_weight: parseFloat(e.target.value) || 0 }))}
                min="0"
                step="0.001"
                placeholder="e.g., 0.1"
                className="text-lg font-medium"
              />
              <p className="text-sm text-gray-600 mt-1">Total weight of the packaging</p>
            </FormField>

            <FormField label="Dimensions">
              <Input
                value={formData.fragrance_notes || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, fragrance_notes: e.target.value }))}
                placeholder="e.g., 10x8x5"
                className="text-lg font-medium"
              />
              <p className="text-sm text-gray-600 mt-1">Length x Width x Height (cm)</p>
            </FormField>

            <FormField label="Quantity per Pack">
              <Input
                type="number"
                value={formData.size}
                onChange={(e) => setFormData(prev => ({ ...prev, size: parseInt(e.target.value) || 0 }))}
                min="0"
                placeholder="e.g., 10"
                className="text-lg font-medium"
              />
              <p className="text-sm text-gray-600 mt-1">Number of items per package</p>
            </FormField>
          </div>
        </div>

        {/* Additional Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Description">
            <TextArea
              value={formData.fragrance_notes || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, fragrance_notes: e.target.value }))}
              placeholder="Describe the packaging features and specifications..."
              rows={3}
            />
          </FormField>

          <div className="space-y-4">
            <FormField label="Packaging Type">
              <div className="flex items-center space-x-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.is_tester}
                    onChange={(e) => setFormData(prev => ({ ...prev, is_tester: e.target.checked }))}
                    className="mr-2"
                  />
                  <span className="text-sm">Sample Packaging</span>
                </label>
              </div>
              <p className="text-sm text-gray-600 mt-1">Mark if this is a sample packaging</p>
            </FormField>
          </div>
        </div>

        {/* Stock Management */}
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Stock Management Settings</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Minimum Stock Level">
              <Input
                type="number"
                value={formData.min_stock}
                onChange={(e) => setFormData(prev => ({ ...prev, min_stock: parseInt(e.target.value) || 0 }))}
                min="0"
                placeholder="Min stock level"
              />
              <p className="text-sm text-gray-600 mt-1">Alert when stock falls below this level</p>
            </FormField>

            <FormField label="Maximum Stock Level">
              <Input
                type="number"
                value={formData.max_stock}
                onChange={(e) => setFormData(prev => ({ ...prev, max_stock: parseInt(e.target.value) || 0 }))}
                min="0"
                placeholder="Max stock level"
              />
              <p className="text-sm text-gray-600 mt-1">Maximum stock capacity</p>
            </FormField>

            <FormField label="Reorder Point">
              <Input
                type="number"
                value={formData.reorder_point}
                onChange={(e) => setFormData(prev => ({ ...prev, reorder_point: parseInt(e.target.value) || 0 }))}
                min="0"
                placeholder="Reorder point"
              />
              <p className="text-sm text-gray-600 mt-1">When to reorder stock</p>
            </FormField>
          </div>
        </div>
      </form>
    </Modal>
  );
}; 