import { FC } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { Service, ServiceStatus } from '../../types/service';
import { cn } from '../../utils/cn';

export interface ServiceCardProps extends Service {
  className?: string;
}

const statusConfig: Record<ServiceStatus, { bg: string; border: string; badge: string }> = {
  active: {
    bg: 'bg-white dark:bg-gray-800',
    border: 'border-gray-200 dark:border-gray-700',
    badge: 'bg-green-100 text-green-700 border-green-300',
  },
  warning: {
    bg: 'bg-white dark:bg-gray-800',
    border: 'border-yellow-300 dark:border-yellow-600',
    badge: 'bg-yellow-100 text-yellow-700 border-yellow-300',
  },
  error: {
    bg: 'bg-white dark:bg-gray-800',
    border: 'border-red-300 dark:border-red-600',
    badge: 'bg-red-100 text-red-700 border-red-300',
  },
  disabled: {
    bg: 'bg-gray-100 dark:bg-gray-900',
    border: 'border-gray-200 dark:border-gray-700',
    badge: 'bg-gray-100 text-gray-500 border-gray-200',
  },
};

export const ServiceCard: FC<ServiceCardProps> = ({
  id,
  title,
  description,
  icon: Icon,
  category,
  route,
  status = 'active',
  badge,
  metrics,
  quickActions,
  className,
}) => {
  const navigate = useNavigate();
  const isDisabled = status === 'disabled';
  const config = statusConfig[status];

  const handleClick = () => {
    if (isDisabled) return;
    navigate(route);
  };

  return (
    <motion.div
      whileHover={isDisabled ? {} : { scale: 1.03, y: -4 }}
      whileTap={isDisabled ? {} : { scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      onClick={handleClick}
      className={cn(
        'relative overflow-hidden rounded-2xl border-2 p-6',
        'flex flex-col gap-4',
        'transition-all duration-200',
        config.bg,
        config.border,
        isDisabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-lg',
        className
      )}
      role="button"
      tabIndex={isDisabled ? -1 : 0}
      aria-label={`${title} - ${description}`}
      aria-disabled={isDisabled}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
            <Icon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-base truncate">
              {title}
            </h3>
          </div>
        </div>
        
        {badge && (
          <div className={cn(
            'px-2 py-1 rounded-md text-xs font-medium border',
            'flex-shrink-0',
            config.badge
          )}>
            {badge}
          </div>
        )}
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
        {description}
      </p>

      {/* Metrics */}
      {metrics && metrics.length > 0 && (
        <div className="flex flex-col gap-2 pt-2 border-t border-gray-100 dark:border-gray-700">
          {metrics.map((metric, index) => (
            <div key={index} className="flex items-center justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">{metric.label}</span>
              <div className="flex items-center gap-1">
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {metric.value}
                </span>
                {metric.trend && metric.trendValue && (
                  <span className={cn(
                    'flex items-center gap-0.5 text-xs',
                    metric.trend === 'up' ? 'text-green-600' : 'text-red-600'
                  )}>
                    {metric.trend === 'up' ? (
                      <TrendingUp className="w-3 h-3" />
                    ) : (
                      <TrendingDown className="w-3 h-3" />
                    )}
                    {metric.trendValue}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Actions - shown on hover */}
      {quickActions && quickActions.length > 0 && !isDisabled && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileHover={{ opacity: 1, y: 0 }}
          className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-white dark:from-gray-800 to-transparent"
        >
          <div className="flex gap-2">
            {quickActions.map((action, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.stopPropagation();
                  action.onClick();
                }}
                className="px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors"
              >
                {action.label}
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};
