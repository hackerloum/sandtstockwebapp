# Perfume Inventory Management System

A comprehensive inventory management system built for perfume businesses, featuring real-time stock tracking, order management, and detailed reporting.

## Features

- **Product Management**: Track perfume products with detailed attributes (brand, concentration, size, batch numbers, expiry dates)
- **Stock Movements**: Monitor stock in/out with detailed tracking
- **Order Management**: Handle customer orders and purchase orders
- **Real-time Dashboard**: View key metrics and stock alerts
- **Activity Logging**: Track all system activities
- **Role-based Access Control**: Secure access with user permissions
- **Supabase Integration**: Real-time database with PostgreSQL

## Tech Stack

- **Frontend**: React 18 with TypeScript
- **Build Tool**: Vite
- **Styling**: TailwindCSS
- **Icons**: Lucide React
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth

## Supabase Setup

### 1. Database Schema

The application uses a comprehensive database schema with the following main tables:

- `products` - Perfume product information
- `product_batches` - Batch tracking for products
- `stock_movements` - Stock in/out transactions
- `orders` - Customer orders
- `order_items` - Order line items
- `purchase_orders` - Supplier purchase orders
- `purchase_order_items` - PO line items
- `brands` - Perfume brands
- `suppliers` - Supplier information
- `activity_log` - System activity tracking
- `user_profiles` - User profile information
- `user_permissions` - User-specific permissions
- `role_permissions` - Role-based permissions

### 2. Row Level Security (RLS)

The database implements Row Level Security policies to ensure data access control:

- Users can only access data they have permission to view
- CRUD operations are controlled by permission checks
- Activity logging tracks all data modifications

### 3. Environment Variables

The application is configured with your Supabase credentials:

```env
VITE_SUPABASE_URL=https://ljkvwaduqvacmrvycshj.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxqa3Z3YWR1cXZhY21ydnljc2hqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5MTE3MTgsImV4cCI6MjA2OTQ4NzcxOH0.fkbZbCF8KTK5aupvRRu6dCycIgB9N4BnnxZNZd3cz4Q
```

## Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Start Development Server

```bash
npm run dev
```

### 3. Build for Production

```bash
npm run build
```

## Database Operations

### Products

- **Create Product**: `createProduct(productData)`
- **Update Product**: `updateProduct(id, updates)`
- **Get Products**: `getProducts()`

### Stock Movements

- **Create Movement**: `createStockMovement(movementData)`
- **Get Movements**: `getStockMovements()`

### Orders

- **Create Order**: `createOrder(orderData, items)`
- **Get Orders**: `getOrders()`

### Purchase Orders

- **Create PO**: `createPurchaseOrder(poData, items)`
- **Get POs**: `getPurchaseOrders()`

## Permission System

The system uses a granular permission system:

- **Admin**: Full access to all features
- **Manager**: Access to most features with some restrictions
- **Staff**: Limited access to basic operations

Permissions are checked using the `has_permission()` function in the database.

## Activity Logging

All system activities are automatically logged:

- Product creation/modification/deletion
- Stock movements
- Order operations
- User actions

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License. 