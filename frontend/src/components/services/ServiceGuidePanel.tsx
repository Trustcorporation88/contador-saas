import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { BookOpen, Database, Gauge, Sparkles } from 'lucide-react';
import { getOperationalStatusMeta, getServiceDefinition } from '../../config/serviceCatalog';

export default function ServiceGuidePanel() {
  const location = useLocation();
  const service = useMemo(() => getServiceDefinition(location.pathname), [location.pathname]);

  if (!service) return null;

  const status = getOperationalStatusMeta(service.status);

  return (
    <section className="mx-auto mt-4 w-full max-w-[1680px] px-4 sm:px-6">
      <details className="glass-strip group overflow-hidden" open>
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="shell-title">Guia do serviço</span>
              <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.18em] ${status.cls}`}>
                {status.label}
              </span>
            </div>
            <p className="mt-2 text-sm font-semibold text-ink-900">{service.title}</p>
            <p className="mt-1 text-sm text-ink-500">{service.summary}</p>
          </div>
          <div className="text-xs font-semibold text-primary-700 group-open:hidden">Mostrar detalhes</div>
        </summary>

        <div className="grid gap-4 border-t border-white/70 px-5 py-5 sm:px-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/70 bg-white/70 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink-900">
              <BookOpen className="h-4 w-4 text-primary-700" />
              Como funciona
            </div>
            <p className="mt-3 text-sm leading-6 text-ink-600">{service.howItWorks}</p>
          </div>

          <div className="rounded-2xl border border-white/70 bg-white/70 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink-900">
              <Database className="h-4 w-4 text-primary-700" />
              Dados a inserir
            </div>
            <ul className="mt-3 space-y-2 text-sm text-ink-600">
              {service.requiredData.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-white/70 bg-white/70 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-ink-900">
              <Gauge className="h-4 w-4 text-primary-700" />
              Para melhor resultado
            </div>
            <ul className="mt-3 space-y-2 text-sm text-ink-600">
              {service.bestResultsTips.map((item) => (
                <li key={item} className="flex gap-2">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </details>
    </section>
  );
}