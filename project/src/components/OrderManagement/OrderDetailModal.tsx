import React from 'react';
import { Printer, Download, FileText, User, Phone, Mail, Calendar, Package, Info } from 'lucide-react';
import { Order, Product } from '../../types';
import { formatCurrency, formatDate } from '../../utils/stockUtils';
import { printOrderPDF, printOrderPDFToWindow } from '../../utils/pdfUtils';
import { Modal } from '../shared/Modal';
import { Select } from '../shared/Form';
import { Button } from '../shared/Button';

interface OrderDetailModalProps {
  order: Order;
  products: Product[];
  onClose: () => void;
  onUpdateStatus: (orderId: string, status: string) => void;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  order,
  products,
  onClose,
  onUpdateStatus
}) => {
  const statusOptions = [
    { value: 'pending', label: 'Pending' },
    { value: 'processing', label: 'Processing' },
    { value: 'shipped', label: 'Shipped' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  const handlePrintPDF = () => {
    printOrderPDFToWindow(order, products);
  };

  const handleDownloadPDF = () => {
    printOrderPDF(order, products);
  };

  // Helper function to get order type display info
  const getOrderTypeInfo = (orderType: string) => {
    switch (orderType) {
      case 'delivery':
        return { label: 'Delivery', style: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'storeToShop':
        return { label: 'Store to Shop', style: 'bg-green-50 text-green-700 border-green-200' };
      case 'pickup':
        return { label: 'Pickup', style: 'bg-purple-50 text-purple-700 border-purple-200' };
      case 'store-to-shop':
        return { label: 'Store to Shop', style: 'bg-green-50 text-green-700 border-green-200' };
      case 'international-to-tanzania':
        return { label: 'International to Tanzania', style: 'bg-orange-50 text-orange-700 border-orange-200' };
      default:
        return { label: orderType || 'Unknown', style: 'bg-gray-50 text-gray-700 border-gray-200' };
    }
  };

  const orderTypeInfo = getOrderTypeInfo(order.order_type);

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Order Details"
      size="lg"
    >
      <div className="space-y-6">
        {/* Print Actions */}
        <div className="flex justify-end space-x-2 pb-4 border-b border-gray-200">
          <Button
            variant="outline"
            size="sm"
            icon={<Printer className="w-4 h-4" />}
            onClick={handlePrintPDF}
          >
            Print PDF
          </Button>
          <Button
            variant="outline"
            size="sm"
            icon={<Download className="w-4 h-4" />}
            onClick={handleDownloadPDF}
          >
            Download PDF
          </Button>
        </div>

        {/* Order Information */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
            <Package className="w-5 h-5 mr-2" />
            Order Information
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-700">Order Number</p>
                  <p className="text-lg font-semibold text-gray-900">{order.order_number}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Order Type</p>
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${orderTypeInfo.style}`}>
                    {orderTypeInfo.label}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Status</p>
                  <Select
                    value={order.status}
                    onChange={(e) => onUpdateStatus(order.id, e.target.value)}
                    options={statusOptions}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-700">Created Date</p>
                  <p className="text-sm text-gray-900 flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    {formatDate(order.created_at)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Last Updated</p>
                  <p className="text-sm text-gray-900 flex items-center">
                    <Calendar className="w-4 h-4 mr-1" />
                    {formatDate(order.updated_at)}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Total Amount</p>
                  <p className="text-lg font-bold text-green-600">{formatCurrency(order.total_amount)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Customer Information */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
            <User className="w-5 h-5 mr-2" />
            Customer Information
          </h3>
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center">
              <User className="w-4 h-4 mr-2 text-gray-500" />
              <span className="font-medium">Name:</span>
              <span className="ml-2 text-gray-900">{order.customer_name}</span>
            </div>
            {order.customer_email && (
              <div className="flex items-center">
                <Mail className="w-4 h-4 mr-2 text-gray-500" />
                <span className="font-medium">Email:</span>
                <span className="ml-2 text-gray-900">{order.customer_email}</span>
              </div>
            )}
            {order.customer_phone && (
              <div className="flex items-center">
                <Phone className="w-4 h-4 mr-2 text-gray-500" />
                <span className="font-medium">Phone:</span>
                <span className="ml-2 text-gray-900">{order.customer_phone}</span>
              </div>
            )}
          </div>
        </div>

        {/* Pickup Information (if available) */}
        {(order.pickup_person_name || order.pickup_person_phone || order.pickup_by_staff) && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
              <Package className="w-5 h-5 mr-2" />
              Pickup Information
            </h3>
            <div className="bg-blue-50 rounded-lg p-4 space-y-3">
              {order.pickup_person_name && (
                <div className="flex items-center">
                  <User className="w-4 h-4 mr-2 text-blue-500" />
                  <span className="font-medium">Pickup Person:</span>
                  <span className="ml-2 text-gray-900">{order.pickup_person_name}</span>
                </div>
              )}
              {order.pickup_person_phone && (
                <div className="flex items-center">
                  <Phone className="w-4 h-4 mr-2 text-blue-500" />
                  <span className="font-medium">Pickup Phone:</span>
                  <span className="ml-2 text-gray-900">{order.pickup_person_phone}</span>
                </div>
              )}
              {order.pickup_by_staff !== null && (
                <div className="flex items-center">
                  <Info className="w-4 h-4 mr-2 text-blue-500" />
                  <span className="font-medium">Staff Pickup:</span>
                  <span className="ml-2 text-gray-900">
                    {order.pickup_by_staff ? 'Yes' : 'No'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Order Items */}
        <div>
          <h3 className="text-lg font-medium text-gray-900 mb-3 flex items-center">
            <Package className="w-5 h-5 mr-2" />
            Order Items
          </h3>
          {order.items && order.items.length > 0 ? (
            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={item.product_id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">{item.product_name}</p>
                    <p className="text-sm text-gray-600">
                      Quantity: {item.quantity} × {formatCurrency(item.unit_price)}
                    </p>
                  </div>
                  <p className="font-medium">{formatCurrency(item.total_price)}</p>
                </div>
              ))}
              <div className="text-right pt-2 border-t border-gray-200">
                <p className="text-xl font-bold">Total: {formatCurrency(order.total_amount)}</p>
              </div>
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-yellow-800 text-sm">
                <Info className="w-4 h-4 inline mr-1" />
                No order items found. This may be due to database schema limitations.
              </p>
            </div>
          )}
        </div>

        {/* Notes */}
        {order.notes && (
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-2 flex items-center">
              <Info className="w-5 h-5 mr-2" />
              Notes
            </h3>
            <p className="text-gray-600 bg-gray-50 rounded-lg p-3">{order.notes}</p>
          </div>
        )}

        {/* Database Information (for debugging) */}
        <div className="bg-gray-100 rounded-lg p-3">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Database Information</h4>
          <div className="text-xs text-gray-600 space-y-1">
            <p>Order ID: {order.id}</p>
            <p>Created By: {order.created_by || 'Not specified'}</p>
            <p>Order Type (raw): {order.order_type}</p>
            <p>Pickup by Staff: {order.pickup_by_staff?.toString() || 'Not specified'}</p>
            <p>Items Count: {order.items?.length || 0}</p>
          </div>
        </div>
      </div>
    </Modal>
  );
};