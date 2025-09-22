import React from 'react';
import { ChevronLeft } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  onBack,
  actions
}) => {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          {onBack && (
            <button
              onClick={onBack}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            {subtitle && (
              <p className="mt-1 text-sm text-gray-500">{subtitle}</p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex items-center space-x-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export const PageContainer: React.FC<PageContainerProps> = ({
  children,
  className = ''
}) => {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-200 ${className}`}>
      {children}
    </div>
  );
};

interface PageSectionProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  actions?: React.ReactNode;
}

export const PageSection: React.FC<PageSectionProps> = ({
  title,
  description,
  children,
  className = '',
  actions
}) => {
  return (
    <div className={`p-6 ${className}`}>
      {(title || description || actions) && (
        <div className="flex items-start justify-between mb-6">
          <div>
            {title && (
              <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            )}
            {description && (
              <p className="mt-1 text-sm text-gray-500">{description}</p>
            )}
          </div>
          {actions && (
            <div className="flex items-center space-x-3">
              {actions}
            </div>
          )}
        </div>
      )}
      {children}
    </div>
  );
};

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  return (
    <div className="flex items-center justify-center p-4">
      <div className={`animate-spin rounded-full border-2 border-gray-200 border-t-blue-600 ${sizeClasses[size]}`} />
    </div>
  );
};

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  action,
  icon
}) => {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {icon && (
        <div className="mb-4 text-gray-400">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-medium text-gray-900">{title}</h3>
      {description && (
        <p className="mt-2 text-sm text-gray-500 max-w-sm">{description}</p>
      )}
      {action && (
        <div className="mt-6">
          {action}
        </div>
      )}
    </div>
  );
};