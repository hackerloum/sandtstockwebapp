-- 1_init.sql
-- Initialize required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "moddatetime";

-- Create custom types
create type product_category as enum (
  'Eau de Parfum',
  'Eau de Toilette',
  'Eau de Cologne',
  'Parfum',
  'Eau Fraiche'
);

create type movement_type as enum ('in', 'out');
create type order_status as enum ('pending', 'processing', 'shipped', 'delivered', 'cancelled');
create type purchase_order_status as enum ('draft', 'sent', 'confirmed', 'received', 'cancelled');
create type user_role as enum ('admin', 'manager', 'staff');

-- 2_auth_schema.sql
-- Create custom auth tables
create table user_profiles (
  id uuid references auth.users primary key,
  role user_role not null default 'staff',
  first_name text,
  last_name text,
  avatar_url text,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table user_permissions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  permission text not null,
  granted_by uuid references auth.users,
  created_at timestamp with time zone default now(),
  unique(user_id, permission)
);

-- Default permissions for roles
create table role_permissions (
  role user_role not null,
  permission text not null,
  created_at timestamp with time zone default now(),
  primary key (role, permission)
);

-- 3_core_schema.sql
-- Create main tables
create table brands (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  website text,
  contact_info jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table suppliers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text,
  phone text,
  address text,
  contact_person text,
  payment_terms text,
  lead_time integer,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table products (
  id uuid primary key default uuid_generate_v4(),
  code text not null unique,
  item_number text not null unique,
  commercial_name text not null,
  brand_id uuid references brands(id),
  category product_category not null,
  concentration text,
  size integer not null,
  current_stock integer not null default 0,
  min_stock integer not null default 5,
  max_stock integer not null default 50,
  reorder_point integer not null default 10,
  price decimal(10,2) not null,
  supplier_id uuid references suppliers(id),
  fragrance_notes text,
  gender text,
  season text[],
  is_tester boolean default false,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now(),
  created_by uuid references auth.users(id),
  updated_by uuid references auth.users(id)
);

-- 4_inventory_schema.sql
create table product_batches (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid references products(id),
  batch_number text not null,
  quantity integer not null,
  manufacturing_date date,
  expiry_date date,
  storage_location text,
  storage_conditions jsonb,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table stock_movements (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid references products(id),
  batch_id uuid references product_batches(id),
  movement_type movement_type not null,
  quantity integer not null,
  reason text not null,
  reference_number text,
  notes text,
  performed_by uuid references auth.users(id),
  performed_at timestamp with time zone default now()
);

-- 5_orders_schema.sql
create table orders (
  id uuid primary key default uuid_generate_v4(),
  order_number text not null unique,
  customer_name text not null,
  customer_email text,
  customer_phone text,
  status order_status not null default 'pending',
  total_amount decimal(10,2) not null,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table order_items (
  id uuid primary key default uuid_generate_v4(),
  order_id uuid references orders(id),
  product_id uuid references products(id),
  batch_id uuid references product_batches(id),
  quantity integer not null,
  unit_price decimal(10,2) not null,
  total_price decimal(10,2) not null,
  created_at timestamp with time zone default now()
);

-- 6_purchase_orders_schema.sql
create table purchase_orders (
  id uuid primary key default uuid_generate_v4(),
  po_number text not null unique,
  supplier_id uuid references suppliers(id),
  status purchase_order_status not null default 'draft',
  total_amount decimal(10,2) not null,
  order_date timestamp with time zone default now(),
  expected_delivery_date date,
  actual_delivery_date date,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

create table purchase_order_items (
  id uuid primary key default uuid_generate_v4(),
  po_id uuid references purchase_orders(id),
  product_id uuid references products(id),
  quantity integer not null,
  received_quantity integer default 0,
  unit_price decimal(10,2) not null,
  total_price decimal(10,2) not null,
  created_at timestamp with time zone default now()
);

-- 7_activity_log_schema.sql
create table activity_log (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  details jsonb not null,
  ip_address text,
  created_at timestamp with time zone default now()
);

-- 8_rls_policies.sql
-- Helper function to check user permissions
create or replace function has_permission(permission text)
returns boolean as $$
begin
  return exists (
    select 1 from user_permissions
    where user_id = auth.uid()
    and permission = $1
  ) or exists (
    select 1 from user_profiles up
    join role_permissions rp on rp.role = up.role
    where up.id = auth.uid()
    and rp.permission = $1
  );
end;
$$ language plpgsql security definer;

-- Enable RLS
alter table products enable row level security;
alter table stock_movements enable row level security;
alter table orders enable row level security;
alter table purchase_orders enable row level security;
alter table activity_log enable row level security;

-- Products policies
create policy "Products viewable by authenticated users"
  on products for select
  using (auth.role() = 'authenticated');

create policy "Products insertable by users with create_product permission"
  on products for insert
  with check (has_permission('create_product'));

create policy "Products updatable by users with edit_product permission"
  on products for update
  using (has_permission('edit_product'));

-- 9_indexes.sql
create index idx_products_code on products(code);
create index idx_products_item_number on products(item_number);
create index idx_products_brand_id on products(brand_id);
create index idx_products_supplier_id on products(supplier_id);
create index idx_stock_movements_product_id on stock_movements(product_id);
create index idx_stock_movements_batch_id on stock_movements(batch_id);
create index idx_order_items_order_id on order_items(order_id);
create index idx_order_items_product_id on order_items(product_id);
create index idx_purchase_order_items_po_id on purchase_order_items(po_id);
create index idx_activity_log_entity on activity_log(entity_type, entity_id);
create index idx_user_permissions_user_id on user_permissions(user_id);

-- 10_triggers.sql
create trigger handle_updated_at before update on products
  for each row execute procedure moddatetime (updated_at);

create trigger handle_updated_at before update on purchase_orders
  for each row execute procedure moddatetime (updated_at);

create trigger handle_updated_at before update on user_profiles
  for each row execute procedure moddatetime (updated_at);

-- Function to update product stock
create or replace function update_product_stock()
returns trigger as $$
begin
  if TG_OP = 'INSERT' then
    if new.movement_type = 'in' then
      update products
      set current_stock = current_stock + new.quantity
      where id = new.product_id;
    else
      update products
      set current_stock = current_stock - new.quantity
      where id = new.product_id;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger update_stock_after_movement
  after insert on stock_movements
  for each row
  execute function update_product_stock();

-- 11_seed_data.sql
-- Insert default roles and permissions
insert into role_permissions (role, permission) values
  ('admin', 'view_dashboard'),
  ('admin', 'create_product'),
  ('admin', 'edit_product'),
  ('admin', 'delete_product'),
  ('admin', 'view_reports'),
  ('admin', 'manage_users'),
  ('manager', 'view_dashboard'),
  ('manager', 'create_product'),
  ('manager', 'edit_product'),
  ('manager', 'view_reports'),
  ('staff', 'view_dashboard'),
  ('staff', 'view_products'),
  ('staff', 'create_order');

  -- Add product_type field to products table
-- Migration: Add product type categorization

ALTER TABLE products 
ADD COLUMN product_type TEXT DEFAULT 'Fragrance Bottles' CHECK (product_type IN ('Fragrance Bottles', 'Crimp', 'Accessories', 'Packaging'));

-- Add comment for documentation
COMMENT ON COLUMN products.product_type IS 'Type of product: Fragrance Bottles, Crimp, Accessories, or Packaging';

-- Update existing products to have the default product type
UPDATE products 
SET product_type = 'Fragrance Bottles'
WHERE product_type IS NULL;

-- Add weight fields to products table
-- Migration: Add bottle weight specifications

ALTER TABLE products 
ADD COLUMN gross_weight DECIMAL(6,3) DEFAULT 1.136,
ADD COLUMN tare_weight DECIMAL(6,3) DEFAULT 0.136,
ADD COLUMN net_weight DECIMAL(6,3) DEFAULT 1.000;

-- Add comments for documentation
COMMENT ON COLUMN products.gross_weight IS 'GROSS MIN - Total weight including bottle and contents in kg';
COMMENT ON COLUMN products.tare_weight IS 'TARE MIN - Weight of empty bottle only in kg';
COMMENT ON COLUMN products.net_weight IS 'NET - Weight of perfume contents only in kg';

-- Update existing products with default weight values if they don't have them
UPDATE products 
SET 
  gross_weight = 1.136,
  tare_weight = 0.136,
  net_weight = 1.000
WHERE gross_weight IS NULL OR tare_weight IS NULL OR net_weight IS NULL; 

-- Comprehensive fix for all RLS policies and ambiguous function

-- First, create the new function with proper parameter naming
CREATE OR REPLACE FUNCTION check_user_permission(perm_name text)
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_permissions up
    WHERE up.user_id = auth.uid()
    AND up.permission = perm_name
  ) OR EXISTS (
    SELECT 1 FROM user_profiles prof
    JOIN role_permissions rp ON rp.role = prof.role
    WHERE prof.id = auth.uid()
    AND rp.permission = perm_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop ALL existing policies that might be using the old function
DROP POLICY IF EXISTS "Products viewable by authenticated users" ON products;
DROP POLICY IF EXISTS "Products insertable by users with create_product permission" ON products;
DROP POLICY IF EXISTS "Products updatable by users with edit_product permission" ON products;
DROP POLICY IF EXISTS "Orders viewable by authenticated users" ON orders;
DROP POLICY IF EXISTS "Orders insertable by users with create_order permission" ON orders;
DROP POLICY IF EXISTS "Orders updatable by users with edit_order permission" ON orders;
DROP POLICY IF EXISTS "Order items viewable by authenticated users" ON order_items;
DROP POLICY IF EXISTS "Order items insertable by users with create_order permission" ON order_items;
DROP POLICY IF EXISTS "Stock movements viewable by authenticated users" ON stock_movements;
DROP POLICY IF EXISTS "Stock movements insertable by users with create_order permission" ON stock_movements;

-- Enable RLS on all tables
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- Recreate ALL policies using the new function

-- Products policies
CREATE POLICY "Products viewable by authenticated users"
  ON products FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Products insertable by users with create_product permission"
  ON products FOR INSERT
  WITH CHECK (check_user_permission('create_product'));

CREATE POLICY "Products updatable by users with edit_product permission"
  ON products FOR UPDATE
  USING (check_user_permission('edit_product'));

-- Orders policies
CREATE POLICY "Orders viewable by authenticated users"
  ON orders FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Orders insertable by users with create_order permission"
  ON orders FOR INSERT
  WITH CHECK (check_user_permission('create_order'));

CREATE POLICY "Orders updatable by users with edit_order permission"
  ON orders FOR UPDATE
  USING (check_user_permission('edit_order') OR created_by = auth.uid());

-- Order items policies
CREATE POLICY "Order items viewable by authenticated users"
  ON order_items FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Order items insertable by users with create_order permission"
  ON order_items FOR INSERT
  WITH CHECK (check_user_permission('create_order'));

-- Stock movements policies
CREATE POLICY "Stock movements viewable by authenticated users"
  ON stock_movements FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Stock movements insertable by users with create_order permission"
  ON stock_movements FOR INSERT
  WITH CHECK (check_user_permission('create_order') OR check_user_permission('manage_stock'));

-- Add missing permissions to role_permissions
INSERT INTO role_permissions (role, permission) VALUES
  ('admin', 'create_order'),
  ('admin', 'edit_order'),
  ('admin', 'manage_stock'),
  ('manager', 'create_order'),
  ('manager', 'edit_order'),
  ('manager', 'manage_stock'),
  ('staff', 'manage_stock')
ON CONFLICT (role, permission) DO NOTHING;

-- Fix product stock update policy to allow stock updates during order creation
-- This allows users with either 'edit_product' OR 'manage_stock' permission to update products

-- Drop the existing product update policy
DROP POLICY IF EXISTS "Products updatable by users with edit_product permission" ON products;

-- Create new policy that allows both edit_product and manage_stock permissions
CREATE POLICY "Products updatable by users with edit_product or manage_stock permission"
  ON products FOR UPDATE
  USING (check_user_permission('edit_product') OR check_user_permission('manage_stock'));

-- Also ensure staff has create_order permission for creating orders
INSERT INTO role_permissions (role, permission) VALUES
  ('staff', 'create_order')
ON CONFLICT (role, permission) DO NOTHING;