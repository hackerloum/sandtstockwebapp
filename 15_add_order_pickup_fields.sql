-- Add order_type column to orders table and related fields for pickup information

-- Add order_type column to orders table
ALTER TABLE orders ADD COLUMN order_type TEXT;

-- Add pickup-related columns to orders table
ALTER TABLE orders ADD COLUMN pickup_by_staff BOOLEAN DEFAULT false;
ALTER TABLE orders ADD COLUMN pickup_person_name TEXT;
ALTER TABLE orders ADD COLUMN pickup_person_phone TEXT;

-- Add comments to document the new columns
COMMENT ON COLUMN orders.order_type IS 'Type of order: storeToShop, delivery, or pickup';
COMMENT ON COLUMN orders.pickup_by_staff IS 'Whether the staff member is doing the pickup (for storeToShop orders)';
COMMENT ON COLUMN orders.pickup_person_name IS 'Name of person picking up the order (for storeToShop orders)';
COMMENT ON COLUMN orders.pickup_person_phone IS 'Phone number of pickup person (for storeToShop orders)';

-- Update existing orders to have a default order_type (assuming they are deliveries)
UPDATE orders SET order_type = 'delivery' WHERE order_type IS NULL;

-- Make order_type NOT NULL after setting defaults
ALTER TABLE orders ALTER COLUMN order_type SET NOT NULL;