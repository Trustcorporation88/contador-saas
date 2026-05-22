# Dashboard Netflix - Quick Start Guide

## 🚀 Como Iniciar

### Desenvolvimento Local

```bash
# Instalar dependências
cd frontend
npm install

# Iniciar dev server
npm run dev

# Acesse: http://localhost:5173
```

## 📖 Exemplos de Uso

### 1. Adicionar Novo Serviço

Edite `frontend/src/config/services.ts`:

```typescript
import { FileInvoice } from 'lucide-react';

export const SERVICES: Service[] = [
  // ... serviços existentes
  
  // Novo serviço
  {
    id: 'nfse-emission',
    title: 'Emissão de NFSe',
    description: 'Emitir notas fiscais de serviço eletrônicas',
    icon: FileInvoice,
    category: 'fiscal',
    route: '/documentos/nfse/criar',
    status: 'active',
    metrics: [
      { label: 'Emitidas este mês', value: '89' },
      { label: 'Total faturado', value: 'R$ 156.000', trend: 'up', trendValue: '+8%' },
    ],
  },
];
```

### 2. Criar Nova Categoria

Edite `frontend/src/config/services.ts`:

```typescript
import { Briefcase } from 'lucide-react';

export const CATEGORIES: Record<ServiceCategory, CategoryConfig> = {
  // ... categorias existentes
  
  rh: {
    name: 'Recursos Humanos',
    color: 'indigo',
    icon: Briefcase,
    description: 'Gestão de folha de pagamento e eSocial',
  },
};
```

Atualizar tipo em `frontend/src/types/service.ts`:

```typescript
export type ServiceCategory = 
  | 'fiscal' 
  | 'financeiro' 
  | 'contabil' 
  | 'relatorios' 
  | 'gestao' 
  | 'auditoria'
  | 'rh'; // Nova categoria
```

### 3. Customizar Card com Quick Actions

```typescript
{
  id: 'nfe-emission',
  title: 'Emissão de NFe',
  description: 'Emitir e gerenciar notas fiscais eletrônicas',
  icon: FileText,
  category: 'fiscal',
  route: '/documentos/nfe/criar',
  quickActions: [
    {
      label: 'Nova NFe',
      onClick: () => navigate('/documentos/nfe/criar'),
    },
    {
      label: 'Consultar',
      onClick: () => navigate('/documentos/nfe/consultar'),
    },
    {
      label: 'Relatório',
      onClick: () => navigate('/relatorios/nfe'),
    },
  ],
}
```

### 4. Adicionar Badge Dinâmico

Com contador numérico:
```typescript
{
  id: 'contas-pagar',
  title: 'Contas a Pagar',
  // ...
  badge: 5, // Exibe "5"
}
```

Com texto customizado:
```typescript
{
  id: 'das-apuracao',
  title: 'Apuração DAS',
  // ...
  badge: 'Vence em 3 dias', // Exibe texto
  status: 'warning', // Badge amarelo
}
```

### 5. Métricas com Trends

```typescript
metrics: [
  {
    label: 'Faturamento',
    value: 'R$ 245.000',
    trend: 'up',           // up | down | neutral
    trendValue: '+12%',    // Mostrado com ícone de seta
  },
  {
    label: 'Custos',
    value: 'R$ 89.000',
    trend: 'down',         // Seta para baixo (vermelho)
    trendValue: '-5%',
  },
  {
    label: 'Total clientes',
    value: '156',          // Sem trend
  },
]
```

### 6. Customizar LoadingScreen

Edite `frontend/src/routes/index.tsx`:

```typescript
const LoadingScreen: React.FC = () => (
  <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
    <div className="text-center">
      {/* Spinner customizado */}
      <div className="relative w-16 h-16 mx-auto mb-4">
        <div className="absolute inset-0 border-4 border-primary-200 rounded-full"></div>
        <div className="absolute inset-0 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
      
      {/* Texto customizado */}
      <p className="text-gray-600 dark:text-gray-400 font-medium">
        Carregando...
      </p>
      
      {/* Subtítulo opcional */}
      <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
        Preparando seu dashboard
      </p>
    </div>
  </div>
);
```

### 7. Customizar Executive Summary

Edite `frontend/src/pages/Dashboard/ServicesDashboard.tsx`:

```typescript
{/* Executive Summary */}
<section className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      
      {/* KPI Card customizado */}
      <div className="p-4 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border border-blue-200 dark:border-blue-700">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-blue-500 flex items-center justify-center shadow-lg">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">12</div>
            <div className="text-xs font-medium text-blue-700 dark:text-blue-300">Empresas Ativas</div>
          </div>
        </div>
      </div>
      
      {/* Mais KPIs... */}
    </div>
  </div>
</section>
```

### 8. Integrar com API Real

Criar hook para buscar serviços do backend:

```typescript
// frontend/src/hooks/useServicesFromAPI.ts
import { useQuery } from '@tanstack/react-query';
import { servicesService } from '../services/servicesService';

export function useServicesFromAPI() {
  return useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const response = await servicesService.getAll();
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutos
  });
}
```

Usar no dashboard:

```typescript
export const ServicesDashboard: FC = () => {
  const { data: services, isLoading } = useServicesFromAPI();
  
  // ... resto do código
  
  if (isLoading) {
    return <ServiceCardSkeleton />;
  }
  
  // Usar services do backend
}
```

### 9. Persistir Favoritos

```typescript
// frontend/src/hooks/useFavorites.ts
import { useState, useEffect } from 'react';

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);
  
  useEffect(() => {
    const saved = localStorage.getItem('service-favorites');
    if (saved) {
      setFavorites(JSON.parse(saved));
    }
  }, []);
  
  const toggleFavorite = (serviceId: string) => {
    setFavorites(prev => {
      const updated = prev.includes(serviceId)
        ? prev.filter(id => id !== serviceId)
        : [...prev, serviceId];
      
      localStorage.setItem('service-favorites', JSON.stringify(updated));
      return updated;
    });
  };
  
  return { favorites, toggleFavorite };
}
```

Adicionar botão de favorito no ServiceCard:

```typescript
import { Star } from 'lucide-react';
import { useFavorites } from '../../hooks/useFavorites';

export const ServiceCard: FC<ServiceCardProps> = ({ id, ...props }) => {
  const { favorites, toggleFavorite } = useFavorites();
  const isFavorite = favorites.includes(id);
  
  return (
    <motion.div>
      {/* ... conteúdo do card */}
      
      <button
        onClick={(e) => {
          e.stopPropagation();
          toggleFavorite(id);
        }}
        className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100"
      >
        <Star 
          className={cn(
            "w-5 h-5",
            isFavorite ? "fill-yellow-400 text-yellow-400" : "text-gray-400"
          )}
        />
      </button>
    </motion.div>
  );
};
```

### 10. Analytics de Uso

```typescript
// frontend/src/hooks/useServiceAnalytics.ts
export function useServiceAnalytics() {
  const trackServiceClick = (serviceId: string) => {
    // Enviar para analytics
    window.gtag?.('event', 'service_click', {
      service_id: serviceId,
      timestamp: new Date().toISOString(),
    });
    
    // Salvar localmente para histórico
    const history = JSON.parse(
      localStorage.getItem('service-history') || '[]'
    );
    
    history.push({
      serviceId,
      timestamp: Date.now(),
    });
    
    // Manter últimos 50
    if (history.length > 50) {
      history.shift();
    }
    
    localStorage.setItem('service-history', JSON.stringify(history));
  };
  
  return { trackServiceClick };
}
```

## 🎨 Customizações de Tema

### Alterar Cores Primary

Edite `frontend/tailwind.config.ts`:

```typescript
export default {
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',  // Cor principal alterada
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
      },
    },
  },
}
```

### Adicionar Gradientes

```typescript
// No ServiceCard
<div className="bg-gradient-to-br from-primary-500 to-primary-700 text-white">
  {/* Conteúdo do card */}
</div>
```

### Animações Customizadas

```typescript
// tailwind.config.ts
export default {
  theme: {
    extend: {
      keyframes: {
        'slide-up': {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      animation: {
        'slide-up': 'slide-up 0.3s ease-out',
      },
    },
  },
}
```

Usar no componente:

```typescript
<div className="animate-slide-up">
  {/* Conteúdo */}
</div>
```

## 🔧 Troubleshooting

### Build Errors

**Erro:** `Cannot find module 'framer-motion'`
```bash
npm install framer-motion
```

**Erro:** TypeScript errors em testes
```bash
# Já configurado: tests são excluídos do build
# Ver tsconfig.json: "exclude": ["**/__tests__"]
```

### Performance Issues

**Cards lentos no mobile:**
```typescript
// Desabilitar animações complexas em mobile
const isMobile = window.innerWidth < 768;

<motion.div
  whileHover={isMobile ? {} : { scale: 1.03, y: -4 }}
  // ...
>
```

**Bundle muito grande:**
```bash
# Analisar bundle
npm run build -- --mode analyze

# Lazy load mais componentes
# Usar dynamic imports para ícones pesados
```

## 📚 Recursos Adicionais

- [Framer Motion Docs](https://www.framer.com/motion/)
- [Tailwind CSS Docs](https://tailwindcss.com/)
- [Lucide Icons](https://lucide.dev/)
- [React Router](https://reactrouter.com/)

## 💡 Dicas de Performance

1. **Use memo para cards estáticos:**
```typescript
export const ServiceCard = memo<ServiceCardProps>(({ ... }) => {
  // ...
});
```

2. **Lazy load ícones pesados:**
```typescript
const HeavyIcon = lazy(() => import('lucide-react').then(m => ({ default: m.FileSpreadsheet })));
```

3. **Virtualização para muitos cards:**
```bash
npm install @tanstack/react-virtual
```

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

const parentRef = useRef<HTMLDivElement>(null);

const virtualizer = useVirtualizer({
  count: services.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 320,
});
```

## ✨ Conclusão

Com este guia você pode:
- ✅ Adicionar novos serviços facilmente
- ✅ Customizar aparência e comportamento
- ✅ Integrar com APIs reais
- ✅ Adicionar analytics e favoritos
- ✅ Otimizar performance

Para mais detalhes, consulte a [documentação completa](./docs/design/DASHBOARD-IMPLEMENTATION.md).

---

**Happy coding!** 🚀
