import { useState, useRef, useEffect } from 'react';
import { BarChart3, Package, ArrowUpDown, Home, Plus, ShoppingCart, FileText, Activity, LogOut, Menu, AlertCircle, X, CheckCircle, Zap, CalendarDays, MoreHorizontal, WalletCards } from 'lucide-react';
import { Product, StockMovement, Order, PurchaseOrder, PurchaseOrderItem, Brand, Supplier, ActivityLog, InventoryOwner } from './types';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';
import { ReorderEnginePage } from './components/ReorderEnginePage';
import { UpcomingInvoicesPage } from './components/UpcomingInvoicesPage';
import { ProductList } from './components/ProductList';
import { EditProductPage } from './components/EditProductPage';
import { ProductDetail } from './components/ProductDetail';
import { StockMovementComponent } from './components/StockMovement';
import { AddProductPage } from './components/AddProductPage';
import { OrderManagement } from './components/OrderManagement';
import { PurchaseOrders } from './components/PurchaseOrders';
import { AdvancedReports } from './components/AdvancedReports';
import { MonthlyReportsPage } from './components/MonthlyReportsPage';
import { DailyClosingPage } from './components/DailyClosingPage';
import { NotificationCenter } from './components/NotificationCenter';
import { ActivityLogComponent } from './components/ActivityLog';
import { ProductReports } from './components/ProductReports';
import { ProductDebug } from './components/ProductDebug';
import { 
  getProducts, 
  getStockMovements, 
  getOrders, 
  getPurchaseOrders, 
  getIncomingByProductSummary,
  getBrands, 
  getSuppliers, 
  getActivityLog,
  createProduct,
  updateProduct,
  deleteProduct,
  createStockMovement,
  createOrder,
  getErrorMessage,
  updateOrder,
  updateOrderWithItems,
  createPurchaseOrder,
  getInventoryOwners,
  receivePurchaseOrderStock,
  ensureArgevilleSupplier,
  testProductVisibility
} from './lib/supabase';

type ActiveTab =
  | 'dashboard'
  | 'products'
  | 'add-product'
  | 'edit-product'
  | 'movements'
  | 'orders'
  | 'purchase-orders'
  | 'reports'
  | 'monthly-reports'
  | 'daily-closing'
  | 'product-reports'
  | 'activity'
  | 'reorder-engine'
  | 'upcoming-invoices'
  | 'debug';

type ProductListScrollState = {
  scrollOffset: number;
  anchorId?: string;
  anchorOffset?: number;
};

type ProductListAnchor = {
  id: string;
  offset: number;
};

function AppContent() {
  const { user, logout, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [inventoryOwners, setInventoryOwners] = useState<InventoryOwner[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [incomingByProduct, setIncomingByProduct] = useState<
    Array<{
      product_id: string;
      total_incoming_kg: number;
      earliest_arrival_date: string | null;
      invoice_references: string[];
      line_count: number;
    }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [newOrderSignal, setNewOrderSignal] = useState(0);
  
  const [isProductDetailOpen, setIsProductDetailOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [productListScrollState, setProductListScrollState] = useState<ProductListScrollState | null>(null);
  const [shouldRestoreProductListScroll, setShouldRestoreProductListScroll] = useState(false);
  const restoreAttemptsRef = useRef(0);

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
        
        const [
          productsData,
          movementsData,
          ordersData,
          purchaseOrdersData,
          incomingByProductData,
          brandsData,
          suppliersData,
          inventoryOwnersData,
          activitiesData
        ] = await Promise.all([
          getProducts(),
          getStockMovements(),
          getOrders(),
          getPurchaseOrders(),
          getIncomingByProductSummary().catch(() => []),
          getBrands(),
          getSuppliers(),
          getInventoryOwners().catch(() => []),
          getActivityLog()
        ]);
        
        setProducts(productsData);
        setMovements(movementsData);
        setOrders(ordersData);
        setPurchaseOrders(purchaseOrdersData);
        setIncomingByProduct(incomingByProductData);
        setBrands(brandsData);
        setSuppliers(suppliersData);
        setInventoryOwners(inventoryOwnersData);
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
        await refreshActivityLog();
      } else {
        const newProduct = await createProduct(product);
        // Add the new product to the existing list
        setProducts(prev => [...prev, newProduct as Product]);
        setSuccess(`Product "${product.commercial_name}" created successfully!`);
        await refreshActivityLog();
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

  const getProductListContainer = () => {
    if (typeof window === 'undefined') return null;
    return document.querySelector('[data-product-list="container"]');
  };

  const getProductListTop = () => {
    const listElement = getProductListContainer();
    if (!listElement || typeof window === 'undefined') return 0;
    return listElement.getBoundingClientRect().top + window.scrollY;
  };

  const getProductListRowOffset = (productId: string) => {
    const listElement = getProductListContainer();
    if (!listElement) return null;
    const rowElement = listElement.querySelector(`[data-row-id="${productId}"]`);
    if (!rowElement) return null;
    return rowElement.getBoundingClientRect().top;
  };

  const getProductListAnchor = (): ProductListAnchor | null => {
    if (typeof window === 'undefined') return null;
    const listElement = getProductListContainer();
    if (!listElement) return null;
    const rows = Array.from(listElement.querySelectorAll('[data-row-id]'));
    let anchor: ProductListAnchor | null = null;
    rows.forEach((row) => {
      const rect = row.getBoundingClientRect();
      const rowId = row.getAttribute('data-row-id');
      if (!rowId || rect.bottom <= 0 || rect.top >= window.innerHeight) return;
      if (!anchor || rect.top < anchor.offset) {
        anchor = { id: rowId, offset: rect.top };
      }
    });
    return anchor;
  };

  const handleEditProduct = (product: Product) => {
    if (activeTab === 'products' && typeof window !== 'undefined') {
      const listTop = getProductListTop();
      const rowOffset = getProductListRowOffset(product.id);
      const anchor = getProductListAnchor();
      setProductListScrollState({
        scrollOffset: Math.max(0, window.scrollY - listTop),
        anchorId: anchor?.id ?? product.id,
        anchorOffset: anchor?.offset ?? rowOffset ?? undefined
      });
      setShouldRestoreProductListScroll(true);
    }
    setEditingProduct(product);
    setActiveTab('edit-product');
  };

  const handleDeleteProduct = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await deleteProduct(id);
        setProducts(prev => prev.filter(p => p.id !== id));
        setMovements(prev => prev.filter(m => m.product_id !== id));
      } catch (err) {
        console.error('Error deleting product:', err);
        const message = err instanceof Error ? err.message : (err && typeof (err as { message?: string }).message === 'string' ? (err as { message: string }).message : 'Failed to delete product');
        setError(message);
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
      await refreshActivityLog();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add movement');
      throw err;
    }
  };

  const handleUpdateProduct = (product: Product) => {
    setProducts(prev => prev.map(p => p.id === product.id ? product : p));
  };

  const applyOwnerStockChange = (product: Product, ownerId: string, quantityDelta: number): Product => {
    const ownerStocks = [...(product.owner_stocks || [])];
    const index = ownerStocks.findIndex((stock) => stock.owner_id === ownerId);
    if (index >= 0) {
      ownerStocks[index] = {
        ...ownerStocks[index],
        quantity: Math.max(0, Number(ownerStocks[index].quantity || 0) + quantityDelta)
      };
    } else if (quantityDelta > 0) {
      ownerStocks.push({ product_id: product.id, owner_id: ownerId, quantity: quantityDelta });
    }
    return {
      ...product,
      current_stock: Math.max(0, ownerStocks.reduce((sum, stock) => sum + Number(stock.quantity || 0), 0)),
      owner_stocks: ownerStocks,
      updated_at: new Date().toISOString()
    };
  };

  const handleAddOrder = async (order: Order) => {
    try {
      const items = order.items || [];
      const orderInsert = {
        order_number: order.order_number,
        customer_name: order.customer_name,
        customer_email: order.customer_email,
        customer_phone: order.customer_phone,
        order_type: order.order_type,
        pickup_by_staff: order.pickup_by_staff,
        pickup_person_name: order.pickup_person_name,
        pickup_person_phone: order.pickup_person_phone,
        status: order.status,
        total_amount: order.total_amount,
        notes: order.notes,
        created_by: order.created_by
      };

      const newOrder = await createOrder(orderInsert, items);
      const savedOrder = { ...newOrder, items } as Order;
      setOrders(prev => [...prev, savedOrder]);
      const soldByProduct = new Map<string, number>();
      const soldByOwner = new Map<string, Array<{ ownerId: string; quantity: number }>>();
      items.forEach((item) => {
        soldByProduct.set(item.product_id, (soldByProduct.get(item.product_id) || 0) + item.quantity);
        const ownerId = item.owner_id || inventoryOwners.find((owner) => owner.is_default)?.id || '';
        if (!soldByOwner.has(item.product_id)) soldByOwner.set(item.product_id, []);
        soldByOwner.get(item.product_id)!.push({ ownerId, quantity: -item.quantity });
      });
      setProducts(prev => prev.map((product) => {
        const sold = soldByProduct.get(product.id) || 0;
        if (sold <= 0) return product;
        const ownerDeltas = soldByOwner.get(product.id) || [];
        return ownerDeltas.reduce((current, delta) => applyOwnerStockChange(current, delta.ownerId, delta.quantity), product);
      }));
      await refreshActivityLog();
      return savedOrder;
    } catch (err) {
      const message = getErrorMessage(err) || 'Failed to create order';
      setError(message);
      throw new Error(message);
    }
  };

  const handleUpdateOrder = async (order: Order, options?: { syncItems?: boolean }) => {
    try {
      console.log('Updating order:', order.id, 'with new status:', order.status);
      const orderUpdate = {
        status: order.status,
        customer_name: order.customer_name,
        customer_email: order.customer_email,
        customer_phone: order.customer_phone,
        order_type: order.order_type,
        total_amount: order.total_amount,
        notes: order.notes,
        updated_at: new Date().toISOString()
      };

      if (options?.syncItems) {
        const result = await updateOrderWithItems(order.id, orderUpdate, order.items || []);
        setOrders(prev => prev.map((current) => current.id === order.id
          ? { ...order, ...result.order, items: order.items || [] }
          : current));
        if (result.products.length > 0) {
          const updatedById = new Map(result.products.map((product) => [product.id, product]));
          setProducts(prev => prev.map((product) => {
            const updated = updatedById.get(product.id);
            return updated ? { ...product, ...updated } as Product : product;
          }));
        }
        await refreshActivityLog();
      } else {
        const updatedOrder = await updateOrder(order.id, orderUpdate);
        setOrders(prev => prev.map(o => o.id === order.id ? { ...order, ...updatedOrder } : o));
        await refreshActivityLog();
      }
      
      console.log('Order updated successfully');
    } catch (err) {
      console.error('Error updating order:', err);
      const message = getErrorMessage(err) || 'Failed to update order';
      setError(message);
      throw new Error(message);
    }
  };

  const handleDeleteOrder = (id: string) => {
    setOrders(prev => prev.filter(o => o.id !== id));
  };

  const handleAddPurchaseOrder = async (po: Omit<PurchaseOrder, 'id' | 'created_at' | 'updated_at'>, items: PurchaseOrderItem[]) => {
    try {
      const newPO = await createPurchaseOrder(po, items);
      const supplier = suppliers.find((candidate) => candidate.id === po.supplier_id);
      setPurchaseOrders(prev => [{
        ...newPO,
        supplier_name: supplier?.name || 'Unknown Supplier',
        items
      }, ...prev]);
      await refreshActivityLog();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create purchase order');
      throw err;
    }
  };

  const handleUpdatePurchaseOrder = (po: PurchaseOrder) => {
    setPurchaseOrders(prev => prev.map(p => p.id === po.id ? po : p));
  };

  const handleReceivePurchaseOrder = async (po: PurchaseOrder) => {
    const result = await receivePurchaseOrderStock(po.id);
    setPurchaseOrders(prev => prev.map((current) => current.id === po.id ? result.purchaseOrder : current));
    const updated = new Map(result.products.map((product) => [product.id, product]));
    setProducts(prev => prev.map((product) => updated.get(product.id) || product));
    await refreshActivityLog();
  };

  const handleDeletePurchaseOrder = (id: string) => {
    setPurchaseOrders(prev => prev.filter(p => p.id !== id));
  };

  const refreshIncomingByProduct = async () => {
    try {
      const data = await getIncomingByProductSummary();
      setIncomingByProduct(data);
    } catch {
      // Ignore refresh errors here to avoid blocking UI workflows.
    }
  };

  const refreshActivityLog = async () => {
    try {
      const data = await getActivityLog();
      setActivities(data);
    } catch {
      // Keep the app usable even if activity logging is temporarily unavailable.
    }
  };

  const mainTabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Home, permission: 'view_dashboard' },
    { id: 'products', label: 'Products', icon: Package, permission: 'view_products' },
    { id: 'orders', label: 'Sales', icon: ShoppingCart, permission: 'view_orders' },
    { id: 'daily-closing', label: 'Daily closing', icon: WalletCards, permission: 'view_reports' },
    { id: 'purchase-orders', label: 'Purchasing', icon: FileText, permission: 'view_purchase_orders' },
  ];

  const secondaryTabs = [
    { id: 'reorder-engine', label: 'Reorder engine', icon: Zap, permission: 'view_dashboard' },
    { id: 'upcoming-invoices', label: 'Upcoming invoices', icon: FileText, permission: 'view_dashboard' },
    { id: 'movements', label: 'Stock Movements', icon: ArrowUpDown, permission: 'view_movements' },
    { id: 'reports', label: 'Reports', icon: BarChart3, permission: 'view_reports' },
    { id: 'monthly-reports', label: 'Monthly Reports', icon: CalendarDays, permission: 'view_reports' },
    { id: 'product-reports', label: 'Product Reports', icon: FileText, permission: 'view_reports' },
    { id: 'activity', label: 'Activity Log', icon: Activity, permission: 'view_activity_log' },
    { id: 'add-product', label: 'Add Product', icon: Plus, permission: 'add_product' },
  ];

  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: Event) => {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, []);

  useEffect(() => {
    if (activeTab !== 'products' || !shouldRestoreProductListScroll || !productListScrollState) return;
    if (typeof window === 'undefined') return;

    const restoreScroll = () => {
      const maxAttempts = 6;
      const tolerance = 2;
      const listElement = getProductListContainer();
      let targetScrollY = window.scrollY;
      let usedAnchor = false;

      if (
        listElement &&
        productListScrollState.anchorId &&
        typeof productListScrollState.anchorOffset === 'number'
      ) {
        const rowElement = listElement.querySelector(
          `[data-row-id="${productListScrollState.anchorId}"]`
        );
        if (rowElement) {
          const rowDocTop = rowElement.getBoundingClientRect().top + window.scrollY;
          targetScrollY = Math.max(0, rowDocTop - productListScrollState.anchorOffset);
          usedAnchor = true;
        }
      }

      if (!usedAnchor) {
        const listTop = getProductListTop();
        targetScrollY = Math.max(0, listTop + productListScrollState.scrollOffset);
      }

      window.scrollTo(0, targetScrollY);

      const currentAnchorDelta = usedAnchor
        ? (listElement?.querySelector(`[data-row-id="${productListScrollState.anchorId}"]`) as HTMLElement | null)?.getBoundingClientRect().top - productListScrollState.anchorOffset
        : 0;

      const isSettled =
        Math.abs(window.scrollY - targetScrollY) <= tolerance &&
        (!usedAnchor || Math.abs(currentAnchorDelta || 0) <= tolerance);

      if (!isSettled && restoreAttemptsRef.current < maxAttempts) {
        restoreAttemptsRef.current += 1;
        requestAnimationFrame(restoreScroll);
        return;
      }

      restoreAttemptsRef.current = 0;
      setShouldRestoreProductListScroll(false);
    };

    requestAnimationFrame(restoreScroll);
  }, [activeTab, productListScrollState, shouldRestoreProductListScroll]);

  const visibleMainTabs = mainTabs.filter(tab => hasPermission(tab.permission));
  const visibleSecondaryTabs = secondaryTabs.filter(tab => hasPermission(tab.permission));

  return (
    <div className="min-h-screen bg-gray-50">
      <nav ref={navRef} className="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-screen-2xl items-center gap-3 px-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className="flex shrink-0 items-center gap-2 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-md bg-gray-950 text-white">
              <BarChart3 className="h-5 w-5" />
            </span>
            <span className="hidden text-base font-semibold text-gray-950 sm:block">S&amp;T Stock</span>
          </button>

          <div className="hidden min-w-0 flex-1 items-center justify-center gap-1 min-[1180px]:flex">
            {visibleMainTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as ActiveTab)}
                  className={`flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-gray-950 text-white'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-950'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}

            {visibleSecondaryTabs.length > 0 && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                  className={`flex h-10 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors ${
                    isMoreMenuOpen || visibleSecondaryTabs.some((tab) => tab.id === activeTab)
                      ? 'bg-gray-100 text-gray-950'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-950'
                  }`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                  <span>More</span>
                </button>
                {isMoreMenuOpen && (
                  <div className="absolute right-0 mt-2 w-60 rounded-md border border-gray-200 bg-white p-1.5 shadow-xl">
                    {visibleSecondaryTabs.map((tab) => {
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => {
                            setActiveTab(tab.id as ActiveTab);
                            setIsMoreMenuOpen(false);
                          }}
                          className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm font-medium ${
                            activeTab === tab.id
                              ? 'bg-emerald-50 text-emerald-800'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{tab.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveTab('orders');
                setNewOrderSignal((value) => value + 1);
              }}
              className="hidden h-10 items-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-700 min-[1180px]:flex"
            >
              <Plus className="h-4 w-4" />
              <span>New sale</span>
            </button>
            <NotificationCenter products={products} />
            <div className="hidden items-center gap-3 border-l border-gray-200 pl-3 min-[1180px]:flex">
              <div className="max-w-36 text-right leading-tight">
                <p className="truncate text-sm font-medium text-gray-900">{user?.firstName} {user?.lastName}</p>
                <p className="text-xs capitalize text-gray-500">{user?.role}</p>
              </div>
              <button
                type="button"
                onClick={logout}
                className="flex h-9 w-9 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                title="Log out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
              className="flex h-10 w-10 items-center justify-center rounded-md text-gray-600 hover:bg-gray-100 min-[1180px]:hidden"
              title="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>

        {isMoreMenuOpen && (
          <div className="fixed inset-x-0 top-16 z-50 border-b border-gray-200 bg-white p-3 shadow-xl min-[1180px]:hidden">
            <div className="mx-auto grid max-h-[calc(100vh-5rem)] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
              {[...visibleMainTabs, ...visibleSecondaryTabs].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(tab.id as ActiveTab);
                      setIsMoreMenuOpen(false);
                    }}
                    className={`flex min-h-12 items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-medium ${
                      activeTab === tab.id ? 'bg-gray-950 text-white' : 'bg-gray-50 text-gray-700'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
              <button
                type="button"
                onClick={logout}
                className="flex min-h-12 items-center gap-2 rounded-md bg-red-50 px-3 py-2 text-left text-sm font-medium text-red-700"
              >
                <LogOut className="h-4 w-4" />
                <span>Log out</span>
              </button>
            </div>
          </div>
        )}
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

      <main className="app-shell-main mx-auto max-w-screen-2xl px-4 py-5 pb-28 sm:px-6 sm:py-7 lg:px-8 min-[1180px]:pb-8">
        {activeTab === 'dashboard' && hasPermission('view_dashboard') && (
          <Dashboard
            products={products}
            movements={movements}
            orders={orders}
            loading={loading}
            onCreatePurchaseOrder={(productId) => {
              const product = products.find(p => p.id === productId);
              if (product) {
                setActiveTab('purchase-orders');
              }
            }}
            onAddProduct={handleAddProduct}
            onCreateOrder={() => {
              setActiveTab('orders');
              setNewOrderSignal((value) => value + 1);
            }}
            onStockCount={() => {
              // For now, navigate to movements where stock count would typically be done
              setActiveTab('movements');
            }}
            onNavigate={(tab) => setActiveTab(tab as ActiveTab)}
            incomingByProduct={incomingByProduct}
            onOpenReorderEngine={() => setActiveTab('reorder-engine')}
          />
        )}

        {activeTab === 'reorder-engine' && hasPermission('view_dashboard') && (
          <ReorderEnginePage
            products={products}
            movements={movements}
            orders={orders}
            incomingByProduct={incomingByProduct}
            loading={loading}
            onBack={() => setActiveTab('dashboard')}
            onCreatePurchaseOrder={(productId) => {
              if (products.find((p) => p.id === productId)) {
                setActiveTab('purchase-orders');
              }
            }}
          />
        )}

        {activeTab === 'upcoming-invoices' && hasPermission('view_dashboard') && (
          <UpcomingInvoicesPage
            products={products}
            onSaved={refreshIncomingByProduct}
            onBack={() => setActiveTab('dashboard')}
          />
        )}

        {activeTab === 'products' && hasPermission('view_products') && (
          <ProductList
            products={products}
            inventoryOwners={inventoryOwners}
            onAddProduct={handleAddProduct}
            onEditProduct={handleEditProduct}
            onDeleteProduct={handleDeleteProduct}
            onViewProduct={handleViewProduct}
            onUpdateProduct={handleUpdateProduct}
          />
        )}

        {activeTab === 'add-product' && hasPermission('add_product') && (
          <AddProductPage
            onSave={handleSaveProduct}
            onBack={() => setActiveTab('products')}
            brands={brands}
            suppliers={suppliers}
            inventoryOwners={inventoryOwners}
          />
        )}

        {activeTab === 'edit-product' && hasPermission('edit_product') && (
          <EditProductPage
            product={editingProduct}
            onSave={handleSaveProduct}
            brands={brands}
            suppliers={suppliers}
            inventoryOwners={inventoryOwners}
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
            inventoryOwners={inventoryOwners}
            openNewOrderSignal={newOrderSignal}
            onNewOrderOpened={() => setNewOrderSignal(0)}
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
            onReceivePurchaseOrder={handleReceivePurchaseOrder}
            onDeletePurchaseOrder={handleDeletePurchaseOrder}
            inventoryOwners={inventoryOwners}
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

        {activeTab === 'monthly-reports' && hasPermission('view_reports') && (
          <MonthlyReportsPage
            orders={orders}
            products={products}
          />
        )}

        {activeTab === 'daily-closing' && hasPermission('view_reports') && (
          <DailyClosingPage orders={orders} />
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

      <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur min-[1180px]:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5 items-end gap-1">
          {visibleMainTabs.filter((tab) => ['dashboard', 'products'].includes(tab.id)).map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as ActiveTab)}
                className={`flex h-[3.25rem] flex-col items-center justify-center gap-1 rounded-md py-1 text-[11px] font-medium ${
                  activeTab === tab.id ? 'text-emerald-700' : 'text-gray-500'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => {
              setActiveTab('orders');
              setNewOrderSignal((value) => value + 1);
            }}
            className="flex h-14 flex-col items-center justify-center gap-0.5 rounded-md bg-emerald-600 text-[11px] font-semibold text-white shadow-sm"
          >
            <Plus className="h-5 w-5" />
            <span>New sale</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`flex h-[3.25rem] flex-col items-center justify-center gap-1 rounded-md py-1 text-[11px] font-medium ${
              activeTab === 'orders' ? 'text-emerald-700' : 'text-gray-500'
            }`}
          >
            <ShoppingCart className="h-5 w-5" />
            <span>Sales</span>
          </button>
          <button
            type="button"
            onClick={() => setIsMoreMenuOpen(true)}
            className="flex h-[3.25rem] flex-col items-center justify-center gap-1 rounded-md py-1 text-[11px] font-medium text-gray-500"
          >
            <Menu className="h-5 w-5" />
            <span>More</span>
          </button>
        </div>
      </nav>

      <ProductDetail
        product={viewingProduct}
        isOpen={isProductDetailOpen}
        onEdit={handleEditProduct}
        inventoryOwners={inventoryOwners}
        movements={movements}
        activities={activities}
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
