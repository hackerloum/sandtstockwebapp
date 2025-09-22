import React, { useState } from 'react';
import { Plus, Search, Eye, Edit2, Trash2, FileText, Calendar, DollarSign, Package } from 'lucide-react';
import { PurchaseOrder, Product, Supplier, PurchaseOrderItem } from '../types';
import { generateId, formatCurrency, formatDate } from '../utils/stockUtils';
import { useAuth } from '../contexts/AuthContext';

interface PurchaseOrdersProps {
  purchaseOrders: PurchaseOrder[];
  products: Product[];
  suppliers: Supplier[];
  onAddPurchaseOrder: (po: PurchaseOrder) => void;
  onUpdatePurchaseOrder: (po: PurchaseOrder) => void;
  onDeletePurchaseOrder: (id: string) => void;
  onUpdateProduct: (product: Product) => void;
}

export const PurchaseOrders: React.FC<PurchaseOrdersProps> = ({
  purchaseOrders,
  products,
  suppliers,
  onAddPurchaseOrder,
  onUpdatePurchaseOrder,
  onDeletePurchaseOrder,
  onUpdateProduct
}) => {
  const { user, hasPermission } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showPOForm, setShowPOForm] = useState(false);
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null);
  const [viewingPO, setViewingPO] = useState<PurchaseOrder | null>(null);

  const filteredPOs = purchaseOrders.filter(po => {
    const matchesSearch = po.poNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         po.supplierName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || po.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'sent': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'confirmed': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'received': return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const generatePONumber = () => {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `PO${year}${month}${day}${random}`;
  };

  const handleReceivePO = (po: PurchaseOrder) => {
    // Update product stock based on received quantities
    po.items.forEach(item => {
      const product = products.find(p => p.id === item.productId);
      if (product && item.receivedQuantity) {
        const updatedProduct = {
          ...product,
          currentStock: product.currentStock + item.receivedQuantity,
          updatedAt: new Date(),
          updatedBy: user?.username
        };
        onUpdateProduct(updatedProduct);
      }
    });

    // Update PO status
    const updatedPO = {
      ...po,
      status: 'received' as const,
      actualDeliveryDate: new Date(),
      updatedBy: user?.username
    };
    onUpdatePurchaseOrder(updatedPO);
  };

  if (!hasPermission('view_purchase_orders')) {
    return (
      <div className="text-center py-12">
        <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
        <p className="text-gray-600">You don't have permission to view purchase orders.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Purchase Orders</h2>
        {hasPermission('add_purchase_order') && (
          <button
            onClick={() => setShowPOForm(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>New Purchase Order</span>
          </button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total POs', value: purchaseOrders.length, color: 'text-blue-600' },
          { label: 'Draft', value: purchaseOrders.filter(po => po.status === 'draft').length, color: 'text-gray-600' },
          { label: 'Sent', value: purchaseOrders.filter(po => po.status === 'sent').length, color: 'text-blue-600' },
          { label: 'Received', value: purchaseOrders.filter(po => po.status === 'received').length, color: 'text-green-600' }
        ].map((stat, index) => (
          <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.label}</p>
                <p className={`text-3xl font-bold ${stat.color} mt-1`}>{stat.value}</p>
              </div>
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
          </div>
        ))}
      </div>

      {/* Filters and Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search purchase orders..."
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
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="confirmed">Confirmed</option>
            <option value="received">Received</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">PO Number</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredPOs.map((po) => (
                <tr key={po.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{po.poNumber}</div>
                    <div className="text-sm text-gray-500">{po.items.length} items</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {po.supplierName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatDate(po.orderDate)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(po.status)}`}>
                      {po.status.charAt(0).toUpperCase() + po.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatCurrency(po.totalAmount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => setViewingPO(po)}
                        className="text-blue-600 hover:text-blue-900 p-1"
                        title="View PO"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {hasPermission('edit_purchase_order') && (
                        <button
                          onClick={() => {
                            setEditingPO(po);
                            setShowPOForm(true);
                          }}
                          className="text-indigo-600 hover:text-indigo-900 p-1"
                          title="Edit PO"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                      )}
                      {hasPermission('edit_purchase_order') && (
                        <button
                          onClick={() => {
                            if (window.confirm('Are you sure you want to delete this purchase order?')) {
                              onDeletePurchaseOrder(po.id);
                            }
                          }}
                          className="text-red-600 hover:text-red-900 p-1"
                          title="Delete PO"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* PO Form Modal */}
      {showPOForm && (
        <PurchaseOrderForm
          po={editingPO}
          products={products}
          suppliers={suppliers}
          onSave={(po) => {
            if (editingPO) {
              onUpdatePurchaseOrder(po);
            } else {
              onAddPurchaseOrder(po);
            }
            setShowPOForm(false);
            setEditingPO(null);
          }}
          onClose={() => {
            setShowPOForm(false);
            setEditingPO(null);
          }}
          generatePONumber={generatePONumber}
        />
      )}

      {/* PO Detail Modal */}
      {viewingPO && (
        <PurchaseOrderDetail
          po={viewingPO}
          products={products}
          onClose={() => setViewingPO(null)}
          onReceive={handleReceivePO}
          onUpdateStatus={(poId, status) => {
            const updatedPO = { ...viewingPO, status, updatedBy: user?.username };
            onUpdatePurchaseOrder(updatedPO);
            setViewingPO(updatedPO);
          }}
        />
      )}
    </div>
  );
};

// Purchase Order Form Component
interface PurchaseOrderFormProps {
  po: PurchaseOrder | null;
  products: Product[];
  suppliers: Supplier[];
  onSave: (po: PurchaseOrder) => void;
  onClose: () => void;
  generatePONumber: () => string;
}

const PurchaseOrderForm: React.FC<PurchaseOrderFormProps> = ({
  po,
  products,
  suppliers,
  onSave,
  onClose,
  generatePONumber
}) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    supplierId: po?.supplierId || '',
    expectedDeliveryDate: po?.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toISOString().split('T')[0] : '',
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

    const existingItem = poItems.find(item => item.productId === selectedProduct);
    if (existingItem) {
      setPOItems(prev => prev.map(item =>
        item.productId === selectedProduct
          ? { ...item, quantity: item.quantity + quantity, totalPrice: (item.quantity + quantity) * item.unitPrice }
          : item
      ));
    } else {
      const newItem: PurchaseOrderItem = {
        productId: product.id,
        productName: product.name,
        quantity,
        unitPrice: unitPrice || product.price,
        totalPrice: quantity * (unitPrice || product.price)
      };
      setPOItems(prev => [...prev, newItem]);
    }
    
    setSelectedProduct('');
    setQuantity(1);
    setUnitPrice(0);
  };

  const removeItem = (productId: string) => {
    setPOItems(prev => prev.filter(item => item.productId !== productId));
  };

  const totalAmount = poItems.reduce((sum, item) => sum + item.totalPrice, 0);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.supplierId || poItems.length === 0) return;

    const poData: PurchaseOrder = {
      id: po?.id || generateId(),
      poNumber: po?.poNumber || generatePONumber(),
      supplierId: formData.supplierId,
      supplierName: selectedSupplier?.name || '',
      items: poItems,
      totalAmount,
      status: po?.status || 'draft',
      orderDate: po?.orderDate || new Date(),
      expectedDeliveryDate: formData.expectedDeliveryDate ? new Date(formData.expectedDeliveryDate) : undefined,
      notes: formData.notes,
      createdBy: po?.createdBy || user?.username,
      updatedBy: user?.username
    };

    onSave(poData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {po ? 'Edit Purchase Order' : 'Create Purchase Order'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Supplier and Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Supplier *</label>
              <select
                value={formData.supplierId}
                onChange={(e) => setFormData(prev => ({ ...prev, supplierId: e.target.value }))}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select supplier</option>
                {suppliers.map(supplier => (
                  <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Expected Delivery Date</label>
              <input
                type="date"
                value={formData.expectedDeliveryDate}
                onChange={(e) => setFormData(prev => ({ ...prev, expectedDeliveryDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Add Items */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Purchase Order Items</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <select
                value={selectedProduct}
                onChange={(e) => {
                  setSelectedProduct(e.target.value);
                  const product = products.find(p => p.id === e.target.value);
                  if (product) setUnitPrice(product.price);
                }}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select product</option>
                {products.map(product => (
                  <option key={product.id} value={product.id}>
                    {product.name} - {formatCurrency(product.price)}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                min="1"
                placeholder="Quantity"
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <input
                type="number"
                value={unitPrice}
                onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                min="0"
                step="0.01"
                placeholder="Unit Price"
                className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
            {poItems.length > 0 && (
              <div className="space-y-2">
                {poItems.map((item) => (
                  <div key={item.productId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <span className="font-medium">{item.productName}</span>
                      <span className="text-gray-600 ml-2">x{item.quantity} @ {formatCurrency(item.unitPrice)}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="font-medium">{formatCurrency(item.totalPrice)}</span>
                      <button
                        type="button"
                        onClick={() => removeItem(item.productId)}
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
              disabled={!formData.supplierId || poItems.length === 0}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded-lg transition-colors"
            >
              {po ? 'Update PO' : 'Create PO'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Purchase Order Detail Component
interface PurchaseOrderDetailProps {
  po: PurchaseOrder;
  products: Product[];
  onClose: () => void;
  onReceive: (po: PurchaseOrder) => void;
  onUpdateStatus: (poId: string, status: string) => void;
}

const PurchaseOrderDetail: React.FC<PurchaseOrderDetailProps> = ({
  po,
  products,
  onClose,
  onReceive,
  onUpdateStatus
}) => {
  const [receivedQuantities, setReceivedQuantities] = useState<Record<string, number>>(
    po.items.reduce((acc, item) => ({
      ...acc,
      [item.productId]: item.receivedQuantity || 0
    }), {})
  );

  const handleReceive = () => {
    const updatedPO = {
      ...po,
      items: po.items.map(item => ({
        ...item,
        receivedQuantity: receivedQuantities[item.productId] || 0
      }))
    };
    onReceive(updatedPO);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Purchase Order Details</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              ×
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* PO Info */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm font-medium text-gray-700">PO Number</p>
              <p className="text-lg font-semibold text-gray-900">{po.poNumber}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Status</p>
              <select
                value={po.status}
                onChange={(e) => onUpdateStatus(po.id, e.target.value)}
                className="mt-1 px-3 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="confirmed">Confirmed</option>
                <option value="received">Received</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Supplier Info */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Supplier Information</h3>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="font-medium">{po.supplierName}</p>
              <p className="text-sm text-gray-600">Order Date: {formatDate(po.orderDate)}</p>
              {po.expectedDeliveryDate && (
                <p className="text-sm text-gray-600">Expected: {formatDate(po.expectedDeliveryDate)}</p>
              )}
            </div>
          </div>

          {/* PO Items */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-3">Items</h3>
            <div className="space-y-2">
              {po.items.map((item) => (
                <div key={item.productId} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">{item.productName}</p>
                    <p className="text-sm text-gray-600">
                      Ordered: {item.quantity} × {formatCurrency(item.unitPrice)}
                    </p>
                  </div>
                  {po.status === 'confirmed' && (
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-600">Received:</span>
                      <input
                        type="number"
                        value={receivedQuantities[item.productId] || 0}
                        onChange={(e) => setReceivedQuantities(prev => ({
                          ...prev,
                          [item.productId]: parseInt(e.target.value) || 0
                        }))}
                        max={item.quantity}
                        min="0"
                        className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                    </div>
                  )}
                  <p className="font-medium ml-4">{formatCurrency(item.totalPrice)}</p>
                </div>
              ))}
              <div className="text-right pt-2 border-t border-gray-200">
                <p className="text-xl font-bold">Total: {formatCurrency(po.totalAmount)}</p>
              </div>
            </div>
          </div>

          {po.notes && (
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Notes</h3>
              <p className="text-gray-600 bg-gray-50 rounded-lg p-3">{po.notes}</p>
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              Close
            </button>
            {po.status === 'confirmed' && (
              <button
                onClick={handleReceive}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
              >
                Mark as Received
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};