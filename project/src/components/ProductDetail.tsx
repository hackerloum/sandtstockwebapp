import React from 'react';
import { X, Package, DollarSign, User, Calendar } from 'lucide-react';
import { Product } from '../types';
import { getStockStatus, getStockStatusColor, getStatusText } from '../utils/stockUtils';

interface ProductDetailProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ProductDetail: React.FC<ProductDetailProps> = ({
  product,
  isOpen,
  onClose
}) => {
  if (!isOpen || !product) return null;

  const status = getStockStatus(product);
  const statusColor = getStockStatusColor(status);
  const statusText = getStatusText(status);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Product Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">{product.commercial_name}</h3>
              <p className="text-gray-600">{product.category || 'N/A'}</p>
              {product.product_type && (
                <p className="text-sm text-blue-600 font-medium">{product.product_type}</p>
              )}
            </div>
            <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full border ${statusColor}`}>
              {statusText}
            </span>
          </div>

          {product.fragrance_notes && (
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Fragrance Notes</h4>
              <p className="text-gray-600">{product.fragrance_notes}</p>
            </div>
          )}

          {/* Product Specifications */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Product Specifications</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Product Code</p>
                <p className="text-sm font-medium">{product.code}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Item Number</p>
                <p className="text-sm font-medium">{product.item_number}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Size</p>
                <p className="text-sm font-medium">{product.size}ml</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Brand</p>
                <p className="text-sm font-medium">{product.brand?.name || product.brand_id || 'N/A'}</p>
              </div>
              {product.concentration && (
                <div>
                  <p className="text-xs text-gray-500">Concentration</p>
                  <p className="text-sm font-medium">{product.concentration}</p>
                </div>
              )}
              {product.gender && (
                <div>
                  <p className="text-xs text-gray-500">Gender</p>
                  <p className="text-sm font-medium">{product.gender}</p>
                </div>
              )}
              {product.season && (
                <div>
                  <p className="text-xs text-gray-500">Season</p>
                  <p className="text-sm font-medium">{product.season}</p>
                </div>
              )}
              {product.is_tester && (
                <div>
                  <p className="text-xs text-gray-500">Tester</p>
                  <p className="text-sm font-medium text-orange-600">Yes</p>
                </div>
              )}
            </div>
            
            {/* Weight details for Fragrance Bottles */}
            {product.product_type === 'Fragrance Bottles' && product.gross_weight && product.tare_weight && product.net_weight && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h5 className="text-xs font-medium text-gray-700 mb-2">Weight Specifications</h5>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Gross Weight</p>
                    <p className="text-sm font-medium">{product.gross_weight}g</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Tare Weight</p>
                    <p className="text-sm font-medium">{product.tare_weight}g</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Net Weight</p>
                    <p className="text-sm font-medium">{product.net_weight}g</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <Package className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Stock Information</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {product.current_stock} / {product.max_stock || 'N/A'} units
                  </p>
                  <p className="text-sm text-gray-500">
                    Minimum: {product.min_stock || 'N/A'} units
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <User className="w-5 h-5 text-green-500" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Supplier</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {product.supplier?.name || 'Argeville'}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <DollarSign className="w-5 h-5 text-yellow-500" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Pricing</p>
                  <p className="text-lg font-semibold text-gray-900">
                    ${product.price?.toFixed(2) || '0.00'} per unit
                  </p>
                  <p className="text-sm text-gray-500">
                    Total value: ${((product.current_stock || 0) * (product.price || 0)).toFixed(2)}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Calendar className="w-5 h-5 text-purple-500" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Last Updated</p>
                  <p className="text-lg font-semibold text-gray-900">
                    {product.updated_at ? new Date(product.updated_at).toLocaleDateString() : 'N/A'}
                  </p>
                  <p className="text-sm text-gray-500">
                    Created: {product.created_at ? new Date(product.created_at).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Stock Levels</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Current Stock</span>
                <span className="font-medium">{product.current_stock || 0} units</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Minimum Stock</span>
                <span className="font-medium">{product.min_stock || 'N/A'} units</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Maximum Stock</span>
                <span className="font-medium">{product.max_stock || 'N/A'} units</span>
              </div>
              {product.max_stock && (
                <div className="mt-3">
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        status === 'out' ? 'bg-red-500' :
                        status === 'low' ? 'bg-yellow-500' :
                        status === 'high' ? 'bg-green-500' :
                        'bg-blue-500'
                      }`}
                      style={{
                        width: `${Math.min(((product.current_stock || 0) / product.max_stock) * 100, 100)}%`
                      }}
                    ></div>
                  </div>
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>0</span>
                    <span>{product.max_stock}</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};