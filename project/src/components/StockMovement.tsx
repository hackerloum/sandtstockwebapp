import React, { useState } from 'react';
import { Plus, Minus, ArrowUpDown } from 'lucide-react';
import { Product, StockMovement } from '../types';
import { generateId } from '../utils/stockUtils';

interface StockMovementProps {
  products: Product[];
  movements: StockMovement[];
  onAddMovement: (movement: StockMovement) => void;
  onUpdateProduct: (product: Product) => void;
}

export const StockMovementComponent: React.FC<StockMovementProps> = ({
  products,
  movements,
  onAddMovement,
  onUpdateProduct
}) => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({
    productId: '',
    type: 'in' as 'in' | 'out',
    quantity: 0,
    reason: '',
    notes: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.productId || formData.quantity <= 0) return;

    const product = products.find(p => p.id === formData.productId);
    if (!product) return;

    // Create movement record
    const movement: StockMovement = {
      id: generateId(),
      productId: formData.productId,
      type: formData.type,
      quantity: formData.quantity,
      reason: formData.reason,
      date: new Date(),
      notes: formData.notes || undefined
    };

    // Update product stock
    const newStock = formData.type === 'in' 
      ? product.currentStock + formData.quantity
      : Math.max(0, product.currentStock - formData.quantity);

    const updatedProduct: Product = {
      ...product,
      currentStock: newStock,
      updatedAt: new Date()
    };

    onAddMovement(movement);
    onUpdateProduct(updatedProduct);

    // Reset form
    setFormData({
      productId: '',
      type: 'in',
      quantity: 0,
      reason: '',
      notes: ''
    });
    setIsFormOpen(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));
  };

  const recentMovements = movements
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 20);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Stock Movements</h2>
        <button
          onClick={() => setIsFormOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
        >
          <ArrowUpDown className="w-4 h-4" />
          <span>Record Movement</span>
        </button>
      </div>

      {isFormOpen && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Record Stock Movement</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Product</label>
                <select
                  name="productId"
                  value={formData.productId}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select a product</option>
                  {products.map(product => (
                    <option key={product.id} value={product.id}>
                      {product.name} (Current: {product.currentStock})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                <select
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="in">Stock In</option>
                  <option value="out">Stock Out</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input
                  type="number"
                  name="quantity"
                  value={formData.quantity}
                  onChange={handleChange}
                  min="1"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter quantity"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <input
                  type="text"
                  name="reason"
                  value={formData.reason}
                  onChange={handleChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="e.g., Purchase, Sale, Damage, etc."
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleChange}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Additional notes..."
              />
            </div>

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Record Movement
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Recent Movements</h3>
        </div>
        
        {recentMovements.length === 0 ? (
          <div className="p-6 text-center">
            <ArrowUpDown className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No movements recorded</h3>
            <p className="text-gray-600">Stock movements will appear here once you start recording them.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Product</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantity</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Reason</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Notes</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recentMovements.map((movement) => {
                  const product = products.find(p => p.id === movement.productId);
                  return (
                    <tr key={movement.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(movement.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {product?.name || 'Unknown Product'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
                          movement.type === 'in' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {movement.type === 'in' ? <Plus className="w-3 h-3 mr-1" /> : <Minus className="w-3 h-3 mr-1" />}
                          {movement.type === 'in' ? 'Stock In' : 'Stock Out'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {movement.quantity}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {movement.reason}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">
                        {movement.notes || '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};