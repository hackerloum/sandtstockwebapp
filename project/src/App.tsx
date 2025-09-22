import React, { useState, useRef, useEffect } from 'react';
import { BarChart3, Package, ArrowUpDown, Home, Plus, ShoppingCart, FileText, Activity, LogOut, Menu, AlertCircle, X, CheckCircle } from 'lucide-react';
import { Product, StockMovement, Order, PurchaseOrder, Brand, Supplier, ActivityLog } from './types';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { ProductList } from './components/ProductList';
import { EditProductPage } from './components/EditProductPage';
import { ProductDetail } from './components/ProductDetail';
import { StockMovementComponent } from './components/StockMovement';
import { AddProductPage } from './components/AddProductPage';
import { OrderManagement } from './components/OrderManagement';
import { PurchaseOrders } from './components/PurchaseOrders';
import { AdvancedReports } from './components/AdvancedReports';
import { NotificationCenter } from './components/NotificationCenter';
import { ActivityLogComponent } from './components/ActivityLog';
import { ProductReports } from './components/ProductReports';
import { ProductDebug } from './components/ProductDebug';
import { 
  getProducts, 
  getStockMovements, 
  getOrders, 
  getPurchaseOrders, 
  getBrands, 
  getSuppliers, 
  getActivityLog,
  createProduct,
  updateProduct,
  deleteProduct,
  createStockMovement,
  createOrder,
  updateOrder,
  createPurchaseOrder,
  ensureArgevilleSupplier,
  testProductVisibility
} from './lib/supabase';

type ActiveTab = 'dashboard' | 'products' | 'add-product' | 'edit-product' | 'movements' | 'orders' | 'purchase-orders' | 'reports' | 'product-reports' | 'activity' | 'debug';

function AppContent() {
  const { user, logout, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [isProductDetailOpen, setIsProductDetailOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);

  // Fetch data from Supabase
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // Ensure Argeville supplier exists first
        await ensureArgevilleSupplier();
        
        // Test product visibility
        console.log('App: Testing product visibility...');
        await testProductVisibility();
        
        const [productsData, movementsData, ordersData, purchaseOrdersData, brandsData, suppliersData, activitiesData] = await Promise.all([
          getProducts(),
          getStockMovements(),
          getOrders(),
          getPurchaseOrders(),
          getBrands(),
          getSuppliers(),
          getActivityLog()
        ]);
        
        setProducts(productsData);
        setMovements(movementsData);
        setOrders(ordersData);
        setPurchaseOrders(purchaseOrdersData);
        setBrands(brandsData);
        setSuppliers(suppliersData);
        setActivities(activitiesData);
        

      } catch (err) {
        console.error('Error in fetchData:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleSaveProduct = async (product: Omit<Product, 'id' | 'created_at' | 'updated_at'>) => {
    console.log('handleSaveProduct called with:', product);
    console.log('Current stock in product data:', product.current_stock);
    console.log('Current stock type:', typeof product.current_stock);
    
    // Clear any previous errors or success messages
    setError(null);
    setSuccess(null);
    
    try {
      if (editingProduct) {
        console.log('Updating existing product:', editingProduct.id);
        console.log('Previous stock:', editingProduct.current_stock);
        console.log('New stock:', product.current_stock);
        
        const updatedProduct = await updateProduct(editingProduct.id, product);
        console.log('Product updated successfully:', updatedProduct);
        console.log('Updated stock value:', updatedProduct.current_stock);
        
        setProducts(prev => prev.map(p => p.id === updatedProduct.id ? updatedProduct : p));
        setSuccess(`Product "${product.commercial_name}" updated successfully!`);
      } else {
        const newProduct = await createProduct(product);
        // Add the new product to the existing list
        setProducts(prev => [...prev, newProduct as Product]);
        setSuccess(`Product "${product.commercial_name}" created successfully!`);
      }
      setEditingProduct(null);
      setActiveTab('products');
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      console.error('Error saving product:', err);
      setError(err instanceof Error ? err.message : 'Failed to save product');
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setActiveTab('edit-product');
  };

  const handleDeleteProduct = async (id: string) => {
    const product = products.find(p => p.id === id);
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await deleteProduct(id);
        setProducts(prev => prev.filter(p => p.id !== id));
        setMovements(prev => prev.filter(m => m.product_id !== id));
      } catch (err) {
        console.error('Error deleting product:', err);
        setError(err instanceof Error ? err.message : 'Failed to delete product');
      }
    }
  };

  const handleViewProduct = (product: Product) => {
    setViewingProduct(product);
    setIsProductDetailOpen(true);
  };

  const handleAddProduct = () => {
    setActiveTab('add-product');
  };

  const handleAddMovement = async (movement: Omit<StockMovement, 'id'>) => {
    try {
      const newMovement = await createStockMovement(movement);
      setMovements(prev => [...prev, newMovement]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add movement');
    }
  };

  const handleUpdateProduct = (product: Product) => {
    setProducts(prev => prev.map(p => p.id === product.id ? product : p));
  };

  const handleAddOrder = async (order: Order) => {
    try {
      const items = order.items || [];
      const orderWithoutItems = { ...order };
      delete orderWithoutItems.items;
      
      const newOrder = await createOrder(orderWithoutItems, items);
      setOrders(prev => [...prev, { ...newOrder, items }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create order');
    }
  };

  const handleUpdateOrder = async (order: Order) => {
    try {
      console.log('Updating order:', order.id, 'with new status:', order.status);
      
      // Update the order in the database
      const updatedOrder = await updateOrder(order.id, {
        status: order.status,
        customer_name: order.customer_name,
        customer_email: order.customer_email,
        customer_phone: order.customer_phone,
        order_type: order.order_type,
        total_amount: order.total_amount,
        notes: order.notes,
        updated_at: new Date().toISOString()
      });
      
      // Update the local state with the database response
      setOrders(prev => prev.map(o => o.id === order.id ? { ...order, ...updatedOrder } : o));
      
      console.log('Order updated successfully');
    } catch (err) {
      console.error('Error updating order:', err);
      setError(err instanceof Error ? err.message : 'Failed to update order');
    }
  };

  const handleDeleteOrder = (id: string) => {
    setOrders(prev => prev.filter(o => o.id !== id));
  };

  const handleAddPurchaseOrder = async (po: Omit<PurchaseOrder, 'id' | 'created_at' | 'updated_at'>, items: any[]) => {
    try {
      const newPO = await createPurchaseOrder(po, items);
      setPurchaseOrders(prev => [...prev, newPO]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create purchase order');
    }
  };

  const handleUpdatePurchaseOrder = (po: PurchaseOrder) => {
    setPurchaseOrders(prev => prev.map(p => p.id === po.id ? po : p));
  };

  const handleDeletePurchaseOrder = (id: string) => {
    setPurchaseOrders(prev => prev.filter(p => p.id !== id));
  };

  const mainTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, permission: 'view_dashboard' },
    { id: 'products', label: 'Products', icon: Package, permission: 'view_products' },
    { id: 'orders', label: 'Orders', icon: ShoppingCart, permission: 'view_orders' },
    { id: 'purchase-orders', label: 'Purchase Orders', icon: FileText, permission: 'view_purchase_orders' },
  ];

  const secondaryTabs = [
    { id: 'movements', label: 'Stock Movements', icon: ArrowUpDown, permission: 'view_movements' },
    { id: 'reports', label: 'Reports', icon: BarChart3, permission: 'view_reports' },
    { id: 'product-reports', label: 'Product Reports', icon: FileText, permission: 'view_reports' },
    { id: 'activity', label: 'Activity Log', icon: Activity, permission: 'view_activity_log' },
    { id: 'add-product', label: 'Add Product', icon: Plus, permission: 'add_product' },
    { id: 'debug', label: 'Debug', icon: BarChart3, permission: 'view_products' },
  ];

  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const visibleMainTabs = mainTabs.filter(tab => hasPermission(tab.permission));
  const visibleSecondaryTabs = secondaryTabs.filter(tab => hasPermission(tab.permission));

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            {/* Logo */}
            <div className="flex items-center">
              <div className="flex items-center space-x-3">
                <BarChart3 className="w-8 h-8 text-blue-600" />
                <h1 className="text-xl font-bold text-gray-900">StockTracker Pro</h1>
              </div>
            </div>
            
            {/* Main Navigation */}
            <div className="hidden md:flex items-center space-x-1">
              {visibleMainTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as ActiveTab)}
                    className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors ${
                      activeTab === tab.id
                        ? 'bg-blue-100 text-blue-700'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}

              {/* More Menu */}
              {visibleSecondaryTabs.length > 0 && (
                <div className="relative" ref={moreMenuRef}>
                  <button
                    onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                    className={`px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors ${
                      isMoreMenuOpen
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }`}
                  >
                    <Menu className="w-4 h-4" />
                    <span>More</span>
                  </button>

                  {isMoreMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                      {visibleSecondaryTabs.map((tab) => {
                        const Icon = tab.icon;
                        return (
                          <button
                            key={tab.id}
                            onClick={() => {
                              setActiveTab(tab.id as ActiveTab);
                              setIsMoreMenuOpen(false);
                            }}
                            className={`w-full px-4 py-2 flex items-center space-x-2 transition-colors ${
                              activeTab === tab.id
                                ? 'bg-blue-50 text-blue-700'
                                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                            }`}
                          >
                            <Icon className="w-4 h-4" />
                            <span>{tab.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <button
                onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              >
                <Menu className="w-6 h-6" />
              </button>

              {isMoreMenuOpen && (
                <div className="absolute top-16 left-0 right-0 bg-white border-b border-gray-200 p-4 space-y-2 z-50">
                  {[...visibleMainTabs, ...visibleSecondaryTabs].map((tab) => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => {
                          setActiveTab(tab.id as ActiveTab);
                          setIsMoreMenuOpen(false);
                        }}
                        className={`w-full px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors ${
                          activeTab === tab.id
                            ? 'bg-blue-100 text-blue-700'
                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Side - User & Notifications */}
            <div className="flex items-center space-x-4">
              <NotificationCenter products={products} />
              
              <div className="hidden sm:flex items-center space-x-3 border-l border-gray-200 pl-4">
                <div className="text-right">
                  <p className="text-sm font-medium text-gray-900">{user?.firstName} {user?.lastName}</p>
                  <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
                </div>
                <button
                  onClick={logout}
                  className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Error Display */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <span className="text-red-700 font-medium">{error}</span>
              </div>
              <button
                onClick={() => setError(null)}
                className="text-red-400 hover:text-red-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Display */}
      {success && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-500" />
                <span className="text-green-700 font-medium">{success}</span>
              </div>
              <button
                onClick={() => setSuccess(null)}
                className="text-green-400 hover:text-green-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'dashboard' && hasPermission('view_dashboard') && (
          <Dashboard 
            onCreatePurchaseOrder={(productId) => {
              const product = products.find(p => p.id === productId);
              if (product) {
                setActiveTab('purchase-orders');
              }
            }}
            onAddProduct={handleAddProduct}
            onCreateOrder={() => setActiveTab('orders')}
            onStockCount={() => {
              // For now, navigate to movements where stock count would typically be done
              setActiveTab('movements');
            }}
            onNavigate={(tab) => setActiveTab(tab as ActiveTab)}
          />
        )}

        {activeTab === 'products' && hasPermission('view_products') && (
          <ProductList
            products={products}
            onAddProduct={handleAddProduct}
            onEditProduct={handleEditProduct}
            onDeleteProduct={handleDeleteProduct}
            onViewProduct={handleViewProduct}
          />
        )}

        {activeTab === 'add-product' && hasPermission('add_product') && (
          <AddProductPage
            onSave={handleSaveProduct}
            onBack={() => setActiveTab('products')}
            brands={brands}
            suppliers={suppliers}
          />
        )}

        {activeTab === 'edit-product' && hasPermission('edit_product') && (
          <EditProductPage
            product={editingProduct}
            onSave={handleSaveProduct}
            onBack={() => {
              setActiveTab('products');
              setEditingProduct(null);
            }}
          />
        )}

        {activeTab === 'movements' && hasPermission('view_movements') && (
          <StockMovementComponent
            products={products}
            movements={movements}
            onAddMovement={handleAddMovement}
            onUpdateProduct={handleUpdateProduct}
          />
        )}

        {activeTab === 'orders' && hasPermission('view_orders') && (
          <OrderManagement
            orders={orders}
            products={products}
            onAddOrder={handleAddOrder}
            onUpdateOrder={handleUpdateOrder}
            onDeleteOrder={handleDeleteOrder}
            onUpdateProduct={handleUpdateProduct}
          />
        )}

        {activeTab === 'purchase-orders' && hasPermission('view_purchase_orders') && (
          <PurchaseOrders
            purchaseOrders={purchaseOrders}
            products={products}
            suppliers={suppliers}
            onAddPurchaseOrder={handleAddPurchaseOrder}
            onUpdatePurchaseOrder={handleUpdatePurchaseOrder}
            onDeletePurchaseOrder={handleDeletePurchaseOrder}
            onUpdateProduct={handleUpdateProduct}
          />
        )}

        {activeTab === 'reports' && hasPermission('view_reports') && (
          <AdvancedReports
            products={products}
            orders={orders}
            movements={movements}
            purchaseOrders={purchaseOrders}
          />
        )}

        {activeTab === 'product-reports' && hasPermission('view_reports') && (
          <ProductReports products={products} />
        )}

        {activeTab === 'activity' && hasPermission('view_activity_log') && (
          <ActivityLogComponent activities={activities} />
        )}

        {activeTab === 'debug' && (
          <ProductDebug />
        )}
      </main>



      <ProductDetail
        product={viewingProduct}
        isOpen={isProductDetailOpen}
        onClose={() => {
          setIsProductDetailOpen(false);
          setViewingProduct(null);
        }}
      />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <AuthWrapper />
    </AuthProvider>
  );
}

function AuthWrapper() {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Login />;
  }
  
  return <AppContent />;
}

export default App;