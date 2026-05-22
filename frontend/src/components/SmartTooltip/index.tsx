/**
 * SmartTooltip — barrel re-export + simplified wrapper for inline field help.
 *
 * The full, production-ready component lives in SmartTooltip.tsx (animation,
 * auto-position, keyboard-a11y).  This index.tsx also exports a simpler
 * `FieldTooltip` wrapper that accepts the flat props used by `FieldHelp` from
 * servicesHelp.ts so form pages don't need to construct `SmartTooltipContent`
 * objects manually.
 *
 * Usage (production):
 *   import { SmartTooltip } from '@/components/SmartTooltip';
 *   <SmartTooltip content={{ description, example, helpText }}>
 *     <label>…</label>
 *   </SmartTooltip>
 *
 * Usage (simplified):
 *   import { FieldTooltip } from '@/components/SmartTooltip';
 *   <FieldTooltip field={fieldHelp}>
 *     <input … />
 *   </FieldTooltip>
 */

// Re-export the full component & types
export { SmartTooltip, type SmartTooltipProps, type SmartTooltipContent } from './SmartTooltip';
export { default } from './SmartTooltip';

// ── Simplified FieldTooltip ────────────────────────────────────────────────
import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { type FieldHelp } from '../../config/servicesHelp';

interface FieldTooltipProps {
  /** FieldHelp object from SERVICES_HELP.fields */
  field: FieldHelp;
  /** The form control to wrap */
  children: React.ReactNode;
}

/**
 * FieldTooltip — drop-in wrapper for form inputs.
 * Renders the child input followed by a ❓ icon.
 * Hover shows a tooltip; click pins it open.
 */
export function FieldTooltip({ field, children }: FieldTooltipProps) {
  const [isOpen, setIsOpen]   = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close pinned tooltip on outside click
  useEffect(() => {
    if (!isPinned) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsPinned(false);
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isPinned]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setIsPinned(false); setIsOpen(false); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const open  = () => { if (!isPinned) setIsOpen(true); };
  const close = () => { if (!isPinned) setIsOpen(false); };
  const toggle = () => {
    const next = !isPinned;
    setIsPinned(next);
    setIsOpen(next);
  };

  return (
    <div ref={ref} className="relative w-full">
      {/* Input row */}
      <div className="flex items-center gap-1.5">
        <div className="flex-1 min-w-0">{children}</div>

        <button
          type="button"
          onMouseEnter={open}
          onMouseLeave={close}
          onClick={toggle}
          className="flex-shrink-0 text-gray-400 hover:text-blue-500 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
          aria-label={`Ajuda sobre o campo ${field.label}`}
          aria-expanded={isOpen}
        >
          <HelpCircle className="w-4 h-4" />
        </button>
      </div>

      {/* Tooltip panel */}
      {isOpen && (
        <div
          role="tooltip"
          className="absolute right-0 z-50 mt-2 w-80 rounded-lg border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-800"
        >
          {/* Close button (only when pinned) */}
          {isPinned && (
            <button
              onClick={() => { setIsPinned(false); setIsOpen(false); }}
              className="absolute right-2 top-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="Fechar ajuda"
            >
              <X className="h-3 w-3" />
            </button>
          )}

          <div className="space-y-2 p-4">
            {/* Required badge */}
            {field.required && (
              <span className="inline-block rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
                Campo obrigatório
              </span>
            )}

            {/* Description */}
            <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
              {field.description}
            </p>

            {/* Example */}
            {field.example && (
              <div className="rounded bg-blue-50 p-2 dark:bg-blue-900/20">
                <p className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                  Exemplo
                </p>
                <p className="font-mono text-xs text-blue-900 dark:text-blue-100">
                  {field.example}
                </p>
              </div>
            )}

            {/* Tips */}
            {field.tips && field.tips.length > 0 && (
              <div>
                <p className="mb-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                  💡 Dicas:
                </p>
                <ul className="space-y-0.5">
                  {field.tips.map((tip, i) => (
                    <li key={i} className="text-xs text-gray-600 dark:text-gray-400">
                      • {tip}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {isPinned && (
              <p className="text-right text-xs text-blue-400">Clique no ✕ ou fora para fechar</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
