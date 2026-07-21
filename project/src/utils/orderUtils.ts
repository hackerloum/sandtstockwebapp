export type OrderDestination = 'sale' | 'store_to_shop';

export const normalizeOrderDestination = (value: string | null | undefined): OrderDestination => {
  const normalized = String(value || '').trim().toLowerCase().replace(/-/g, '_');

  if (normalized === 'store_to_shop' || normalized === 'storetoshop') {
    return 'store_to_shop';
  }

  return 'sale';
};

export const getOrderDestinationLabel = (value: string | null | undefined) => (
  normalizeOrderDestination(value) === 'store_to_shop' ? 'Store to shop' : 'Customer'
);
