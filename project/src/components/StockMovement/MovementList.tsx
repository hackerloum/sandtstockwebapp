import React from 'react';
import { Plus, Minus, ArrowUpDown } from 'lucide-react';
import { Product, StockMovement } from '../../types';
import { Table } from '../shared/Table';
import { EmptyState } from '../shared/PageLayout';

interface MovementListProps {
  movements: StockMovement[];
  products: Product[];
}

export const MovementList: React.FC<MovementListProps> = ({
  movements,
  products
}) => {
  const columns = [
    {
      key: 'date',
      header: 'Date',
      render: (movement: StockMovement) => new Date(movement.date).toLocaleDateString()
    },
    {
      key: 'product',
      header: 'Product',
      render: (movement: StockMovement) => {
        const product = products.find(p => p.id === movement.productId);
        return product?.name || 'Unknown Product';
      }
    },
    {
      key: 'type',
      header: 'Type',
      render: (movement: StockMovement) => (
        <span className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-full ${
          movement.type === 'in' 
            ? 'bg-green-100 text-green-800' 
            : 'bg-red-100 text-red-800'
        }`}>
          {movement.type === 'in' ? <Plus className="w-3 h-3 mr-1" /> : <Minus className="w-3 h-3 mr-1" />}
          {movement.type === 'in' ? 'Stock In' : 'Stock Out'}
        </span>
      )
    },
    {
      key: 'quantity',
      header: 'Quantity',
      render: (movement: StockMovement) => movement.quantity
    },
    {
      key: 'reason',
      header: 'Reason',
      render: (movement: StockMovement) => movement.reason
    },
    {
      key: 'notes',
      header: 'Notes',
      render: (movement: StockMovement) => movement.notes || '-'
    }
  ];

  return (
    <Table
      data={movements}
      columns={columns}
      emptyState={
        <EmptyState
          icon={<ArrowUpDown className="w-16 h-16" />}
          title="No movements recorded"
          description="Stock movements will appear here once you start recording them."
        />
      }
    />
  );
};