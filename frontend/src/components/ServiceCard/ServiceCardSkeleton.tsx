import { FC } from 'react';
import { cn } from '../../utils/cn';

interface ServiceCardSkeletonProps {
  className?: string;
}

export const ServiceCardSkeleton: FC<ServiceCardSkeletonProps> = ({ className }) => {
  return (
    <div
      className={cn(
        'rounded-2xl border-2 border-gray-200 dark:border-gray-700 p-6',
        'bg-white dark:bg-gray-800',
        'animate-pulse',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700" />
          <div className="flex-1">
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
          </div>
        </div>
        <div className="w-16 h-6 bg-gray-200 dark:bg-gray-700 rounded" />
      </div>

      {/* Description */}
      <div className="mt-4 space-y-2">
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
      </div>

      {/* Metrics */}
      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-700 space-y-2">
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full" />
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-5/6" />
      </div>
    </div>
  );
};
