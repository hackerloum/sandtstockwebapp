import React, { useMemo, useState } from 'react';
import { Activity, CalendarDays, Search, ShieldX } from 'lucide-react';
import { ActivityLog } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Input, Select } from './shared/Form';
import { EmptyState, PageHeader } from './shared/PageLayout';

interface ActivityLogProps {
  activities: ActivityLog[];
}

const detailText = (details: ActivityLog['details']) => {
  if (!details) return 'No additional details';
  if (typeof details === 'string') return details;
  try {
    return JSON.stringify(details)
      .replace(/[{}"]+/g, '')
      .replace(/,/g, ', ')
      .replace(/:/g, ': ');
  } catch {
    return 'Activity details recorded';
  }
};

const actionTone = (action: string) => {
  const value = action.toLowerCase();
  if (value.includes('delete') || value.includes('remove')) return 'bg-red-500';
  if (value.includes('create') || value.includes('add')) return 'bg-emerald-500';
  if (value.includes('update') || value.includes('edit')) return 'bg-blue-500';
  return 'bg-gray-400';
};

export const ActivityLogComponent: React.FC<ActivityLogProps> = ({ activities }) => {
  const { hasPermission } = useAuth();
  const [search, setSearch] = useState('');
  const [entity, setEntity] = useState('all');
  const [dateRange, setDateRange] = useState('all');

  const entityTypes = useMemo(
    () => Array.from(new Set(activities.map((activity) => activity.entity_type).filter(Boolean))).sort(),
    [activities]
  );

  const filteredActivities = useMemo(() => {
    const query = search.trim().toLowerCase();
    const now = Date.now();
    const rangeDays = dateRange === 'today' ? 1 : dateRange === 'week' ? 7 : dateRange === 'month' ? 30 : null;
    return [...activities]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .filter((activity) => {
        const matchesSearch = !query || [activity.action, activity.entity_type, detailText(activity.details)]
          .some((value) => value.toLowerCase().includes(query));
        const matchesEntity = entity === 'all' || activity.entity_type === entity;
        const matchesDate = rangeDays === null || now - new Date(activity.created_at).getTime() <= rangeDays * 86400000;
        return matchesSearch && matchesEntity && matchesDate;
      });
  }, [activities, dateRange, entity, search]);

  if (!hasPermission('view_activity_log')) {
    return <EmptyState icon={<ShieldX className="h-10 w-10" />} title="Access denied" description="You do not have permission to view the activity log." />;
  }

  return (
    <div className="space-y-5">
      <PageHeader title="Activity log" subtitle="Review changes made across the app" />

      <section className="overflow-hidden rounded-md border border-gray-200 bg-white">
        <div className="grid grid-cols-1 gap-3 border-b border-gray-200 p-4 sm:grid-cols-3">
          <div className="relative sm:col-span-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search activity" className="pl-9" />
          </div>
          <Select
            value={entity}
            onChange={(event) => setEntity(event.target.value)}
            aria-label="Entity type"
            options={[
              { value: 'all', label: 'All areas' },
              ...entityTypes.map((type) => ({ value: type, label: type.replace(/_/g, ' ') }))
            ]}
          />
          <Select
            value={dateRange}
            onChange={(event) => setDateRange(event.target.value)}
            aria-label="Date range"
            options={[
              { value: 'all', label: 'All time' },
              { value: 'today', label: 'Today' },
              { value: 'week', label: 'Last 7 days' },
              { value: 'month', label: 'Last 30 days' }
            ]}
          />
        </div>

        <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-3 text-sm">
          <span className="font-medium text-gray-700">{filteredActivities.length} activities</span>
          <CalendarDays className="h-4 w-4 text-gray-400" />
        </div>

        {filteredActivities.length === 0 ? (
          <EmptyState icon={<Activity className="h-10 w-10" />} title="No activities found" description="Try a different search or date range." />
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredActivities.map((activity) => (
              <article key={activity.id} className="grid gap-2 p-4 sm:grid-cols-[1fr_auto] sm:gap-6">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 shrink-0 rounded-full ${actionTone(activity.action)}`} />
                    <h2 className="truncate text-sm font-semibold capitalize text-gray-900">{activity.action.replace(/_/g, ' ')}</h2>
                  </div>
                  <p className="mt-2 break-words text-sm text-gray-600">{detailText(activity.details)}</p>
                  <p className="mt-2 text-xs capitalize text-gray-500">{activity.entity_type.replace(/_/g, ' ')}{activity.entity_id ? ` · ${activity.entity_id}` : ''}</p>
                </div>
                <time className="whitespace-nowrap text-xs text-gray-500" dateTime={activity.created_at}>
                  {new Date(activity.created_at).toLocaleString()}
                </time>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};
