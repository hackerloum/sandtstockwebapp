import React, { useMemo, useState } from 'react';
import { Eye, FileText, Package, Plus, Search, Trash2 } from 'lucide-react';
import { Product, PurchaseOrder, PurchaseOrderItem, Supplier } from '../types';
import { formatCurrency, formatDate } from '../utils/stockUtils';
import { useAuth } from '../contexts/AuthContext';
import { Button } from './shared/Button';
import { FormField, Input, Select, TextArea } from './shared/Form';
import { EmptyState, PageHeader } from './shared/PageLayout';
import { Modal } from './shared/Modal';

interface PurchaseOrdersProps {
  purchaseOrders: PurchaseOrder[];
  products: Product[];
  suppliers: Supplier[];
  onAddPurchaseOrder: (
    po: Omit<PurchaseOrder, 'id' | 'created_at' | 'updated_at'>,
    items: PurchaseOrderItem[]
  ) => void | Promise<void>;
  onUpdatePurchaseOrder: (po: PurchaseOrder) => void;
  onDeletePurchaseOrder: (id: string) => void;
  onUpdateProduct: (product: Product) => void;
}

const statusStyles: Record<PurchaseOrder['status'], string> = {
  draft: 'bg-gray-100 text-gray-700',
  sent: 'bg-blue-50 text-blue-700',
  confirmed: 'bg-amber-50 text-amber-700',
  received: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-red-50 text-red-700'
};

const generatePONumber = () => {
  const now = new Date();
  const date = now.toISOString().slice(2, 10).replace(/-/g, '');
  return `PO-${date}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
};

export const PurchaseOrders: React.FC<PurchaseOrdersProps> = ({
  purchaseOrders,
  products,
  suppliers,
  onAddPurchaseOrder,
  onUpdatePurchaseOrder,
  onDeletePurchaseOrder,
  onUpdateProduct
}) => {
  const { hasPermission } = useAuth();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [formOpen, setFormOpen] = useState(false);
  const [viewingPO, setViewingPO] = useState<PurchaseOrder | null>(null);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return purchaseOrders.filter((po) => {
      const matchesSearch = !query || [po.po_number, po.supplier_name]
        .some((value) => value?.toLowerCase().includes(query));
      return matchesSearch && (status === 'all' || po.status === status);
    });
  }, [purchaseOrders, search, status]);

  if (!hasPermission('view_purchase_orders')) {
    return <EmptyState icon={<Package className="h-10 w-10" />} title="Access denied" description="You do not have permission to view purchase orders." />;
  }

  const receivePurchaseOrder = (po: PurchaseOrder) => {
    (po.items || []).forEach((item) => {
      const product = products.find((candidate) => candidate.id === item.product_id);
      const received = item.received_quantity || item.quantity;
      if (product && received > 0) {
        onUpdateProduct({ ...product, current_stock: product.current_stock + received, updated_at: new Date().toISOString() });
      }
    });
    const updated = {
      ...po,
      status: 'received' as const,
      actual_delivery_date: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: (po.items || []).map((item) => ({ ...item, received_quantity: item.received_quantity || item.quantity }))
    };
    onUpdatePurchaseOrder(updated);
    setViewingPO(updated);
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Purchase orders"
        subtitle="Create and track stock ordered from suppliers"
        actions={hasPermission('add_purchase_order') ? (
          <Button onClick={() => setFormOpen(true)} icon={<Plus className="h-4 w-4" />}>New purchase order</Button>
        ) : undefined}
      />

      <section className="overflow-hidden rounded-md border border-gray-200 bg-white">
        <div className="grid grid-cols-2 divide-x divide-y divide-gray-200 sm:grid-cols-4 sm:divide-y-0">
          {[
            ['All orders', purchaseOrders.length],
            ['Draft', purchaseOrders.filter((po) => po.status === 'draft').length],
            ['Awaiting stock', purchaseOrders.filter((po) => ['sent', 'confirmed'].includes(po.status)).length],
            ['Received', purchaseOrders.filter((po) => po.status === 'received').length]
          ].map(([label, value]) => (
            <div key={String(label)} className="p-4">
              <p className="text-xs font-medium text-gray-500">{label}</p>
              <p className="mt-1 text-xl font-semibold text-gray-900">{value}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-3 border-t border-gray-200 p-4 sm:grid-cols-[1fr_12rem]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search purchase orders" className="pl-9" />
          </div>
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            aria-label="Purchase order status"
            options={[
              { value: 'all', label: 'All statuses' },
              { value: 'draft', label: 'Draft' },
              { value: 'sent', label: 'Sent' },
              { value: 'confirmed', label: 'Confirmed' },
              { value: 'received', label: 'Received' },
              { value: 'cancelled', label: 'Cancelled' }
            ]}
          />
        </div>

        {filtered.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-10 w-10" />}
            title="No purchase orders found"
            description={purchaseOrders.length === 0 ? 'Create the first purchase order to start tracking incoming stock.' : 'Try another search or status.'}
            action={purchaseOrders.length === 0 && hasPermission('add_purchase_order') ? <Button onClick={() => setFormOpen(true)}>New purchase order</Button> : undefined}
          />
        ) : (
          <>
            <div className="divide-y divide-gray-200 border-t border-gray-200 md:hidden">
              {filtered.map((po) => (
                <button key={po.id} type="button" onClick={() => setViewingPO(po)} className="block w-full p-4 text-left hover:bg-gray-50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900">{po.po_number}</p>
                      <p className="mt-1 truncate text-sm text-gray-500">{po.supplier_name || 'Unknown supplier'}</p>
                    </div>
                    <span className={`rounded px-2 py-1 text-xs font-medium capitalize ${statusStyles[po.status]}`}>{po.status}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="text-gray-500">{formatDate(po.order_date)}</span>
                    <span className="font-semibold text-gray-900">{formatCurrency(po.total_amount)}</span>
                  </div>
                </button>
              ))}
            </div>
            <div className="hidden overflow-x-auto border-t border-gray-200 md:block">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                  <tr><th className="px-4 py-3">PO number</th><th className="px-4 py-3">Supplier</th><th className="px-4 py-3">Order date</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-right">Action</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filtered.map((po) => (
                    <tr key={po.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3"><p className="font-semibold text-gray-900">{po.po_number}</p><p className="text-xs text-gray-500">{po.items?.length || 0} items</p></td>
                      <td className="px-4 py-3 text-gray-700">{po.supplier_name || 'Unknown supplier'}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-600">{formatDate(po.order_date)}</td>
                      <td className="px-4 py-3"><span className={`rounded px-2 py-1 text-xs font-medium capitalize ${statusStyles[po.status]}`}>{po.status}</span></td>
                      <td className="whitespace-nowrap px-4 py-3 text-right font-semibold text-gray-900">{formatCurrency(po.total_amount)}</td>
                      <td className="px-4 py-3 text-right"><button type="button" onClick={() => setViewingPO(po)} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900" title="View purchase order"><Eye className="h-4 w-4" /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <PurchaseOrderForm
        isOpen={formOpen}
        products={products}
        suppliers={suppliers}
        onClose={() => setFormOpen(false)}
        onSave={async (po, items) => {
          await onAddPurchaseOrder(po, items);
          setFormOpen(false);
        }}
      />

      {viewingPO && (
        <PurchaseOrderDetail
          po={viewingPO}
          onClose={() => setViewingPO(null)}
          onReceive={() => receivePurchaseOrder(viewingPO)}
          onDelete={hasPermission('edit_purchase_order') ? () => {
            if (window.confirm(`Delete ${viewingPO.po_number}?`)) {
              onDeletePurchaseOrder(viewingPO.id);
              setViewingPO(null);
            }
          } : undefined}
        />
      )}
    </div>
  );
};

type DraftItem = { product_id: string; quantity: number; unit_price: number };

const PurchaseOrderForm: React.FC<{
  isOpen: boolean;
  products: Product[];
  suppliers: Supplier[];
  onClose: () => void;
  onSave: (po: Omit<PurchaseOrder, 'id' | 'created_at' | 'updated_at'>, items: PurchaseOrderItem[]) => void | Promise<void>;
}> = ({ isOpen, products, suppliers, onClose, onSave }) => {
  const [supplierId, setSupplierId] = useState('');
  const [expectedDate, setExpectedDate] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<DraftItem[]>([{ product_id: '', quantity: 1, unit_price: 0 }]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const total = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
  const updateItem = (index: number, next: Partial<DraftItem>) => setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...next } : item));

  const reset = () => {
    setSupplierId('');
    setExpectedDate('');
    setNotes('');
    setItems([{ product_id: '', quantity: 1, unit_price: 0 }]);
    setError(null);
  };

  const handleSubmit = async () => {
    setError(null);
    const validItems = items.filter((item) => item.product_id && item.quantity > 0);
    if (!supplierId) return setError('Select a supplier.');
    if (validItems.length === 0) return setError('Add at least one product.');
    setSaving(true);
    try {
      const purchaseItems: PurchaseOrderItem[] = validItems.map((item) => ({
        product_id: item.product_id,
        product_name: products.find((product) => product.id === item.product_id)?.commercial_name || 'Unknown product',
        quantity: item.quantity,
        received_quantity: 0,
        unit_price: item.unit_price,
        total_price: item.quantity * item.unit_price
      }));
      await onSave({
        po_number: generatePONumber(),
        supplier_id: supplierId,
        status: 'draft',
        total_amount: total,
        order_date: new Date().toISOString(),
        expected_delivery_date: expectedDate || null,
        actual_delivery_date: null,
        notes: notes.trim() || null,
        created_by: null
      }, purchaseItems);
      reset();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not create this purchase order.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { reset(); onClose(); }}
      title="New purchase order"
      size="xl"
      footer={<><Button variant="outline" onClick={() => { reset(); onClose(); }}>Cancel</Button><Button onClick={handleSubmit} disabled={saving}>{saving ? 'Saving...' : 'Create purchase order'}</Button></>}
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label="Supplier" required>
            <Select value={supplierId} onChange={(event) => setSupplierId(event.target.value)} options={[{ value: '', label: 'Select supplier' }, ...suppliers.map((supplier) => ({ value: supplier.id, label: supplier.name }))]} />
          </FormField>
          <FormField label="Expected delivery">
            <Input type="date" value={expectedDate} onChange={(event) => setExpectedDate(event.target.value)} />
          </FormField>
        </div>

        <section className="border-t border-gray-200 pt-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-semibold text-gray-900">Products</h3>
            <Button type="button" variant="outline" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setItems((current) => [...current, { product_id: '', quantity: 1, unit_price: 0 }])}>Add line</Button>
          </div>
          <div className="mt-3 space-y-3">
            {items.map((item, index) => (
              <div key={index} className="grid grid-cols-[1fr_5rem_7rem_2.25rem] items-end gap-2">
                <FormField label={index === 0 ? 'Product' : ''}>
                  <Select value={item.product_id} onChange={(event) => updateItem(index, { product_id: event.target.value })} options={[{ value: '', label: 'Select product' }, ...products.map((product) => ({ value: product.id, label: `${product.code} - ${product.commercial_name}` }))]} />
                </FormField>
                <FormField label={index === 0 ? 'Qty' : ''}>
                  <Input type="number" min="1" value={item.quantity} onChange={(event) => updateItem(index, { quantity: Number(event.target.value) || 0 })} />
                </FormField>
                <FormField label={index === 0 ? 'Unit cost' : ''}>
                  <Input type="number" min="0" step="0.01" value={item.unit_price} onChange={(event) => updateItem(index, { unit_price: Number(event.target.value) || 0 })} />
                </FormField>
                <button type="button" onClick={() => setItems((current) => current.length === 1 ? current : current.filter((_, itemIndex) => itemIndex !== index))} className="inline-flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-red-50 hover:text-red-700" title="Remove line"><Trash2 className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        </section>

        <FormField label="Notes"><TextArea rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional" /></FormField>
        {error && <p className="text-sm text-red-700" role="alert">{error}</p>}
        <div className="flex justify-between border-t border-gray-200 pt-4 text-sm"><span className="font-medium text-gray-600">Order total</span><span className="text-lg font-semibold text-gray-900">{formatCurrency(total)}</span></div>
      </div>
    </Modal>
  );
};

const PurchaseOrderDetail: React.FC<{
  po: PurchaseOrder;
  onClose: () => void;
  onReceive: () => void;
  onDelete?: () => void;
}> = ({ po, onClose, onReceive, onDelete }) => (
  <Modal
    isOpen
    onClose={onClose}
    title={po.po_number}
    size="lg"
    footer={<>{onDelete && <Button variant="danger" onClick={onDelete}>Delete</Button>}<Button variant="outline" onClick={onClose}>Close</Button>{!['received', 'cancelled'].includes(po.status) && <Button onClick={onReceive}>Mark received</Button>}</>}
  >
    <div className="space-y-5">
      <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <div><dt className="text-gray-500">Supplier</dt><dd className="mt-1 font-medium text-gray-900">{po.supplier_name || 'Unknown supplier'}</dd></div>
        <div><dt className="text-gray-500">Order date</dt><dd className="mt-1 font-medium text-gray-900">{formatDate(po.order_date)}</dd></div>
        <div><dt className="text-gray-500">Status</dt><dd className="mt-1"><span className={`rounded px-2 py-1 text-xs font-medium capitalize ${statusStyles[po.status]}`}>{po.status}</span></dd></div>
        <div><dt className="text-gray-500">Total</dt><dd className="mt-1 font-semibold text-gray-900">{formatCurrency(po.total_amount)}</dd></div>
      </dl>
      <div className="overflow-x-auto border-y border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500"><tr><th className="px-3 py-2">Product</th><th className="px-3 py-2 text-right">Qty</th><th className="px-3 py-2 text-right">Unit cost</th><th className="px-3 py-2 text-right">Total</th></tr></thead>
          <tbody className="divide-y divide-gray-200">{(po.items || []).map((item, index) => <tr key={item.id || `${item.product_id}-${index}`}><td className="px-3 py-3 font-medium text-gray-900">{item.product_name}</td><td className="px-3 py-3 text-right text-gray-700">{item.quantity}</td><td className="px-3 py-3 text-right text-gray-700">{formatCurrency(item.unit_price)}</td><td className="px-3 py-3 text-right font-medium text-gray-900">{formatCurrency(item.total_price)}</td></tr>)}</tbody>
        </table>
      </div>
      {po.notes && <div><h3 className="text-sm font-medium text-gray-700">Notes</h3><p className="mt-1 text-sm text-gray-600">{po.notes}</p></div>}
    </div>
  </Modal>
);
