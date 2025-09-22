import React, { useState } from 'react';
import { Plus, Search, Eye, Edit2, Trash2, Package } from 'lucide-react';
import { PurchaseOrder, Product, Supplier } from '../../types';
import { getStatusColor, formatCurrency, formatDate } from '../../utils/stockUtils';
import { PageHeader, PageContainer, PageSection, EmptyState } from '../shared/PageLayout';
import { Button } from '../shared/Button';
import { Input, Select } from '../shared/Form';
import { Table } from '../shared/Table';
import { ConfirmModal } from '../shared/Modal';
import { useAuth } from '../../contexts/AuthContext';
import { POStats } from './POStats';
import { POForm } from './POForm';
import { PODetail } from './PODetail';

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
  const [deletingPOId, setDeletingPOId] = useState<string | null>(null);

  const filteredPOs = purchaseOrders.filter(po => {
    const matchesSearch = po.po_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (po.supplier_name || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || po.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleReceivePO = (po: PurchaseOrder) => {
    // Update product stock based on received quantities
    po.items?.forEach(item => {
      const product = products.find(p => p.id === item.product_id);
      if (product && item.received_quantity) {
        const updatedProduct = {
          ...product,
          current_stock: product.current_stock + item.received_quantity,
          updated_at: new Date().toISOString(),
          updated_by: user?.username || null
        };
        onUpdateProduct(updatedProduct);
      }
    });

    // Update PO status
    const updatedPO = {
      ...po,
      status: 'received' as const,
      actual_delivery_date: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    onUpdatePurchaseOrder(updatedPO);
  };

  const columns = [
    {
      key: 'po_number',
      header: 'PO Number',
      render: (po: PurchaseOrder) => (
        <div>
          <div className="font-medium text-gray-900">{po.po_number}</div>
          <div className="text-sm text-gray-500">{po.items?.length || 0} items</div>
        </div>
      )
    },
    {
      key: 'supplier',
      header: 'Supplier',
      render: (po: PurchaseOrder) => po.supplier_name || 'Unknown'
    },
    {
      key: 'order_date',
      header: 'Date',
      render: (po: PurchaseOrder) => formatDate(po.order_date)
    },
    {
      key: 'status',
      header: 'Status',
      render: (po: PurchaseOrder) => (
        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getStatusColor(po.status)}`}>
          {po.status.charAt(0).toUpperCase() + po.status.slice(1)}
        </span>
      )
    },
    {
      key: 'total_amount',
      header: 'Total',
      render: (po: PurchaseOrder) => formatCurrency(po.total_amount)
    }
  ];

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'draft', label: 'Draft' },
    { value: 'sent', label: 'Sent' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'received', label: 'Received' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  if (!hasPermission('view_purchase_orders')) {
    return (
      <EmptyState
        icon={<Package className="w-16 h-16" />}
        title="Access Denied"
        description="You don't have permission to view purchase orders."
      />
    );
  }

  const generatePONumber = () => {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.random().toString(36).substr(2, 4).toUpperCase();
    return `PO${year}${month}${day}${random}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Orders"
        actions={
          hasPermission('add_purchase_order') && (
            <Button
              variant="primary"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => setShowPOForm(true)}
            >
              New Purchase Order
            </Button>
          )
        }
      />

      <POStats purchaseOrders={purchaseOrders} />

      <PageContainer>
        <PageSection>
          <div className="flex flex-col lg:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <Input
                type="text"
                placeholder="Search purchase orders..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              options={statusOptions}
            />
          </div>

          <Table
            data={filteredPOs}
            columns={columns}
            rowActions={(po) => (
              <div className="flex items-center space-x-2">
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Eye className="w-4 h-4" />}
                  onClick={() => setViewingPO(po)}
                  title="View PO"
                />
                {hasPermission('edit_purchase_order') && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Edit2 className="w-4 h-4" />}
                      onClick={() => {
                        setEditingPO(po);
                        setShowPOForm(true);
                      }}
                      title="Edit PO"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Trash2 className="w-4 h-4" />}
                      onClick={() => setDeletingPOId(po.id)}
                      title="Delete PO"
                    />
                  </>
                )}
              </div>
            )}
          />
        </PageSection>
      </PageContainer>

      {/* PO Form Modal */}
      {showPOForm && (
        <POForm
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
        <PODetail
          po={viewingPO}
          products={products}
          onClose={() => setViewingPO(null)}
          onReceive={handleReceivePO}
          onUpdateStatus={(poId, status) => {
            const updatedPO = { 
              ...viewingPO, 
              status: status as PurchaseOrder['status'], 
              updated_at: new Date().toISOString() 
            };
            onUpdatePurchaseOrder(updatedPO);
            setViewingPO(updatedPO);
          }}
        />
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deletingPOId}
        onClose={() => setDeletingPOId(null)}
        onConfirm={() => {
          if (deletingPOId) {
            onDeletePurchaseOrder(deletingPOId);
            setDeletingPOId(null);
          }
        }}
        title="Delete Purchase Order"
        message="Are you sure you want to delete this purchase order? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />
    </div>
  );
};