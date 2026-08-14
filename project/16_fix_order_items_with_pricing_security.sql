-- Migration 16: Fix security issue with order_items_with_pricing view
-- Remove SECURITY DEFINER property to use SECURITY INVOKER (default)
-- This ensures the view respects the querying user's permissions and RLS policies

-- Extract the view definition and recreate it without SECURITY DEFINER
DO $$
DECLARE
  view_def text;
BEGIN
  -- Check if view exists
  IF EXISTS (
    SELECT 1 FROM pg_views 
    WHERE schemaname = 'public' AND viewname = 'order_items_with_pricing'
  ) THEN
    -- Get the view definition using pg_get_viewdef
    SELECT pg_get_viewdef('public.order_items_with_pricing', true) INTO view_def;
    
    -- Drop the existing view
    DROP VIEW IF EXISTS public.order_items_with_pricing CASCADE;
    
    -- Recreate the view without SECURITY DEFINER (defaults to SECURITY INVOKER)
    -- pg_get_viewdef returns the SELECT statement, so we wrap it in CREATE VIEW
    EXECUTE format('CREATE VIEW public.order_items_with_pricing AS %s', view_def);
    
    -- Add comment for documentation
    EXECUTE 'COMMENT ON VIEW public.order_items_with_pricing IS ''View joining order_items with products and orders to include pricing and product details. Uses SECURITY INVOKER (default) to respect querying user permissions and RLS policies.''';
    
    RAISE NOTICE 'View order_items_with_pricing recreated without SECURITY DEFINER';
  ELSE
    RAISE NOTICE 'View order_items_with_pricing not found, skipping migration';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error recreating view: %', SQLERRM;
    RAISE;
END $$;
