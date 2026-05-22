import { FC, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Building2, AlertTriangle, ListTodo, TrendingUp, Command } from 'lucide-react';
import { ServiceCard, ServiceCardSkeleton } from '../../components/ServiceCard';
import { SearchModal } from '../../components/ServiceCard/SearchModal';
import { useServiceSearch, useServiceSearchShortcut } from '../../hooks/useServiceSearch';
import { CATEGORIES, getServicesByCategory } from '../../config/services';
import { ServiceCategory } from '../../types/service';
import { cn } from '../../utils/cn';

export const ServicesDashboard: FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<ServiceCategory | 'all'>('all');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isLoading] = useState(false);

  // Keyboard shortcut for search (Ctrl+K / Cmd+K)
  useServiceSearchShortcut(() => setIsSearchOpen(true));

  // Search and filter services
  const filteredServices = useServiceSearch(searchQuery, {
    category: selectedCategory,
    status: 'all',
  });

  // Group services by category for display
  const servicesByCategory = useMemo(() => {
    if (selectedCategory !== 'all') {
      return {
        [selectedCategory]: getServicesByCategory(selectedCategory),
      };
    }

    const grouped: Record<string, typeof filteredServices> = {};
    Object.keys(CATEGORIES).forEach((cat) => {
      const categoryServices = filteredServices.filter(
        (service) => service.category === cat
      );
      if (categoryServices.length > 0) {
        grouped[cat] = categoryServices;
      }
    });
    return grouped;
  }, [selectedCategory, filteredServices]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Search Modal */}
      <SearchModal isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />

      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Bem-vindo ao Contador
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Selecione um serviço para começar
              </p>
            </div>

            {/* Search Bar */}
            <div className="w-full sm:w-auto sm:min-w-[320px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar serviços... (Ctrl+K)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchOpen(true)}
                  className={cn(
                    'w-full pl-10 pr-10 py-2.5 rounded-lg border-2',
                    'bg-white dark:bg-gray-800',
                    'border-gray-200 dark:border-gray-700',
                    'focus:border-primary-500 focus:ring-2 focus:ring-primary-200 dark:focus:ring-primary-900',
                    'text-gray-900 dark:text-white',
                    'placeholder:text-gray-400',
                    'transition-all duration-200'
                  )}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-gray-400">
                  <Command className="w-3 h-3" />
                  <span>K</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Executive Summary */}
      <section className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">12</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Empresas</div>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">3</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Alertas</div>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <ListTodo className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">7</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Tarefas</div>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">85%</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">Progresso</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Category Filters */}
      <section className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <button
              onClick={() => setSelectedCategory('all')}
              className={cn(
                'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all',
                selectedCategory === 'all'
                  ? 'bg-primary-600 text-white shadow-md'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
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
                    'px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all',
                    'flex items-center gap-2',
                    selectedCategory === key
                      ? 'bg-primary-600 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {config.name}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Services Grid */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {searchQuery && (
          <div className="mb-6">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {filteredServices.length} resultado(s) para "{searchQuery}"
            </p>
          </div>
        )}

        <AnimatePresence mode="wait">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
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
                    {/* Category Header */}
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                        <CategoryIcon className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                          {categoryConfig.name}
                        </h2>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {categoryConfig.description}
                        </p>
                      </div>
                    </div>

                    {/* Services Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                      {services.map((service) => (
                        <motion.div
                          key={service.id}
                          initial={{ opacity: 0, scale: 0.95 }}
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
                <div className="text-center py-12">
                  <p className="text-gray-600 dark:text-gray-400">
                    Nenhum serviço encontrado
                  </p>
                </div>
              )}
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};
