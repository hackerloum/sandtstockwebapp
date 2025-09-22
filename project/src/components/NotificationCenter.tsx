import React, { useState, useEffect } from 'react';
import { Bell, X, AlertTriangle, Info, CheckCircle, AlertCircle } from 'lucide-react';
import { Notification, Product } from '../types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { formatDate } from '../utils/stockUtils';

interface NotificationCenterProps {
  products: Product[];
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ products }) => {
  const [notifications, setNotifications] = useLocalStorage<Notification[]>('notifications', []);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Generate stock-related notifications
  useEffect(() => {
    const newNotifications: Notification[] = [];
    const now = new Date();

    products.forEach(product => {
      // Out of stock notification
      if (product.current_stock === 0) {
        const existingNotification = notifications.find(
          n => n.type === 'out_of_stock' && n.entityId === product.id && !n.isRead
        );
        
        if (!existingNotification) {
          newNotifications.push({
            id: `out_of_stock_${product.id}_${now.getTime()}`,
            type: 'out_of_stock',
            title: 'Product Out of Stock',
            message: `${product.commercial_name} is completely out of stock`,
            isRead: false,
            createdAt: now,
            entityType: 'product',
            entityId: product.id,
            priority: 'critical'
          });
        }
      }

      // Low stock notification
      if (product.current_stock > 0 && product.current_stock <= product.min_stock) {
        const existingNotification = notifications.find(
          n => n.type === 'low_stock' && n.entityId === product.id && !n.isRead
        );
        
        if (!existingNotification) {
          newNotifications.push({
            id: `low_stock_${product.id}_${now.getTime()}`,
            type: 'low_stock',
            title: 'Low Stock Alert',
            message: `${product.commercial_name} is running low (${product.current_stock} remaining)`,
            isRead: false,
            createdAt: now,
            entityType: 'product',
            entityId: product.id,
            priority: 'high'
          });
        }
      }

      // Reorder point notification
      if (product.current_stock <= product.reorder_point && product.current_stock > product.min_stock) {
        const existingNotification = notifications.find(
          n => n.type === 'reorder_point' && n.entityId === product.id && !n.isRead
        );
        
        if (!existingNotification) {
          newNotifications.push({
            id: `reorder_${product.id}_${now.getTime()}`,
            type: 'reorder_point',
            title: 'Reorder Point Reached',
            message: `${product.commercial_name} has reached its reorder point (${product.current_stock} remaining)`,
            isRead: false,
            createdAt: now,
            entityType: 'product',
            entityId: product.id,
            priority: 'medium'
          });
        }
      }
    });

    if (newNotifications.length > 0) {
      setNotifications(prev => [...newNotifications, ...prev]);
    }
  }, [products, setNotifications]);

  // Update unread count
  useEffect(() => {
    const count = notifications.filter(n => !n.isRead).length;
    setUnreadCount(count);
  }, [notifications]);

  const markAsRead = (notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, isRead: true } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const deleteNotification = (notificationId: string) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const getNotificationIcon = (type: string, priority: string) => {
    switch (type) {
      case 'out_of_stock':
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      case 'low_stock':
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case 'reorder_point':
        return <Info className="w-5 h-5 text-blue-500" />;
      default:
        return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'border-l-red-500 bg-red-50';
      case 'high': return 'border-l-yellow-500 bg-yellow-50';
      case 'medium': return 'border-l-blue-500 bg-blue-50';
      case 'low': return 'border-l-gray-500 bg-gray-50';
      default: return 'border-l-gray-300 bg-white';
    }
  };

  const sortedNotifications = notifications.sort((a, b) => {
    // Sort by read status first (unread first), then by priority, then by date
    if (a.isRead !== b.isRead) return a.isRead ? 1 : -1;
    
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] ?? 4;
    const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] ?? 4;
    
    if (aPriority !== bPriority) return aPriority - bPriority;
    
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-xl shadow-lg border border-gray-200 z-50 max-h-96 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
              <div className="flex items-center space-x-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={clearAll}
                  className="text-sm text-red-600 hover:text-red-800"
                >
                  Clear all
                </button>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {sortedNotifications.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {sortedNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-4 border-l-4 ${getPriorityColor(notification.priority)} ${
                      !notification.isRead ? 'bg-opacity-100' : 'bg-opacity-50'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3 flex-1">
                        {getNotificationIcon(notification.type, notification.priority)}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${
                            !notification.isRead ? 'text-gray-900' : 'text-gray-600'
                          }`}>
                            {notification.title}
                          </p>
                          <p className={`text-sm mt-1 ${
                            !notification.isRead ? 'text-gray-700' : 'text-gray-500'
                          }`}>
                            {notification.message}
                          </p>
                          <p className="text-xs text-gray-400 mt-2">
                            {formatDate(notification.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-1 ml-2">
                        {!notification.isRead && (
                          <button
                            onClick={() => markAsRead(notification.id)}
                            className="text-blue-600 hover:text-blue-800 p-1"
                            title="Mark as read"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotification(notification.id)}
                          className="text-red-600 hover:text-red-800 p-1"
                          title="Delete notification"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};