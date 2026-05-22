import type { ReactNode } from 'react';
import { clsx } from 'clsx';

interface KpiCardProps {
  label: string;
  value: string;
  detail?: string;
  footnote?: string;
  tone?: 'default' | 'positive' | 'negative';
  icon?: ReactNode;
}

export function KpiCard({
  label,
  value,
  detail,
  footnote,
  tone = 'default',
  icon,
}: KpiCardProps) {
  return (
    <div className="kpi-card">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p className="kpi-label">{label}</p>
          <p className={clsx(
            'kpi-value',
            tone === 'positive' && 'text-emerald-700',
            tone === 'negative' && 'text-red-700'
          )}>
            {value}
          </p>
          {detail && <p className="kpi-detail">{detail}</p>}
          {footnote && (
            <p className={clsx(
              'mt-3 text-sm font-semibold',
              tone === 'negative' ? 'text-red-600' : 'text-emerald-600'
            )}>
              {footnote}
            </p>
          )}
        </div>
        {icon ? (
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-2xl bg-primary-50 text-primary-700 ring-1 ring-primary-100">
            {icon}
          </div>
        ) : null}
      </div>
    </div>
  );
}