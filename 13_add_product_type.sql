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