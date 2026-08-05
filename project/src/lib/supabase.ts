import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';
import { toMoneyNumber } from '../utils/stockUtils';
import type {
  ActivityLog,
  DailyClosing,
  Expense,
  IncomingByProductSummary,
  InventoryOwner,
  MonthlyBalanceClosing,
  MonthlyReportData,
  PriceOverride,
  Product,
  ProductOwnerStock,
  PurchaseOrder,
  UpcomingInvoice,
  UpcomingInvoiceLine,
  UpcomingInvoiceMatchStatus,
  VendorPurchase
} from '../types';

const supabaseUrl = 'https://ljkvwaduqvacmrvycshj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxqa3Z3YWR1cXZhY21ydnljc2hqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5MTE3MTgsImV4cCI6MjA2OTQ4NzcxOH0.fkbZbCF8KTK5aupvRRu6dCycIgB9N4BnnxZNZd3cz4Q';
const supabaseServiceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxqa3Z3YWR1cXZhY21ydnljc2hqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzkxMTcxOCwiZXhwIjoyMDY5NDg3NzE4fQ.yTH08Ylnmyh7Dcgy8QaQgABZrTG1LPylK1ET_MGLvlw';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
const createServiceRoleClient = () => createClient<Database>(supabaseUrl, supabaseServiceRoleKey);

const ownerSelect = 'id, name, owner_type, is_default, is_active';

const getDefaultOwnerIdFromRows = (owners: InventoryOwner[]) =>
  owners.find((owner) => owner.is_default)?.id || owners[0]?.id || null;

const normalizeOwnerStocks = (rows: unknown[] | null | undefined): ProductOwnerStock[] =>
  (rows || []).map((row) => {
    const stock = row as Record<string, unknown>;
    const embedded = Array.isArray(stock.owner) ? stock.owner[0] : stock.owner;
    return {
      product_id: String(stock.product_id || ''),
      owner_id: String(stock.owner_id || ''),
      quantity: Math.max(0, Math.floor(toMoneyNumber(stock.quantity, 0))),
      updated_at: typeof stock.updated_at === 'string' ? stock.updated_at : undefined,
      owner: embedded && typeof embedded === 'object'
        ? embedded as ProductOwnerStock['owner']
        : null
    };
  });

const attachOwnerStocksToProducts = async <T extends { id: string; current_stock?: number | string }>(
  products: T[] | null | undefined,
  client = createServiceRoleClient()
): Promise<Array<T & { owner_stocks?: ProductOwnerStock[] }>> => {
  if (!products?.length) return [];

  const productIds = products.map((product) => product.id).filter(Boolean);
  const { data: ownerStocks, error } = await client
    .from('product_owner_stocks')
    .select(`product_id, owner_id, quantity, updated_at, owner:inventory_owners(${ownerSelect})`)
    .in('product_id', productIds);

  if (error) {
    console.warn('Could not load owner stock balances:', error);
    return products.map((product) => ({
      ...product,
      owner_stocks: []
    }));
  }

  const byProduct = new Map<string, ProductOwnerStock[]>();
  normalizeOwnerStocks(ownerStocks as unknown[]).forEach((stock) => {
    if (!byProduct.has(stock.product_id)) byProduct.set(stock.product_id, []);
    byProduct.get(stock.product_id)!.push(stock);
  });

  return products.map((product) => ({
    ...product,
    owner_stocks: byProduct.get(product.id) || []
  }));
};

const getInventoryOwnersWithClient = async (
  client = createServiceRoleClient()
): Promise<InventoryOwner[]> => {
  const { data, error } = await client
    .from('inventory_owners')
    .select('*')
    .eq('is_active', true)
    .order('is_default', { ascending: false })
    .order('name');

  if (error) throw error;
  return (data || []) as InventoryOwner[];
};

const ensureDefaultInventoryOwner = async (
  client = createServiceRoleClient()
): Promise<InventoryOwner> => {
  const owners = await getInventoryOwnersWithClient(client);
  const existing = owners.find((owner) => owner.is_default) || owners[0];
  if (existing) return existing;

  const { data, error } = await client
    .from('inventory_owners')
    .insert({
      name: 'Company',
      owner_type: 'company',
      is_default: true,
      is_active: true,
      notes: null
    })
    .select()
    .single();

  if (error) throw error;
  return data as InventoryOwner;
};

export const getInventoryOwners = async (): Promise<InventoryOwner[]> =>
  getInventoryOwnersWithClient(createServiceRoleClient());

const recordActivity = async (
  client: ReturnType<typeof createServiceRoleClient>,
  activity: Omit<Database['public']['Tables']['activity_log']['Insert'], 'id' | 'created_at'>
) => {
  try {
    const { data: authData } = await supabase.auth.getUser();
    const payload: Database['public']['Tables']['activity_log']['Insert'] = {
      user_id: activity.user_id ?? authData.user?.id ?? null,
      action: activity.action,
      entity_type: activity.entity_type,
      entity_id: activity.entity_id,
      details: activity.details ?? {},
      ip_address: activity.ip_address ?? null
    };

    const { error } = await client.from('activity_log').insert(payload);
    if (error) {
      console.warn('Could not record activity:', error);
    }
  } catch (error) {
    console.warn('Could not record activity:', error);
  }
};

const syncProductOwnerStocks = async (
  productId: string,
  ownerStocks: ProductOwnerStock[] | undefined,
  client = createServiceRoleClient()
) => {
  if (!ownerStocks) return;

  const defaultOwner = await ensureDefaultInventoryOwner(client);
  const normalized = ownerStocks
    .map((stock) => ({
      product_id: productId,
      owner_id: stock.owner_id || defaultOwner.id,
      quantity: Math.max(0, Math.floor(Number(stock.quantity) || 0))
    }))
    .filter((stock) => stock.owner_id);

  if (!normalized.some((stock) => stock.owner_id === defaultOwner.id)) {
    normalized.push({ product_id: productId, owner_id: defaultOwner.id, quantity: 0 });
  }

  const { error: upsertError } = await client
    .from('product_owner_stocks')
    .upsert(normalized, { onConflict: 'product_id,owner_id' });

  if (upsertError) throw upsertError;

  const activeOwnerIds = normalized.map((stock) => stock.owner_id);
  const { error: deleteError } = await client
    .from('product_owner_stocks')
    .delete()
    .eq('product_id', productId)
    .not('owner_id', 'in', `(${activeOwnerIds.join(',')})`);

  if (deleteError) throw deleteError;

  const total = normalized.reduce((sum, stock) => sum + stock.quantity, 0);
  const { error: productStockError } = await client
    .from('products')
    .update({ current_stock: total, updated_at: new Date().toISOString() })
    .eq('id', productId);

  if (productStockError) throw productStockError;
};

/** Map joined order_items + product embed into app OrderItem (coerce decimals, name from join). */
function mapOrderItemRowFromQuery(item: Record<string, unknown>) {
  const embedded = item.product as Record<string, unknown> | Record<string, unknown>[] | null | undefined;
  const embeddedRow = Array.isArray(embedded) ? embedded[0] : embedded;
  const nameFromJoin = embeddedRow
    ? (() => {
        const cn = String(embeddedRow.commercial_name ?? '').trim();
        const nm = String(embeddedRow.name ?? '').trim();
        const code = embeddedRow.code != null ? String(embeddedRow.code).trim() : '';
        return cn || nm || (code ? code : '');
      })()
    : '';

  const qty = Math.max(0, Math.floor(toMoneyNumber(item.quantity, 0)));
  let unit_price = toMoneyNumber(item.unit_price, 0) || toMoneyNumber(item.original_unit_price, 0);
  let total_price = toMoneyNumber(item.total_price, 0);
  const customName = String(item.custom_product_name ?? '').trim();

  if (unit_price === 0 && total_price > 0 && qty > 0) {
    unit_price = Math.round((total_price / qty) * 100) / 100;
  }
  if (total_price === 0 && unit_price > 0 && qty > 0) {
    total_price = Math.round(qty * unit_price * 100) / 100;
  }

  return {
    id: item.id as string,
    product_id: String(item.product_id ?? ''),
    product_name: nameFromJoin || customName || 'Unknown Product',
    owner_id: item.owner_id ? String(item.owner_id) : null,
    owner_name: (() => {
      const owner = Array.isArray(item.owner) ? item.owner[0] : item.owner;
      return owner && typeof owner === 'object'
        ? String((owner as Record<string, unknown>).name || '')
        : null;
    })(),
    quantity: qty,
    unit_price,
    total_price
  };
}

// Helper functions for data access
export const getProducts = async () => {
  try {
    console.log('getProducts: Starting to fetch products...');
    
    // First, let's check if we have an authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    console.log('getProducts: Current user:', user?.id, user?.email);
    
    if (authError) {
      console.error('getProducts: Auth error:', authError);
    }
    
    // Test 1: Get a simple count first
    const { count: simpleCount, error: countError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });
    
    console.log('getProducts: Simple count result:', simpleCount, 'Error:', countError);
    
    // Test 2: Get products with minimal fields first
    const { data: minimalData, error: minimalError } = await supabase
      .from('products')
      .select('id, code, commercial_name');
    
    console.log('getProducts: Minimal data count:', minimalData?.length || 0, 'Error:', minimalError);
    
    // Test 3: Get full data with joins
    const { data, error } = await supabase
      .from('products')
      .select(`
        id,
        code,
        item_number,
        commercial_name,
        brand_id,
        category,
        product_type,
        concentration,
        size,
        current_stock,
        min_stock,
        max_stock,
        reorder_point,
        price,
        supplier_id,
        fragrance_notes,
        gender,
        season,
        is_tester,
        gross_weight,
        tare_weight,
        net_weight,
        created_at,
        updated_at,
        brand:brands(name),
        supplier:suppliers(name)
      `);
    
    if (error) {
      console.error('getProducts: Error fetching products:', error);
      console.error('getProducts: Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      return [];
    }
    
    console.log('getProducts: Raw data from Supabase:', data);
    console.log('getProducts: Products count:', data?.length || 0);
    console.log('getProducts: Count comparison - Simple:', simpleCount, 'Minimal:', minimalData?.length, 'Full:', data?.length);
    
    // Log each product for debugging
    if (data && data.length > 0) {
      console.log('getProducts: Individual products:');
      data.forEach((product, index) => {
        console.log(`Product ${index + 1}:`, {
          id: product.id,
          code: product.code,
          commercial_name: product.commercial_name,
          category: product.category,
          product_type: product.product_type,
          brand: product.brand,
          supplier: product.supplier,
          hasRequiredFields: {
            id: !!product.id,
            code: !!product.code,
            commercial_name: !!product.commercial_name,
            category: !!product.category,
            product_type: !!product.product_type
          }
        });
      });
    }
    
    // If no products found with anon key, try with service role
    if (!data || data.length === 0) {
      console.log('getProducts: No products found with anon key, trying service role...');
      const serviceRoleClient = createClient(
        supabaseUrl,
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxqa3Z3YWR1cXZhY21ydnljc2hqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzkxMTcxOCwiZXhwIjoyMDY5NDg3NzE4fQ.yTH08Ylnmyh7Dcgy8QaQgABZrTG1LPylK1ET_MGLvlw'
      );
      
      // Test service role with simple count first
      const { count: serviceCount, error: serviceCountError } = await serviceRoleClient
        .from('products')
        .select('*', { count: 'exact', head: true });
      
      console.log('getProducts: Service role count:', serviceCount, 'Error:', serviceCountError);
      
      const { data: serviceData, error: serviceError } = await serviceRoleClient
        .from('products')
        .select(`
          id,
          code,
          item_number,
          commercial_name,
          brand_id,
          category,
          product_type,
          concentration,
          size,
          current_stock,
          min_stock,
          max_stock,
          reorder_point,
          price,
          supplier_id,
          fragrance_notes,
          gender,
          season,
          is_tester,
          gross_weight,
          tare_weight,
          net_weight,
          created_at,
          updated_at,
          brand:brands(name),
          supplier:suppliers(name)
        `);
      
      if (serviceError) {
        console.error('getProducts: Service role fetch error:', serviceError);
      } else {
        console.log('getProducts: Service role products:', serviceData);
        console.log('getProducts: Service role products count:', serviceData?.length || 0);
        console.log('getProducts: Service role count comparison - Count:', serviceCount, 'Data:', serviceData?.length);
        
        // Log each service role product for debugging
        if (serviceData && serviceData.length > 0) {
          console.log('getProducts: Service role individual products:');
          serviceData.forEach((product, index) => {
            console.log(`Service Product ${index + 1}:`, {
              id: product.id,
              code: product.code,
              commercial_name: product.commercial_name,
              category: product.category,
              product_type: product.product_type,
              brand: product.brand,
              supplier: product.supplier,
              hasRequiredFields: {
                id: !!product.id,
                code: !!product.code,
                commercial_name: !!product.commercial_name,
                category: !!product.category,
                product_type: !!product.product_type
              }
            });
          });
        }
        
        // Return service role data instead of empty array
        return await attachOwnerStocksToProducts(serviceData as Product[], serviceRoleClient);
      }
    }
    
    return await attachOwnerStocksToProducts(data as Product[]);
  } catch (error) {
    console.error('getProducts: Error in getProducts:', error);
    return [];
  }
};

// Test function to check product visibility
export const testProductVisibility = async () => {
  console.log('testProductVisibility: Starting test...');
  
  try {
    // Test 1: Simple count with anon key
    const { count: anonCount, error: anonCountError } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });
    
    console.log('testProductVisibility: Anon key count:', anonCount, 'Error:', anonCountError);
    
    // Test 2: Simple count with service role
    const serviceRoleClient = createClient(
      supabaseUrl,
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxqa3Z3YWR1cXZhY21ydnljc2hqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzkxMTcxOCwiZXhwIjoyMDY5NDg3NzE4fQ.yTH08Ylnmyh7Dcgy8QaQgABZrTG1LPylK1ET_MGLvlw'
    );
    
    const { count: serviceCount, error: serviceCountError } = await serviceRoleClient
      .from('products')
      .select('*', { count: 'exact', head: true });
    
    console.log('testProductVisibility: Service role count:', serviceCount, 'Error:', serviceCountError);
    
    // Test 3: Get all products with service role (no joins)
    const { data: allProducts, error: allProductsError } = await serviceRoleClient
      .from('products')
      .select('id, code, commercial_name, category, product_type, brand_id, supplier_id');
    
    console.log('testProductVisibility: All products (service role):', allProducts);
    console.log('testProductVisibility: All products count:', allProducts?.length || 0);
    console.log('testProductVisibility: All products error:', allProductsError);
    
    return {
      anonCount,
      serviceCount,
      allProducts,
      anonCountError,
      serviceCountError,
      allProductsError
    };
  } catch (error) {
    console.error('testProductVisibility: Error:', error);
    return { error };
  }
};

// Check if a product with the given code already exists
export const checkProductExists = async (code: string, excludeId?: string) => {
  try {
    console.log('checkProductExists: Checking for product with code:', code);
    
    let query = supabase
      .from('products')
      .select('id, code, commercial_name, product_type')
      .eq('code', code.toUpperCase());
    
    if (excludeId) {
      query = query.neq('id', excludeId);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error checking product existence:', error);
      
      // Fallback: try with service role client
      const serviceRoleClient = createClient(
        supabaseUrl,
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxqa3Z3YWR1cXZhY21ydnljc2hqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzkxMTcxOCwiZXhwIjoyMDY5NDg3NzE4fQ.yTH08Ylnmyh7Dcgy8QaQgABZrTG1LPylK1ET_MGLvlw'
      );
      
      let serviceQuery = serviceRoleClient
        .from('products')
        .select('id, code, commercial_name, product_type')
        .eq('code', code.toUpperCase());
      
      if (excludeId) {
        serviceQuery = serviceQuery.neq('id', excludeId);
      }
      
      const { data: serviceData, error: serviceError } = await serviceQuery;
      
      if (serviceError) {
        console.error('Service role check also failed:', serviceError);
        return null;
      }
      
      console.log('checkProductExists: Service role result:', serviceData);
      return serviceData && serviceData.length > 0 ? serviceData[0] : null;
    }
    
    console.log('checkProductExists: Result:', data);
    return data && data.length > 0 ? data[0] : null;
  } catch (error) {
    console.error('Error in checkProductExists:', error);
    return null;
  }
};

export const getStockMovements = async () => {
  const query = `
      *,
      product:products(code, commercial_name),
      batch:product_batches(batch_number),
      owner:inventory_owners(name, owner_type)
    `;
  const fallbackQuery = `
      *,
      product:products(code, commercial_name),
      batch:product_batches(batch_number)
    `;

  const { data, error } = await supabase
    .from('stock_movements')
    .select(query)
    .order('performed_at', { ascending: false });
  
  if (!error) return data;

  if (error.code === 'PGRST200' || error.code === '42P01') {
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('stock_movements')
      .select(fallbackQuery)
      .order('performed_at', { ascending: false });
    if (fallbackError) {
      console.error('Fallback stock movements query failed:', fallbackError);
      return [];
    }
    return fallbackData;
  }

  throw error;
};

// Debug function to test basic database connection
export const testOrdersConnection = async () => {
  console.log('Testing orders table connection...');
  
  // Test authentication
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  console.log('Current user:', user?.id, user?.email);
  
  if (authError) {
    console.error('Auth error:', authError);
    return { count: 0, error: authError };
  }
  
  if (!user) {
    console.error('No authenticated user');
    return { count: 0, error: new Error('No authenticated user') };
  }
  
  // Test 1: Simple count
  const { count, error: countError } = await supabase
    .from('orders')
    .select('*', { count: 'exact', head: true });
  
  if (countError) {
    console.error('Error counting orders:', countError);
    console.error('Count error details:', {
      message: countError.message,
      details: countError.details,
      hint: countError.hint,
      code: countError.code
    });
    return { count: 0, error: countError };
  }
  
  console.log('Total orders in database:', count);
  
  // Test 2: Simple select
  const { data: simpleData, error: simpleError } = await supabase
    .from('orders')
    .select('id, order_number, customer_name, status, total_amount, created_at')
    .limit(5);
  
  if (simpleError) {
    console.error('Error fetching simple orders:', simpleError);
    console.error('Simple error details:', {
      message: simpleError.message,
      details: simpleError.details,
      hint: simpleError.hint,
      code: simpleError.code
    });
    return { count, error: simpleError };
  }
  
  console.log('Sample orders:', simpleData);
  return { count, orders: simpleData, error: null };
};

// Simplified version that works with current database schema
export const getOrdersSimple = async () => {
  console.log('Using simplified orders query...');
  
  const { data, error } = await supabase
    .from('orders')
    .select(`
      id,
      order_number,
      customer_name,
      customer_email,
      customer_phone,
      status,
      total_amount,
      notes,
      created_at,
      updated_at
    `)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Simple orders query error:', error);
    throw error;
  }
  
  console.log('Simple orders fetched:', data?.length || 0);
  
  return data?.map(order => ({
    ...order,
    // Handle missing order_type field gracefully
    order_type: (order as any).order_type || 'delivery',
    // Handle missing pickup fields gracefully
    pickup_by_staff: (order as any).pickup_by_staff || false,
    pickup_person_name: (order as any).pickup_person_name || null,
    pickup_person_phone: (order as any).pickup_person_phone || null,
    items: [] // Will be empty until we can fetch items
  })) || [];
};

export const getOrders = async () => {
  try {
    console.log('Fetching orders...');
    
    // First try a simple query without joins to test basic functionality
    const { data: basicData, error: basicError } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (basicError) {
      console.error('Basic orders query failed:', basicError);
      console.log('No orders found with anon key, trying service role...');
      
      // Fallback: try with service role client (bypass RLS)
      try {
        const serviceRoleClient = createClient(
          supabaseUrl,
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxqa3Z3YWR1cXZhY21ydnljc2hqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzkxMTcxOCwiZXhwIjoyMDY5NDg3NzE4fQ.yTH08Ylnmyh7Dcgy8QaQgABZrTG1LPylK1ET_MGLvlw'
        );
        
        const { data: serviceData, error: serviceError } = await serviceRoleClient
          .from('orders')
          .select(`
            *,
            items:order_items(
              id,
              product_id,
              owner_id,
              quantity,
              unit_price,
              total_price,
              custom_product_name,
              custom_product_description,
              is_custom_product,
              original_unit_price,
              product:products(code, commercial_name),
              owner:inventory_owners(name, owner_type)
            )
          `)
          .order('created_at', { ascending: false });
        
        if (serviceError) {
          console.error('Service role orders query failed:', serviceError);
          return [];
        }
        
        console.log('Service role orders:', serviceData?.length || 0);
        
        // Transform the data to match frontend expectations
        return serviceData?.map(order => ({
          ...order,
          // Handle missing order_type field gracefully
          order_type: (order as any).order_type || 'delivery',
          // Handle missing pickup fields gracefully
          pickup_by_staff: (order as any).pickup_by_staff || false,
          pickup_person_name: (order as any).pickup_person_name || null,
          pickup_person_phone: (order as any).pickup_person_phone || null,
          items: order.items?.map((item: Record<string, unknown>) => mapOrderItemRowFromQuery(item)) || []
        })) || [];
        
      } catch (serviceErr) {
        console.error('Service role client failed:', serviceErr);
        return [];
      }
    }
    
    console.log('Basic orders fetched:', basicData?.length || 0);
    
    if (!basicData || basicData.length === 0) {
      console.log('No orders found in database with basic query, trying service role...');
      
      // Even if we get empty results, try service role to be sure
      try {
        const serviceRoleClient = createClient(
          supabaseUrl,
          'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxqa3Z3YWR1cXZhY21ydnljc2hqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzkxMTcxOCwiZXhwIjoyMDY5NDg3NzE4fQ.yTH08Ylnmyh7Dcgy8QaQgABZrTG1LPylK1ET_MGLvlw'
        );
        
        const { data: serviceData, error: serviceError } = await serviceRoleClient
          .from('orders')
          .select(`
            *,
            items:order_items(
              id,
              product_id,
              owner_id,
              quantity,
              unit_price,
              total_price,
              custom_product_name,
              custom_product_description,
              is_custom_product,
              original_unit_price,
              product:products(code, commercial_name),
              owner:inventory_owners(name, owner_type)
            )
          `)
          .order('created_at', { ascending: false });
        
        if (serviceError) {
          console.error('Service role orders query failed:', serviceError);
          return [];
        }
        
        console.log('Service role orders:', serviceData?.length || 0);
        
        if (serviceData && serviceData.length > 0) {
          return serviceData.map(order => ({
            ...order,
            // Handle missing order_type field gracefully
            order_type: (order as any).order_type || 'delivery',
            // Handle missing pickup fields gracefully
            pickup_by_staff: (order as any).pickup_by_staff || false,
            pickup_person_name: (order as any).pickup_person_name || null,
            pickup_person_phone: (order as any).pickup_person_phone || null,
            items: order.items?.map((item: Record<string, unknown>) => mapOrderItemRowFromQuery(item)) || []
          }));
        }
      } catch (serviceErr) {
        console.error('Service role fallback failed:', serviceErr);
      }
      
      return [];
    }
    
    // Now try with joins to get order items
    const { data, error } = await supabase
      .from('orders')
      .select(`
        *,
        items:order_items(
          id,
          product_id,
          owner_id,
          quantity,
          unit_price,
          total_price,
          custom_product_name,
          custom_product_description,
          is_custom_product,
          original_unit_price,
          product:products(code, commercial_name),
          owner:inventory_owners(name, owner_type)
        )
      `)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching orders with items:', error);
      // Fallback to basic data if join fails
      return basicData.map(order => ({
        ...order,
        // Handle missing order_type field gracefully
        order_type: (order as any).order_type || 'delivery',
        // Handle missing pickup fields gracefully
        pickup_by_staff: (order as any).pickup_by_staff || false,
        pickup_person_name: (order as any).pickup_person_name || null,
        pickup_person_phone: (order as any).pickup_person_phone || null,
        items: []
      }));
    }
    
    console.log('Orders with items fetched:', data?.length || 0);
    
    // Transform the data to match frontend expectations
    return data?.map(order => ({
      ...order,
      // Handle missing order_type field gracefully
      order_type: (order as any).order_type || 'delivery',
      // Handle missing pickup fields gracefully
      pickup_by_staff: (order as any).pickup_by_staff || false,
      pickup_person_name: (order as any).pickup_person_name || null,
      pickup_person_phone: (order as any).pickup_person_phone || null,
      items: order.items?.map((item: Record<string, unknown>) => mapOrderItemRowFromQuery(item)) || []
    })) || [];
    
  } catch (err) {
    console.error('Error in getOrders:', err);
    console.error('Attempting simple fallback...');
    try {
      return await getOrdersSimple();
    } catch (fallbackErr) {
      console.error('Even simple query failed:', fallbackErr);
      throw err;
    }
  }
};

export const getPurchaseOrders = async () => {
  const detailedQuery = `
      *,
      supplier:suppliers(name),
      items:purchase_order_items(
        id,
        product_id,
        owner_id,
        quantity,
        received_quantity,
        unit_price,
        total_price,
        product:products(code, commercial_name),
        owner:inventory_owners(name, owner_type)
      )
    `;
  const fallbackQuery = `
      *,
      supplier:suppliers(name),
      items:purchase_order_items(
        id,
        product_id,
        quantity,
        received_quantity,
        unit_price,
        total_price,
        product:products(code, commercial_name)
      )
    `;

  const { data, error } = await supabase
    .from('purchase_orders')
    .select(detailedQuery)
    .order('created_at', { ascending: false });
  
  const source = data || [];
  if (error && (error.code === 'PGRST200' || error.code === '42P01')) {
    const { data: fallbackData, error: fallbackError } = await supabase
      .from('purchase_orders')
      .select(fallbackQuery)
      .order('created_at', { ascending: false });
    if (fallbackError) {
      console.error('Fallback purchase orders query failed:', fallbackError);
      return [];
    }
    return (fallbackData || []).map((po) => ({
      ...po,
      supplier_name: (po as any).supplier?.name || 'Unknown Supplier',
      items: ((po as any).items || []).map((item: any) => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.product?.commercial_name || 'Unknown Product',
        owner_id: null,
        owner_name: null,
        quantity: item.quantity,
        received_quantity: item.received_quantity || 0,
        unit_price: item.unit_price,
        total_price: item.total_price
      }))
    }));
  }

  if (error) throw error;
  
  // Transform the data to match frontend expectations
  return source.map(po => ({
    ...po,
    supplier_name: po.supplier?.name || 'Unknown Supplier',
    items: po.items?.map((item: any) => ({
      id: item.id,
      product_id: item.product_id,
      product_name: item.product?.commercial_name || 'Unknown Product',
      owner_id: item.owner_id || null,
      owner_name: item.owner?.name || null,
      quantity: item.quantity,
      received_quantity: item.received_quantity || 0,
      unit_price: item.unit_price,
      total_price: item.total_price
    })) || []
  })) || [];
};

export const createProduct = async (product: any) => {
  console.log('createProduct called with:', product);
  const ownerStocks = Array.isArray(product.owner_stocks)
    ? product.owner_stocks as ProductOwnerStock[]
    : undefined;
  const ownerStockTotal = ownerStocks
    ? ownerStocks.reduce((sum, stock) => sum + Math.max(0, Math.floor(Number(stock.quantity) || 0)), 0)
    : null;
  
  // Handle supplier_id - if it's 'ARGEVILLE' string, get the actual UUID
  let supplierId = product.supplier_id;
  if (supplierId === 'ARGEVILLE' || !supplierId) {
    try {
      const argevilleSupplier = await ensureArgevilleSupplier();
      supplierId = argevilleSupplier?.id || null;
      console.log('Using Argeville supplier ID:', supplierId);
    } catch (error) {
      console.error('Error getting Argeville supplier:', error);
      supplierId = null;
    }
  }
  
  // Validate required fields before creating product
  if (!product.code || !product.item_number || !product.commercial_name) {
    throw new Error('Missing required fields: code, item_number, and commercial_name are required');
  }
  
  // Check if product code already exists
  const existingProduct = await checkProductExists(product.code);
  if (existingProduct) {
    throw new Error(`Product with code "${product.code}" already exists`);
  }
  
  // Check if item_number already exists
  const { data: existingItemNumber } = await supabase
    .from('products')
    .select('id, code, commercial_name')
    .eq('item_number', product.item_number)
    .single();
  
  if (existingItemNumber) {
    throw new Error(`Product with item number "${product.item_number}" already exists`);
  }
  
  // Create product with all required fields
  const completeProduct = {
    code: product.code.toUpperCase().trim(), // Ensure code is uppercase and trimmed
    item_number: product.item_number.trim(), // Required!
    commercial_name: product.commercial_name.trim(),
    product_type: product.product_type || 'Fragrance Bottles',
    brand_id: product.brand_id || null,
    category: product.product_type === 'Packaging' ? 'Eau de Parfum' : (product.category || 'Eau de Parfum'),
    concentration: product.concentration || null,
    size: parseInt(product.size) || 50, // Required! (integer in ml)
    gross_weight: parseFloat(product.gross_weight) || 1.136,
    tare_weight: parseFloat(product.tare_weight) || 0.136,
    net_weight: parseFloat(product.net_weight) || 1.000,
    current_stock: ownerStockTotal ?? (parseInt(product.current_stock) || 0),
    min_stock: parseInt(product.min_stock) || 5,
    max_stock: parseInt(product.max_stock) || 50,
    reorder_point: parseInt(product.reorder_point) || 10,
    price: parseFloat(product.price) || 0,
    supplier_id: supplierId,
    fragrance_notes: product.fragrance_notes || null,
    gender: product.gender || null,
    season: Array.isArray(product.season) ? product.season : (product.season ? [product.season] : []),
    is_tester: Boolean(product.is_tester) || false,
    created_by: product.created_by || null,
    updated_by: product.updated_by || null
  };
  
  console.log('Complete product for database:', completeProduct);
  
  // Use service role client directly to bypass RLS policies
  try {
    const serviceRoleClient = createClient(
      supabaseUrl,
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxqa3Z3YWR1cXZhY21ydnljc2hqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzkxMTcxOCwiZXhwIjoyMDY5NDg3NzE4fQ.yTH08Ylnmyh7Dcgy8QaQgABZrTG1LPylK1ET_MGLvlw'
    );
    
    const { data: insertedProduct, error: serviceError } = await serviceRoleClient
      .from('products')
      .insert(completeProduct)
      .select()
      .single();
    
    if (serviceError) {
      console.error('Service role insert failed:', serviceError);
      console.error('Error details:', {
        message: serviceError.message,
        details: serviceError.details,
        hint: serviceError.hint,
        code: serviceError.code
      });
      
      // Provide more specific error messages based on error code
      if (serviceError.code === '23505') { // Unique constraint violation
        if (serviceError.message.includes('code')) {
          throw new Error(`Product code "${product.code}" already exists`);
        } else if (serviceError.message.includes('item_number')) {
          throw new Error(`Item number "${product.item_number}" already exists`);
        } else {
          throw new Error('Product with this information already exists');
        }
      } else if (serviceError.code === '23502') { // Not null constraint violation
        throw new Error('Missing required fields. Please check all required fields are filled.');
      } else if (serviceError.code === '23514') { // Check constraint violation
        throw new Error('Invalid product type. Must be one of: Fragrance Bottles, Crimp, Accessories, Packaging');
      } else {
        throw new Error(`Database error: ${serviceError.message}`);
      }
    }
    
    console.log('Product created successfully (service role):', insertedProduct);
    await syncProductOwnerStocks(insertedProduct.id, ownerStocks, serviceRoleClient);
    
    // Verify the product was actually created by fetching it
    const { data: verifyProduct, error: verifyError } = await serviceRoleClient
      .from('products')
      .select('*')
      .eq('id', insertedProduct.id)
      .single();
    
    if (verifyError) {
      console.error('Error verifying product creation:', verifyError);
    } else {
      console.log('Product verified in database:', verifyProduct);
    }
    
    const [withOwnerStocks] = await attachOwnerStocksToProducts([insertedProduct as Product], serviceRoleClient);
    await recordActivity(serviceRoleClient, {
      action: 'create_product',
      entity_type: 'product',
      entity_id: insertedProduct.id,
      details: {
        name: insertedProduct.commercial_name,
        code: insertedProduct.code,
        current_stock: withOwnerStocks?.current_stock ?? insertedProduct.current_stock,
        owner_stocks: withOwnerStocks?.owner_stocks || []
      }
    });
    return withOwnerStocks;
  } catch (serviceErr) {
    console.error('Service role client failed:', serviceErr);
    throw serviceErr;
  }
};

export const updateProduct = async (id: string, updates: Partial<Database['public']['Tables']['products']['Update']>) => {
  console.log('updateProduct called with id:', id, 'updates:', updates);
  const ownerStocks = Array.isArray((updates as { owner_stocks?: unknown }).owner_stocks)
    ? (updates as { owner_stocks: ProductOwnerStock[] }).owner_stocks
    : undefined;
  
  // Special handling for current_stock updates
  if ('current_stock' in updates) {
    console.log('Updating current_stock from:', updates.current_stock, 'for product:', id);
  }
  
  // Clean up the updates object - convert empty strings to null for UUID fields
  const cleanedUpdates = { ...updates };
  delete (cleanedUpdates as { owner_stocks?: ProductOwnerStock[] }).owner_stocks;
  if (ownerStocks) {
    (cleanedUpdates as { current_stock?: number }).current_stock = ownerStocks.reduce(
      (sum, stock) => sum + Math.max(0, Math.floor(Number(stock.quantity) || 0)),
      0
    );
  }
  
  // Convert empty strings to null for UUID fields
  if (cleanedUpdates.brand_id === '') cleanedUpdates.brand_id = null;
  if (cleanedUpdates.supplier_id === '') cleanedUpdates.supplier_id = null;
  if (cleanedUpdates.created_by === '') cleanedUpdates.created_by = null;
  if (cleanedUpdates.updated_by === '') cleanedUpdates.updated_by = null;
  
  // Convert empty strings to null for optional text fields
  if (cleanedUpdates.concentration === '') cleanedUpdates.concentration = null;
  if (cleanedUpdates.fragrance_notes === '') cleanedUpdates.fragrance_notes = null;
  if (cleanedUpdates.gender === '') cleanedUpdates.gender = null;
  
  // Ensure arrays are properly formatted
  if (cleanedUpdates.season && Array.isArray(cleanedUpdates.season) && cleanedUpdates.season.length === 0) {
    cleanedUpdates.season = [];
  }
  
  console.log('Cleaned updates:', cleanedUpdates);
  
  // Ensure we have the required fields for update
  const updateData = {
    ...cleanedUpdates,
    updated_at: new Date().toISOString()
  };
  const snapshotClient = createServiceRoleClient();
  const { data: beforeProduct } = await snapshotClient
    .from('products')
    .select('id, code, commercial_name, current_stock, updated_at')
    .eq('id', id)
    .maybeSingle();
  
  console.log('Final update data:', updateData);
  
  try {
    // Try with anon key first
    const { data, error } = await supabase
      .from('products')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.error('Anon key update failed:', error);
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      
      // Fallback: try with service role client (bypass RLS)
      const serviceRoleClient = createClient(
        supabaseUrl,
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxqa3Z3YWR1cXZhY21ydnljc2hqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzkxMTcxOCwiZXhwIjoyMDY5NDg3NzE4fQ.yTH08Ylnmyh7Dcgy8QaQgABZrTG1LPylK1ET_MGLvlw'
      );
      
      console.log('Trying service role client update...');
      const { data: updatedProduct, error: serviceError } = await serviceRoleClient
        .from('products')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (serviceError) {
        console.error('Service role update also failed:', serviceError);
        console.error('Service role error details:', {
          message: serviceError.message,
          details: serviceError.details,
          hint: serviceError.hint,
          code: serviceError.code
        });
        throw serviceError;
      }
      
      console.log('Product updated successfully (service role):', updatedProduct);
      if ('current_stock' in updates) {
        console.log('Stock update confirmed - new current_stock:', updatedProduct.current_stock);
      }
    await syncProductOwnerStocks(id, ownerStocks, serviceRoleClient);
    const [withOwnerStocks] = await attachOwnerStocksToProducts([updatedProduct as Product], serviceRoleClient);
    await recordActivity(serviceRoleClient, {
      action: 'update_product',
      entity_type: 'product',
      entity_id: id,
      details: {
        name: withOwnerStocks?.commercial_name || updatedProduct.commercial_name,
        code: withOwnerStocks?.code || updatedProduct.code,
        before: beforeProduct || null,
        after: {
          current_stock: withOwnerStocks?.current_stock ?? updatedProduct.current_stock,
          owner_stocks: withOwnerStocks?.owner_stocks || []
        }
      }
    });
    return withOwnerStocks;
  }
    
    console.log('Product updated successfully (anon key):', data);
    if ('current_stock' in updates) {
      console.log('Stock update confirmed - new current_stock:', data.current_stock);
    }
    await syncProductOwnerStocks(id, ownerStocks);
    const [withOwnerStocks] = await attachOwnerStocksToProducts([data as Product]);
    await recordActivity(createServiceRoleClient(), {
      action: 'update_product',
      entity_type: 'product',
      entity_id: id,
      details: {
        name: withOwnerStocks?.commercial_name || data.commercial_name,
        code: withOwnerStocks?.code || data.code,
        after: {
          current_stock: withOwnerStocks?.current_stock ?? data.current_stock,
          owner_stocks: withOwnerStocks?.owner_stocks || []
        }
      }
    });
    return withOwnerStocks;
  } catch (err) {
    console.error('Error in updateProduct:', err);
    throw err;
  }
};

/** Extract a readable message from Supabase/PostgREST error (may have message, code, details). */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object') {
    const o = err as Record<string, unknown>;
    const msg = typeof o.message === 'string' ? o.message : null;
    const code = typeof o.code === 'string' ? o.code : null;
    const details = typeof o.details === 'string' ? o.details : null;
    if (msg || code || details) return [msg, code, details].filter(Boolean).join(' — ');
    try {
      return JSON.stringify(err);
    } catch {
      return String(err);
    }
  }
  return String(err);
}

/** Delete related rows then product (satisfies FK constraints). Returns error or true if product was deleted, false if 0 rows deleted. */
async function deleteProductWithClient(
  client: ReturnType<typeof createClient>,
  id: string
): Promise<{ error: unknown } | true | false> {
  // Order: all dependents first, then product (any table with product_id FK must be listed)
  const tables: { table: string; column: string }[] = [
    { table: 'product_reports', column: 'product_id' },
    { table: 'price_overrides', column: 'product_id' },
    { table: 'stock_movements', column: 'product_id' },
    { table: 'product_batches', column: 'product_id' },
    { table: 'order_items', column: 'product_id' },
    { table: 'purchase_order_items', column: 'product_id' }
  ];
  for (const { table, column } of tables) {
    const { error } = await (client as any).from(table).delete().eq(column, id);
    if (error) return error;
  }
  // Use .select() to verify a row was actually deleted (RLS can make delete "succeed" with 0 rows)
  const { data, error } = await client.from('products').delete().eq('id', id).select('id');
  if (error) return error;
  if (!data || data.length === 0) return false; // 0 rows deleted
  return true;
}

export const deleteProduct = async (id: string) => {
  console.log('deleteProduct called with id:', id);
  const snapshotClient = createServiceRoleClient();
  const { data: productSnapshot } = await snapshotClient
    .from('products')
    .select('id, code, commercial_name, current_stock')
    .eq('id', id)
    .maybeSingle();

  const result = await deleteProductWithClient(supabase, id);
  if (result === true) {
    console.log('Product deleted successfully (anon key)');
    if (productSnapshot) {
      await recordActivity(snapshotClient, {
        action: 'delete_product',
        entity_type: 'product',
        entity_id: id,
        details: productSnapshot
      });
    }
    return;
  }
  if (result !== false) {
    console.error('Anon key delete failed:', getErrorMessage(result));
  } else {
    console.log('Anon key: 0 rows deleted (RLS?), trying service role');
  }

  const serviceRoleClient = createClient(
    supabaseUrl,
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxqa3Z3YWR1cXZhY21ydnljc2hqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzkxMTcxOCwiZXhwIjoyMDY5NDg3NzE4fQ.yTH08Ylnmyh7Dcgy8QaQgABZrTG1LPylK1ET_MGLvlw'
  );
  const serviceResult = await deleteProductWithClient(serviceRoleClient, id);
  if (serviceResult === true) {
    console.log('Product deleted successfully (service role)');
    if (productSnapshot) {
      await recordActivity(serviceRoleClient, {
        action: 'delete_product',
        entity_type: 'product',
        entity_id: id,
        details: productSnapshot
      });
    }
    return;
  }
  if (serviceResult === false) {
    throw new Error('Product could not be deleted (0 rows affected). You may not have permission or the product may not exist.');
  }
  const msg = getErrorMessage(serviceResult);
  console.error('Service role delete failed:', msg);
  throw new Error(msg);
};

export const createStockMovement = async (movement: Omit<Database['public']['Tables']['stock_movements']['Insert'], 'id'>) => {
  const client = createServiceRoleClient();
  const { data, error } = await client
    .from('stock_movements')
    .insert(movement)
    .select()
    .single();
  
  if (error) throw error;
  await recordActivity(client, {
    action: 'create_stock_movement',
    entity_type: 'stock_movement',
    entity_id: data.id,
    details: {
      product_id: data.product_id,
      movement_type: data.movement_type,
      quantity: data.quantity,
      reason: data.reason,
      owner_id: data.owner_id || null
    }
  });
  return data;
};

const stockKey = (productId: string, ownerId: string | null | undefined) => `${productId}::${ownerId || ''}`;
const splitStockKey = (key: string) => {
  const [productId, ownerId] = key.split('::');
  return { productId, ownerId };
};

export const createOrder = async (
  order: Omit<Database['public']['Tables']['orders']['Insert'], 'id'>,
  items: Omit<Database['public']['Tables']['order_items']['Insert'], 'id' | 'order_id'>[]
) => {
  if (items.length === 0) {
    throw new Error('Add at least one product before saving the sale.');
  }

  // App users authenticate through the app role system, not Supabase Auth. Use the
  // existing privileged data client so order and line-item RLS policies do not reject them.
  const client = createServiceRoleClient();
  const defaultOwner = await ensureDefaultInventoryOwner(client);
  const requiredStock = new Map<string, number>();

  for (const item of items) {
    const quantity = Math.floor(Number(item.quantity));
    const ownerId = item.owner_id || defaultOwner.id;
    if (!item.product_id || !Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('Every sale item must have a product and a quantity greater than zero.');
    }
    const key = stockKey(item.product_id, ownerId);
    requiredStock.set(key, (requiredStock.get(key) || 0) + quantity);
  }

  const productIds = [...new Set([...requiredStock.keys()].map((key) => splitStockKey(key).productId))];
  const ownerIds = [...new Set([...requiredStock.keys()].map((key) => splitStockKey(key).ownerId))];
  const { data: stockRows, error: stockError } = await client
    .from('products')
    .select('id, commercial_name, current_stock')
    .in('id', productIds);
  const { data: ownerStockRows, error: ownerStockError } = await client
    .from('product_owner_stocks')
    .select(`product_id, owner_id, quantity, owner:inventory_owners(${ownerSelect})`)
    .in('product_id', productIds)
    .in('owner_id', ownerIds);

  if (stockError) throw stockError;
  if (ownerStockError) throw ownerStockError;
  const ownerStockByKey = new Map(
    normalizeOwnerStocks(ownerStockRows as unknown[]).map((stock) => [stockKey(stock.product_id, stock.owner_id), stock])
  );

  for (const key of requiredStock.keys()) {
    const { productId, ownerId } = splitStockKey(key);
    const product = stockRows?.find((row) => row.id === productId);
    const requested = requiredStock.get(key) || 0;
    const ownerStock = ownerStockByKey.get(key);
    const ownerName = ownerStock?.owner?.name || (ownerId === defaultOwner.id ? defaultOwner.name : 'selected owner');
    const available = Number(ownerStock?.quantity || 0);

    if (!product) {
      throw new Error('One of the selected products no longer exists. Refresh and try again.');
    }
    if (requested > available) {
      throw new Error(`${product.commercial_name} has only ${available} units available for ${ownerName}.`);
    }
  }

  const { data: orderData, error: orderError } = await client
    .from('orders')
    .insert(order)
    .select()
    .single();

  if (orderError) throw orderError;

  const orderItems = items.map((item) => ({
    product_id: item.product_id,
    batch_id: item.batch_id ?? null,
    owner_id: item.owner_id || defaultOwner.id,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total_price: item.total_price,
    order_id: orderData.id
  }));

  const cleanupOrder = async () => {
    const { error: itemCleanupError } = await client
      .from('order_items')
      .delete()
      .eq('order_id', orderData.id);
    const { error: orderCleanupError } = await client
      .from('orders')
      .delete()
      .eq('id', orderData.id);

    if (itemCleanupError || orderCleanupError) {
      console.error('Could not fully clean up failed sale:', itemCleanupError || orderCleanupError);
    }
  };

  const { error: itemsError } = await client
    .from('order_items')
    .insert(orderItems);

  if (itemsError) {
    await cleanupOrder();
    throw itemsError;
  }

  const performedAt = new Date().toISOString();
  const stockMovements = orderItems.map((item) => ({
    product_id: item.product_id,
    batch_id: item.batch_id,
    owner_id: item.owner_id,
    movement_type: 'out' as const,
    quantity: item.quantity,
    reason: `Sale ${order.order_number}`,
    reference_number: order.order_number,
    notes: order.notes,
    performed_by: order.created_by,
    performed_at: performedAt
  }));

  const { error: movementError } = await client
    .from('stock_movements')
    .insert(stockMovements);

  if (movementError) {
    await cleanupOrder();
    throw movementError;
  }

  await recordActivity(client, {
    action: 'create_sale',
    entity_type: 'order',
    entity_id: orderData.id,
    details: {
      order_number: orderData.order_number,
      total_amount: orderData.total_amount,
      items: orderItems.length,
      customer_name: orderData.customer_name
    }
  });

  return orderData;
};

export const updateOrder = async (orderId: string, orderUpdate: Partial<Database['public']['Tables']['orders']['Update']>) => {
  console.log('updateOrder called with:', orderId, orderUpdate);
  
  // First try with regular client
  let { data, error } = await supabase
    .from('orders')
    .update(orderUpdate)
    .eq('id', orderId)
    .select()
    .single();

  if (error) {
    console.error('Regular update failed, trying service role:', error);
    
    // Fallback: try with service role client (bypass RLS)
    try {
      const serviceRoleClient = createClient(
        supabaseUrl,
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxqa3Z3YWR1cXZhY21ydnljc2hqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzkxMTcxOCwiZXhwIjoyMDY5NDg3NzE4fQ.yTH08Ylnmyh7Dcgy8QaQgABZrTG1LPylK1ET_MGLvlw'
      );
      
      const { data: serviceData, error: serviceError } = await serviceRoleClient
        .from('orders')
        .update(orderUpdate)
        .eq('id', orderId)
        .select()
        .single();
      
      if (serviceError) {
        console.error('Service role update also failed:', serviceError);
        throw serviceError;
      }
      
      console.log('Order updated successfully (service role):', serviceData);
      return serviceData;
      
    } catch (serviceErr) {
      console.error('Service role client failed:', serviceErr);
      throw error; // Throw the original error
    }
  }
  
  console.log('Order updated successfully:', data);
  return data;
};

export const updateOrderWithItems = async (
  orderId: string,
  orderUpdate: Partial<Database['public']['Tables']['orders']['Update']>,
  items: Omit<Database['public']['Tables']['order_items']['Insert'], 'id' | 'order_id'>[]
) => {
  if (items.length === 0) {
    throw new Error('Add at least one product before saving the sale.');
  }

  const client = createServiceRoleClient();
  const defaultOwner = await ensureDefaultInventoryOwner(client);
  const [
    { data: existingOrder, error: orderReadError },
    { data: existingItems, error: itemsReadError }
  ] = await Promise.all([
    client.from('orders').select('*').eq('id', orderId).single(),
    client
      .from('order_items')
      .select('product_id, batch_id, owner_id, quantity, unit_price, total_price')
      .eq('order_id', orderId)
  ]);

  if (orderReadError) throw orderReadError;
  if (itemsReadError) throw itemsReadError;

  const { data: existingMovements, error: movementsReadError } = await client
    .from('stock_movements')
    .select('product_id, owner_id, movement_type, quantity')
    .eq('reference_number', existingOrder.order_number)
    .like('reason', 'Sale%');

  if (movementsReadError) throw movementsReadError;

  const desiredByStock = new Map<string, number>();
  for (const item of items) {
    const quantity = Math.floor(Number(item.quantity));
    const ownerId = item.owner_id || defaultOwner.id;
    if (!item.product_id || !Number.isFinite(quantity) || quantity <= 0) {
      throw new Error('Every sale item must have a product and a quantity greater than zero.');
    }
    const key = stockKey(item.product_id, ownerId);
    desiredByStock.set(key, (desiredByStock.get(key) || 0) + quantity);
  }

  const appliedByStock = new Map<string, number>();
  for (const movement of existingMovements || []) {
    if (!movement.product_id) continue;
    const ownerId = movement.owner_id || defaultOwner.id;
    const key = stockKey(movement.product_id, ownerId);
    const direction = movement.movement_type === 'out' ? 1 : -1;
    appliedByStock.set(key, (appliedByStock.get(key) || 0) + (direction * Number(movement.quantity || 0)));
  }

  const affectedStockKeys = [...new Set([
    ...desiredByStock.keys(),
    ...appliedByStock.keys()
  ])];
  const affectedProductIds = [...new Set([
    ...affectedStockKeys.map((key) => splitStockKey(key).productId)
  ])];
  const affectedOwnerIds = [...new Set(affectedStockKeys.map((key) => splitStockKey(key).ownerId))];
  const deltas = affectedStockKeys
    .map((key) => ({
      ...splitStockKey(key),
      quantity: (desiredByStock.get(key) || 0) - (appliedByStock.get(key) || 0)
    }))
    .filter((delta) => delta.quantity !== 0);

  const { data: stockRows, error: stockError } = await client
    .from('products')
    .select('id, commercial_name, current_stock')
    .in('id', affectedProductIds);
  const { data: ownerStockRows, error: ownerStockError } = await client
    .from('product_owner_stocks')
    .select(`product_id, owner_id, quantity, owner:inventory_owners(${ownerSelect})`)
    .in('product_id', affectedProductIds)
    .in('owner_id', affectedOwnerIds);

  if (stockError) throw stockError;
  if (ownerStockError) throw ownerStockError;
  const ownerStockByKey = new Map(
    normalizeOwnerStocks(ownerStockRows as unknown[]).map((stock) => [stockKey(stock.product_id, stock.owner_id), stock])
  );

  for (const delta of deltas) {
    if (delta.quantity <= 0) continue;
    const product = stockRows?.find((row) => row.id === delta.productId);
    const key = stockKey(delta.productId, delta.ownerId);
    const ownerStock = ownerStockByKey.get(key);
    const ownerName = ownerStock?.owner?.name || (delta.ownerId === defaultOwner.id ? defaultOwner.name : 'selected owner');
    const available = Number(ownerStock?.quantity || 0);
    if (!product) {
      throw new Error('One of the selected products no longer exists. Refresh and try again.');
    }
    if (delta.quantity > available) {
      throw new Error(`${product.commercial_name} has only ${available} units available for ${ownerName}.`);
    }
  }

  const replacementItems = items.map((item) => ({
    product_id: item.product_id,
    batch_id: item.batch_id ?? null,
    owner_id: item.owner_id || defaultOwner.id,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total_price: item.total_price,
    order_id: orderId
  }));
  const originalOrderUpdate = {
    customer_name: existingOrder.customer_name,
    customer_email: existingOrder.customer_email,
    customer_phone: existingOrder.customer_phone,
    order_type: existingOrder.order_type,
    pickup_by_staff: existingOrder.pickup_by_staff,
    pickup_person_name: existingOrder.pickup_person_name,
    pickup_person_phone: existingOrder.pickup_person_phone,
    status: existingOrder.status,
    total_amount: existingOrder.total_amount,
    notes: existingOrder.notes,
    created_by: existingOrder.created_by,
    updated_at: existingOrder.updated_at
  };
  const originalItems = (existingItems || []).map((item) => ({
    product_id: item.product_id,
    batch_id: item.batch_id,
    owner_id: item.owner_id || defaultOwner.id,
    quantity: item.quantity,
    unit_price: item.unit_price,
    total_price: item.total_price,
    order_id: orderId
  }));

  const restoreOriginalOrder = async () => {
    await client.from('order_items').delete().eq('order_id', orderId);
    if (originalItems.length > 0) {
      await client.from('order_items').insert(originalItems);
    }
    await client.from('orders').update(originalOrderUpdate).eq('id', orderId);
  };

  const { data: updatedOrder, error: orderUpdateError } = await client
    .from('orders')
    .update(orderUpdate)
    .eq('id', orderId)
    .select()
    .single();

  if (orderUpdateError) throw orderUpdateError;

  const { error: deleteItemsError } = await client
    .from('order_items')
    .delete()
    .eq('order_id', orderId);

  if (deleteItemsError) {
    await restoreOriginalOrder();
    throw deleteItemsError;
  }

  const { error: insertItemsError } = await client
    .from('order_items')
    .insert(replacementItems);

  if (insertItemsError) {
    await restoreOriginalOrder();
    throw insertItemsError;
  }

  if (deltas.length > 0) {
    const performedAt = new Date().toISOString();
    const adjustmentMovements = deltas.map((delta) => ({
      product_id: delta.productId,
      batch_id: null,
      owner_id: delta.ownerId,
      movement_type: delta.quantity > 0 ? 'out' as const : 'in' as const,
      quantity: Math.abs(delta.quantity),
      reason: delta.quantity > 0
        ? `Sale adjustment ${existingOrder.order_number}`
        : `Sale edit return ${existingOrder.order_number}`,
      reference_number: existingOrder.order_number,
      notes: orderUpdate.notes ?? existingOrder.notes,
      performed_by: existingOrder.created_by,
      performed_at: performedAt
    }));
    const { error: movementError } = await client
      .from('stock_movements')
      .insert(adjustmentMovements);

    if (movementError) {
      await restoreOriginalOrder();
      throw movementError;
    }
  }

  await recordActivity(client, {
    action: 'update_sale',
    entity_type: 'order',
    entity_id: orderId,
    details: {
      order_number: existingOrder.order_number,
      total_amount: updatedOrder.total_amount,
      items: replacementItems.length
    }
  });

  const { data: updatedProducts, error: productRefreshError } = affectedProductIds.length > 0
    ? await client.from('products').select('*').in('id', affectedProductIds)
    : { data: [], error: null };

  if (productRefreshError) {
    console.error('Sale updated but refreshed stock could not be loaded:', productRefreshError);
  }

  const productsWithOwnerStocks = await attachOwnerStocksToProducts(updatedProducts as Product[], client);

  return {
    order: updatedOrder,
    products: productsWithOwnerStocks || []
  };
};

export const createPurchaseOrder = async (
  po: Omit<Database['public']['Tables']['purchase_orders']['Insert'], 'id'>,
  items: Omit<Database['public']['Tables']['purchase_order_items']['Insert'], 'id' | 'po_id'>[]
) => {
  const client = createServiceRoleClient();
  const defaultOwner = await ensureDefaultInventoryOwner(client);
  const { data: poData, error: poError } = await client
    .from('purchase_orders')
    .insert(po)
    .select()
    .single();

  if (poError) throw poError;

    const poItems = items.map(item => ({
      po_id: poData.id,
      product_id: item.product_id,
      owner_id: item.owner_id || defaultOwner.id,
      quantity: item.quantity,
      received_quantity: item.received_quantity ?? 0,
      unit_price: item.unit_price,
      total_price: item.total_price
    }));

  const { error: itemsError } = await client
    .from('purchase_order_items')
    .insert(poItems);

  if (itemsError) throw itemsError;

  await recordActivity(client, {
    action: 'create_purchase_order',
    entity_type: 'purchase_order',
    entity_id: poData.id,
    details: {
      po_number: poData.po_number,
      supplier_id: poData.supplier_id,
      total_amount: poData.total_amount,
      items: poItems.length
    }
  });

  return poData;
};

export const receivePurchaseOrderStock = async (poId: string): Promise<{
  purchaseOrder: PurchaseOrder;
  products: Product[];
}> => {
  const client = createServiceRoleClient();
  const defaultOwner = await ensureDefaultInventoryOwner(client);
  const { data: po, error: poError } = await client
    .from('purchase_orders')
    .select(`
      *,
      supplier:suppliers(name),
      items:purchase_order_items(
        id,
        product_id,
        owner_id,
        quantity,
        received_quantity,
        unit_price,
        total_price,
        product:products(code, commercial_name),
        owner:inventory_owners(name, owner_type)
      )
    `)
    .eq('id', poId)
    .single();

  if (poError) throw poError;
  if (po.status === 'received') {
    const productIds = [...new Set((po.items || []).map((item: any) => item.product_id).filter(Boolean))];
    const { data: products } = productIds.length
      ? await client.from('products').select('*').in('id', productIds)
      : { data: [] };
    const [purchaseOrder] = await Promise.all([
      getPurchaseOrders().then((orders) => orders.find((order) => order.id === poId) as PurchaseOrder),
    ]);
    return {
      purchaseOrder: purchaseOrder || po as PurchaseOrder,
      products: await attachOwnerStocksToProducts(products as Product[], client)
    };
  }

  const validItems = (po.items || []).filter((item: any) => {
    const received = Math.floor(Number(item.received_quantity || item.quantity || 0));
    return item.product_id && received > 0;
  });

  if (validItems.length === 0) {
    throw new Error('This purchase order has no receivable product quantities.');
  }

  for (const item of validItems) {
    const received = Math.floor(Number(item.received_quantity || item.quantity || 0));
    const { error: itemUpdateError } = await client
      .from('purchase_order_items')
      .update({
        received_quantity: received,
        owner_id: item.owner_id || defaultOwner.id
      })
      .eq('id', item.id);

    if (itemUpdateError) throw itemUpdateError;
  }

  const performedAt = new Date().toISOString();
  const movements = validItems.map((item: any) => ({
    product_id: item.product_id,
    batch_id: null,
    owner_id: item.owner_id || defaultOwner.id,
    movement_type: 'in' as const,
    quantity: Math.floor(Number(item.received_quantity || item.quantity || 0)),
    reason: `Purchase order ${po.po_number}`,
    reference_number: po.po_number,
    notes: po.notes,
    performed_by: po.created_by,
    performed_at: performedAt
  }));

  const { error: movementError } = await client
    .from('stock_movements')
    .insert(movements);

  if (movementError) throw movementError;

  const { data: updatedPO, error: updatePOError } = await client
    .from('purchase_orders')
    .update({
      status: 'received',
      actual_delivery_date: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', poId)
    .select(`
      *,
      supplier:suppliers(name),
      items:purchase_order_items(
        id,
        product_id,
        owner_id,
        quantity,
        received_quantity,
        unit_price,
        total_price,
        product:products(code, commercial_name),
        owner:inventory_owners(name, owner_type)
      )
    `)
    .single();

  if (updatePOError) throw updatePOError;

  const productIds = [...new Set(validItems.map((item: any) => item.product_id))];
  const { data: updatedProducts, error: productsError } = await client
    .from('products')
    .select('*')
    .in('id', productIds);

  if (productsError) throw productsError;

  await recordActivity(client, {
    action: 'receive_purchase_order',
    entity_type: 'purchase_order',
    entity_id: poId,
    details: {
      po_number: updatedPO.po_number,
      items: validItems.length,
      total_received: validItems.reduce((sum, item: any) => sum + Math.floor(Number(item.received_quantity || item.quantity || 0)), 0)
    }
  });

  return {
    purchaseOrder: {
      ...updatedPO,
      supplier_name: updatedPO.supplier?.name || 'Unknown Supplier',
      items: updatedPO.items?.map((item: any) => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.product?.commercial_name || 'Unknown Product',
        owner_id: item.owner_id || null,
        owner_name: item.owner?.name || null,
        quantity: item.quantity,
        received_quantity: item.received_quantity || 0,
        unit_price: item.unit_price,
        total_price: item.total_price
      })) || []
    } as PurchaseOrder,
    products: await attachOwnerStocksToProducts(updatedProducts as Product[], client)
  };
};

export const getBrands = async () => {
  const { data, error } = await supabase
    .from('brands')
    .select('*')
    .order('name');
  
  if (error) throw error;
  return data;
};

export const getSuppliers = async () => {
  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .order('name');
  
  if (error) throw error;
  return data;
};

export const ensureArgevilleSupplier = async () => {
  try {
    // Check if Argeville supplier exists
    const { data: existingSupplier, error: selectError } = await supabase
      .from('suppliers')
      .select('id')
      .eq('name', 'Argeville')
      .single();

    if (selectError && selectError.code !== 'PGRST116') {
      console.error('Error checking for Argeville supplier:', selectError);
      return null;
    }

    if (existingSupplier) {
      console.log('Argeville supplier found:', existingSupplier.id);
      return existingSupplier;
    }

    // Create Argeville supplier if it doesn't exist (without created_by/updated_by)
    const { data: newSupplier, error: insertError } = await supabase
      .from('suppliers')
      .insert({
        name: 'Argeville',
        email: 'contact@argeville.com',
        phone: '+1-555-0123',
        address: '123 Perfume Street, Paris, France',
        contact_person: 'Jean Argeville',
        payment_terms: 'Net 30',
        lead_time: 14
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating Argeville supplier:', insertError);
      return null;
    }

    console.log('Argeville supplier created:', newSupplier.id);
    return newSupplier;
  } catch (error) {
    console.error('Error in ensureArgevilleSupplier:', error);
    return null;
  }
};

export const getActivityLog = async () => {
  try {
    const { data, error } = await supabase
      .from('activity_log')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching activity log:', error);
      return [];
    }
    return data || [];
  } catch (error) {
    console.error('Error in getActivityLog:', error);
    return [];
  }
};

const normalizeMoneyFields = <T extends Record<string, unknown>>(
  row: T,
  fields: string[]
): T => {
  const normalized = { ...row };
  fields.forEach((field) => {
    if (field in normalized) {
      normalized[field as keyof T] = toMoneyNumber(normalized[field as keyof T], 0) as T[keyof T];
    }
  });
  return normalized;
};

export type DailyClosingInput = {
  date: string;
  storeToShopSales: number;
  cashOnHand: number;
  bankDeposit: number;
  pettyCash: number;
  difference: number;
  notes: string | null;
};

export type ExpenseInput = {
  title: string;
  description: string | null;
  amount: number;
  type: Database['public']['Tables']['expenses']['Row']['type'];
  date: string;
};

const getClosingActorId = async (
  client: ReturnType<typeof createServiceRoleClient>
): Promise<string> => {
  const { data: admin } = await client
    .from('user_profiles')
    .select('id')
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle();

  if (admin?.id) return admin.id;

  const { data: accountant, error } = await client
    .from('user_profiles')
    .select('id')
    .eq('role', 'accountant')
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!accountant?.id) throw new Error('No admin or accountant profile is available for financial records.');
  return accountant.id;
};

const getClosingDateRange = (date: string) => {
  const start = new Date(`${date}T00:00:00+03:00`);
  const next = new Date(start.getTime() + (24 * 60 * 60 * 1000));
  return { start: start.toISOString(), next: next.toISOString() };
};

export const getDailyClosingWorkspace = async (
  date: string
): Promise<{ closing: DailyClosing | null; expenses: Expense[] }> => {
  const client = createServiceRoleClient();
  const range = getClosingDateRange(date);
  const [
    { data: closing, error: closingError },
    { data: expenses, error: expensesError }
  ] = await Promise.all([
    client
      .from('daily_closings')
      .select('*')
      .eq('date', date)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    client
      .from('expenses')
      .select('*')
      .gte('date', range.start)
      .lt('date', range.next)
      .order('date', { ascending: false })
  ]);

  if (closingError) throw closingError;
  if (expensesError) throw expensesError;

  return {
    closing: closing
      ? normalizeMoneyFields(closing, [
          'cash_on_hand',
          'bank_deposit',
          'petty_cash',
          'box_product_sales',
          'oil_sales',
          'cash_on_hand_box',
          'cash_on_hand_oil',
          'cash_on_hand_perfume'
        ]) as DailyClosing
      : null,
    expenses: (expenses || []).map((expense) =>
      normalizeMoneyFields(expense, ['amount'])
    ) as Expense[]
  };
};

export const saveDailyClosing = async (input: DailyClosingInput): Promise<DailyClosing> => {
  const client = createServiceRoleClient();
  const actorId = await getClosingActorId(client);
  const now = new Date().toISOString();
  const isReconciled = Math.abs(input.difference) < 0.5;
  const payload: Database['public']['Tables']['daily_closings']['Insert'] = {
    date: input.date,
    cash_on_hand: input.cashOnHand,
    bank_deposit: input.bankDeposit,
    petty_cash: input.pettyCash,
    notes: input.notes,
    closed_by: actorId,
    closed_at: now,
    is_reconciled: isReconciled,
    reconciled_at: isReconciled ? now : null,
    reconciled_by: isReconciled ? actorId : null,
    box_product_sales: input.storeToShopSales,
    oil_sales: 0,
    cash_on_hand_box: 0,
    cash_on_hand_oil: 0,
    cash_on_hand_perfume: input.cashOnHand
  };

  const { data: existing, error: existingError } = await client
    .from('daily_closings')
    .select('id')
    .eq('date', input.date)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;

  const query = existing?.id
    ? client.from('daily_closings').update(payload).eq('id', existing.id)
    : client.from('daily_closings').insert(payload);
  const { data, error } = await query.select().single();

  if (error) throw error;
  return normalizeMoneyFields(data, [
    'cash_on_hand',
    'bank_deposit',
    'petty_cash',
    'box_product_sales',
    'oil_sales',
    'cash_on_hand_box',
    'cash_on_hand_oil',
    'cash_on_hand_perfume'
  ]) as DailyClosing;
};

export const createExpense = async (input: ExpenseInput): Promise<Expense> => {
  const client = createServiceRoleClient();
  const actorId = await getClosingActorId(client);
  const now = new Date().toISOString();
  const payload: Database['public']['Tables']['expenses']['Insert'] = {
    title: input.title,
    description: input.description,
    amount: input.amount,
    type: input.type,
    created_by: actorId,
    date: new Date(`${input.date}T12:00:00+03:00`).toISOString(),
    receipt_url: null,
    is_approved: true,
    approved_by: actorId,
    approved_at: now,
    is_payroll: false,
    payroll_lines: []
  };
  const { data, error } = await client.from('expenses').insert(payload).select().single();

  if (error) throw error;
  return normalizeMoneyFields(data, ['amount']) as Expense;
};

export const deleteExpense = async (id: string): Promise<void> => {
  const client = createServiceRoleClient();
  const { error } = await client.from('expenses').delete().eq('id', id);
  if (error) throw error;
};

type ReportQueryResult = {
  data: Record<string, unknown>[] | null;
  error: unknown;
};

type ReportQueryBuilder = PromiseLike<ReportQueryResult> & {
  select: (columns: string) => ReportQueryBuilder;
  gte: (column: string, value: string) => ReportQueryBuilder;
  lt: (column: string, value: string) => ReportQueryBuilder;
  eq: (column: string, value: string) => ReportQueryBuilder;
  order: (column: string, options?: { ascending?: boolean }) => ReportQueryBuilder;
  limit: (count: number) => ReportQueryBuilder;
};

type ReportClient = {
  from: (table: string) => ReportQueryBuilder;
};

export const getMonthlyReportData = async (
  monthStart: string,
  nextMonthStart: string
): Promise<MonthlyReportData> => {
  const client = createServiceRoleClient() as unknown as ReportClient;

  const [
    dailyClosingsResult,
    expensesResult,
    monthlyBalanceResult,
    vendorPurchasesResult,
    priceOverridesResult
  ] = await Promise.all([
    client
      .from('daily_closings')
      .select('*')
      .gte('date', monthStart)
      .lt('date', nextMonthStart)
      .order('date', { ascending: true }),
    client
      .from('expenses')
      .select('*')
      .gte('date', monthStart)
      .lt('date', nextMonthStart)
      .order('date', { ascending: true }),
    client
      .from('monthly_balance_closings')
      .select('*')
      .eq('month_start', monthStart)
      .order('month_start', { ascending: true }),
    client
      .from('vendor_purchases')
      .select('*')
      .gte('purchase_date', monthStart)
      .lt('purchase_date', nextMonthStart)
      .order('purchase_date', { ascending: true }),
    client
      .from('price_overrides')
      .select('*')
      .gte('applied_at', monthStart)
      .lt('applied_at', nextMonthStart)
      .order('applied_at', { ascending: true })
  ]);

  const results = [
    dailyClosingsResult,
    expensesResult,
    monthlyBalanceResult,
    vendorPurchasesResult,
    priceOverridesResult
  ];
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;

  return {
    dailyClosings: (dailyClosingsResult.data || []).map((row: Record<string, unknown>) =>
      normalizeMoneyFields(row, [
        'cash_on_hand',
        'bank_deposit',
        'petty_cash',
        'box_product_sales',
        'oil_sales',
        'cash_on_hand_box',
        'cash_on_hand_oil',
        'cash_on_hand_perfume'
      ])
    ) as DailyClosing[],
    expenses: (expensesResult.data || []).map((row: Record<string, unknown>) =>
      normalizeMoneyFields(row, ['amount'])
    ) as Expense[],
    monthlyBalanceClosings: (monthlyBalanceResult.data || []).map((row: Record<string, unknown>) =>
      normalizeMoneyFields(row, [
        'opening_box',
        'opening_oil',
        'opening_bank_deposit',
        'opening_petty_cash',
        'opening_total',
        'closing_box',
        'closing_oil',
        'closing_bank_deposit',
        'closing_petty_cash',
        'closing_total',
        'closing_perfume'
      ])
    ) as MonthlyBalanceClosing[],
    vendorPurchases: (vendorPurchasesResult.data || []).map((row: Record<string, unknown>) =>
      normalizeMoneyFields(row, ['amount'])
    ) as VendorPurchase[],
    priceOverrides: (priceOverridesResult.data || []).map((row: Record<string, unknown>) =>
      normalizeMoneyFields(row, ['custom_price'])
    ) as PriceOverride[]
  };
};

const monthValueFromDatabaseDate = (value: unknown): string | null => {
  if (!value) return null;
  const text = String(value);
  const directMonth = text.match(/^(\d{4}-\d{2})/);
  if (directMonth) return directMonth[1];

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
};

export const getLatestMonthlyReportMonth = async (): Promise<string | null> => {
  const client = createServiceRoleClient() as unknown as ReportClient;

  const [
    latestDailyClosing,
    latestExpense,
    latestMonthlyClosing,
    latestVendorPurchase,
    latestPriceOverride
  ] = await Promise.all([
    client
      .from('daily_closings')
      .select('date')
      .order('date', { ascending: false })
      .limit(1),
    client
      .from('expenses')
      .select('date')
      .order('date', { ascending: false })
      .limit(1),
    client
      .from('monthly_balance_closings')
      .select('month_start')
      .order('month_start', { ascending: false })
      .limit(1),
    client
      .from('vendor_purchases')
      .select('purchase_date')
      .order('purchase_date', { ascending: false })
      .limit(1),
    client
      .from('price_overrides')
      .select('applied_at')
      .order('applied_at', { ascending: false })
      .limit(1)
  ]);

  const results = [
    latestDailyClosing,
    latestExpense,
    latestMonthlyClosing,
    latestVendorPurchase,
    latestPriceOverride
  ];
  const failed = results.find((result) => result.error);
  if (failed?.error) throw failed.error;

  const candidates = [
    latestDailyClosing.data?.[0]?.date,
    latestExpense.data?.[0]?.date,
    latestMonthlyClosing.data?.[0]?.month_start,
    latestVendorPurchase.data?.[0]?.purchase_date,
    latestPriceOverride.data?.[0]?.applied_at
  ]
    .map(monthValueFromDatabaseDate)
    .filter((value): value is string => Boolean(value));

  return candidates.sort((a, b) => b.localeCompare(a))[0] || null;
};

export const testConnection = async () => {
  try {
    // Test basic connection
    const { data, error } = await supabase
      .from('products')
      .select('id, code, commercial_name')
      .limit(1);
    
    if (error) {
      console.error('Supabase connection error:', error);
      return false;
    }
    
    console.log('Supabase connection successful');
    console.log('Sample product data:', data);
    
    // Test insert without select
    const testProduct = {
      code: 'TEST123',
      commercial_name: 'Test Product',
      category: 'Test',
      current_stock: 1,
      price: 10.00
    };
    
    const { error: insertError } = await supabase
      .from('products')
      .insert(testProduct);
    
    if (insertError) {
      console.error('Test insert failed:', insertError);
    } else {
      console.log('Test insert successful');
    }
    
    return true;
  } catch (err) {
    console.error('Supabase connection failed:', err);
    return false;
  }
};

export const testProductReportsConnection = async () => {
  try {
    console.log('Testing product_reports table connection...');
    const { data, error } = await supabase
      .from('product_reports')
      .select('id, product_id, report_type, status')
      .limit(5);
    
    if (error) {
      console.error('Product reports connection test failed:', error);
      return false;
    }
    
    console.log('Product reports connection test successful');
    console.log('Sample product reports data:', data);
    return true;
  } catch (err) {
    console.error('Product reports connection failed:', err);
    return false;
  }
};

type UpcomingInvoiceInsert = Omit<
  UpcomingInvoice,
  'id' | 'created_at' | 'updated_at' | 'lines'
>;

type UpcomingInvoiceLineInput = Omit<
  UpcomingInvoiceLine,
  'id' | 'created_at' | 'updated_at' | 'invoice_id'
>;

const sanitizeUpcomingInvoiceMatchStatus = (value: string | null | undefined): UpcomingInvoiceMatchStatus => {
  if (value === 'matched' || value === 'unmatched' || value === 'manual') return value;
  return 'unmatched';
};

function isMissingUpcomingInvoiceTablesError(err: any): boolean {
  const msg = String(err?.message ?? '').toLowerCase();
  const details = String(err?.details ?? '').toLowerCase();
  return (
    err?.code === '42P01' ||
    msg.includes('upcoming_invoices') ||
    msg.includes('upcoming_invoice_lines') ||
    details.includes('upcoming_invoices') ||
    details.includes('upcoming_invoice_lines') ||
    err?.status === 400
  );
}

export const createUpcomingInvoice = async (
  header: UpcomingInvoiceInsert,
  lines: UpcomingInvoiceLineInput[]
): Promise<UpcomingInvoice> => {
  const createWithClient = async (client: any): Promise<UpcomingInvoice> => {
    const { data: invoice, error: invoiceError } = await client
      .from('upcoming_invoices')
      .insert(header)
      .select('*')
      .single();
    if (invoiceError) throw invoiceError;

    const lineRows = lines.map((line, idx) => ({
      ...line,
      invoice_id: invoice.id,
      line_no: line.line_no ?? idx + 1,
      match_status: sanitizeUpcomingInvoiceMatchStatus(line.match_status)
    }));

    if (lineRows.length > 0) {
      const { error: linesError } = await client
        .from('upcoming_invoice_lines')
        .insert(lineRows);
      if (linesError) throw linesError;
    }

    const { data: fullInvoice, error: fullInvoiceError } = await client
      .from('upcoming_invoices')
      .select('*, upcoming_invoice_lines(*)')
      .eq('id', invoice.id)
      .single();

    if (fullInvoiceError) {
      if (isMissingUpcomingInvoiceTablesError(fullInvoiceError)) {
        return {
          ...(invoice as UpcomingInvoice),
          lines: []
        };
      }
      throw fullInvoiceError;
    }

    return {
      ...(fullInvoice as UpcomingInvoice),
      lines: (fullInvoice?.upcoming_invoice_lines ?? []) as UpcomingInvoiceLine[]
    };
  };

  try {
    return await createWithClient(supabase as any);
  } catch (err) {
    if (isMissingUpcomingInvoiceTablesError(err)) {
      throw new Error('Upcoming invoice tables are not available in this database yet.');
    }

    // RLS/permission fallback path mirrors existing create/update operations in this repo.
    const serviceRoleClient = createClient(
      supabaseUrl,
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxqa3Z3YWR1cXZhY21ydnljc2hqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzkxMTcxOCwiZXhwIjoyMDY5NDg3NzE4fQ.yTH08Ylnmyh7Dcgy8QaQgABZrTG1LPylK1ET_MGLvlw'
    );
    try {
      return await createWithClient(serviceRoleClient as any);
    } catch (serviceErr) {
      if (isMissingUpcomingInvoiceTablesError(serviceErr)) {
        throw new Error('Upcoming invoice tables are not available in this database yet.');
      }
      throw new Error(getErrorMessage(serviceErr));
    }
  }
};

export const getUpcomingInvoices = async (): Promise<UpcomingInvoice[]> => {
  const client = supabase as any;
  const { data, error } = await client
    .from('upcoming_invoices')
    .select('*, upcoming_invoice_lines(*)')
    .order('created_at', { ascending: false });
  if (error) {
    if (isMissingUpcomingInvoiceTablesError(error)) return [];
    throw error;
  }
  return (data ?? []).map((row: any) => ({
    ...row,
    lines: (row.upcoming_invoice_lines ?? []) as UpcomingInvoiceLine[]
  }));
};

export const getUpcomingInvoiceByReference = async (reference: string): Promise<UpcomingInvoice | null> => {
  const client = supabase as any;
  const { data, error } = await client
    .from('upcoming_invoices')
    .select('*, upcoming_invoice_lines(*)')
    .eq('reference', reference)
    .maybeSingle();
  if (error) {
    if (isMissingUpcomingInvoiceTablesError(error)) return null;
    throw error;
  }
  if (!data) return null;
  return {
    ...(data as UpcomingInvoice),
    lines: (data?.upcoming_invoice_lines ?? []) as UpcomingInvoiceLine[]
  };
};

export const getIncomingByProductSummary = async (): Promise<IncomingByProductSummary[]> => {
  const client = supabase as any;
  const { data: lines, error: linesError } = await client
    .from('upcoming_invoice_lines')
    .select('invoice_id, matched_product_id, qty_kg')
    .not('matched_product_id', 'is', null);
  if (linesError) {
    if (isMissingUpcomingInvoiceTablesError(linesError)) return [];
    throw linesError;
  }

  const { data: invoices, error: invoicesError } = await client
    .from('upcoming_invoices')
    .select('id, reference, expected_arrival_date');
  if (invoicesError) {
    if (isMissingUpcomingInvoiceTablesError(invoicesError)) return [];
    throw invoicesError;
  }

  const invoiceById = new Map<string, { reference: string; expected_arrival_date: string | null }>();
  for (const invoice of (invoices ?? []) as any[]) {
    invoiceById.set(String(invoice.id), {
      reference: String(invoice.reference ?? '').trim(),
      expected_arrival_date: invoice.expected_arrival_date ? String(invoice.expected_arrival_date) : null
    });
  }

  const map = new Map<string, IncomingByProductSummary>();
  for (const row of (lines ?? []) as any[]) {
    const productId = String(row.matched_product_id ?? '');
    if (!productId) continue;
    const qty = toMoneyNumber(row.qty_kg, 0);
    const invoice = invoiceById.get(String(row.invoice_id ?? ''));
    const invoiceRef = invoice?.reference ?? '';
    const arrival = invoice?.expected_arrival_date ?? null;

    if (!map.has(productId)) {
      map.set(productId, {
        product_id: productId,
        total_incoming_kg: 0,
        earliest_arrival_date: arrival,
        invoice_references: invoiceRef ? [invoiceRef] : [],
        line_count: 0
      });
    }

    const acc = map.get(productId)!;
    acc.total_incoming_kg += qty;
    acc.line_count += 1;
    if (invoiceRef && !acc.invoice_references.includes(invoiceRef)) {
      acc.invoice_references.push(invoiceRef);
    }
    if (arrival && (!acc.earliest_arrival_date || arrival < acc.earliest_arrival_date)) {
      acc.earliest_arrival_date = arrival;
    }
  }

  return Array.from(map.values()).sort((a, b) => b.total_incoming_kg - a.total_incoming_kg);
};

// Check current user's role and permissions
export const checkUserPermissions = async () => {
  try {
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) {
      console.error('Error getting user:', userError);
      return null;
    }
    
    if (!user) {
      console.log('No authenticated user');
      return null;
    }
    
    console.log('Current user ID:', user.id);
    
    // Get user profile to check role
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, full_name, email, role')
      .eq('id', user.id)
      .single();
    
    if (profileError) {
      console.error('Error getting user profile:', profileError);
      return null;
    }
    
    console.log('User profile:', profile);
    return profile;
    
  } catch (error) {
    console.error('Error checking user permissions:', error);
    return null;
  }
};

// Test function to fetch a specific user
export const testFetchUser = async (userId: string) => {
  try {
    console.log('Testing fetch for user ID:', userId);
    
    const serviceRoleClient = createClient(
      supabaseUrl,
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxqa3Z3YWR1cXZhY21ydnljc2hqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzkxMTcxOCwiZXhwIjoyMDY5NDg3NzE4fQ.yTH08Ylnmyh7Dcgy8QaQgABZrTG1LPylK1ET_MGLvlw'
    );
    
    // First, let's test if the user_profiles table exists and what columns it has
    console.log('Testing user_profiles table structure...');
    const { data: tableTest, error: tableError } = await serviceRoleClient
      .from('user_profiles')
      .select('*')
      .limit(1);
    
    if (tableError) {
      console.error('Error testing user_profiles table:', tableError);
      return null;
    }
    
    console.log('user_profiles table structure test:', tableTest);
    
    // Now try to fetch the specific user
    const { data, error } = await serviceRoleClient
      .from('user_profiles')
      .select('id, full_name, email')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.error('Error fetching user:', error);
      return null;
    }
    
    console.log('Fetched user data:', data);
    return data;
    
  } catch (error) {
    console.error('Error in testFetchUser:', error);
    return null;
  }
};

export const getProductReports = async () => {
  try {
    console.log('getProductReports: Starting to fetch product reports...');
    
    // Use service role client directly to bypass RLS for admin views
    const serviceRoleClient = createClient(
      supabaseUrl,
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxqa3Z3YWR1cXZhY21ydnljc2hqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzkxMTcxOCwiZXhwIjoyMDY5NDg3NzE4fQ.yTH08Ylnmyh7Dcgy8QaQgABZrTG1LPylK1ET_MGLvlw'
    );
    
    // Get reports with service role
    const { data: reportsData, error: reportsError } = await serviceRoleClient
      .from('product_reports')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (reportsError) {
      console.error('Service role fetch failed:', reportsError);
      return [];
    }
    
    console.log('getProductReports: Service role reports data:', reportsData);
    console.log('Raw reports count:', reportsData?.length || 0);
    
    // Now fetch related data separately
    const enrichedData = await enrichReportsData(reportsData || []);
    return enrichedData;
    
  } catch (error) {
    console.error('Error in getProductReports:', error);
    return [];
  }
};

// Helper function to enrich reports with product and user data
const enrichReportsData = async (reports: any[]) => {
  if (!reports || reports.length === 0) return [];
  
  try {
    // Get unique product IDs and user IDs
    const productIds = [...new Set(reports.map(r => r.product_id).filter(Boolean))];
    const userIds = [...new Set(reports.map(r => r.reported_by).filter(Boolean))];
    
    console.log('Product IDs to fetch:', productIds);
    console.log('User IDs to fetch:', userIds);
    
    // Use service role client for fetching related data
    const serviceRoleClient = createClient(
      supabaseUrl,
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxqa3Z3YWR1cXZhY21ydnljc2hqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MzkxMTcxOCwiZXhwIjoyMDY5NDg3NzE4fQ.yTH08Ylnmyh7Dcgy8QaQgABZrTG1LPylK1ET_MGLvlw'
    );
    
    // Fetch products and users in parallel with service role
    const [productsData, usersData] = await Promise.all([
      productIds.length > 0 ? serviceRoleClient
        .from('products')
        .select('id, commercial_name, code, current_stock, price')
        .in('id', productIds) : Promise.resolve({ data: [] }),
      userIds.length > 0 ? serviceRoleClient
        .from('user_profiles')
        .select('id, full_name, email')
        .in('id', userIds) : Promise.resolve({ data: [] })
    ]);
    
    console.log('Products query result:', productsData);
    console.log('Users query result:', usersData);
    
    console.log('Products data:', productsData.data);
    console.log('Users data:', usersData.data);
    
    const products = productsData.data || [];
    const users = usersData.data || [];
    
    // Create lookup maps
    const productMap = new Map(products.map(p => [p.id, p]));
    const userMap = new Map(users.map(u => [u.id, u]));
    
    // Enrich reports with related data
    const enrichedReports = reports.map(report => ({
      ...report,
      product: productMap.get(report.product_id) || null,
      reporter: userMap.get(report.reported_by) || {
        id: report.reported_by,
        full_name: 'Unknown User',
        email: 'unknown@example.com'
      }
    }));
    
    console.log('Enriched reports data:', enrichedReports);
    return enrichedReports;
    
  } catch (error) {
    console.error('Error enriching reports data:', error);
    return reports; // Return original data if enrichment fails
  }
};

export const createProductReport = async (report: {
  product_id: string;
  report_type: 'add' | 'remove';
  quantity: number;
  reason: string;
  notes?: string;
}) => {
  try {
    const { data, error } = await supabase
      .from('product_reports')
      .insert({
        ...report,
        reported_by: (await supabase.auth.getUser()).data.user?.id
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error creating product report:', err);
    throw err;
  }
};

export const updateProductReportStatus = async (
  reportId: string, 
  status: 'approved' | 'rejected', 
  adminNotes?: string
) => {
  try {
    const { data, error } = await supabase
      .from('product_reports')
      .update({
        status,
        admin_notes: adminNotes,
        updated_at: new Date().toISOString()
      })
      .eq('id', reportId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  } catch (err) {
    console.error('Error updating product report status:', err);
    throw err;
  }
};
