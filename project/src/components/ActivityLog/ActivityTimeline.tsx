import React from 'react';
import { User, Eye, Calendar, Activity } from 'lucide-react';
import { ActivityLog } from '../../types';
import { formatDate } from '../../utils/stockUtils';
import { EmptyState } from '../shared/PageLayout';

interface ActivityTimelineProps {
  activities: ActivityLog[];
}

export const ActivityTimeline: React.FC<ActivityTimelineProps> = ({ activities }) => {
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

  if (activities.length === 0) {
    return (
      <EmptyState
        icon={<Activity className="w-16 h-16" />}
        title="No activities found"
        description="Try adjusting your search or filters."
      />
    );
  }

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {activities.map((activity, index) => (
          <li key={activity.id}>
            <div className="relative pb-8">
              {index !== activities.length - 1 && (
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
  );
};