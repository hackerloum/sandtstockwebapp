import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Order, Product, OrderItem } from '../../types';
import { generateOrderNumber, formatCurrency } from '../../utils/stockUtils';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { FormField, Input, TextArea, Select } from '../shared/Form';

interface OrderFormProps {
  order: Order | null;
  products: Product[];
  onSave: (order: Order) => void;
  onClose: () => void;
}

export const OrderForm: React.FC<OrderFormProps> = ({
  order,
  products,
  onSave,
  onClose
}) => {
  const [formData, setFormData] = useState({
    customerName: order?.customer_name || '',
    customerEmail: order?.customer_email || '',
    customerPhone: order?.customer_phone || '',
    orderType: order?.order_type || 'delivery',
    notes: order?.notes || ''
  });
  
  const [orderItems, setOrderItems] = useState<OrderItem[]>(order?.items || []);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [quantity, setQuantity] = useState(1);

  const addItem = () => {
    const product = products.find(p => p.id === selectedProduct);
    if (!product) return;

    const existingItem = orderItems.find(item => item.product_id === selectedProduct);
    if (existingItem) {
      setOrderItems(prev => prev.map(item =>
        item.product_id === selectedProduct
          ? { ...item, quantity: item.quantity + quantity, total_price: (item.quantity + quantity) * item.unit_price }
          : item
      ));
    } else {
      const newItem: OrderItem = {
        product_id: product.id,
        product_name: product.commercial_name,
        quantity,
        unit_price: product.price,
        total_price: quantity * product.price
      };
      setOrderItems(prev => [...prev, newItem]);
    }
    
    setSelectedProduct('');
    setQuantity(1);
  };

  const removeItem = (productId: string) => {
    setOrderItems(prev => prev.filter(item => item.product_id !== productId));
  };

  const totalAmount = orderItems.reduce((sum, item) => sum + item.total_price, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.customerName || orderItems.length === 0) return;

    const orderData: Order = {
      id: order?.id || Date.now().toString(),
      order_number: order?.order_number || generateOrderNumber(),
      customer_name: formData.customerName,
      customer_email: formData.customerEmail,
      customer_phone: formData.customerPhone,
      order_type: formData.orderType,
      pickup_by_staff: null,
      pickup_person_name: null,
      pickup_person_phone: null,
      items: orderItems,
      total_amount: totalAmount,
      status: order?.status || 'pending',
      notes: formData.notes,
      created_by: null,
      created_at: order?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    onSave(orderData);
  };

  const productOptions = products
    .filter(p => p.current_stock > 0)
    .map(product => ({
      value: product.id,
      label: `${product.commercial_name} - ${formatCurrency(product.price)} (Stock: ${product.current_stock})`
    }));

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={order ? 'Edit Order' : 'Create New Order'}
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={!formData.customerName || orderItems.length === 0}
          >
            {order ? 'Update Order' : 'Create Order'}
          </Button>
        </>
      }
    >
      <form className="space-y-6">
        {/* Order Type */}
        <div className="mb-4">
          <FormField label="Order Type" required>
            <Select
              value={formData.orderType}
              onChange={(e) => setFormData(prev => ({ ...prev, orderType: e.target.value }))}
              options={[
                { value: 'delivery', label: 'Delivery' },
                { value: 'storeToShop', label: 'Store to Shop' },
                { value: 'pickup', label: 'Pickup' }
              ]}
            />
          </FormField>
        </div>

        {/* Customer Information */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField label="Customer Name" required>
            <Input
              value={formData.customerName}
              onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
              required
            />
          </FormField>
          <FormField label="Email">
            <Input
              type="email"
              value={formData.customerEmail}
              onChange={(e) => setFormData(prev => ({ ...prev, customerEmail: e.target.value }))}
            />
          </FormField>
          <FormField label="Phone">
            <Input
              type="tel"
              value={formData.customerPhone}
              onChange={(e) => setFormData(prev => ({ ...prev, customerPhone: e.target.value }))}
            />
          </FormField>
        </div>

        {/* Add Items */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Order Items</h3>
          
          <div className="flex gap-4 mb-4">
            <Select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
              options={[{ value: '', label: 'Select a product' }, ...productOptions]}
              className="flex-1"
            />
            <Input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
              min="1"
              className="w-24"
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
          {orderItems.length > 0 && (
            <div className="space-y-2">
              {orderItems.map((item) => (
                <div key={item.product_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <span className="font-medium">{item.product_name}</span>
                    <span className="text-gray-600 ml-2">x{item.quantity}</span>
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