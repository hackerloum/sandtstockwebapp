-- Migration 14: Add order types and international shipping statuses
-- This migration adds support for the two-tier order system:
-- 1. Store-to-shop orders (local)
-- 2. International-to-Tanzania orders

-- Create the order_type enum
CREATE TYPE order_type AS ENUM ('store-to-shop', 'international-to-tanzania');

-- Add order_type column to orders table
ALTER TABLE orders 
ADD COLUMN order_type order_type DEFAULT 'store-to-shop';

-- Add new order statuses for international shipping
ALTER TYPE order_status ADD VALUE 'customs-clearance';
ALTER TYPE order_status ADD VALUE 'in-transit-international';
ALTER TYPE order_status ADD VALUE 'arrived-tanzania';

-- Add comments for documentation
COMMENT ON COLUMN orders.order_type IS 'Type of order: store-to-shop (local) or international-to-tanzania';
COMMENT ON TYPE order_status IS 'Order status including international shipping stages: pending, processing, shipped, customs-clearance, in-transit-international, arrived-tanzania, delivered, cancelled';

-- Update existing orders to have the default order type
UPDATE orders 
SET order_type = 'store-to-shop'
WHERE order_type IS NULL;

-- Make order_type NOT NULL after setting defaults
ALTER TABLE orders 
ALTER COLUMN order_type SET NOT NULL;