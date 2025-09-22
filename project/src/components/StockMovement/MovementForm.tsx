import React, { useState } from 'react';
import { Product, StockMovement } from '../../types';
import { generateId } from '../../utils/stockUtils';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { FormField, Input, Select, TextArea } from '../shared/Form';

interface MovementFormProps {
  products: Product[];
  onAddMovement: (movement: StockMovement) => void;
  onUpdateProduct: (product: Product) => void;
  onClose: () => void;
}

export const MovementForm: React.FC<MovementFormProps> = ({
  products,
  onAddMovement,
  onUpdateProduct,
  onClose
}) => {
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
    onClose();
  };

  const productOptions = products.map(product => ({
    value: product.id,
    label: `${product.name} (Current: ${product.currentStock})`
  }));

  const typeOptions = [
    { value: 'in', label: 'Stock In' },
    { value: 'out', label: 'Stock Out' }
  ];

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Record Stock Movement"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!formData.productId || formData.quantity <= 0}
          >
            Record Movement
          </Button>
        </>
      }
    >
      <form className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Product" required>
            <Select
              name="productId"
              value={formData.productId}
              onChange={(e) => setFormData(prev => ({ ...prev, productId: e.target.value }))}
              options={[{ value: '', label: 'Select a product' }, ...productOptions]}
            />
          </FormField>

          <FormField label="Type">
            <Select
              name="type"
              value={formData.type}
              onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as 'in' | 'out' }))}
              options={typeOptions}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Quantity" required>
            <Input
              type="number"
              name="quantity"
              value={formData.quantity}
              onChange={(e) => setFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 0 }))}
              min="1"
              placeholder="Enter quantity"
            />
          </FormField>

          <FormField label="Reason" required>
            <Input
              type="text"
              name="reason"
              value={formData.reason}
              onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
              placeholder="e.g., Purchase, Sale, Damage, etc."
            />
          </FormField>
        </div>

        <FormField label="Notes" helpText="Optional additional information">
          <TextArea
            name="notes"
            value={formData.notes}
            onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            rows={2}
            placeholder="Additional notes..."
          />
        </FormField>
      </form>
    </Modal>
  );
};