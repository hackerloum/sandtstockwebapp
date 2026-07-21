import React, { useMemo, useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, ArrowUpDown, Search } from 'lucide-react';
import { Product, StockMovement } from '../types';
import { Button } from './shared/Button';
import { FormField, Input, Select, TextArea } from './shared/Form';
import { EmptyState, PageHeader } from './shared/PageLayout';

interface StockMovementProps {
  products: Product[];
  movements: StockMovement[];
  onAddMovement: (movement: Omit<StockMovement, 'id'>) => void | Promise<void>;
  onUpdateProduct: (product: Product) => void;
}

export const StockMovementComponent: React.FC<StockMovementProps> = ({
  products,
  movements,
  onAddMovement,
  onUpdateProduct
}) => {
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    product_id: '',
    movement_type: 'in' as StockMovement['movement_type'],
    quantity: 1,
    reason: '',
    reference_number: '',
    notes: ''
  });

  const productById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const recentMovements = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...movements]
      .sort((a, b) => new Date(b.performed_at).getTime() - new Date(a.performed_at).getTime())
      .filter((movement) => {
        if (!query) return true;
        const product = productById.get(movement.product_id);
        return [product?.commercial_name, product?.code, movement.reason, movement.reference_number]
          .some((value) => value?.toLowerCase().includes(query));
      })
      .slice(0, 50);
  }, [movements, productById, search]);

  const resetForm = () => {
    setFormData({ product_id: '', movement_type: 'in', quantity: 1, reason: '', reference_number: '', notes: '' });
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const product = productById.get(formData.product_id);
    if (!product) {
      setError('Select a product.');
      return;
    }
    if (formData.quantity <= 0) {
      setError('Quantity must be greater than zero.');
      return;
    }
    if (formData.movement_type === 'out' && formData.quantity > product.current_stock) {
      setError(`Only ${product.current_stock} units are available.`);
      return;
    }
    if (!formData.reason.trim()) {
      setError('Enter a reason for this stock change.');
      return;
    }

    setSaving(true);
    try {
      await onAddMovement({
        product_id: product.id,
        batch_id: null,
        movement_type: formData.movement_type,
        quantity: formData.quantity,
        reason: formData.reason.trim(),
        reference_number: formData.reference_number.trim() || null,
        notes: formData.notes.trim() || null,
        performed_by: null,
        performed_at: new Date().toISOString()
      });
      const stockChange = formData.movement_type === 'in' ? formData.quantity : -formData.quantity;
      onUpdateProduct({ ...product, current_stock: Math.max(0, product.current_stock + stockChange), updated_at: new Date().toISOString() });
      resetForm();
      setShowForm(false);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not record this stock movement.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="Stock movements"
        subtitle="Record stock in or stock out and review inventory activity"
        actions={
          <Button onClick={() => setShowForm((current) => !current)} icon={<ArrowUpDown className="h-4 w-4" />}>
            {showForm ? 'Close form' : 'Record movement'}
          </Button>
        }
      />

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-md border border-gray-200 bg-white p-4 sm:p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <FormField label="Product" required className="lg:col-span-2">
              <Select
                value={formData.product_id}
                onChange={(event) => setFormData({ ...formData, product_id: event.target.value })}
                options={[
                  { value: '', label: 'Select product' },
                  ...products.map((product) => ({
                    value: product.id,
                    label: `${product.commercial_name} (${product.current_stock} available)`
                  }))
                ]}
              />
            </FormField>
            <FormField label="Movement" required>
              <Select
                value={formData.movement_type}
                onChange={(event) => setFormData({ ...formData, movement_type: event.target.value as StockMovement['movement_type'] })}
                options={[{ value: 'in', label: 'Stock in' }, { value: 'out', label: 'Stock out' }]}
              />
            </FormField>
            <FormField label="Quantity" required>
              <Input type="number" min="1" value={formData.quantity} onChange={(event) => setFormData({ ...formData, quantity: Number(event.target.value) || 0 })} />
            </FormField>
            <FormField label="Reason" required className="lg:col-span-2">
              <Input value={formData.reason} onChange={(event) => setFormData({ ...formData, reason: event.target.value })} placeholder="Purchase, sale, damage, adjustment..." />
            </FormField>
            <FormField label="Reference number">
              <Input value={formData.reference_number} onChange={(event) => setFormData({ ...formData, reference_number: event.target.value })} placeholder="Optional" />
            </FormField>
            <FormField label="Notes">
              <TextArea rows={1} value={formData.notes} onChange={(event) => setFormData({ ...formData, notes: event.target.value })} placeholder="Optional" />
            </FormField>
          </div>
          {error && <p className="mt-4 text-sm text-red-700" role="alert">{error}</p>}
          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => { resetForm(); setShowForm(false); }}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save movement'}</Button>
          </div>
        </form>
      )}

      <section className="overflow-hidden rounded-md border border-gray-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-gray-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-gray-900">Recent movements</h2>
            <p className="mt-1 text-sm text-gray-500">{movements.length} total records</p>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search movements" className="pl-9" />
          </div>
        </div>

        {recentMovements.length === 0 ? (
          <EmptyState icon={<ArrowUpDown className="h-10 w-10" />} title="No movements found" description="New stock movements will appear here." />
        ) : (
          <>
            <div className="divide-y divide-gray-200 md:hidden">
              {recentMovements.map((movement) => {
                const product = productById.get(movement.product_id);
                const isIn = movement.movement_type === 'in';
                return (
                  <article key={movement.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-gray-900">{product?.commercial_name || 'Unknown product'}</p>
                        <p className="mt-1 text-sm text-gray-500">{movement.reason}</p>
                      </div>
                      <span className={`inline-flex shrink-0 items-center gap-1 text-sm font-semibold ${isIn ? 'text-emerald-700' : 'text-red-700'}`}>
                        {isIn ? <ArrowDownToLine className="h-4 w-4" /> : <ArrowUpFromLine className="h-4 w-4" />}
                        {isIn ? '+' : '-'}{movement.quantity}
                      </span>
                    </div>
                    <p className="mt-3 text-xs text-gray-500">{new Date(movement.performed_at).toLocaleString()}</p>
                  </article>
                );
              })}
            </div>
            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                  <tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Product</th><th className="px-4 py-3">Movement</th><th className="px-4 py-3">Quantity</th><th className="px-4 py-3">Reason</th><th className="px-4 py-3">Reference</th></tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {recentMovements.map((movement) => {
                    const product = productById.get(movement.product_id);
                    const isIn = movement.movement_type === 'in';
                    return (
                      <tr key={movement.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-4 py-3 text-gray-600">{new Date(movement.performed_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3"><p className="font-medium text-gray-900">{product?.commercial_name || 'Unknown product'}</p><p className="text-xs text-gray-500">{product?.code}</p></td>
                        <td className={`whitespace-nowrap px-4 py-3 font-medium ${isIn ? 'text-emerald-700' : 'text-red-700'}`}>{isIn ? 'Stock in' : 'Stock out'}</td>
                        <td className="px-4 py-3 font-semibold text-gray-900">{movement.quantity}</td>
                        <td className="px-4 py-3 text-gray-700">{movement.reason}</td>
                        <td className="px-4 py-3 text-gray-500">{movement.reference_number || '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  );
};
