export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

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
  order_type: string; // 'customer' or 'store-to-shop'; legacy values are normalized for display
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

export type UpcomingInvoiceMatchStatus = 'matched' | 'unmatched' | 'manual';

export interface UpcomingInvoiceLine {
  id: string;
  invoice_id: string;
  line_no: number;
  product_code: string;
  product_name: string;
  qty_kg: number;
  price_per_kg_eur: number | null;
  amount_eur: number | null;
  customer_ref: string | null;
  matched_product_id: string | null;
  match_status: UpcomingInvoiceMatchStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface UpcomingInvoice {
  id: string;
  reference: string;
  order_number: string | null;
  info_label: string | null;
  invoice_date: string | null;
  shipping_date: string | null;
  expected_arrival_date: string | null;
  delivery_mode: string | null;
  carrier: string | null;
  payment_terms: string | null;
  currency: string | null;
  total_net_weight_kg: number | null;
  total_amount_eur: number | null;
  source_file_name: string | null;
  raw_text: string | null;
  created_at: string;
  updated_at: string;
  lines?: UpcomingInvoiceLine[];
}

export interface IncomingByProductSummary {
  product_id: string;
  total_incoming_kg: number;
  earliest_arrival_date: string | null;
  invoice_references: string[];
  line_count: number;
}

export interface DailyClosing {
  id: string;
  date: string;
  cash_on_hand: number;
  bank_deposit: number;
  petty_cash: number;
  notes: string | null;
  closed_by: string;
  closed_at: string;
  is_reconciled: boolean;
  reconciled_at: string | null;
  reconciled_by: string | null;
  created_at: string | null;
  updated_at: string | null;
  box_product_sales: number;
  oil_sales: number;
  cash_on_hand_box: number;
  cash_on_hand_oil: number;
  cash_on_hand_perfume: number;
}

export interface Expense {
  id: string;
  title: string;
  description: string | null;
  amount: number;
  type: string;
  created_by: string;
  date: string;
  created_at: string | null;
  updated_at: string | null;
  receipt_url: string | null;
  is_approved: boolean | null;
  approved_by: string | null;
  approved_at: string | null;
  is_payroll: boolean;
  payroll_lines: Json;
}

export interface MonthlyBalanceClosing {
  id: string;
  month_start: string;
  opening_box: number;
  opening_oil: number;
  opening_bank_deposit: number;
  opening_petty_cash: number;
  opening_total: number;
  closing_box: number;
  closing_oil: number;
  closing_bank_deposit: number;
  closing_petty_cash: number;
  closing_total: number;
  closing_perfume: number;
  carried_from_month: string | null;
  closed_by: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface VendorPurchase {
  id: string;
  vendor_name: string;
  amount: number;
  purchase_date: string;
  notes: string | null;
  invoice_reference: string | null;
  receipt_url: string | null;
  created_by: string;
  created_at: string | null;
  updated_at: string | null;
  invoice_date: string | null;
  received_date: string | null;
  shipping_date: string | null;
}

export interface PriceOverride {
  id: string;
  product_id: string;
  customer_phone: string;
  custom_price: number;
  reason: string | null;
  applied_by: string;
  applied_at: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface MonthlyReportData {
  dailyClosings: DailyClosing[];
  expenses: Expense[];
  monthlyBalanceClosings: MonthlyBalanceClosing[];
  vendorPurchases: VendorPurchase[];
  priceOverrides: PriceOverride[];
}
