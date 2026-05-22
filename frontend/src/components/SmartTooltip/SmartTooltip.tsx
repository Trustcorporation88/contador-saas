import { FC, useState, useRef, useEffect, ReactNode } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../utils/cn';

export interface SmartTooltipContent {
  description: string;
  example?: string;
  helpText?: string;
}

export interface SmartTooltipProps {
  content: SmartTooltipContent;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  pinnable?: boolean;
  maxWidth?: number;
  className?: string;
}

/**
 * SmartTooltip - Tooltip rico com suporte a pin/unpin
 * 
 * Features:
 * - Aparece em hover/focus
 * - Pode ser "pinned" (clique para manter aberto)
 * - Suporta rich content (descrição, exemplo, help text)
 * - Reposicionamento automático se sair da tela
 * - Keyboard accessible (Esc para fechar)
 * - Animação suave
 */
export const SmartTooltip: FC<SmartTooltipProps> = ({
  content,
  children,
  position = 'auto',
  pinnable = true,
  maxWidth = 320,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const [computedPosition, setComputedPosition] = useState(position);
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Auto-reposition tooltip if out of viewport
  useEffect(() => {
    if (!isOpen || !tooltipRef.current || !triggerRef.current) return;

    const tooltip = tooltipRef.current;
    const trigger = triggerRef.current;
    const rect = tooltip.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();

    let newPosition = position;

    if (position === 'auto') {
      // Check if tooltip fits on each side
      const spaceTop = triggerRect.top;
      const spaceBottom = window.innerHeight - triggerRect.bottom;
      const spaceLeft = triggerRect.left;
      const spaceRight = window.innerWidth - triggerRect.right;

      // Prefer bottom, then top, then right, then left
      if (spaceBottom >= rect.height) {
        newPosition = 'bottom';
      } else if (spaceTop >= rect.height) {
        newPosition = 'top';
      } else if (spaceRight >= rect.width) {
        newPosition = 'right';
      } else {
        newPosition = 'left';
      }
    } else {
      // Check if chosen position fits
      if (position === 'bottom' && rect.bottom > window.innerHeight) {
        newPosition = 'top';
      } else if (position === 'top' && rect.top < 0) {
        newPosition = 'bottom';
      } else if (position === 'right' && rect.right > window.innerWidth) {
        newPosition = 'left';
      } else if (position === 'left' && rect.left < 0) {
        newPosition = 'right';
      }
    }

    setComputedPosition(newPosition);
  }, [isOpen, position]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setIsPinned(false);
      }
    };

    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen]);

  const handleMouseEnter = () => {
    if (!isPinned) setIsOpen(true);
  };

  const handleMouseLeave = () => {
    if (!isPinned) setIsOpen(false);
  };

  const handleClick = () => {
    if (pinnable) {
      setIsPinned(!isPinned);
      setIsOpen(!isPinned);
    }
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(false);
    setIsPinned(false);
  };

  const positionClasses = {
    top: '-top-2 left-1/2 -translate-x-1/2 -translate-y-full',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'top-1/2 -left-2 -translate-y-1/2 -translate-x-full',
    right: 'top-1/2 left-full -translate-y-1/2 ml-2',
    auto: 'top-full left-1/2 -translate-x-1/2 mt-2',
  };

  return (
    <div
      ref={triggerRef}
      className={cn('relative inline-flex items-center gap-1', className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      
      {pinnable && (
        <button
          type="button"
          onClick={handleClick}
          className="flex-shrink-0 p-0.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          aria-label="Mostrar ajuda"
          aria-expanded={isOpen}
        >
          <HelpCircle className="w-4 h-4 text-gray-400 hover:text-primary-600 dark:hover:text-primary-400" />
        </button>
      )}

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={tooltipRef}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={cn(
              'absolute z-50',
              positionClasses[computedPosition]
            )}
            style={{ maxWidth }}
            role="tooltip"
          >
            <div className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden">
              {/* Close button (only when pinned) */}
              {isPinned && (
                <button
                  onClick={handleClose}
                  className="absolute top-2 right-2 p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors z-10"
                  aria-label="Fechar"
                >
                  <X className="w-3 h-3 text-gray-500" />
                </button>
              )}

              <div className="p-4 space-y-3">
                {/* Description */}
                {content.description && (
                  <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {content.description}
                  </div>
                )}

                {/* Example */}
                {content.example && (
                  <div className="p-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-md">
                    <div className="text-xs font-semibold text-primary-700 dark:text-primary-400 uppercase tracking-wide mb-1">
                      Exemplo
                    </div>
                    <div className="text-sm text-primary-900 dark:text-primary-100 font-mono">
                      {content.example}
                    </div>
                  </div>
                )}

                {/* Help Text */}
                {content.helpText && (
                  <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-start gap-2">
                      <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <span className="text-xs">💡</span>
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                        {content.helpText}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Arrow */}
              <div
                className={cn(
                  'absolute w-3 h-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 transform rotate-45',
                  {
                    'bottom-full left-1/2 -translate-x-1/2 translate-y-1/2 border-t-0 border-l-0':
                      computedPosition === 'top',
                    'top-full left-1/2 -translate-x-1/2 -translate-y-1/2 border-b-0 border-r-0':
                      computedPosition === 'bottom',
                    'right-full top-1/2 -translate-y-1/2 translate-x-1/2 border-t-0 border-r-0':
                      computedPosition === 'left',
                    'left-full top-1/2 -translate-y-1/2 -translate-x-1/2 border-b-0 border-l-0':
                      computedPosition === 'right',
                  }
                )}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SmartTooltip;
