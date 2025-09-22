export interface Product {
  id: string;
  code: string;
  item_number: string;
  commercial_name: string;
  product_type: ProductType;
  brand_id: string | null;
  category: string;
  concentration: string | null;
  size: number;
  gross_weight: number; // GROSS MIN in kg
  tare_weight: number; // TARE MIN in kg
  net_weight: number; // NET in kg
  current_stock: number;
  min_stock: number;
  max_stock: number;
  reorder_point: number;
  price: number;
  supplier_id: string | null;
  fragrance_notes: string | null;
  gender: string | null;
  season: string[] | null;
  is_tester: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface StockMovement {
  id: string;
  product_id: string;
  batch_id: string | null;
  movement_type: 'in' | 'out';
  quantity: number;
  reason: string;
  reference_number: string | null;
  notes: string | null;
  performed_by: string | null;
  performed_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string | null;
  customer_phone: string | null;
  order_type: string; // 'storeToShop', 'delivery', 'pickup'
  pickup_by_staff: boolean | null;
  pickup_person_name: string | null;
  pickup_person_phone: string | null;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  total_amount: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Frontend-only property for items
  items?: OrderItem[];
}

export interface OrderItem {
  id?: string;
  order_id?: string;
  product_id: string;
  product_name: string; // Frontend-only for display
  batch_id?: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  created_at?: string;
}

export interface PurchaseOrder {
  id: string;
  po_number: string;
  supplier_id: string;
  supplier_name?: string; // Frontend-only for display
  status: 'draft' | 'sent' | 'confirmed' | 'received' | 'cancelled';
  total_amount: number;
  order_date: string;
  expected_delivery_date: string | null;
  actual_delivery_date: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Frontend-only property for items
  items?: PurchaseOrderItem[];
}

export interface PurchaseOrderItem {
  id?: string;
  po_id?: string;
  product_id: string;
  product_name: string; // Frontend-only for display
  quantity: number;
  received_quantity?: number;
  unit_price: number;
  total_price: number;
  created_at?: string;
}

export interface Brand {
  id: string;
  name: string;
  description: string | null;
  website: string | null;
  contact_info: any | null;
  created_at: string;
  updated_at: string;
}

export interface Supplier {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  contact_person: string | null;
  payment_terms: string | null;
  lead_time: number | null;
  created_at: string;
  updated_at: string;
}

export interface ActivityLog {
  id: string;
  user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string;
  details: any;
  ip_address: string | null;
  created_at: string;
}

export type Category = 'Eau de Parfum' | 'Eau de Toilette' | 'Eau de Cologne' | 'Parfum' | 'Eau Fraiche';

export type ProductType = 'Fragrance Bottles' | 'Crimp' | 'Accessories' | 'Packaging';

export interface User {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'manager' | 'staff' | 'viewer';
  firstName: string;
  lastName: string;
  isActive: boolean;
  createdAt: Date;
  lastLogin?: Date;
}

export interface Notification {
  id: string;
  type: 'out_of_stock' | 'low_stock' | 'reorder_point' | 'system' | 'order' | 'movement';
  title: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
  entityType: string;
  entityId: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface ProductReport {
  id: string;
  product_id: string;
  reported_by: string;
  report_type: 'add' | 'remove';
  quantity: number;
  reason: string;
  notes?: string;
  status: 'pending' | 'approved' | 'rejected';
  admin_notes?: string;
  created_at: string;
  updated_at: string;
  product?: {
    id: string;
    commercial_name: string;
    code: string;
    current_stock: number;
    price: number;
  };
  reporter?: {
    id: string;
    full_name: string;
    email: string;
  };
}