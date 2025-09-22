# Order Database Schema Fix

## Problem
The order details are not showing correct information because the database schema is missing several fields that the frontend expects:

- `order_type` (delivery, storeToShop, pickup)
- `pickup_by_staff` (boolean)
- `pickup_person_name` (text)
- `pickup_person_phone` (text)

## Solution
Run the database migration script `16_fix_order_schema.sql` to add the missing fields.

## Steps to Fix

### 1. Run the Migration Script
Execute the SQL script in your database:

```sql
-- Run the contents of 16_fix_order_schema.sql
```

### 2. Verify the Schema
After running the migration, verify that the new columns exist:

```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'orders' 
ORDER BY ordinal_position;
```

### 3. Check Sample Data
Verify that existing orders have proper values:

```sql
SELECT 
    order_number,
    order_type,
    status,
    customer_name,
    total_amount,
    created_at
FROM orders 
LIMIT 5;
```

## What the Migration Does

1. **Adds missing columns** if they don't exist
2. **Converts enum types** to text for compatibility
3. **Sets default values** for existing orders
4. **Creates indexes** for better performance
5. **Adds documentation** for the new columns

## Expected Result

After running the migration, you should see:

- All orders have an `order_type` field
- Pickup information fields are available
- Order details display correctly in the frontend
- PDF generation works with complete information

## Troubleshooting

### If you get permission errors:
- Make sure you're using a database user with ALTER TABLE permissions
- Consider using the service role key for migrations

### If the migration fails:
- Check the database logs for specific error messages
- Ensure you have sufficient disk space
- Verify that the orders table exists and is accessible

### If orders still don't show correctly:
- Clear your browser cache
- Check the browser console for JavaScript errors
- Verify that the frontend is fetching fresh data

## Frontend Changes Made

The frontend has been updated to:

1. **Handle missing fields gracefully** with default values
2. **Show comprehensive order information** including pickup details
3. **Display database debugging information** to help troubleshoot
4. **Support multiple order type formats** for compatibility
5. **Generate detailed PDFs** with all available information

## Testing

After applying the migration:

1. **View order details** - should show all available information
2. **Generate PDFs** - should include complete order details
3. **Check order list** - should display order types and pickup info
4. **Verify statistics** - should show correct order type counts

## Support

If you continue to have issues:

1. Check the browser console for error messages
2. Verify the database migration completed successfully
3. Ensure the frontend is using the latest code
4. Check that the database connection is working properly 