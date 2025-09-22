import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { PurchaseOrder, Product, Supplier, PurchaseOrderItem } from '../../types';
import { generateId, formatCurrency } from '../../utils/stockUtils';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { FormField, Input, TextArea, Select } from '../shared/Form';
import { useAuth } from '../../contexts/AuthContext';

interface POFormProps {
  po: PurchaseOrder | null;
  products: Product[];
  suppliers: Supplier[];
  onSave: (po: PurchaseOrder) => void;
  onClose: () => void;
  generatePONumber: () => string;
}

export const POForm: React.FC<POFormProps> = ({
  po,
  products,
  suppliers,
  onSave,
  onClose,
  generatePONumber
}) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    supplierId: po?.supplier_id || '',
    expectedDeliveryDate: po?.expected_delivery_date ? new Date(po.expected_delivery_date).toISOString().split('T')[0] : '',
    notes: po?.notes || ''
  });
  
  const [poItems, setPOItems] = useState<PurchaseOrderItem[]>(po?.items || []);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);

  const selectedSupplier = suppliers.find(s => s.id === formData.supplierId);

  const addItem = () => {
    const product = products.find(p => p.id === selectedProduct);
    if (!product) return;

    const existingItem = poItems.find(item => item.product_id === selectedProduct);
    if (existingItem) {
      setPOItems(prev => prev.map(item =>
        item.product_id === selectedProduct
          ? { ...item, quantity: item.quantity + quantity, total_price: (item.quantity + quantity) * item.unit_price }
          : item
      ));
    } else {
      const newItem: PurchaseOrderItem = {
        product_id: product.id,
        product_name: product.commercial_name,
        quantity,
        unit_price: unitPrice || product.price,
        total_price: quantity * (unitPrice || product.price)
      };
      setPOItems(prev => [...prev, newItem]);
    }
    
    setSelectedProduct('');
    setQuantity(1);
    setUnitPrice(0);
  };

  const removeItem = (productId: string) => {
    setPOItems(prev => prev.filter(item => item.product_id !== productId));
  };

  const totalAmount = poItems.reduce((sum, item) => sum + item.total_price, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.supplierId || poItems.length === 0) return;

    const poData: PurchaseOrder = {
      id: po?.id || generateId(),
      po_number: po?.po_number || generatePONumber(),
      supplier_id: formData.supplierId,
      supplier_name: selectedSupplier?.name || '',
      items: poItems,
      total_amount: totalAmount,
      status: po?.status || 'draft',
      order_date: po?.order_date || new Date().toISOString(),
      expected_delivery_date: formData.expectedDeliveryDate ? new Date(formData.expectedDeliveryDate).toISOString() : null,
      notes: formData.notes,
      created_by: po?.created_by || user?.username || null,
      created_at: po?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    onSave(poData);
  };

  const supplierOptions = suppliers.map(supplier => ({
    value: supplier.id,
    label: supplier.name
  }));

  const productOptions = products.map(product => ({
    value: product.id,
    label: `${product.commercial_name} - ${formatCurrency(product.price)}`
  }));

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={po ? 'Edit Purchase Order' : 'Create Purchase Order'}
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!formData.supplierId || poItems.length === 0}
          >
            {po ? 'Update PO' : 'Create PO'}
          </Button>
        </>
      }
    >
      <form className="space-y-6">
        {/* Supplier and Date */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Supplier" required>
            <Select
              value={formData.supplierId}
              onChange={(e) => setFormData(prev => ({ ...prev, supplierId: e.target.value }))}
              options={[{ value: '', label: 'Select supplier' }, ...supplierOptions]}
            />
          </FormField>
          <FormField label="Expected Delivery Date">
            <Input
              type="date"
              value={formData.expectedDeliveryDate}
              onChange={(e) => setFormData(prev => ({ ...prev, expectedDeliveryDate: e.target.value }))}
            />
          </FormField>
        </div>

        {/* Add Items */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Purchase Order Items</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <Select
              value={selectedProduct}
              onChange={(e) => {
                setSelectedProduct(e.target.value);
                const product = products.find(p => p.id === e.target.value);
                if (product) setUnitPrice(product.price);
              }}
              options={[{ value: '', label: 'Select product' }, ...productOptions]}
            />
            <Input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              min="1"
              placeholder="Quantity"
            />
            <Input
              type="number"
              value={unitPrice}
              onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
              min="0"
              step="0.01"
              placeholder="Unit Price"
            />
            <Button
              variant="primary"
              onClick={addItem}
              disabled={!selectedProduct}
            >
              Add
            </Button>
          </div>

          {/* Items List */}
          {poItems.length > 0 && (
            <div className="space-y-2">
              {poItems.map((item) => (
                <div key={item.product_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <span className="font-medium">{item.product_name}</span>
                    <span className="text-gray-600 ml-2">x{item.quantity} @ {formatCurrency(item.unit_price)}</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="font-medium">{formatCurrency(item.total_price)}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Trash2 className="w-4 h-4" />}
                      onClick={() => removeItem(item.product_id)}
                    />
                  </div>
                </div>
              ))}
              <div className="text-right pt-2 border-t border-gray-200">
                <span className="text-lg font-bold">Total: {formatCurrency(totalAmount)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Notes */}
        <FormField label="Notes">
          <TextArea
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            rows={3}
          />
        </FormField>
      </form>
    </Modal>
  );
};