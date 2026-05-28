import { FC, useState, useRef, useEffect, ReactNode } from 'react';
import { createPortal } from 'react-dom';
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
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Calcula posição do tooltip em relação à viewport
  useEffect(() => {
    if (!isOpen || !triggerRef.current) return;

    const trigger = triggerRef.current;
    const triggerRect = trigger.getBoundingClientRect();

    // Estima tamanho do tooltip
    const estimatedHeight = 200;
    const estimatedWidth = maxWidth;

    let newPosition = position;
    let top = 0;
    let left = 0;

    if (position === 'auto') {
      const spaceTop = triggerRect.top;
      const spaceBottom = window.innerHeight - triggerRect.bottom;
      const spaceLeft = triggerRect.left;
      const spaceRight = window.innerWidth - triggerRect.right;

      if (spaceBottom >= estimatedHeight) {
        newPosition = 'bottom';
      } else if (spaceTop >= estimatedHeight) {
        newPosition = 'top';
      } else if (spaceRight >= estimatedWidth) {
        newPosition = 'right';
      } else {
        newPosition = 'left';
      }
    }

    // Calcula posição absoluta em relação à viewport
    switch (newPosition) {
      case 'top':
        top = triggerRect.top - estimatedHeight - 8;
        left = triggerRect.left + triggerRect.width / 2 - estimatedWidth / 2;
        break;
      case 'bottom':
        top = triggerRect.bottom + 8;
        left = triggerRect.left + triggerRect.width / 2 - estimatedWidth / 2;
        break;
      case 'left':
        top = triggerRect.top + triggerRect.height / 2 - estimatedHeight / 2;
        left = triggerRect.left - estimatedWidth - 8;
        break;
      case 'right':
        top = triggerRect.top + triggerRect.height / 2 - estimatedHeight / 2;
        left = triggerRect.right + 8;
        break;
    }

    // Garante que não sai da tela
    left = Math.max(8, Math.min(left, window.innerWidth - estimatedWidth - 8));
    top = Math.max(8, Math.min(top, window.innerHeight - estimatedHeight - 8));

    setComputedPosition(newPosition);
    setTooltipPos({ top, left });
  }, [isOpen, position, maxWidth]);

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

  const tooltipContent = (
    <motion.div
      ref={tooltipRef}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      className="fixed z-[9999]"
      style={{
        top: `${tooltipPos.top}px`,
        left: `${tooltipPos.left}px`,
        maxWidth,
      }}
      role="tooltip"
    >
      <div className="relative bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl overflow-hidden">
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
          {content.description && (
            <div className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
              {content.description}
            </div>
          )}

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
      </div>
    </motion.div>
  );

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
        {isOpen && typeof document !== 'undefined' && createPortal(tooltipContent, document.body)}
      </AnimatePresence>
    </div>
  );
};

export default SmartTooltip;
