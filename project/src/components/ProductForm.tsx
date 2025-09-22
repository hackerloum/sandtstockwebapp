import React, { useState } from 'react';
import { Product, ProductType } from '../types';
import { Modal } from './shared/Modal';
import { Button } from './shared/Button';
import { FormField, Input, Select, TextArea } from './shared/Form';
import { formatDate } from '../utils/stockUtils';

interface ProductFormProps {
  product: Product | null;
  productType?: ProductType;
  onSave: (product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => void;
  onClose: () => void;
  isOpen: boolean;
}

export const ProductForm: React.FC<ProductFormProps> = ({
  product,
  productType,
  onSave,
  onClose,
  isOpen
}) => {
  const [formData, setFormData] = useState({
    code: product?.code || '',
    item_number_prefix: product?.item_number?.substring(0, 2) || 'ITM',
    item_number_suffix: product?.item_number?.substring(2) || '',
    commercial_name: product?.commercial_name || '',
    product_type: product?.product_type || productType || 'Fragrance Bottles',
    brand_id: product?.brand_id || '',
    category: product?.category || 'Eau de Parfum',
    concentration: product?.concentration || '',
    size: product?.size || 100,
    gross_weight: product?.gross_weight || 1.136,
    tare_weight: product?.tare_weight || 0.136,
    net_weight: product?.net_weight || 1.000,
    fragrance_notes: product?.fragrance_notes || '',
    gender: product?.gender || '',
    season: product?.season || [],
    is_tester: product?.is_tester || false,
    current_stock: product?.current_stock || 0,
    min_stock: product?.min_stock || 5,
    max_stock: product?.max_stock || 50,
    reorder_point: product?.reorder_point || 10,
    price: product?.price || 0,
    supplier_id: product?.supplier_id || 'ARGEVILLE' // Default to Argeville
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const productData = {
      ...formData,
      item_number: formData.item_number_prefix + formData.item_number_suffix,
      created_by: null,
      updated_by: null
    };

    // Remove the separate prefix and suffix fields
    const { item_number_prefix, item_number_suffix, ...finalData } = productData;

    onSave(finalData);
  };

  const categoryOptions = [
    { value: 'Eau de Parfum', label: 'Eau de Parfum (EDP)' },
    { value: 'Eau de Toilette', label: 'Eau de Toilette (EDT)' },
    { value: 'Eau de Cologne', label: 'Eau de Cologne (EDC)' },
    { value: 'Parfum', label: 'Parfum/Extrait' },
    { value: 'Eau Fraiche', label: 'Eau Fraiche' }
  ];

  const concentrationOptions = [
    { value: '15-20', label: '15-20% (Eau de Parfum)' },
    { value: '5-15', label: '5-15% (Eau de Toilette)' },
    { value: '2-4', label: '2-4% (Eau de Cologne)' },
    { value: '20-30', label: '20-30% (Parfum)' },
    { value: '1-3', label: '1-3% (Eau Fraiche)' }
  ];

  const sizeOptions = [
    { value: '30', label: '30ml' },
    { value: '50', label: '50ml' },
    { value: '75', label: '75ml' },
    { value: '100', label: '100ml' },
    { value: '200', label: '200ml' }
  ];

  const itemNumberPrefixOptions = [
    { value: 'AF', label: 'AF - Argeville Fragrance' },
    { value: 'ITM', label: 'ITM - Item' },
    { value: 'AM', label: 'AM - Argeville Men' },
    { value: 'TK', label: 'TK - Tester Kit' }
  ];

  // Determine which fields to show based on product type
  const shouldShowFragranceFields = formData.product_type === 'Fragrance Bottles';
  const shouldShowWeightFields = formData.product_type === 'Fragrance Bottles';
  const shouldShowCrimpFields = formData.product_type === 'Crimp';
  const shouldShowAccessoryFields = formData.product_type === 'Accessories';
  const shouldShowPackagingFields = formData.product_type === 'Packaging';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={product ? `Edit ${product.product_type}` : `Add New ${formData.product_type}`}
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            {product ? 'Update Perfume' : 'Add Perfume'}
          </Button>
        </>
      }
    >
      <form className="space-y-6">
        {/* Initial Stock Section - Prominent */}
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
              <p className="text-sm text-gray-600 mt-1">This will be the starting stock level for this product</p>
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

        {/* Product Type Display */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-purple-900 mb-4">Product Type</h3>
          <div className="flex items-center space-x-3">
            <div className="px-3 py-2 bg-purple-100 text-purple-800 rounded-lg font-medium">
              {formData.product_type}
            </div>
            <p className="text-sm text-purple-700">
              {formData.product_type === 'Fragrance Bottles' && 'Perfume bottles with fragrance contents'}
              {formData.product_type === 'Crimp' && 'Crimping tools and accessories'}
              {formData.product_type === 'Accessories' && 'Perfume accessories and tools'}
              {formData.product_type === 'Packaging' && 'Packaging materials and boxes'}
            </p>
          </div>
        </div>

        {/* Basic Information */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField label="Code Name" required>
            <Input
              value={formData.code}
              onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
              placeholder="e.g., NOVICE"
            />
          </FormField>
          
          <FormField label="Item Number" required>
            <div className="flex gap-2">
              <Select
                value={formData.item_number_prefix}
                onChange={(e) => setFormData(prev => ({ ...prev, item_number_prefix: e.target.value }))}
                options={itemNumberPrefixOptions}
                className="w-24"
              />
              <Input
                value={formData.item_number_suffix}
                onChange={(e) => setFormData(prev => ({ ...prev, item_number_suffix: e.target.value }))}
                placeholder="e.g., 061570"
                className="flex-1"
              />
            </div>
            <p className="text-sm text-gray-600 mt-1">Select prefix and enter the number</p>
          </FormField>

          <FormField label="Commercial Name" required>
            <Input
              value={formData.commercial_name}
              onChange={(e) => setFormData(prev => ({ ...prev, commercial_name: e.target.value }))}
              placeholder="e.g., BLUE DE CHANEL"
            />
          </FormField>
        </div>

        {/* Product Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField label="Brand ID" required>
            <Input
              value={formData.brand_id}
              onChange={(e) => setFormData(prev => ({ ...prev, brand_id: e.target.value }))}
              placeholder="e.g., CHANEL001"
            />
          </FormField>

          {shouldShowFragranceFields && (
            <FormField label="Category" required>
              <Select
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as Product['category'] }))}
                options={categoryOptions}
              />
            </FormField>
          )}

          {shouldShowFragranceFields && (
            <FormField label="Concentration">
              <Select
                value={formData.concentration}
                onChange={(e) => setFormData(prev => ({ ...prev, concentration: e.target.value }))}
                options={concentrationOptions}
              />
            </FormField>
          )}

          {!shouldShowFragranceFields && (
            <FormField label="Product Category">
              <Input
                value={formData.category}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as Product['category'] }))}
                placeholder="e.g., Tools, Materials, etc."
              />
            </FormField>
          )}
        </div>

        {/* Additional Details */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <FormField label="Size (ml)" required>
            <Select
              value={formData.size.toString()}
              onChange={(e) => setFormData(prev => ({ ...prev, size: parseInt(e.target.value) }))}
              options={sizeOptions}
            />
          </FormField>

          {shouldShowFragranceFields && (
            <FormField label="Gender">
              <Input
                value={formData.gender}
                onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value }))}
                placeholder="e.g., Men, Women, Unisex"
              />
            </FormField>
          )}

          {shouldShowFragranceFields && (
            <FormField label="Season">
              <Input
                value={formData.season.join(', ')}
                onChange={(e) => setFormData(prev => ({ ...prev, season: e.target.value.split(',').map(s => s.trim()) }))}
                placeholder="e.g., Spring, Summer, Fall, Winter"
              />
            </FormField>
          )}

          <FormField label="Supplier">
            <Input
              value="Argeville"
              disabled
              className="bg-gray-100 text-gray-600"
              placeholder="Argeville (Default Supplier)"
            />
            <p className="text-sm text-gray-600 mt-1">All products use Argeville as the supplier</p>
          </FormField>
        </div>

        {/* Bottle Weight Specifications - Only for Fragrance Bottles */}
        {shouldShowWeightFields && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-green-900 mb-4">Bottle Weight Specifications</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField label="GROSS MIN (kg)" required>
                <Input
                  type="number"
                  value={formData.gross_weight}
                  onChange={(e) => setFormData(prev => ({ ...prev, gross_weight: parseFloat(e.target.value) || 0 }))}
                  min="0"
                  step="0.001"
                  placeholder="e.g., 1.136"
                  className="text-lg font-medium"
                />
                <p className="text-sm text-gray-600 mt-1">Total weight including bottle and contents</p>
              </FormField>

              <FormField label="TARE MIN (kg)" required>
                <Input
                  type="number"
                  value={formData.tare_weight}
                  onChange={(e) => setFormData(prev => ({ ...prev, tare_weight: parseFloat(e.target.value) || 0 }))}
                  min="0"
                  step="0.001"
                  placeholder="e.g., 0.136"
                  className="text-lg font-medium"
                />
                <p className="text-sm text-gray-600 mt-1">Weight of empty bottle only</p>
              </FormField>

              <FormField label="NET (kg)" required>
                <Input
                  type="number"
                  value={formData.net_weight}
                  onChange={(e) => setFormData(prev => ({ ...prev, net_weight: parseFloat(e.target.value) || 0 }))}
                  min="0"
                  step="0.001"
                  placeholder="e.g., 1.000"
                  className="text-lg font-medium"
                />
                <p className="text-sm text-gray-600 mt-1">Weight of perfume contents only</p>
              </FormField>
            </div>
          </div>
        )}

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

        {/* Additional Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {shouldShowFragranceFields && (
            <FormField label="Fragrance Notes">
              <TextArea
                value={formData.fragrance_notes}
                onChange={(e) => setFormData(prev => ({ ...prev, fragrance_notes: e.target.value }))}
                placeholder="Describe the fragrance notes..."
                rows={3}
              />
            </FormField>
          )}

          <div className="space-y-4">
            {shouldShowFragranceFields && (
              <FormField label="Product Type">
                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={formData.is_tester}
                      onChange={(e) => setFormData(prev => ({ ...prev, is_tester: e.target.checked }))}
                      className="mr-2"
                    />
                    <span className="text-sm">Tester Product</span>
                  </label>
                </div>
                <p className="text-sm text-gray-600 mt-1">Mark if this is a tester/sample product</p>
              </FormField>
            )}
          </div>
        </div>
      </form>
    </Modal>
  );
};