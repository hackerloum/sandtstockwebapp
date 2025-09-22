import React, { useState } from 'react';
import { Activity, Search, Filter, User, Calendar, Eye } from 'lucide-react';
import { ActivityLog } from '../types';
import { formatDate } from '../utils/stockUtils';
import { useAuth } from '../contexts/AuthContext';

interface ActivityLogProps {
  activities: ActivityLog[];
}

export const ActivityLogComponent: React.FC<ActivityLogProps> = ({ activities }) => {
  const { hasPermission } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [entityFilter, setEntityFilter] = useState<string>('all');
  const [userFilter, setUserFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');

  const getDateRange = (filter: string) => {
    const now = new Date();
    const start = new Date();
    
    switch (filter) {
      case 'today':
        start.setHours(0, 0, 0, 0);
        break;
      case 'week':
        start.setDate(now.getDate() - 7);
        break;
      case 'month':
        start.setMonth(now.getMonth() - 1);
        break;
      default:
        return null;
    }
    
    return { start, end: now };
  };

  const filteredActivities = activities.filter(activity => {
    const matchesSearch = activity.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         activity.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (activity.username && activity.username.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesEntity = entityFilter === 'all' || activity.entityType === entityFilter;
    const matchesUser = userFilter === 'all' || activity.username === userFilter;
    
    let matchesDate = true;
    if (dateFilter !== 'all') {
      const dateRange = getDateRange(dateFilter);
      if (dateRange) {
        const activityDate = new Date(activity.timestamp);
        matchesDate = activityDate >= dateRange.start && activityDate <= dateRange.end;
      }
    }
    
    return matchesSearch && matchesEntity && matchesUser && matchesDate;
  });

  const uniqueUsers = Array.from(new Set(activities.map(a => a.username).filter(Boolean)));
  const entityTypes = Array.from(new Set(activities.map(a => a.entityType)));

  const getActionIcon = (action: string) => {
    if (action.includes('create') || action.includes('add')) {
      return <div className="w-2 h-2 bg-green-500 rounded-full"></div>;
    } else if (action.includes('update') || action.includes('edit')) {
      return <div className="w-2 h-2 bg-blue-500 rounded-full"></div>;
    } else if (action.includes('delete') || action.includes('remove')) {
      return <div className="w-2 h-2 bg-red-500 rounded-full"></div>;
    } else {
      return <div className="w-2 h-2 bg-gray-500 rounded-full"></div>;
    }
  };

  const getActionColor = (action: string) => {
    if (action.includes('create') || action.includes('add')) {
      return 'text-green-600';
    } else if (action.includes('update') || action.includes('edit')) {
      return 'text-blue-600';
    } else if (action.includes('delete') || action.includes('remove')) {
      return 'text-red-600';
    } else {
      return 'text-gray-600';
    }
  };

  if (!hasPermission('view_activity_log')) {
    return (
      <div className="text-center py-12">
        <Activity className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">Access Denied</h3>
        <p className="text-gray-600">You don't have permission to view the activity log.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Activity Log</h2>
        <div className="flex items-center space-x-2">
          <Activity className="w-6 h-6 text-gray-600" />
          <span className="text-sm text-gray-600">{filteredActivities.length} activities</span>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search activities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <select
            value={entityFilter}
            onChange={(e) => setEntityFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Entities</option>
            {entityTypes.map(type => (
              <option key={type} value={type}>
                {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </option>
            ))}
          </select>

          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Users</option>
            {uniqueUsers.map(user => (
              <option key={user} value={user}>{user}</option>
            ))}
          </select>

          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="week">Last Week</option>
            <option value="month">Last Month</option>
          </select>
        </div>
      </div>

      {/* Activity Timeline */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Activity Timeline</h3>
        </div>

        {filteredActivities.length === 0 ? (
          <div className="p-8 text-center">
            <Activity className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No activities found</h3>
            <p className="text-gray-600">Try adjusting your search or filters.</p>
          </div>
        ) : (
          <div className="p-6">
            <div className="flow-root">
              <ul className="-mb-8">
                {filteredActivities.map((activity, index) => (
                  <li key={activity.id}>
                    <div className="relative pb-8">
                      {index !== filteredActivities.length - 1 && (
                        <span
                          className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-gray-200"
                          aria-hidden="true"
                        />
                      )}
                      <div className="relative flex space-x-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 ring-8 ring-white">
                          {getActionIcon(activity.action)}
                        </div>
                        <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-gray-900">
                              <span className={`font-medium ${getActionColor(activity.action)}`}>
                                {activity.action}
                              </span>
                              {activity.username && (
                                <span className="text-gray-600"> by {activity.username}</span>
                              )}
                            </p>
                            <p className="mt-1 text-sm text-gray-600">{activity.details}</p>
                            <div className="mt-2 flex items-center space-x-4 text-xs text-gray-500">
                              <div className="flex items-center space-x-1">
                                <User className="w-3 h-3" />
                                <span>{activity.entityType.replace('_', ' ')}</span>
                              </div>
                              {activity.ipAddress && (
                                <div className="flex items-center space-x-1">
                                  <Eye className="w-3 h-3" />
                                  <span>{activity.ipAddress}</span>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="whitespace-nowrap text-right text-sm text-gray-500">
                            <div className="flex items-center space-x-1">
                              <Calendar className="w-3 h-3" />
                              <time dateTime={activity.timestamp.toISOString()}>
                                {formatDate(activity.timestamp)}
                              </time>
                            </div>
                            <div className="text-xs text-gray-400 mt-1">
                              {new Date(activity.timestamp).toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};