import { Database } from '../types/supabase';

type Product = Database['public']['Tables']['products']['Row'];

export const getStockStatus = (product: Product) => {
  if (product.current_stock <= 0) return 'out';
  if (product.current_stock <= product.min_stock) return 'low';
  if (product.current_stock >= product.max_stock) return 'high';
  return 'ok';
};

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-TZ', {
    style: 'currency',
    currency: 'TZS'
  }).format(amount);
};

export const formatDate = (date: string | Date) => {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(typeof date === 'string' ? new Date(date) : date);
};

export const formatWeight = (weight: number) => {
  return `${weight.toFixed(3)}kg`;
};

export const calculateReorderQuantity = (product: Product) => {
  const targetStock = Math.ceil((product.max_stock + product.min_stock) / 2);
  return Math.max(0, targetStock - product.current_stock);
};

// Stock status colors
export const getStockStatusColor = (status: string) => {
  switch (status) {
    case 'out':
      return 'text-red-600 bg-red-50';
    case 'low':
      return 'text-yellow-600 bg-yellow-50';
    case 'high':
      return 'text-green-600 bg-green-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
};

// Order status colors
export const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': 
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'processing': 
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'shipped': 
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'customs-clearance': 
      return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'in-transit-international': 
      return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    case 'arrived-tanzania': 
      return 'bg-cyan-100 text-cyan-800 border-cyan-200';
    case 'delivered': 
      return 'bg-green-100 text-green-800 border-green-200';
    case 'cancelled': 
      return 'bg-red-100 text-red-800 border-red-200';
    default: 
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export const getStatusText = (status: string) => {
  switch (status) {
    case 'out':
      return 'Out of Stock';
    case 'low':
      return 'Low Stock';
    case 'high':
      return 'High Stock';
    default:
      return 'In Stock';
  }
};

export const generateId = () => {
  return Math.random().toString(36).substr(2, 9);
};

export const generateOrderNumber = () => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `ORD${year}${month}${day}${random}`;
};

export const generatePONumber = () => {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const random = Math.random().toString(36).substr(2, 4).toUpperCase();
  return `PO${year}${month}${day}${random}`;
};

export const logActivity = (
  activities: any[],
  setActivities: (activities: any[]) => void,
  action: string,
  entityType: string,
  entityId: string,
  details: string,
  username?: string
) => {
  const newActivity = {
    id: generateId(),
    action,
    entityType,
    entityId,
    details,
    username,
    timestamp: new Date().toISOString()
  };
  setActivities([newActivity, ...activities]);
};