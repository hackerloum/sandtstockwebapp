import React, { useState, useEffect } from 'react';
import { testProductVisibility, getProducts } from '../lib/supabase';

export const ProductDebug: React.FC = () => {
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<any[]>([]);

  const runDebug = async () => {
    setLoading(true);
    try {
      console.log('ProductDebug: Starting debug...');
      
      // Test 1: Run the visibility test
      const visibilityResult = await testProductVisibility();
      console.log('ProductDebug: Visibility test result:', visibilityResult);
      
      // Test 2: Get products normally
      const productsResult = await getProducts();
      console.log('ProductDebug: Products result:', productsResult);
      
      setDebugInfo({
        visibility: visibilityResult,
        products: productsResult
      });
      
      setProducts(productsResult || []);
    } catch (error) {
      console.error('ProductDebug: Error:', error);
      setDebugInfo({ error: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runDebug();
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Product Debug Information</h1>
      
      <div className="mb-6">
        <button 
          onClick={runDebug}
          disabled={loading}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {loading ? 'Running Debug...' : 'Run Debug Again'}
        </button>
      </div>

      {debugInfo && (
        <div className="space-y-6">
          <div className="bg-gray-100 p-4 rounded">
            <h2 className="text-lg font-semibold mb-2">Debug Results</h2>
            <pre className="text-sm overflow-auto">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </div>

          <div className="bg-gray-100 p-4 rounded">
            <h2 className="text-lg font-semibold mb-2">Products Found ({products.length})</h2>
            {products.map((product, index) => (
              <div key={product.id || index} className="border-b border-gray-300 py-2">
                <div className="font-medium">{product.commercial_name}</div>
                <div className="text-sm text-gray-600">
                  Code: {product.code} | Type: {product.product_type} | Category: {product.category}
                </div>
                <div className="text-sm text-gray-500">
                  Brand: {product.brand?.name || product.brand_id || 'N/A'} | 
                  Supplier: {product.supplier?.name || product.supplier_id || 'N/A'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}; 