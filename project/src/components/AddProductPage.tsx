import React, { useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { Brand, Product, ProductType, Supplier } from '../types';
import { checkProductExists } from '../lib/supabase';
import { Button } from './shared/Button';
import { Checkbox, FormField, Input, Select, TextArea } from './shared/Form';
import { PageHeader } from './shared/PageLayout';

interface AddProductPageProps {
  onSave: (product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => void;
  onBack: () => void;
  brands: Brand[];
  suppliers: Supplier[];
  product?: Product | null;
}

type ProductDraft = Omit<Product, 'id' | 'created_at' | 'updated_at'>;

const productTypes: ProductType[] = ['Fragrance Bottles', 'Crimp', 'Accessories', 'Packaging'];

const categoryByType: Record<ProductType, string> = {
  'Fragrance Bottles': 'Eau de Parfum',
  Crimp: 'Crimping Tools',
  Accessories: 'Accessories',
  Packaging: 'Packaging'
};

const createDraft = (product?: Product | null): ProductDraft => product ? ({
  code: product.code,
  item_number: product.item_number,
  commercial_name: product.commercial_name,
  product_type: product.product_type,
  brand_id: product.brand_id,
  category: product.category,
  concentration: product.concentration,
  size: product.size,
  gross_weight: product.gross_weight,
  tare_weight: product.tare_weight,
  net_weight: product.net_weight,
  current_stock: product.current_stock,
  min_stock: product.min_stock,
  max_stock: product.max_stock,
  reorder_point: product.reorder_point,
  price: product.price,
  supplier_id: product.supplier_id,
  fragrance_notes: product.fragrance_notes,
  gender: product.gender,
  season: product.season,
  is_tester: product.is_tester,
  created_by: product.created_by,
  updated_by: product.updated_by
}) : ({
  code: '',
  item_number: '',
  commercial_name: '',
  product_type: 'Fragrance Bottles',
  brand_id: null,
  category: categoryByType['Fragrance Bottles'],
  concentration: null,
  size: 100,
  gross_weight: 0,
  tare_weight: 0,
  net_weight: 0,
  current_stock: 0,
  min_stock: 5,
  max_stock: 50,
  reorder_point: 10,
  price: 0,
  supplier_id: null,
  fragrance_notes: null,
  gender: null,
  season: null,
  is_tester: false,
  created_by: null,
  updated_by: null
});

export const AddProductPage: React.FC<AddProductPageProps> = ({
  onSave,
  onBack,
  brands,
  suppliers,
  product = null
}) => {
  const [formData, setFormData] = useState<ProductDraft>(() => createDraft(product));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const setNumber = (field: keyof ProductDraft, value: string) => {
    setFormData((current) => ({ ...current, [field]: Number(value) || 0 }));
  };

  const handleTypeChange = (productType: ProductType) => {
    setFormData((current) => ({
      ...current,
      product_type: productType,
      category: categoryByType[productType],
      size: productType === 'Fragrance Bottles' ? current.size || 100 : 0,
      is_tester: productType === 'Fragrance Bottles' ? current.is_tester : false
    }));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const code = formData.code.trim().toUpperCase();
    const name = formData.commercial_name.trim();
    const itemNumber = formData.item_number.trim().toUpperCase() || code;
    if (!code || !name) {
      setError('Product name and code are required.');
      return;
    }
    if (formData.max_stock > 0 && formData.min_stock > formData.max_stock) {
      setError('Minimum stock cannot be higher than maximum stock.');
      return;
    }

    setIsSaving(true);
    try {
      const existing = await checkProductExists(code, product?.id);
      if (existing) {
        setError(`Code ${code} is already used by ${existing.commercial_name}.`);
        return;
      }
      onSave({
        ...formData,
        code,
        item_number: itemNumber,
        commercial_name: name,
        category: formData.category.trim() || categoryByType[formData.product_type],
        concentration: formData.concentration?.trim() || null,
        fragrance_notes: formData.fragrance_notes?.trim() || null,
        gender: formData.gender?.trim() || null
      });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save this product.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title={product ? 'Edit product' : 'Add product'}
        subtitle={product ? `Update ${product.commercial_name}` : 'Enter the product and opening stock in one step'}
        onBack={onBack}
      />

      <form onSubmit={handleSubmit} className="overflow-hidden rounded-md border border-gray-200 bg-white">
        <section className="border-b border-gray-200 p-4 sm:p-6">
          <h2 className="text-base font-semibold text-gray-900">Product type</h2>
          <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4" role="group" aria-label="Product type">
            {productTypes.map((productType) => (
              <button
                key={productType}
                type="button"
                onClick={() => handleTypeChange(productType)}
                className={`min-h-11 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                  formData.product_type === productType
                    ? 'border-emerald-700 bg-emerald-50 text-emerald-800'
                    : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}
                aria-pressed={formData.product_type === productType}
              >
                {productType}
              </button>
            ))}
          </div>
        </section>

        <section className="border-b border-gray-200 p-4 sm:p-6">
          <h2 className="text-base font-semibold text-gray-900">Product information</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField label="Product name" required>
              <Input
                value={formData.commercial_name}
                onChange={(event) => setFormData({ ...formData, commercial_name: event.target.value })}
                placeholder="Product name"
                autoFocus
              />
            </FormField>
            <FormField label="Product code" required>
              <Input
                value={formData.code}
                onChange={(event) => setFormData({ ...formData, code: event.target.value.toUpperCase() })}
                placeholder="e.g. PROD-001"
              />
            </FormField>
            <FormField label="Item number" helpText="Uses the product code when left blank">
              <Input
                value={formData.item_number}
                onChange={(event) => setFormData({ ...formData, item_number: event.target.value.toUpperCase() })}
                placeholder="Optional"
              />
            </FormField>
            <FormField label="Category">
              <Input
                value={formData.category}
                onChange={(event) => setFormData({ ...formData, category: event.target.value })}
                placeholder="Category"
              />
            </FormField>
            <FormField label="Brand">
              <Select
                value={formData.brand_id ?? ''}
                onChange={(event) => setFormData({ ...formData, brand_id: event.target.value || null })}
                options={[
                  { value: '', label: 'No brand' },
                  ...brands.map((brand) => ({ value: brand.id, label: brand.name }))
                ]}
              />
            </FormField>
            <FormField label="Supplier">
              <Select
                value={formData.supplier_id ?? ''}
                onChange={(event) => setFormData({ ...formData, supplier_id: event.target.value || null })}
                options={[
                  { value: '', label: 'No supplier' },
                  ...suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name }))
                ]}
              />
            </FormField>
          </div>
        </section>

        <section className="border-b border-gray-200 p-4 sm:p-6">
          <h2 className="text-base font-semibold text-gray-900">Price and stock</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-5">
            <FormField label="Selling price" required className="col-span-2 sm:col-span-1">
              <Input type="number" min="0" step="0.01" value={formData.price} onChange={(event) => setNumber('price', event.target.value)} />
            </FormField>
            <FormField label="Opening stock" required>
              <Input type="number" min="0" value={formData.current_stock} onChange={(event) => setNumber('current_stock', event.target.value)} />
            </FormField>
            <FormField label="Low stock at">
              <Input type="number" min="0" value={formData.reorder_point} onChange={(event) => setNumber('reorder_point', event.target.value)} />
            </FormField>
            <FormField label="Minimum stock">
              <Input type="number" min="0" value={formData.min_stock} onChange={(event) => setNumber('min_stock', event.target.value)} />
            </FormField>
            <FormField label="Maximum stock">
              <Input type="number" min="0" value={formData.max_stock} onChange={(event) => setNumber('max_stock', event.target.value)} />
            </FormField>
          </div>
        </section>

        <details className="border-b border-gray-200 p-4 sm:p-6">
          <summary className="cursor-pointer text-sm font-semibold text-gray-900">More product details</summary>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField label={formData.product_type === 'Fragrance Bottles' ? 'Bottle size (ml)' : 'Size'}>
              <Input type="number" min="0" step="0.01" value={formData.size} onChange={(event) => setNumber('size', event.target.value)} />
            </FormField>
            <FormField label="Gross weight (kg)">
              <Input type="number" min="0" step="0.001" value={formData.gross_weight} onChange={(event) => setNumber('gross_weight', event.target.value)} />
            </FormField>
            <FormField label="Tare weight (kg)">
              <Input type="number" min="0" step="0.001" value={formData.tare_weight} onChange={(event) => setNumber('tare_weight', event.target.value)} />
            </FormField>
            <FormField label="Net weight (kg)">
              <Input type="number" min="0" step="0.001" value={formData.net_weight} onChange={(event) => setNumber('net_weight', event.target.value)} />
            </FormField>
            {formData.product_type === 'Fragrance Bottles' && (
              <>
                <FormField label="Concentration">
                  <Input value={formData.concentration ?? ''} onChange={(event) => setFormData({ ...formData, concentration: event.target.value })} />
                </FormField>
                <FormField label="Gender">
                  <Select
                    value={formData.gender ?? ''}
                    onChange={(event) => setFormData({ ...formData, gender: event.target.value || null })}
                    options={[
                      { value: '', label: 'Not specified' },
                      { value: 'Unisex', label: 'Unisex' },
                      { value: 'Women', label: 'Women' },
                      { value: 'Men', label: 'Men' }
                    ]}
                  />
                </FormField>
                <FormField label="Fragrance notes" className="sm:col-span-2 lg:col-span-3">
                  <TextArea rows={3} value={formData.fragrance_notes ?? ''} onChange={(event) => setFormData({ ...formData, fragrance_notes: event.target.value })} />
                </FormField>
                <Checkbox
                  label="This product is a tester"
                  checked={formData.is_tester}
                  onChange={(event) => setFormData({ ...formData, is_tester: event.target.checked })}
                />
              </>
            )}
          </div>
        </details>

        {error && (
          <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 sm:px-6" role="alert">
            {error}
          </div>
        )}

        <div className="flex flex-col-reverse gap-2 p-4 sm:flex-row sm:justify-end sm:p-6">
          <Button type="button" variant="outline" onClick={onBack} disabled={isSaving}>Cancel</Button>
          <Button type="submit" icon={isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} disabled={isSaving}>
            {isSaving ? 'Saving...' : product ? 'Save changes' : 'Save product'}
          </Button>
        </div>
      </form>
    </div>
  );
};
