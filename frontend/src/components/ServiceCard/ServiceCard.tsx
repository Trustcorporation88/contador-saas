import { FC } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { Sparkles, TrendingDown, TrendingUp } from 'lucide-react';
import { SmartTooltip } from '../SmartTooltip';
import { Service, ServiceStatus } from '../../types/service';
import { cn } from '../../utils/cn';

export interface ServiceCardProps extends Service {
  className?: string;
}

const statusConfig: Record<ServiceStatus, { accent: string; badge: string }> = {
  active: {
    accent: 'from-sky-500/20 via-cyan-400/10 to-transparent',
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30',
  },
  warning: {
    accent: 'from-amber-500/25 via-orange-400/10 to-transparent',
    badge: 'bg-amber-500/15 text-amber-200 border-amber-400/30',
  },
  error: {
    accent: 'from-rose-500/25 via-red-400/10 to-transparent',
    badge: 'bg-rose-500/15 text-rose-200 border-rose-400/30',
  },
  disabled: {
    accent: 'from-slate-500/10 via-slate-400/5 to-transparent',
    badge: 'bg-slate-500/10 text-slate-400 border-slate-500/20',
  },
};

export const ServiceCard: FC<ServiceCardProps> = ({
  title,
  description,
  icon: Icon,
  category,
  route,
  externalUrl,
  status = 'active',
  badge,
  metrics,
  quickActions,
  help,
  automated,
  className,
}) => {
  const navigate = useNavigate();
  const isDisabled = status === 'disabled';
  const config = statusConfig[status];

  const helpContent = help
    ? {
        description: help.summary,
        example: help.examples?.join(' • '),
        helpText:
          help.requiredInputs && help.requiredInputs.length > 0
            ? `Dados para imputar: ${help.requiredInputs.join(', ')}${
                help.automation ? `. Automação: ${help.automation}` : ''
              }`
            : help.automation
              ? `Automação: ${help.automation}`
              : undefined,
      }
    : undefined;

  const handleClick = () => {
    if (isDisabled) return;
    if (externalUrl) {
      window.open(externalUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    navigate(route);
  };

  return (
    <motion.div
      whileHover={isDisabled ? {} : { scale: 1.02, y: -6 }}
      whileTap={isDisabled ? {} : { scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 280, damping: 24 }}
      onClick={handleClick}
      className={cn(
        'group relative overflow-hidden rounded-[28px] border border-white/10 p-6',
        'flex min-h-[280px] flex-col gap-4',
        'bg-[linear-gradient(180deg,rgba(15,23,42,0.98)_0%,rgba(17,24,39,0.96)_100%)]',
        'shadow-[0_18px_50px_rgba(2,6,23,0.42)] transition-all duration-300',
        automated && 'ring-1 ring-emerald-400/30',
        isDisabled
          ? 'cursor-not-allowed opacity-55'
          : 'cursor-pointer hover:shadow-[0_25px_70px_rgba(2,6,23,0.55)]',
        className
      )}
      role="button"
      tabIndex={isDisabled ? -1 : 0}
      aria-label={`${title} - ${description}`}
      aria-disabled={isDisabled}
    >
      <div className={cn('absolute inset-0 bg-gradient-to-br opacity-100', config.accent)} />
      <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/40 to-transparent" />

      {/* Linha 1: Ícone + Título + Tooltip */}
      <div className="relative flex items-center gap-3">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 backdrop-blur">
          <Icon className="h-6 w-6 text-white" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-white">{title}</h3>
            {helpContent && (
              <SmartTooltip content={helpContent} position="bottom">
                <span className="inline-flex items-center rounded-full border border-sky-400/20 bg-sky-500/10 px-2 py-0.5 text-[11px] font-medium text-sky-200">
                  Como imputar
                </span>
              </SmartTooltip>
            )}
          </div>
        </div>
      </div>

      {/* Linha 2: Categoria */}
      <p className="relative text-xs uppercase tracking-[0.18em] text-slate-400">{category}</p>

      {/* Linha 3: Badges (Automação + Status) */}
      {(automated || badge) && (
        <div className="relative flex flex-wrap items-center gap-2">
          {automated && (
            <div className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-200">
              <Sparkles className="h-3 w-3" />
              Automação
            </div>
          )}

          {badge && (
            <div
              className={cn(
                'rounded-full border px-2.5 py-1 text-[11px] font-medium backdrop-blur',
                config.badge
              )}
            >
              {badge}
            </div>
          )}
        </div>
      )}

      {/* Linha 4: Descrição */}
      <p className="relative line-clamp-3 text-sm leading-6 text-slate-300">{description}</p>

      {/* Métricas */}
      {metrics && metrics.length > 0 && (
        <div className="relative mt-1 flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-3 backdrop-blur-sm">
          {metrics.map((metric, index) => (
            <div key={index} className="flex items-center justify-between text-xs">
              <span className="text-slate-400">{metric.label}</span>
              <div className="flex items-center gap-1">
                <span className="font-semibold text-white">{metric.value}</span>
                {metric.trend && metric.trendValue && (
                  <span
                    className={cn(
                      'flex items-center gap-0.5 text-xs',
                      metric.trend === 'up' ? 'text-emerald-300' : 'text-rose-300'
                    )}
                  >
                    {metric.trend === 'up' ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {metric.trendValue}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Actions */}
      {quickActions && quickActions.length > 0 && !isDisabled && (
        <motion.div initial={{ opacity: 0, y: 10 }} whileHover={{ opacity: 1, y: 0 }} className="relative mt-auto pt-2">
          <div className="flex flex-wrap gap-2">
            {quickActions.map((action, index) => (
              <button
                key={index}
                onClick={(e) => {
                  e.stopPropagation();
                  action.onClick();
                }}
                className="rounded-xl bg-white px-3 py-1.5 text-xs font-medium text-slate-900 transition-colors hover:bg-slate-200"
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
