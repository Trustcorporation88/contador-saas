import { FC, ReactNode, useState } from 'react';
import { X, Info, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface QuickTipProps {
  type?: 'info' | 'warning' | 'success' | 'error';
  children: ReactNode;
  dismissible?: boolean;
  className?: string;
  onDismiss?: () => void;
}

const typeConfig = {
  info: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800',
    text: 'text-blue-800 dark:text-blue-200',
    icon: Info,
    iconColor: 'text-blue-600 dark:text-blue-400',
  },
  warning: {
    bg: 'bg-yellow-50 dark:bg-yellow-900/20',
    border: 'border-yellow-200 dark:border-yellow-800',
    text: 'text-yellow-800 dark:text-yellow-200',
    icon: AlertTriangle,
    iconColor: 'text-yellow-600 dark:text-yellow-400',
  },
  success: {
    bg: 'bg-green-50 dark:bg-green-900/20',
    border: 'border-green-200 dark:border-green-800',
    text: 'text-green-800 dark:text-green-200',
    icon: CheckCircle2,
    iconColor: 'text-green-600 dark:text-green-400',
  },
  error: {
    bg: 'bg-red-50 dark:bg-red-900/20',
    border: 'border-red-200 dark:border-red-800',
    text: 'text-red-800 dark:text-red-200',
    icon: XCircle,
    iconColor: 'text-red-600 dark:text-red-400',
  },
};

/**
 * QuickTip - Pequenos avisos contextuais inline
 * 
 * Features:
 * - 4 tipos: info, warning, success, error
 * - Pode ser dismissível
 * - Ícone automático por tipo
 * - Responsivo
 */
export const QuickTip: FC<QuickTipProps> = ({
  type = 'info',
  children,
  dismissible = false,
  className,
  onDismiss,
}) => {
  const [isDismissed, setIsDismissed] = useState(false);

  const config = typeConfig[type];
  const Icon = config.icon;

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  if (isDismissed) return null;

  return (
    <div
      className={cn(
        'relative flex items-start gap-3 p-4 rounded-lg border',
        config.bg,
        config.border,
        className
      )}
      role="alert"
    >
      {/* Icon */}
      <div className="flex-shrink-0 mt-0.5">
        <Icon className={cn('w-5 h-5', config.iconColor)} />
      </div>

      {/* Content */}
      <div className={cn('flex-1 text-sm leading-relaxed', config.text)}>
        {children}
      </div>

      {/* Dismiss Button */}
      {dismissible && (
        <button
          onClick={handleDismiss}
          className={cn(
            'flex-shrink-0 p-1 rounded-md hover:bg-black/5 dark:hover:bg-white/5 transition-colors',
            config.iconColor
          )}
          aria-label="Dispensar"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default QuickTip;
