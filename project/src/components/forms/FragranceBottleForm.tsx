import React, { useState, useEffect } from 'react';
import { Product, ProductType } from '../../types';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { FormField, Input, Select, TextArea } from '../shared/Form';
import { checkProductExists } from '../../lib/supabase';

interface FragranceBottleFormProps {
  product: Product | null;
  onSave: (product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => void;
  onClose: () => void;
  isOpen: boolean;
}

export const FragranceBottleForm: React.FC<FragranceBottleFormProps> = ({
  product,
  onSave,
  onClose,
  isOpen
}) => {
  const [formData, setFormData] = useState({
    code: '',
    item_number_prefix: 'AF',
    item_number_suffix: '',
    commercial_name: '',
    product_type: 'Fragrance Bottles' as ProductType,
    brand_id: '',
    category: 'Eau de Parfum',
    concentration: '',
    size: 100,
    gross_weight: 1.136,
    tare_weight: 0.136,
    net_weight: 1.000,
    fragrance_notes: '',
    gender: '',
    season: [] as string[],
    is_tester: false,
    current_stock: 0,
    min_stock: 5,
    max_stock: 50,
    reorder_point: 10,
    price: 0,
    supplier_id: null as string | null
  });

  const [isCheckingCode, setIsCheckingCode] = useState(false);
  const [codeExists, setCodeExists] = useState<{ exists: boolean; product?: any } | null>(null);

  // Update form data when product prop changes (for editing)
  useEffect(() => {
    if (product) {
      setFormData({
        code: product.code || '',
        item_number_prefix: product.item_number?.substring(0, 2) || 'AF',
        item_number_suffix: product.item_number?.substring(2) || '',
        commercial_name: product.commercial_name || '',
        product_type: product.product_type || 'Fragrance Bottles',
        brand_id: product.brand_id || '',
        category: product.category || 'Eau de Parfum',
        concentration: product.concentration || '',
        size: product.size || 100,
        gross_weight: product.gross_weight || 1.136,
        tare_weight: product.tare_weight || 0.136,
        net_weight: product.net_weight || 1.000,
        fragrance_notes: product.fragrance_notes || '',
        gender: product.gender || '',
        season: product.season || [],
        is_tester: product.is_tester || false,
        current_stock: product.current_stock || 0,
        min_stock: product.min_stock || 5,
        max_stock: product.max_stock || 50,
        reorder_point: product.reorder_point || 10,
        price: product.price || 0,
        supplier_id: product.supplier_id
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

  const handleSubmit = async () => {
    console.log('handleSubmit called with formData:', formData);
    console.log('Product being edited:', product);
    console.log('Current stock value in form:', formData.current_stock);
    console.log('Current stock type:', typeof formData.current_stock);
    
    // Validate required fields
    if (!formData.code || !formData.commercial_name || !formData.item_number_suffix) {
      alert('Please fill in all required fields: Code Name, Commercial Name, and Item Number Suffix');
      return;
    }

    // Check if product already exists (only for new products)
    if (!product) {
      const existingProduct = await checkProductExists(formData.code);
      if (existingProduct) {
        alert(`A product with code "${formData.code}" already exists:\n\nName: ${existingProduct.commercial_name}\nType: ${existingProduct.product_type}\n\nPlease use a different code.`);
        return;
      }
    }
    
    // Construct the complete product data
    const productData = {
      ...formData,
      item_number: formData.item_number_prefix + formData.item_number_suffix,
      created_by: null,
      updated_by: null
    };

    // Remove the separate prefix and suffix fields
    const { item_number_prefix, item_number_suffix, ...finalData } = productData;
    
    // Ensure supplier_id is properly handled
    if (finalData.supplier_id === 'ARGEVILLE' || !finalData.supplier_id) {
      finalData.supplier_id = null; // Will be handled by ensureArgevilleSupplier in supabase
    }
    
    // Ensure current_stock is a number
    if (typeof finalData.current_stock === 'string') {
      finalData.current_stock = parseInt(finalData.current_stock) || 0;
    }
    
    // Clean up empty strings for optional fields
    if (finalData.brand_id === '') finalData.brand_id = null as any;
    if (finalData.concentration === '') finalData.concentration = null as any;
    if (finalData.fragrance_notes === '') finalData.fragrance_notes = null as any;
    if (finalData.gender === '') finalData.gender = null as any;
    if (finalData.season && finalData.season.length === 0) finalData.season = [];
    
    console.log('Final product data to save:', finalData);
    console.log('Product ID (if editing):', product?.id);
    console.log('Final current_stock value:', finalData.current_stock);
    console.log('Final current_stock type:', typeof finalData.current_stock);
    
    try {
      onSave(finalData);
    } catch (error) {
      console.error('Error in handleSubmit:', error);
      alert(`Error saving product: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };



  const itemNumberPrefixOptions = [
    { value: 'AF', label: 'AF - Argeville Fragrance' },
    { value: 'ITM', label: 'ITM - Item' },
    { value: 'AM', label: 'AM - Argeville Men' },
    { value: 'TK', label: 'TK - Tester Kit' }
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={product ? `Edit ${product.product_type}` : 'Add New Fragrance Bottle'}
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            {product ? 'Update Fragrance' : 'Add Fragrance'}
          </Button>
        </>
      }
    >
      <form className="space-y-6">
        {/* Stock Information */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-blue-900 mb-4">
            {product ? 'Current Stock Information' : 'Initial Stock Information'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label={product ? 'Current Stock Quantity' : 'Initial Stock Quantity'} required>
              <Input
                type="number"
                value={formData.current_stock}
                onChange={(e) => setFormData(prev => ({ ...prev, current_stock: parseInt(e.target.value) || 0 }))}
                min="0"
                placeholder={product ? "Enter current stock quantity" : "Enter initial stock quantity"}
                className="text-lg font-medium"
              />
              <p className="text-sm text-gray-600 mt-1">
                {product 
                  ? "Update the current stock level for this product"
                  : "This will be the starting stock level for this fragrance"
                }
              </p>
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

        {/* Fragrance Details */}
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
          <h3 className="text-lg font-semibold text-purple-900 mb-4">Fragrance Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Code Name" required>
              <div className="relative">
                <Input
                  value={formData.code}
                  onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value.toUpperCase() }))}
                  placeholder="e.g., NOVICE"
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
            
            <FormField label="Commercial Name" required>
              <Input
                value={formData.commercial_name}
                onChange={(e) => setFormData(prev => ({ ...prev, commercial_name: e.target.value }))}
                placeholder="e.g., BLUE DE CHANEL"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <FormField label="Item Number Prefix" required>
              <Select
                value={formData.item_number_prefix}
                onChange={(e) => setFormData(prev => ({ ...prev, item_number_prefix: e.target.value }))}
                options={itemNumberPrefixOptions}
              />
            </FormField>

            <FormField label="Item Number Suffix" required>
              <Input
                value={formData.item_number_suffix}
                onChange={(e) => setFormData(prev => ({ ...prev, item_number_suffix: e.target.value }))}
                placeholder="e.g., 001, 002"
              />
              <p className="text-sm text-gray-600 mt-1">Complete item number will be: {formData.item_number_prefix}{formData.item_number_suffix}</p>
            </FormField>
          </div>




        </div>



        {/* Additional Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Fragrance Notes">
            <TextArea
              value={formData.fragrance_notes}
              onChange={(e) => setFormData(prev => ({ ...prev, fragrance_notes: e.target.value }))}
              placeholder="Describe the fragrance notes..."
              rows={3}
            />
          </FormField>

          <FormField label="Concentration">
            <Input
              value={formData.concentration}
              onChange={(e) => setFormData(prev => ({ ...prev, concentration: e.target.value }))}
              placeholder="e.g., EDP, EDT, Parfum"
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Gender">
            <Select
              value={formData.gender}
              onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value }))}
              options={[
                { value: '', label: 'Select Gender' },
                { value: 'Men', label: 'Men' },
                { value: 'Women', label: 'Women' },
                { value: 'Unisex', label: 'Unisex' }
              ]}
            />
          </FormField>

          <FormField label="Season">
            <div className="space-y-2">
              {['Spring', 'Summer', 'Autumn', 'Winter'].map((season) => (
                <label key={season} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.season.includes(season)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData(prev => ({ ...prev, season: [...prev.season, season] }));
                      } else {
                        setFormData(prev => ({ ...prev, season: prev.season.filter(s => s !== season) }));
                      }
                    }}
                    className="mr-2"
                  />
                  <span className="text-sm">{season}</span>
                </label>
              ))}
            </div>
          </FormField>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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