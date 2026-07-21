export type OrderDestination = 'customer' | 'store-to-shop';

export const normalizeOrderDestination = (value: string | null | undefined): OrderDestination => {
  const normalized = String(value || '').trim().toLowerCase().replace(/_/g, '-');

  if (normalized === 'store-to-shop' || normalized === 'storetoshop') {
    return 'store-to-shop';
  }

  return 'customer';
};

export const getOrderDestinationLabel = (value: string | null | undefined) => (
  normalizeOrderDestination(value) === 'store-to-shop' ? 'Store to shop' : 'Customer'
);
