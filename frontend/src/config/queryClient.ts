import { QueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/authStore';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 min
      retry: 1,
    },
  },
});

/**
 * Descarta todo o cache quando a empresa ativa muda.
 *
 * A chave de cada query deveria conter o companyId — e a maioria contém. Mas
 * numa tela contábil, uma que esqueça a chave mostra os números da empresa
 * ANTERIOR sob o nome da nova, e o usuário registra pagamento na empresa errada
 * sem nenhuma pista visual. A rede de segurança fica aqui, num único lugar, em
 * vez de depender de cada tela nova lembrar da convenção.
 *
 * removeQueries e não invalidateQueries: invalidar mantém o dado antigo em tela
 * enquanto o refetch acontece. Aqui o certo é não ter dado nenhum — a tela mostra
 * carregando e nunca um valor de outra empresa.
 *
 * A assinatura fica no módulo do queryClient (e não no store) para o store não
 * depender da camada de dados, e para valer para qualquer origem da troca.
 */
let lastCompanyId = useAuthStore.getState().currentCompanyId;

useAuthStore.subscribe((state) => {
  if (state.currentCompanyId === lastCompanyId) return;
  const previous = lastCompanyId;
  lastCompanyId = state.currentCompanyId;
  // Na primeira seleção (null -> empresa) não há dado de outra empresa em cache.
  if (previous === null) return;
  queryClient.removeQueries();
});

export default queryClient;
