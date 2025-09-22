import React from 'react';
import { Search } from 'lucide-react';
import { Input, Select } from '../shared/Form';

interface ActivityFiltersProps {
  searchTerm: string;
  entityFilter: string;
  userFilter: string;
  dateFilter: string;
  entityTypes: string[];
  uniqueUsers: string[];
  onSearchChange: (value: string) => void;
  onEntityFilterChange: (value: string) => void;
  onUserFilterChange: (value: string) => void;
  onDateFilterChange: (value: string) => void;
}

export const ActivityFilters: React.FC<ActivityFiltersProps> = ({
  searchTerm,
  entityFilter,
  userFilter,
  dateFilter,
  entityTypes,
  uniqueUsers,
  onSearchChange,
  onEntityFilterChange,
  onUserFilterChange,
  onDateFilterChange
}) => {
  const entityOptions = [
    { value: 'all', label: 'All Entities' },
    ...entityTypes.map(type => ({
      value: type,
      label: type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())
    }))
  ];

  const userOptions = [
    { value: 'all', label: 'All Users' },
    ...uniqueUsers.map(user => ({
      value: user,
      label: user
    }))
  ];

  const dateOptions = [
    { value: 'all', label: 'All Time' },
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'Last Week' },
    { value: 'month', label: 'Last Month' }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <Input
          type="text"
          placeholder="Search activities..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      <Select
        value={entityFilter}
        onChange={(e) => onEntityFilterChange(e.target.value)}
        options={entityOptions}
      />

      <Select
        value={userFilter}
        onChange={(e) => onUserFilterChange(e.target.value)}
        options={userOptions}
      />

      <Select
        value={dateFilter}
        onChange={(e) => onDateFilterChange(e.target.value)}
        options={dateOptions}
      />
    </div>
  );
};