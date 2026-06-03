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