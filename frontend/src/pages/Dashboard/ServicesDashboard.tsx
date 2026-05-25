import { FC, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  Building2,
  Command,
  ListTodo,
  Search,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import { ServiceCard, ServiceCardSkeleton } from '../../components/ServiceCard';
import { SearchModal } from '../../components/ServiceCard/SearchModal';
import { CATEGORIES, getServicesByCategory } from '../../config/services';
import { useServiceSearch, useServiceSearchShortcut } from '../../hooks/useServiceSearch';
import { ServiceCategory } from '../../types/service';
import { cn } from '../../utils/cn';

export const ServicesDashboard: FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | 'all'>('all');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLoading] = useState(false);

  useServiceSearchShortcut(() => setIsSearchOpen(true));

  const filteredServices = useServiceSearch(searchQuery, {
    category: selectedCategory,
    status: 'all',
  });

  const servicesByCategory = useMemo(() => {
    if (selectedCategory !== 'all') {
      return {
        [selectedCategory]: getServicesByCategory(selectedCategory),
      };
    }

    const grouped: Record<string, typeof filteredServices> = {};
    Object.keys(CATEGORIES).forEach((cat) => {
      const categoryServices = filteredServices.filter((service) => service.category === cat);
      if (categoryServices.length > 0) {
        grouped[cat] = categoryServices;
      }
    });
    return grouped;
  }, [selectedCategory, filteredServices]);

  const automatedServices = filteredServices.filter((service) => service.automated);
  const servicesWithHelp = filteredServices.filter((service) => service.help);
  const urgentServices = filteredServices.filter(
    (service) => service.status === 'warning' || service.status === 'error'
  );

  return (
    <div className="min-h-screen bg-[#030712] text-white">
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(59,130,246,0.18),_transparent_30%),radial-gradient(circle_at_80%_20%,_rgba(16,185,129,0.12),_transparent_20%)]" />

      <header className="sticky top-0 z-40 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-300">
              Pro Contador
            </p>
            <h1 className="mt-2 text-xl font-bold text-white sm:text-2xl break-words">
              Dashboard operacional estilo streaming
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-300">
              Serviços críticos, automações de guias e pontos de input organizados para operação
              contábil, fiscal e financeira com mais clareza.
            </p>
          </div>

          <div className="w-full sm:w-auto sm:min-w-[340px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar serviços... (Ctrl+K)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchOpen(true)}
                className={cn(
                  'w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-10 pr-12',
                  'text-white placeholder:text-slate-400',
                  'focus:border-sky-400/40 focus:outline-none focus:ring-2 focus:ring-sky-400/20'
                )}
              />
              <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1 text-xs text-slate-400">
                <Command className="h-3 w-3" />
                <span>K</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-7xl px-4 pb-12 pt-8 sm:px-6 lg:px-8">
        <section className="overflow-hidden rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.96),rgba(30,41,59,0.92))] shadow-[0_30px_80px_rgba(2,6,23,0.45)]">
          <div className="grid gap-8 px-6 py-8 lg:grid-cols-[1.5fr,1fr] lg:px-8 lg:py-10">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
                <Sparkles className="h-3.5 w-3.5" />
                Guias e rotinas com foco em automação
              </div>

              <h2 className="mt-4 max-w-2xl text-3xl font-semibold leading-tight text-white sm:text-4xl">
                Priorize entregas do mês, acompanhe inputs e destaque o que pode rodar no automático
              </h2>

              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-300">
                Cada serviço com input manual passa a exibir orientação contextual. Os módulos com
                automação de guias e conciliação ficam sinalizados para acelerar a operação do
                escritório.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm text-sky-100">
                  Netflix-style cards
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                  Ajuda contextual para imputação
                </div>
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                  Geração de guias automatizável
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/15">
                    <Building2 className="h-5 w-5 text-sky-300" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">12</div>
                    <div className="text-xs text-slate-400">Empresas</div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/15">
                    <AlertTriangle className="h-5 w-5 text-amber-300" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">{urgentServices.length || 3}</div>
                    <div className="text-xs text-slate-400">Alertas</div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/15">
                    <ListTodo className="h-5 w-5 text-violet-300" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">{servicesWithHelp.length}</div>
                    <div className="text-xs text-slate-400">Serviços com ajuda</div>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/5 p-4 backdrop-blur">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/15">
                    <TrendingUp className="h-5 w-5 text-emerald-300" />
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-white">{automatedServices.length}</div>
                    <div className="text-xs text-slate-400">Automações ativas</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-3">
          <Link to="/impostos/das" className="rounded-[28px] border border-white/10 bg-white/5 p-5 hover:bg-white/10 transition-colors block text-left">
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
              Em destaque
            </div>
            <div className="mt-3 text-lg font-semibold text-white">Apuração DAS automatizada</div>
            <p className="mt-2 text-sm text-slate-300">
              Conferência de receita, cálculo da guia e alerta de vencimento no mesmo fluxo.
            </p>
          </Link>

          <Link to="/impostos/das" className="rounded-[28px] border border-white/10 bg-white/5 p-5 hover:bg-white/10 transition-colors block text-left">
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
              Inputs guiados
            </div>
            <div className="mt-3 text-lg font-semibold text-white">Ícones de explicação</div>
            <p className="mt-2 text-sm text-slate-300">
              Serviços com dados manuais mostram como imputar, exemplos e o que é obrigatório.
            </p>
          </Link>

          <Link to="/impostos/das" className="rounded-[28px] border border-white/10 bg-white/5 p-5 hover:bg-white/10 transition-colors block text-left">
            <div className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">
              Prioridade operacional
            </div>
            <div className="mt-3 text-lg font-semibold text-white">Fiscal + Financeiro</div>
            <p className="mt-2 text-sm text-slate-300">
              Fluxos de guias, conciliação e importação bancária aparecem primeiro para acelerar a
              rotina.
            </p>
          </Link>
        </section>

        <section className="mt-8">
          <div className="flex flex-wrap gap-2 pb-2">
            <button
              onClick={() => setSelectedCategory('all')}
              className={cn(
                'whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-all',
                selectedCategory === 'all'
                  ? 'border-sky-400/40 bg-sky-500/20 text-white'
                  : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
              )}
            >
              Todos os Serviços
            </button>

            {Object.entries(CATEGORIES).map(([key, config]) => {
              const Icon = config.icon;
              return (
                <button
                  key={key}
                  onClick={() => setSelectedCategory(key as ServiceCategory)}
                  className={cn(
                    'flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 text-sm font-medium transition-all',
                    selectedCategory === key
                      ? 'border-sky-400/40 bg-sky-500/20 text-white'
                      : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {config.name}
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-10 space-y-12">
          {searchQuery && (
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-300">
              {filteredServices.length} resultado(s) para "{searchQuery}"
            </div>
          )}

          <AnimatePresence mode="wait">
            {isLoading ? (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <ServiceCardSkeleton key={i} />
                ))}
              </div>
            ) : (
              <div className="space-y-12">
                {Object.entries(servicesByCategory).map(([category, services]) => {
                  const categoryConfig = CATEGORIES[category as ServiceCategory];
                  const CategoryIcon = categoryConfig.icon;

                  return (
                    <motion.section
                      key={category}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      transition={{ duration: 0.3 }}
                    >
                      <div className="mb-6 flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5">
                          <CategoryIcon className="h-5 w-5 text-sky-300" />
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-white">{categoryConfig.name}</h2>
                          <p className="text-sm text-slate-400">{categoryConfig.description}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
                        {services.map((service) => (
                          <motion.div
                            key={service.id}
                            initial={{ opacity: 0, scale: 0.97 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.2 }}
                          >
                            <ServiceCard {...service} />
                          </motion.div>
                        ))}
                      </div>
                    </motion.section>
                  );
                })}

                {filteredServices.length === 0 && (
                  <div className="rounded-3xl border border-dashed border-white/10 py-16 text-center">
                    <p className="text-slate-400">Nenhum serviço encontrado</p>
                  </div>
                )}
              </div>
            )}
          </AnimatePresence>
        </section>
      </main>
    </div>
  );
};
