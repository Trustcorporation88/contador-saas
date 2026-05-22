import { Activity, BookOpen, CheckCircle2, FlaskConical, Layers3 } from 'lucide-react';
import { getOperationalStatusMeta, serviceCatalog } from '../../config/serviceCatalog';

export default function ServicesCatalogPage() {
  const counts = {
    operacional: serviceCatalog.filter((item) => item.status === 'operacional').length,
    hibrido: serviceCatalog.filter((item) => item.status === 'hibrido').length,
    simulado: serviceCatalog.filter((item) => item.status === 'simulado').length,
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="glass-strip px-5 py-5 sm:px-6">
        <p className="shell-title">Revisão operacional</p>
        <h1 className="mt-2 flex items-center gap-2 text-xl font-extrabold tracking-tight text-ink-900">
          <Layers3 className="h-5 w-5 text-primary-700" />
          Guia Operacional dos Serviços
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-500">
          Esta pagina resume o estado real de cada serviço do produto, quais dados precisam ser inseridos e como obter o melhor resultado em cada modulo.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="kpi-card">
          <p className="kpi-label">Serviços operacionais</p>
          <p className="kpi-value text-emerald-700">{counts.operacional}</p>
          <p className="kpi-detail">Fluxos conectados ao backend e aptos para uso real.</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Serviços híbridos</p>
          <p className="kpi-value text-amber-700">{counts.hibrido}</p>
          <p className="kpi-detail">Dependem de dados reais, mas ainda usam motor analítico local.</p>
        </div>
        <div className="kpi-card">
          <p className="kpi-label">Serviços simulados</p>
          <p className="kpi-value text-slate-700">{counts.simulado}</p>
          <p className="kpi-detail">Ainda precisam de integração real para produção completa.</p>
        </div>
      </div>

      <div className="space-y-4">
        {serviceCatalog.map((service) => {
          const status = getOperationalStatusMeta(service.status);
          return (
            <section key={service.path} className="card card-body">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-ink-900">{service.title}</h2>
                    <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-[0.18em] ${status.cls}`}>
                      {status.label}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-ink-500">{service.summary}</p>
                </div>
                <div className="rounded-2xl border border-white/70 bg-white/60 px-3 py-2 text-xs text-ink-500">
                  Rota: <span className="font-semibold text-ink-800">{service.path}</span>
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                <div className="rounded-2xl border border-ink-100 bg-white/70 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                    <BookOpen className="h-4 w-4 text-primary-700" />
                    Como funciona
                  </div>
                  <p className="mt-3 text-sm leading-6 text-ink-600">{service.howItWorks}</p>
                </div>

                <div className="rounded-2xl border border-ink-100 bg-white/70 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                    <Activity className="h-4 w-4 text-primary-700" />
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

                <div className="rounded-2xl border border-ink-100 bg-white/70 p-4">
                  <div className="flex items-center gap-2 text-sm font-semibold text-ink-900">
                    {service.status === 'simulado' ? <FlaskConical className="h-4 w-4 text-primary-700" /> : <CheckCircle2 className="h-4 w-4 text-primary-700" />}
                    Melhor uso
                  </div>
                  <ul className="mt-3 space-y-2 text-sm text-ink-600">
                    {service.bestResultsTips.map((item) => (
                      <li key={item} className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary-500" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-ink-100 bg-gray-50/80 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink-500">Fonte de dados</p>
                  <ul className="mt-3 space-y-2 text-sm text-ink-600">
                    {service.dataSources.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="rounded-2xl border border-ink-100 bg-gray-50/80 p-4">
                  <p className="text-xs font-bold uppercase tracking-[0.2em] text-ink-500">Observações operacionais</p>
                  <ul className="mt-3 space-y-2 text-sm text-ink-600">
                    {(service.notes?.length ? service.notes : ['Sem observações críticas adicionais.']).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                    {service.backendRoutes?.map((item) => (
                      <li key={item}>Endpoint relacionado: {item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}