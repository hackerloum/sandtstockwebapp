import React, { useState } from 'react';
import { Activity } from 'lucide-react';
import { ActivityLog } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { PageHeader, PageContainer, PageSection, EmptyState } from '../shared/PageLayout';
import { ActivityFilters } from './ActivityFilters';
import { ActivityTimeline } from './ActivityTimeline';

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

  if (!hasPermission('view_activity_log')) {
    return (
      <EmptyState
        icon={<Activity className="w-16 h-16" />}
        title="Access Denied"
        description="You don't have permission to view the activity log."
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity Log"
        subtitle={`${filteredActivities.length} activities`}
      />

      <PageContainer>
        <PageSection>
          <ActivityFilters
            searchTerm={searchTerm}
            entityFilter={entityFilter}
            userFilter={userFilter}
            dateFilter={dateFilter}
            entityTypes={entityTypes}
            uniqueUsers={uniqueUsers}
            onSearchChange={setSearchTerm}
            onEntityFilterChange={setEntityFilter}
            onUserFilterChange={setUserFilter}
            onDateFilterChange={setDateFilter}
          />
        </PageSection>

        <PageSection title="Activity Timeline">
          <ActivityTimeline activities={filteredActivities} />
        </PageSection>
      </PageContainer>
    </div>
  );
};