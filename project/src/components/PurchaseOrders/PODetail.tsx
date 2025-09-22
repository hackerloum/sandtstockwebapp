import React, { useState } from 'react';
import { PurchaseOrder, Product } from '../../types';
import { formatCurrency, formatDate } from '../../utils/stockUtils';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/Button';
import { Select, Input } from '../shared/Form';

interface PODetailProps {
  po: PurchaseOrder;
  products: Product[];
  onClose: () => void;
  onReceive: (po: PurchaseOrder) => void;
  onUpdateStatus: (poId: string, status: string) => void;
}

export const PODetail: React.FC<PODetailProps> = ({
  po,
  products,
  onClose,
  onReceive,
  onUpdateStatus
}) => {
  const [receivedQuantities, setReceivedQuantities] = useState<Record<string, number>>(
    po.items?.reduce((acc, item) => ({
      ...acc,
      [item.product_id]: item.received_quantity || 0
    }), {}) || {}
  );

  const handleReceive = () => {
    const updatedPO = {
      ...po,
      items: po.items?.map(item => ({
        ...item,
        received_quantity: receivedQuantities[item.product_id] || 0
      })) || []
    };
    onReceive(updatedPO);
    onClose();
  };

  const statusOptions = [
    { value: 'draft', label: 'Draft' },
    { value: 'sent', label: 'Sent' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'received', label: 'Received' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Purchase Order Details"
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          {po.status === 'confirmed' && (
            <Button variant="primary" onClick={handleReceive}>
              Mark as Received
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-6">
        {/* PO Info */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-gray-700">PO Number</p>
            <p className="text-lg font-semibold text-gray-900">{po.po_number}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">Status</p>
            <Select
              value={po.status}
              onChange={(e) => onUpdateStatus(po.id, e.target.value)}
              options={statusOptions}
              className="mt-1"
            />
          </div>
        </div>

        {/* Supplier Info */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-3">Supplier Information</h3>
          <div className="bg-gray-50 rounded-lg p-4">
            <p className="font-medium">{po.supplier_name || 'Unknown Supplier'}</p>
            <p className="text-sm text-gray-600">Order Date: {formatDate(po.order_date)}</p>
            {po.expected_delivery_date && (
              <p className="text-sm text-gray-600">Expected: {formatDate(po.expected_delivery_date)}</p>
            )}
          </div>
        </div>

        {/* PO Items */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-3">Purchase Order Items</h3>
          <div className="space-y-3">
            {po.items?.map((item) => (
              <div key={item.product_id} className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="font-medium">{item.product_name}</p>
                    <p className="text-sm text-gray-600">
                      Quantity: {item.quantity} × {formatCurrency(item.unit_price)}
                    </p>
                  </div>
                  <p className="font-medium">{formatCurrency(item.total_price)}</p>
                </div>
                
                {po.status === 'confirmed' && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Received Quantity
                    </label>
                    <Input
                      type="number"
                      min="0"
                      max={item.quantity}
                      value={receivedQuantities[item.product_id] || 0}
                      onChange={(e) => setReceivedQuantities(prev => ({
                        ...prev,
                        [item.product_id]: parseInt(e.target.value) || 0
                      }))}
                      className="w-32"
                    />
                  </div>
                )}
              </div>
            ))}
            <div className="text-right pt-2 border-t border-gray-200">
              <p className="text-xl font-bold">Total: {formatCurrency(po.total_amount)}</p>
            </div>
          </div>
        </div>

        {po.notes && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Notes</h3>
            <p className="text-gray-600 bg-gray-50 rounded-lg p-3">{po.notes}</p>
          </div>
        )}
      </div>
    </Modal>
  );
};