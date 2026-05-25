import { FC, ReactNode, useState } from 'react';
import { ChevronDown, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../utils/cn';

export interface FAQItem {
  question: string;
  answer: ReactNode;
  /** Tags para filtro/busca (opcional) */
  tags?: string[];
}

export interface FAQProps {
  items: FAQItem[];
  /** Título da seção. Default: "Perguntas frequentes" */
  title?: string;
  /** Permitir várias abertas ao mesmo tempo. Default: false (estilo accordion). */
  allowMultiple?: boolean;
  /** Mostra campo de busca. */
  searchable?: boolean;
  className?: string;
}

/**
 * FAQ — componente de perguntas frequentes (accordion).
 *
 * Features:
 * - Abre/fecha por clique (com animação)
 * - Modo accordion (1 aberta por vez) ou múltiplas
 * - Busca opcional por pergunta/resposta/tag
 * - Totalmente acessível (aria-expanded, keyboard)
 *
 * @example
 * <FAQ
 *   searchable
 *   items={[
 *     { question: 'Posso cancelar uma NFe?', answer: 'Sim, em até 24h após a emissão...' },
 *   ]}
 * />
 */
export const FAQ: FC<FAQProps> = ({
  items,
  title = 'Perguntas frequentes',
  allowMultiple = false,
  searchable = false,
  className,
}) => {
  const [openIndices, setOpenIndices] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState('');

  const toggle = (index: number) => {
    setOpenIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        if (!allowMultiple) next.clear();
        next.add(index);
      }
      return next;
    });
  };

  const filtered = items.filter((item) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    const inQ = item.question.toLowerCase().includes(q);
    const inA =
      typeof item.answer === 'string' &&
      item.answer.toLowerCase().includes(q);
    const inT = item.tags?.some((t) => t.toLowerCase().includes(q));
    return inQ || inA || !!inT;
  });

  return (
    <section className={cn('w-full', className)} aria-label={title}>
      <header className="mb-4 flex items-center gap-2">
        <HelpCircle className="h-5 w-5 text-primary-600 dark:text-primary-400" aria-hidden="true" />
        <h2 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h2>
      </header>

      {searchable && (
        <div className="mb-4">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar pergunta..."
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            aria-label="Buscar nas perguntas frequentes"
          />
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center text-sm text-gray-500 dark:border-gray-700 dark:bg-gray-800/40">
          Nenhuma pergunta corresponde à busca.
        </p>
      ) : (
        <ul className="divide-y divide-gray-200 overflow-hidden rounded-xl border border-gray-200 bg-white dark:divide-gray-700 dark:border-gray-700 dark:bg-gray-800/40">
          {filtered.map((item, i) => {
            const isOpen = openIndices.has(i);
            const headerId = `faq-h-${i}`;
            const panelId = `faq-p-${i}`;

            return (
              <li key={i}>
                <h3>
                  <button
                    type="button"
                    onClick={() => toggle(i)}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    id={headerId}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-none dark:text-white dark:hover:bg-gray-700/40 dark:focus-visible:bg-gray-700/40"
                  >
                    <span className="flex-1">{item.question}</span>
                    <motion.span
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="flex-shrink-0"
                    >
                      <ChevronDown className="h-4 w-4 text-gray-500" aria-hidden="true" />
                    </motion.span>
                  </button>
                </h3>

                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="content"
                      id={panelId}
                      role="region"
                      aria-labelledby={headerId}
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 pt-1 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                        {item.answer}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default FAQ;
