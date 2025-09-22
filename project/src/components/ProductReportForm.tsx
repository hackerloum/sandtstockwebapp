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

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (success) {
    return (
      <PageContainer>
        <PageHeader title="Report Submitted" icon={CheckCircle} />
        <PageSection>
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-green-800 mb-2">
              Report Submitted Successfully
            </h3>
            <p className="text-green-600">
              Your product report has been submitted and will be reviewed by an administrator.
            </p>
          </div>
        </PageSection>
      </PageContainer>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Submit Product Report"
        description="Request to add or remove products from inventory"
        icon={Package}
      />

      <PageContainer>
        <PageSection>
          <div className="max-w-2xl mx-auto">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Report Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Report Type
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => handleChange('report_type', 'add')}
                    className={`p-4 rounded-lg border-2 transition-colors ${
                      formData.report_type === 'add'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Plus className="w-5 h-5" />
                      <div className="text-left">
                        <div className="font-medium">Add Product</div>
                        <div className="text-sm text-gray-500">Request to add new products</div>
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChange('report_type', 'remove')}
                    className={`p-4 rounded-lg border-2 transition-colors ${
                      formData.report_type === 'remove'
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <Package className="w-5 h-5" />
                      <div className="text-left">
                        <div className="font-medium">Remove Product</div>
                        <div className="text-sm text-gray-500">Request to remove products</div>
                      </div>
                    </div>
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
              <div className="flex justify-end space-x-3">
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
                  {loading ? 'Submitting...' : 'Submit Report'}
                </Button>
              </div>
            </form>
          </div>
        </PageSection>
      </PageContainer>
    </div>
  );
}; 