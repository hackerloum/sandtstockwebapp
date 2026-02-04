import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';

const supabaseUrl = 'https://ljkvwaduqvacmrvycshj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxqa3Z3YWR1cXZhY21ydnljc2hqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM5MTE3MTgsImV4cCI6MjA2OTQ4NzcxOH0.fkbZbCF8KTK5aupvRRu6dCycIgB9N4BnnxZNZd3cz4Q';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);

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
        return serviceData || [];
      }
    }
    
    return data || [];
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
  const { data, error } = await supabase
    .from('stock_movements')
    .select(`
      *,
      product:products(code, commercial_name),
      batch:product_batches(batch_number)
    `)
    .order('performed_at', { ascending: false });
  
  if (error) throw error;
  return data;
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
              quantity,
              unit_price,
              total_price,
              product:products(code, commercial_name)
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
          items: order.items?.map((item: any) => ({
            id: item.id,
            product_id: item.product_id,
            product_name: item.product?.commercial_name || 'Unknown Product',
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price
          })) || []
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
              quantity,
              unit_price,
              total_price,
              product:products(code, commercial_name)
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
            items: order.items?.map((item: any) => ({
              id: item.id,
              product_id: item.product_id,
              product_name: item.product?.commercial_name || 'Unknown Product',
              quantity: item.quantity,
              unit_price: item.unit_price,
              total_price: item.total_price
            })) || []
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
          quantity,
          unit_price,
          total_price,
          product:products(code, commercial_name)
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
      items: order.items?.map((item: any) => ({
        id: item.id,
        product_id: item.product_id,
        product_name: item.product?.commercial_name || 'Unknown Product',
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price
      })) || []
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
  const { data, error } = await supabase
    .from('purchase_orders')
    .select(`
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
    `)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  
  // Transform the data to match frontend expectations
  return data?.map(po => ({
    ...po,
    supplier_name: po.supplier?.name || 'Unknown Supplier',
    items: po.items?.map((item: any) => ({
      id: item.id,
      product_id: item.product_id,
      product_name: item.product?.commercial_name || 'Unknown Product',
      quantity: item.quantity,
      received_quantity: item.received_quantity || 0,
      unit_price: item.unit_price,
      total_price: item.total_price
    })) || []
  })) || [];
};

export const createProduct = async (product: any) => {
  console.log('createProduct called with:', product);
  
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
    current_stock: parseInt(product.current_stock) || 0,
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
    
    return insertedProduct;
  } catch (serviceErr) {
    console.error('Service role client failed:', serviceErr);
    throw serviceErr;
  }
};

export const updateProduct = async (id: string, updates: Partial<Database['public']['Tables']['products']['Update']>) => {
  console.log('updateProduct called with id:', id, 'updates:', updates);
  
  // Special handling for current_stock updates
  if ('current_stock' in updates) {
    console.log('Updating current_stock from:', updates.current_stock, 'for product:', id);
  }
  
  // Clean up the updates object - convert empty strings to null for UUID fields
  const cleanedUpdates = { ...updates };
  
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
      return updatedProduct;
    }
    
    console.log('Product updated successfully (anon key):', data);
    if ('current_stock' in updates) {
      console.log('Stock update confirmed - new current_stock:', data.current_stock);
    }
    return data;
  } catch (err) {
    console.error('Error in updateProduct:', err);
    throw err;
  }
};

/** Extract a readable message from Supabase/PostgREST error (may have message, code, details). */
function getErrorMessage(err: unknown): string {
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
  // Order: all dependents first (product_reports, stock_movements, product_batches, order_items, purchase_order_items), then product
  const tables = [
    { table: 'product_reports' as const, column: 'product_id' },
    { table: 'stock_movements' as const, column: 'product_id' },
    { table: 'product_batches' as const, column: 'product_id' },
    { table: 'order_items' as const, column: 'product_id' },
    { table: 'purchase_order_items' as const, column: 'product_id' }
  ] as const;
  for (const { table, column } of tables) {
    const { error } = await client.from(table).delete().eq(column, id);
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

  const result = await deleteProductWithClient(supabase, id);
  if (result === true) {
    console.log('Product deleted successfully (anon key)');
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
  const { data, error } = await supabase
    .from('stock_movements')
    .insert(movement)
    .select()
    .single();
  
  if (error) throw error;
  return data;
};

export const createOrder = async (
  order: Omit<Database['public']['Tables']['orders']['Insert'], 'id'>,
  items: Omit<Database['public']['Tables']['order_items']['Insert'], 'id' | 'order_id'>[]
) => {
  const { data: orderData, error: orderError } = await supabase
    .from('orders')
    .insert(order)
    .select()
    .single();

  if (orderError) throw orderError;

  const orderItems = items.map(item => ({
    ...item,
    order_id: orderData.id
  }));

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItems);

  if (itemsError) throw itemsError;

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

export const createPurchaseOrder = async (
  po: Omit<Database['public']['Tables']['purchase_orders']['Insert'], 'id'>,
  items: Omit<Database['public']['Tables']['purchase_order_items']['Insert'], 'id' | 'po_id'>[]
) => {
  const { data: poData, error: poError } = await supabase
    .from('purchase_orders')
    .insert(po)
    .select()
    .single();

  if (poError) throw poError;

  const poItems = items.map(item => ({
    ...item,
    po_id: poData.id
  }));

  const { error: itemsError } = await supabase
    .from('purchase_order_items')
    .insert(poItems);

  if (itemsError) throw itemsError;

  return poData;
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