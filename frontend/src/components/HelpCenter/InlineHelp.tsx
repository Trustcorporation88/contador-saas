import { FC, ReactNode } from 'react';
import { Info, BookOpen, ExternalLink } from 'lucide-react';
import { cn } from '../../utils/cn';

export interface InlineHelpAction {
  label: string;
  href?: string;
  onClick?: () => void;
  external?: boolean;
}

export interface InlineHelpProps {
  /** Título curto (opcional). Default: "Como funciona" */
  title?: string;
  /** Conteúdo principal — texto ou JSX rico. */
  children: ReactNode;
  /** Ações secundárias (ex.: "Ver documentação completa"). */
  actions?: InlineHelpAction[];
  /** Variante visual */
  variant?: 'default' | 'subtle' | 'highlight';
  /** Ícone customizado (default: BookOpen) */
  icon?: ReactNode;
  className?: string;
}

const variantClasses = {
  default:
    'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100',
  subtle:
    'bg-gray-50 dark:bg-gray-800/40 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200',
  highlight:
    'bg-gradient-to-br from-primary-50 to-blue-50 dark:from-primary-900/20 dark:to-blue-900/20 border-primary-200 dark:border-primary-800 text-gray-800 dark:text-gray-100',
};

/**
 * InlineHelp — bloco de ajuda contextual embutido em páginas/formulários.
 *
 * Diferente do `QuickTip` (alerta curto) e do `SmartTooltip` (popup),
 * o InlineHelp é um *card explicativo* que fica permanentemente visível
 * para guiar o usuário em uma seção/fluxo.
 *
 * @example
 * <InlineHelp
 *   title="Como funciona a apuração do DAS"
 *   actions={[{ label: 'Ver documentação completa', href: '/docs/servicos/fiscal/DAS-APURACAO.md', external: true }]}
 * >
 *   O DAS é apurado mensalmente com base no faturamento dos últimos 12 meses.
 *   Confira os valores antes de gerar a guia.
 * </InlineHelp>
 */
export const InlineHelp: FC<InlineHelpProps> = ({
  title = 'Como funciona',
  children,
  actions,
  variant = 'default',
  icon,
  className,
}) => {
  const IconNode = icon ?? <BookOpen className="w-5 h-5" aria-hidden="true" />;

  return (
    <aside
      className={cn(
        'rounded-xl border p-4 sm:p-5',
        variantClasses[variant],
        className
      )}
      role="region"
      aria-label={title}
    >
      <header className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5 opacity-80">{IconNode}</div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold leading-tight">{title}</h3>
        </div>
      </header>

      <div className="mt-3 pl-8 text-sm leading-relaxed">
        {children}
      </div>

      {actions && actions.length > 0 && (
        <footer className="mt-4 pl-8 flex flex-wrap items-center gap-3">
          {actions.map((action, i) => {
            const content = (
              <span className="inline-flex items-center gap-1.5">
                {action.label}
                {action.external && <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />}
              </span>
            );

            if (action.href) {
              return (
                <a
                  key={i}
                  href={action.href}
                  target={action.external ? '_blank' : undefined}
                  rel={action.external ? 'noopener noreferrer' : undefined}
                  className="text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current rounded"
                >
                  {content}
                </a>
              );
            }

            return (
              <button
                key={i}
                type="button"
                onClick={action.onClick}
                className="text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current rounded"
              >
                {content}
              </button>
            );
          })}
        </footer>
      )}
    </aside>
  );
};

/** Versão compacta (uma linha) — útil acima de tabelas/listas. */
export const InlineHelpCompact: FC<Pick<InlineHelpProps, 'children' | 'className'>> = ({
  children,
  className,
}) => (
  <div
    className={cn(
      'flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50/60 px-3 py-2 text-xs text-blue-900 dark:border-blue-800 dark:bg-blue-900/20 dark:text-blue-100',
      className
    )}
    role="note"
  >
    <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" aria-hidden="true" />
    <div className="flex-1 leading-relaxed">{children}</div>
  </div>
);

export default InlineHelp;
