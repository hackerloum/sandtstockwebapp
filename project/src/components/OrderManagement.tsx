import React, { useState } from 'react';
import { Plus, Search, Eye, Edit2, Trash2, ShoppingCart, User, Calendar, DollarSign } from 'lucide-react';
import { Order, Product, OrderItem } from '../types';
import { generateOrderNumber, formatCurrency, formatDate } from '../utils/stockUtils';

interface OrderManagementProps {
  orders: Order[];
  products: Product[];
  onAddOrder: (order: Order) => void;
  onUpdateOrder: (order: Order) => void;
  onDeleteOrder: (id: string) => void;
  onUpdateProduct: (product: Product) => void;
}

export const OrderManagement: React.FC<OrderManagementProps> = ({
  orders,
  products,
  onAddOrder,
  onUpdateOrder,
  onDeleteOrder,
  onUpdateProduct
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);

  const filteredOrders = orders.filter(order => {
    const matchesSearch = (order.order_number || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (order.customer_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'processing': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'shipped': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'delivered': return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Order Management</h2>
        <button
          onClick={() => setShowOrderForm(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span>New Order</span>
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Orders', value: orders.length, color: 'text-blue-600' },
          { label: 'Pending', value: orders.filter(o => o.status === 'pending').length, color: 'text-yellow-600' },
          { label: 'Processing', value: orders.filter(o => o.status === 'processing').length, color: 'text-blue-600' },
          { label: 'Delivered', value: orders.filter(o => o.status === 'delivered').length, color: 'text-green-600' }
        ].map((stat, index) => (
          <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                <p className={`text-3xl font-bold ${stat.color} mt-1`}>{stat.value}</p>
              </div>
              <ShoppingCart className="w-8 h-8 text-gray-400" />
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search orders..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Orders Table */}
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredOrders.map((order) => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{order.order_number}</div>
                    <div className="text-sm text-gray-500">{order.items?.length || 0} items</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{order.customer_name}</div>
                    <div className="text-sm text-gray-500">{order.customer_email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(order.created_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(order.status)}`}>
                      {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatCurrency(order.total_amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => setViewingOrder(order)}
                        className="text-blue-600 hover:text-blue-900 p-1"
                        title="View Order"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setEditingOrder(order);
                          setShowOrderForm(true);
                        }}
                        className="text-indigo-600 hover:text-indigo-900 p-1"
                        title="Edit Order"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm('Are you sure you want to delete this order?')) {
                            onDeleteOrder(order.id);
                          }
                        }}
                        className="text-red-600 hover:text-red-900 p-1"
                        title="Delete Order"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Form Modal */}
      {showOrderForm && (
        <OrderForm
          order={editingOrder}
          products={products}
          onSave={(order) => {
            if (editingOrder) {
              onUpdateOrder(order);
            } else {
              onAddOrder(order);
              // Update product stock
              order.items.forEach(item => {
                const product = products.find(p => p.id === item.productId);
                if (product) {
                  const updatedProduct = {
                    ...product,
                    currentStock: Math.max(0, product.currentStock - item.quantity),
                    updatedAt: new Date()
                  };
                  onUpdateProduct(updatedProduct);
                }
              });
            }
            setShowOrderForm(false);
            setEditingOrder(null);
          }}
          onClose={() => {
            setShowOrderForm(false);
            setEditingOrder(null);
          }}
        />
      )}

      {/* Order Detail Modal */}
      {viewingOrder && (
        <OrderDetailModal
          order={viewingOrder}
          products={products}
          onClose={() => setViewingOrder(null)}
          onUpdateStatus={(orderId, status) => {
            const updatedOrder = { ...viewingOrder, status };
            onUpdateOrder(updatedOrder);
            setViewingOrder(updatedOrder);
          }}
        />
      )}
    </div>
  );
};

// Order Form Component
interface OrderFormProps {
  order: Order | null;
  products: Product[];
  onSave: (order: Order) => void;
  onClose: () => void;
}

const OrderForm: React.FC<OrderFormProps> = ({ order, products, onSave, onClose }) => {
  const [formData, setFormData] = useState({
    customerName: order?.customer_name || '',
    customerEmail: order?.customer_email || '',
    customerPhone: order?.customer_phone || '',
    orderType: order?.order_type || 'store-to-shop',
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
      order_type: formData.orderType as 'store-to-shop' | 'international-to-tanzania',
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {order ? 'Edit Order' : 'Create New Order'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Order Type */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Order Type *</label>
            <select
              value={formData.orderType}
              onChange={(e) => setFormData(prev => ({ ...prev, orderType: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            >
              <option value="store-to-shop">Store to Shop (Local)</option>
              <option value="international-to-tanzania">International to Tanzania</option>
            </select>
          </div>

          {/* Customer Information */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name *</label>
              <input
                type="text"
                value={formData.customerName}
                onChange={(e) => setFormData(prev => ({ ...prev, customerName: e.target.value }))}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={formData.customerEmail}
                onChange={(e) => setFormData(prev => ({ ...prev, customerEmail: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
              <input
                type="tel"
                value={formData.customerPhone}
                onChange={(e) => setFormData(prev => ({ ...prev, customerPhone: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Add Items */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Order Items</h3>
            
            <div className="flex gap-4 mb-4">
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select a product</option>
                {products.filter(p => p.current_stock > 0).map(product => (
                  <option key={product.id} value={product.id}>
                    {product.commercial_name} - {formatCurrency(product.price)} (Stock: {product.current_stock})
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                min="1"
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                type="button"
                onClick={addItem}
                disabled={!selectedProduct}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg transition-colors"
              >
                Add
              </button>
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
                      <button
                        type="button"
                        onClick={() => removeItem(item.product_id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
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
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!formData.customerName || orderItems.length === 0}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg transition-colors"
            >
              {order ? 'Update Order' : 'Create Order'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Order Detail Modal Component
interface OrderDetailModalProps {
  order: Order;
  products: Product[];
  onClose: () => void;
  onUpdateStatus: (orderId: string, status: string) => void;
}

const OrderDetailModal: React.FC<OrderDetailModalProps> = ({ order, products, onClose, onUpdateStatus }) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Order Details</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              ×
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Order Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-700">Order Number</p>
              <p className="text-lg font-semibold text-gray-900">{order.order_number}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Status</p>
              <select
                value={order.status}
                onChange={(e) => onUpdateStatus(order.id, e.target.value)}
                className="mt-1 px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="shipped">Shipped</option>

                <option value="delivered">Delivered</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Customer Info */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Customer Information</h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                          <p><span className="font-medium">Name:</span> {order.customer_name}</p>
            <p><span className="font-medium">Email:</span> {order.customer_email}</p>
            <p><span className="font-medium">Phone:</span> {order.customer_phone}</p>
            </div>
          </div>

          {/* Order Items */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Order Items</h3>
            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={item.productId} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium">{item.productName}</p>
                    <p className="text-sm text-gray-600">Quantity: {item.quantity} × {formatCurrency(item.unitPrice)}</p>
                  </div>
                  <p className="font-medium">{formatCurrency(item.totalPrice)}</p>
                </div>
              ))}
              <div className="text-right pt-2 border-t border-gray-200">
                <p className="text-xl font-bold">Total: {formatCurrency(order.total_amount)}</p>
              </div>
            </div>
          </div>

          {order.notes && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Notes</h3>
              <p className="text-gray-600 bg-gray-50 rounded-lg p-3">{order.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};