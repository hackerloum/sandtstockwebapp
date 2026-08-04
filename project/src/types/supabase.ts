export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      products: {
        Row: {
          id: string
          code: string
          item_number: string
          commercial_name: string
          brand_id: string | null
          category: 'Eau de Parfum' | 'Eau de Toilette' | 'Eau de Cologne' | 'Parfum' | 'Eau Fraiche'
          concentration: string | null
          size: number
          current_stock: number
          min_stock: number
          max_stock: number
          reorder_point: number
          price: number
          supplier_id: string | null
          fragrance_notes: string | null
          gender: string | null
          season: string[] | null
          is_tester: boolean
          created_at: string
          updated_at: string
          created_by: string | null
          updated_by: string | null
        }
        Insert: Omit<Database['public']['Tables']['products']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['products']['Insert']>
      }
      inventory_owners: {
        Row: {
          id: string
          name: string
          owner_type: 'company' | 'person'
          is_default: boolean
          is_active: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['inventory_owners']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['inventory_owners']['Insert']>
      }
      product_owner_stocks: {
        Row: {
          product_id: string
          owner_id: string
          quantity: number
          updated_at: string
        }
        Insert: Database['public']['Tables']['product_owner_stocks']['Row']
        Update: Partial<Database['public']['Tables']['product_owner_stocks']['Insert']>
      }
      product_batches: {
        Row: {
          id: string
          product_id: string
          batch_number: string
          quantity: number
          manufacturing_date: string | null
          expiry_date: string | null
          storage_location: string | null
          storage_conditions: Json | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['product_batches']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['product_batches']['Insert']>
      }
      stock_movements: {
        Row: {
          id: string
          product_id: string
          batch_id: string | null
          owner_id: string | null
          movement_type: 'in' | 'out'
          quantity: number
          reason: string
          reference_number: string | null
          notes: string | null
          performed_by: string | null
          performed_at: string
        }
        Insert: Omit<Database['public']['Tables']['stock_movements']['Row'], 'id'>
        Update: Partial<Database['public']['Tables']['stock_movements']['Insert']>
      }
      orders: {
        Row: {
          id: string
          order_number: string
          customer_name: string
          customer_email: string | null
          customer_phone: string | null
          order_type: string
          pickup_by_staff: boolean | null
          pickup_person_name: string | null
          pickup_person_phone: string | null
          status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled'
          total_amount: number
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['orders']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['orders']['Insert']>
      }
      order_items: {
        Row: {
          id: string
          order_id: string
          product_id: string
          batch_id: string | null
          owner_id: string | null
          quantity: number
          unit_price: number
          total_price: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['order_items']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['order_items']['Insert']>
      }
      purchase_orders: {
        Row: {
          id: string
          po_number: string
          supplier_id: string
          status: 'draft' | 'sent' | 'confirmed' | 'received' | 'cancelled'
          total_amount: number
          order_date: string
          expected_delivery_date: string | null
          actual_delivery_date: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['purchase_orders']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['purchase_orders']['Insert']>
      }
      purchase_order_items: {
        Row: {
          id: string
          po_id: string
          product_id: string
          owner_id: string | null
          quantity: number
          received_quantity: number
          unit_price: number
          total_price: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['purchase_order_items']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['purchase_order_items']['Insert']>
      }
      brands: {
        Row: {
          id: string
          name: string
          description: string | null
          website: string | null
          contact_info: Json | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['brands']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['brands']['Insert']>
      }
      suppliers: {
        Row: {
          id: string
          name: string
          email: string | null
          phone: string | null
          address: string | null
          contact_person: string | null
          payment_terms: string | null
          lead_time: number | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['suppliers']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['suppliers']['Insert']>
      }
      activity_log: {
        Row: {
          id: string
          user_id: string | null
          action: string
          entity_type: string
          entity_id: string
          details: Json
          ip_address: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['activity_log']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['activity_log']['Insert']>
      }
      user_profiles: {
        Row: {
          id: string
          role: 'admin' | 'manager' | 'staff' | 'accountant'
          first_name: string | null
          last_name: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['user_profiles']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['user_profiles']['Insert']>
      }
      user_permissions: {
        Row: {
          id: string
          user_id: string
          permission: string
          granted_by: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['user_permissions']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['user_permissions']['Insert']>
      }
      role_permissions: {
        Row: {
          role: 'admin' | 'manager' | 'staff' | 'accountant'
          permission: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['role_permissions']['Row'], 'created_at'>
        Update: Partial<Database['public']['Tables']['role_permissions']['Insert']>
      }
      daily_closings: {
        Row: {
          id: string
          date: string
          cash_on_hand: number
          bank_deposit: number
          petty_cash: number
          notes: string | null
          closed_by: string
          closed_at: string
          is_reconciled: boolean
          reconciled_at: string | null
          reconciled_by: string | null
          created_at: string | null
          updated_at: string | null
          box_product_sales: number
          oil_sales: number
          cash_on_hand_box: number
          cash_on_hand_oil: number
          cash_on_hand_perfume: number
        }
        Insert: Omit<Database['public']['Tables']['daily_closings']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['daily_closings']['Insert']>
      }
      expenses: {
        Row: {
          id: string
          title: string
          description: string | null
          amount: number
          type: 'staff' | 'operational' | 'utilities' | 'supplies' | 'other'
          created_by: string
          date: string
          created_at: string | null
          updated_at: string | null
          receipt_url: string | null
          is_approved: boolean | null
          approved_by: string | null
          approved_at: string | null
          is_payroll: boolean
          payroll_lines: Json
        }
        Insert: Omit<Database['public']['Tables']['expenses']['Row'], 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['expenses']['Insert']>
      }
    }
  }
}
