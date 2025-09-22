import React, { useState } from 'react';
import { Plus, Search, Eye, Edit2, Trash2, Printer } from 'lucide-react';
import { Order, Product } from '../../types';
import { getStatusColor, formatCurrency, formatDate } from '../../utils/stockUtils';
import { printOrderPDF, generateBulkOrdersPDF } from '../../utils/pdfUtils';
import { PageHeader, PageContainer, PageSection } from '../shared/PageLayout';
import { Button } from '../shared/Button';
import { Input, Select } from '../shared/Form';
import { Table } from '../shared/Table';
import { ConfirmModal } from '../shared/Modal';
import { OrderStats } from './OrderStats';
import { OrderForm } from './OrderForm';
import { OrderDetailModal } from './OrderDetailModal';

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
  const [orderTypeFilter, setOrderTypeFilter] = useState<string>('all');
  const [showOrderForm, setShowOrderForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [viewingOrder, setViewingOrder] = useState<Order | null>(null);
  const [deletingOrderId, setDeletingOrderId] = useState<string | null>(null);
  const [selectedOrders, setSelectedOrders] = useState<Set<string>>(new Set());

  const filteredOrders = orders.filter(order => {
    const matchesSearch = order.order_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         order.customer_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    const matchesOrderType = orderTypeFilter === 'all' || order.order_type === orderTypeFilter;
    return matchesSearch && matchesStatus && matchesOrderType;
  });

  const handleSelectOrder = (orderId: string) => {
    const newSelected = new Set(selectedOrders);
    if (newSelected.has(orderId)) {
      newSelected.delete(orderId);
    } else {
      newSelected.add(orderId);
    }
    setSelectedOrders(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedOrders.size === filteredOrders.length) {
      setSelectedOrders(new Set());
    } else {
      setSelectedOrders(new Set(filteredOrders.map(order => order.id)));
    }
  };

  const handleBulkPrint = () => {
    const selectedOrderObjects = Array.from(selectedOrders).map(orderId => 
      orders.find(o => o.id === orderId)
    ).filter(Boolean) as Order[];
    
    if (selectedOrderObjects.length > 0) {
      try {
        const doc = generateBulkOrdersPDF(selectedOrderObjects, products);
        const filename = `Bulk_Orders_${selectedOrderObjects.length}_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(filename);
        alert(`Successfully generated PDF with ${selectedOrderObjects.length} orders: ${filename}`);
      } catch (error) {
        console.error('Error generating bulk PDF:', error);
        alert('Error generating bulk PDF. Please try again.');
      }
    }
  };

  const handleBulkPrintToWindow = () => {
    // Print the first selected order to window (for printing)
    const firstOrderId = Array.from(selectedOrders)[0];
    if (firstOrderId) {
      const order = orders.find(o => o.id === firstOrderId);
      if (order) {
        const { printOrderPDFToWindow } = require('../../utils/pdfUtils');
        printOrderPDFToWindow(order, products);
      }
    }
  };

  const clearSelection = () => {
    setSelectedOrders(new Set());
  };

  const columns = [
    {
      key: 'order_number',
      header: 'Order',
      render: (order: Order) => (
        <div>
          <div className="font-medium text-gray-900">{order.order_number}</div>
          <div className="text-sm text-gray-500">{order.items?.length || 0} items</div>
          <div className="text-xs text-gray-400">ID: {order.id.substring(0, 8)}...</div>
        </div>
      )
    },
    {
      key: 'customer',
      header: 'Customer',
      render: (order: Order) => (
        <div>
          <div className="font-medium text-gray-900">{order.customer_name}</div>
          {order.customer_email && (
            <div className="text-sm text-gray-500">{order.customer_email}</div>
          )}
          {order.customer_phone && (
            <div className="text-xs text-gray-400">{order.customer_phone}</div>
          )}
        </div>
      )
    },
    {
      key: 'order_type',
      header: 'Type',
      render: (order: Order) => {
        const getOrderTypeStyle = (type: string) => {
          switch (type) {
            case 'delivery':
              return 'bg-blue-50 text-blue-700 border-blue-200';
            case 'storeToShop':
            case 'store-to-shop':
              return 'bg-green-50 text-green-700 border-green-200';
            case 'pickup':
              return 'bg-purple-50 text-purple-700 border-purple-200';
            case 'international-to-tanzania':
              return 'bg-orange-50 text-orange-700 border-orange-200';
            default:
              return 'bg-gray-50 text-gray-700 border-gray-200';
          }
        };
        
        const getOrderTypeLabel = (type: string) => {
          switch (type) {
            case 'delivery':
              return 'Delivery';
            case 'storeToShop':
            case 'store-to-shop':
              return 'Store to Shop';
            case 'pickup':
              return 'Pickup';
            case 'international-to-tanzania':
              return 'International';
            default:
              return type || 'Unknown';
          }
        };

        return (
          <div>
            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getOrderTypeStyle(order.order_type)}`}>
              {getOrderTypeLabel(order.order_type)}
            </span>
            {/* Show pickup info if available */}
            {order.pickup_person_name && (
              <div className="text-xs text-gray-500 mt-1">
                Pickup: {order.pickup_person_name}
              </div>
            )}
          </div>
        );
      }
    },
    {
      key: 'created_at',
      header: 'Date',
      render: (order: Order) => (
        <div>
          <div className="text-sm">{formatDate(order.created_at)}</div>
          <div className="text-xs text-gray-500">{formatDate(order.updated_at)}</div>
        </div>
      )
    },
    {
      key: 'status',
      header: 'Status',
      render: (order: Order) => (
        <div>
          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(order.status)}`}>
            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
          </span>
          {order.created_by && (
            <div className="text-xs text-gray-500 mt-1">
              By: {order.created_by.substring(0, 8)}...
            </div>
          )}
        </div>
      )
    },
    {
      key: 'total_amount',
      header: 'Total',
      render: (order: Order) => (
        <div>
          <div className="font-medium">{formatCurrency(order.total_amount)}</div>
          {order.notes && (
            <div className="text-xs text-gray-400 truncate max-w-20" title={order.notes}>
              📝 {order.notes.substring(0, 20)}...
            </div>
          )}
        </div>
      )
    }
  ];

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'pending', label: 'Pending' },
    { value: 'processing', label: 'Processing' },
    { value: 'shipped', label: 'Shipped' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  const orderTypeOptions = [
    { value: 'all', label: 'All Types' },
    { value: 'delivery', label: 'Delivery' },
    { value: 'storeToShop', label: 'Store to Shop' },
    { value: 'pickup', label: 'Pickup' }
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Order Management"
        actions={
          <div className="flex space-x-2">
            <Button
              variant="outline"
              icon={<Printer className="w-4 h-4" />}
              onClick={() => {
                if (filteredOrders.length > 0) {
                  try {
                    const doc = generateBulkOrdersPDF(filteredOrders, products);
                    const filename = `All_Orders_${filteredOrders.length}_${new Date().toISOString().split('T')[0]}.pdf`;
                    doc.save(filename);
                    alert(`Successfully generated PDF with all ${filteredOrders.length} orders: ${filename}`);
                  } catch (error) {
                    console.error('Error generating all orders PDF:', error);
                    alert('Error generating PDF. Please try again.');
                  }
                }
              }}
            >
              Download All ({filteredOrders.length})
            </Button>
            <Button
              variant="outline"
              icon={<Printer className="w-4 h-4" />}
              onClick={() => {
                if (orders.length > 0) {
                  try {
                    const doc = generateBulkOrdersPDF(orders, products);
                    const filename = `All_Orders_${orders.length}_${new Date().toISOString().split('T')[0]}.pdf`;
                    doc.save(filename);
                    alert(`Successfully generated PDF with all ${orders.length} orders: ${filename}`);
                  } catch (error) {
                    console.error('Error generating all orders PDF:', error);
                    alert('Error generating PDF. Please try again.');
                  }
                }
              }}
            >
              Print All ({orders.length})
            </Button>
            <Button
              variant="primary"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => setShowOrderForm(true)}
            >
              New Order
            </Button>
          </div>
        }
      />

      {/* SUPER PROMINENT PRINT BUTTON */}
      <div className="bg-red-100 border-2 border-red-500 rounded-lg p-4 mb-4">
        <div className="text-center">
          <h3 className="text-lg font-bold text-red-800 mb-2">🚨 PRINT BUTTONS SHOULD BE HERE 🚨</h3>
          <div className="flex justify-center space-x-4">
            <Button
              variant="primary"
              size="lg"
              icon={<Printer className="w-6 h-6" />}
              onClick={() => {
                if (orders.length > 0) {
                  try {
                    const doc = generateBulkOrdersPDF(orders, products);
                    const filename = `TEST_All_Orders_${orders.length}_${new Date().toISOString().split('T')[0]}.pdf`;
                    doc.save(filename);
                    alert(`SUCCESS! PDF generated: ${filename}`);
                  } catch (error) {
                    console.error('Error generating PDF:', error);
                    alert(`ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
                  }
                } else {
                  alert('No orders available to print');
                }
              }}
              className="bg-red-600 hover:bg-red-700 text-white font-bold text-lg px-6 py-3"
            >
              🖨️ TEST PRINT ALL ORDERS 🖨️
            </Button>
            {filteredOrders.length > 0 && (
              <Button
                variant="outline"
                size="lg"
                icon={<Printer className="w-6 h-6" />}
                onClick={() => {
                  const firstOrder = filteredOrders[0];
                  try {
                    printOrderPDF(firstOrder, products);
                    alert(`SUCCESS! Printing first order: ${firstOrder.order_number}`);
                  } catch (error) {
                    console.error('Error printing first order:', error);
                    alert(`ERROR: ${error instanceof Error ? error.message : 'Unknown error'}`);
                  }
                }}
                className="border-red-500 text-red-600 hover:bg-red-50 font-bold text-lg px-6 py-3"
              >
                🖨️ TEST PRINT FIRST ORDER 🖨️
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* SIMPLE TEST BUTTON */}
      <div className="bg-green-100 border-2 border-green-500 rounded-lg p-4 mb-4 text-center">
        <h3 className="text-lg font-bold text-green-800 mb-2">🧪 SIMPLE TEST BUTTON</h3>
        <button 
          className="bg-green-600 text-white px-6 py-3 rounded-lg font-bold text-lg hover:bg-green-700"
          onClick={() => alert('Button is working!')}
        >
          🎯 CLICK ME TO TEST
        </button>
      </div>

      {/* DEBUG SECTION */}
      <div className="bg-yellow-100 border border-yellow-400 rounded-lg p-4 mb-4">
        <h3 className="text-lg font-bold text-yellow-800 mb-2">🐛 DEBUG INFO</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <strong>Total Orders:</strong> {orders.length}
          </div>
          <div>
            <strong>Filtered Orders:</strong> {filteredOrders.length}
          </div>
          <div>
            <strong>Products Available:</strong> {products.length}
          </div>
          <div>
            <strong>Search Term:</strong> "{searchTerm}"
          </div>
          <div>
            <strong>Status Filter:</strong> {statusFilter}
          </div>
          <div>
            <strong>Order Type Filter:</strong> {orderTypeFilter}
          </div>
        </div>
        {orders.length > 0 && (
          <div className="mt-2">
            <strong>First Order:</strong> {orders[0].order_number} - {orders[0].customer_name}
          </div>
        )}
      </div>

      <OrderStats orders={orders} products={products} />

      <PageContainer>
        <PageSection>
          {/* Quick Print Section */}
          <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium text-blue-900">Quick Print Options</h3>
                <p className="text-sm text-blue-700">Print individual orders or bulk orders</p>
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Printer className="w-4 h-4" />}
                  onClick={() => {
                    if (filteredOrders.length > 0) {
                      try {
                        const doc = generateBulkOrdersPDF(filteredOrders, products);
                        const filename = `Filtered_Orders_${filteredOrders.length}_${new Date().toISOString().split('T')[0]}.pdf`;
                        doc.save(filename);
                        alert(`Successfully generated PDF with ${filteredOrders.length} filtered orders: ${filename}`);
                      } catch (error) {
                        console.error('Error generating filtered orders PDF:', error);
                        alert('Error generating PDF. Please try again.');
                      }
                    }
                  }}
                >
                  Print Filtered ({filteredOrders.length})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Printer className="w-4 h-4" />}
                  onClick={() => {
                    if (orders.length > 0) {
                      try {
                        const doc = generateBulkOrdersPDF(orders, products);
                        const filename = `All_Orders_${orders.length}_${new Date().toISOString().split('T')[0]}.pdf`;
                        doc.save(filename);
                        alert(`Successfully generated PDF with all ${orders.length} orders: ${filename}`);
                      } catch (error) {
                        console.error('Error generating all orders PDF:', error);
                        alert('Error generating PDF. Please try again.');
                      }
                    }
                  }}
                >
                  Print All ({orders.length})
                </Button>
                {filteredOrders.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Printer className="w-4 h-4" />}
                    onClick={() => {
                      const firstOrder = filteredOrders[0];
                      try {
                        printOrderPDF(firstOrder, products);
                        alert(`Printing first order: ${firstOrder.order_number}`);
                      } catch (error) {
                        console.error('Error printing first order:', error);
                        alert('Error printing order. Please try again.');
                      }
                    }}
                  >
                    Print First Order
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col lg:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="Search orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select
              value={orderTypeFilter}
              onChange={(e) => setOrderTypeFilter(e.target.value)}
              options={orderTypeOptions}
            />
            
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={statusOptions}
            />
          </div>

          {/* Bulk Actions */}
          {selectedOrders.size > 0 && (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="text-sm text-blue-800">
                  <strong>{selectedOrders.size} order(s) selected</strong>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Printer className="w-4 h-4" />}
                    onClick={handleBulkPrint}
                  >
                    Download All PDFs
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<Printer className="w-4 h-4" />}
                    onClick={handleBulkPrintToWindow}
                  >
                    Print First PDF
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSelection}
                  >
                    Clear Selection
                  </Button>
                </div>
              </div>
            </div>
          )}

          <Table
            data={filteredOrders}
            columns={[
              {
                key: 'select',
                header: 'Select',
                render: (order: Order) => (
                  <input
                    type="checkbox"
                    checked={selectedOrders.has(order.id)}
                    onChange={() => handleSelectOrder(order.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                )
              },
              ...columns
            ]}
            selectedRows={Array.from(selectedOrders)}
            onSelectRow={handleSelectOrder}
            onSelectAll={handleSelectAll}
            rowActions={(order) => {
              console.log('Rendering row actions for order:', order.order_number);
              console.log('Order object:', order);
              console.log('Products available:', products.length);
              
              return (
                <div className="flex items-center space-x-2 border-2 border-red-500 p-3 rounded bg-red-50">
                  <div className="text-xs text-red-600 font-bold mr-2">ACTIONS:</div>
                  <div className="text-xs text-red-800 bg-red-200 px-2 py-1 rounded">ROW {order.order_number}</div>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Eye className="w-4 h-4" />}
                    onClick={() => setViewingOrder(order)}
                    title="View Order"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Printer className="w-6 h-6" />}
                    onClick={() => {
                      console.log('Print button clicked for order:', order.order_number);
                      console.log('Calling printOrderPDF with:', { order, products });
                      try {
                        printOrderPDF(order, products);
                      } catch (error) {
                        console.error('Error in print button click:', error);
                        alert('Error printing order. Please check console for details.');
                      }
                    }}
                    title="Print PDF"
                    className="bg-red-600 hover:bg-red-700 text-white font-bold px-4 py-2 text-lg"
                  >
                    🖨️ PRINT
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Edit2 className="w-4 h-4" />}
                    onClick={() => {
                      setEditingOrder(order);
                      setShowOrderForm(true);
                    }}
                    title="Edit Order"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Trash2 className="w-4 h-4" />}
                    onClick={() => setDeletingOrderId(order.id)}
                    title="Delete Order"
                  />
                </div>
              );
            }}
          />
        </PageSection>
      </PageContainer>

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
              order.items?.forEach(item => {
                const product = products.find(p => p.id === item.product_id);
                if (product) {
                  const updatedProduct = {
                    ...product,
                    current_stock: Math.max(0, product.current_stock - item.quantity),
                    updated_at: new Date().toISOString()
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
            const updatedOrder = { ...viewingOrder, status: status as 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' };
            onUpdateOrder(updatedOrder);
            setViewingOrder(updatedOrder);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deletingOrderId}
        onClose={() => setDeletingOrderId(null)}
        onConfirm={() => {
          if (deletingOrderId) {
            onDeleteOrder(deletingOrderId);
            setDeletingOrderId(null);
          }
        }}
        title="Delete Order"
        message="Are you sure you want to delete this order? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
};