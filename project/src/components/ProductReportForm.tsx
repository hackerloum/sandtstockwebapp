import React, { useState } from 'react';
import { Plus, Package, AlertCircle, CheckCircle } from 'lucide-react';
import { Product } from '../types';
import { createProductReport } from '../lib/supabase';
import { PageHeader, PageContainer, PageSection } from './shared/PageLayout';
import { Button } from './shared/Button';
import { Input, Select, TextArea } from './shared/Form';

interface ProductReportFormProps {
  products: Product[];
  onBack: () => void;
}

export const ProductReportForm: React.FC<ProductReportFormProps> = ({ products, onBack }) => {
  const [formData, setFormData] = useState({
    product_id: '',
    report_type: 'add' as 'add' | 'remove',
    quantity: 1,
    reason: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await createProductReport(formData);
      setSuccess(true);
      setTimeout(() => {
        onBack();
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit report');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof typeof formData, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (success) {
    return (
      <div className="space-y-5">
        <PageHeader title="Report submitted" onBack={onBack} />
        <PageContainer>
          <PageSection>
            <div className="py-8 text-center">
              <CheckCircle className="mx-auto mb-4 h-10 w-10 text-emerald-600" />
              <h3 className="text-lg font-medium text-gray-900">Report submitted successfully</h3>
              <p className="mt-2 text-sm text-gray-500">The request is ready for administrator review.</p>
            </div>
          </PageSection>
        </PageContainer>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="New product report"
        subtitle="Request an inventory addition or removal"
        onBack={onBack}
      />

      <PageContainer>
        <PageSection title="Request details">
          <div className="max-w-2xl mx-auto">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Report Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Report Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleChange('report_type', 'add')}
                    className={`rounded-md border px-3 py-3 text-sm font-medium transition-colors ${
                      formData.report_type === 'add'
                        ? 'border-emerald-600 bg-emerald-50 text-emerald-800'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="flex items-center justify-center gap-2"><Plus className="h-4 w-4" /> Add product</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChange('report_type', 'remove')}
                    className={`rounded-md border px-3 py-3 text-sm font-medium transition-colors ${
                      formData.report_type === 'remove'
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="flex items-center justify-center gap-2"><Package className="h-4 w-4" /> Remove product</span>
                  </button>
                </div>
              </div>

              {/* Product Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Product
                </label>
                <Select
                  value={formData.product_id}
                  onChange={(e) => handleChange('product_id', e.target.value)}
                  options={[
                    { value: '', label: 'Select a product' },
                    ...products.map(product => ({
                      value: product.id,
                      label: `${product.commercial_name} (${product.code})`
                    }))
                  ]}
                  required
                />
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantity
                </label>
                <Input
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => handleChange('quantity', parseInt(e.target.value) || 1)}
                  required
                />
              </div>

              {/* Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason *
                </label>
                <TextArea
                  value={formData.reason}
                  onChange={(e) => handleChange('reason', e.target.value)}
                  placeholder="Please provide a detailed reason for this request..."
                  rows={3}
                  required
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Notes (Optional)
                </label>
                <TextArea
                  value={formData.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  placeholder="Any additional information or context..."
                  rows={2}
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="w-5 h-5 text-red-500" />
                    <span className="text-red-700">{error}</span>
                  </div>
                </div>
              )}

              {/* Submit Buttons */}
              <div className="flex flex-col-reverse gap-2 border-t border-gray-200 pt-5 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={onBack}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={loading || !formData.product_id || !formData.reason}
                >
                  {loading ? 'Submitting...' : 'Submit report'}
                </Button>
              </div>
            </form>
          </div>
        </PageSection>
      </PageContainer>
    </div>
  );
};
