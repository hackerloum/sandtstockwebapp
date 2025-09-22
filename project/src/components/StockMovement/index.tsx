import React, { useState } from 'react';
import { ArrowUpDown } from 'lucide-react';
import { Product, StockMovement } from '../../types';
import { PageHeader, PageContainer, PageSection } from '../shared/PageLayout';
import { Button } from '../shared/Button';
import { MovementForm } from './MovementForm';
import { MovementList } from './MovementList';

interface StockMovementProps {
  products: Product[];
  movements: StockMovement[];
  onAddMovement: (movement: StockMovement) => void;
  onUpdateProduct: (product: Product) => void;
}

export const StockMovementComponent: React.FC<StockMovementProps> = ({
  products,
  movements,
  onAddMovement,
  onUpdateProduct
}) => {
  const [isFormOpen, setIsFormOpen] = useState(false);

  const recentMovements = movements
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 20);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Stock Movements"
        actions={
          <Button
            variant="primary"
            icon={<ArrowUpDown className="w-4 h-4" />}
            onClick={() => setIsFormOpen(true)}
          >
            Record Movement
          </Button>
        }
      />

      <PageContainer>
        <PageSection title="Recent Movements">
          <MovementList movements={recentMovements} products={products} />
        </PageSection>
      </PageContainer>

      {isFormOpen && (
        <MovementForm
          products={products}
          onAddMovement={onAddMovement}
          onUpdateProduct={onUpdateProduct}
          onClose={() => setIsFormOpen(false)}
        />
      )}
    </div>
  );
};