import React from 'react';
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react';

interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  width?: string;
}

interface TableProps<T> {
  data: T[];
  columns: Column<T>[];
  onSort?: (key: string, direction: 'asc' | 'desc') => void;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
  isLoading?: boolean;
  emptyState?: React.ReactNode;
  rowActions?: (item: T) => React.ReactNode;
  onRowClick?: (item: T) => void;
  selectedRows?: string[];
  onSelectRow?: (id: string) => void;
  onSelectAll?: () => void;
  keyField?: string;
}

export function Table<T extends { id: string }>({
  data,
  columns,
  onSort,
  sortKey,
  sortDirection,
  isLoading,
  emptyState,
  rowActions,
  onRowClick,
  selectedRows = [],
  onSelectRow,
  onSelectAll,
  keyField = 'id'
}: TableProps<T>) {
  const getSortIcon = (columnKey: string) => {
    if (columnKey !== sortKey) return <ChevronsUpDown className="w-4 h-4" />;
    return sortDirection === 'asc' ? (
      <ChevronUp className="w-4 h-4" />
    ) : (
      <ChevronDown className="w-4 h-4" />
    );
  };

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-10 bg-gray-200 rounded-t-lg mb-1" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 mb-1" />
        ))}
      </div>
    );
  }

  if (data.length === 0 && emptyState) {
    return <>{emptyState}</>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {onSelectRow && (
              <th className="px-6 py-3 w-12">
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  checked={selectedRows.length === data.length}
                  onChange={onSelectAll}
                />
              </th>
            )}
            {columns.map((column) => (
              <th
                key={column.key}
                className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                  column.width || ''
                }`}
              >
                {column.sortable ? (
                  <button
                    className="group inline-flex items-center space-x-1 hover:text-gray-900"
                    onClick={() =>
                      onSort?.(
                        column.key,
                        sortKey === column.key && sortDirection === 'asc'
                          ? 'desc'
                          : 'asc'
                      )
                    }
                  >
                    <span>{column.header}</span>
                    <span className="text-gray-400 group-hover:text-gray-500">
                      {getSortIcon(column.key)}
                    </span>
                  </button>
                ) : (
                  column.header
                )}
              </th>
            ))}
            {rowActions && <th className="px-6 py-3 w-48" />}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((item) => (
            <tr
              key={item[keyField as keyof T] as string}
              className={`${
                onRowClick ? 'cursor-pointer hover:bg-gray-50' : ''
              }`}
              onClick={() => onRowClick?.(item)}
            >
              {onSelectRow && (
                <td className="px-6 py-4 whitespace-nowrap w-12">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    checked={selectedRows.includes(item[keyField as keyof T] as string)}
                    onChange={(e) => {
                      e.stopPropagation();
                      onSelectRow(item[keyField as keyof T] as string);
                    }}
                  />
                </td>
              )}
              {columns.map((column) => (
                <td
                  key={column.key}
                  className="px-6 py-4 whitespace-nowrap text-sm text-gray-900"
                >
                  {column.render
                    ? column.render(item)
                    : (item[column.key as keyof T] as React.ReactNode)}
                </td>
              ))}
              {rowActions && (
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  {rowActions(item)}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}