/**
 * useServiceOnboarding — Hook para exibir o modal de onboarding na 1ª visita.
 *
 * Persiste no localStorage se o usuário já concluiu o onboarding de um serviço.
 * Na primeira visita, aguarda 500ms antes de abrir (evita flash de carregamento).
 *
 * @param serviceId - ID do serviço (ex: 'nfe-emissao', 'das-mensal')
 *
 * @example
 * ```tsx
 * function NFeEmissaoPage() {
 *   const { showOnboarding, completeOnboarding, resetOnboarding } =
 *     useServiceOnboarding('nfe-emissao');
 *
 *   return (
 *     <>
 *       {showOnboarding && (
 *         <ServiceOnboarding
 *           serviceId="nfe-emissao"
 *           onClose={completeOnboarding}
 *           onGoToForm={completeOnboarding}
 *         />
 *       )}
 *       <NFeForm />
 *       {/* Dev helper: reset onboarding *\/}
 *       <button onClick={resetOnboarding} className="text-xs text-gray-400">
 *         Resetar tour
 *       </button>
 *     </>
 *   );
 * }
 * ```
 */

import { useState, useEffect, useCallback } from 'react';

const STORAGE_PREFIX = 'onboarding_done_';

export function useServiceOnboarding(serviceId: string) {
  const storageKey = `${STORAGE_PREFIX}${serviceId}`;
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    // Reset state when serviceId changes (navigation between service pages)
    setShowOnboarding(false);

    try {
      const isDone = localStorage.getItem(storageKey) === 'true';
      if (!isDone) {
        // Small delay prevents flash during page load animations
        const timer = setTimeout(() => setShowOnboarding(true), 500);
        return () => clearTimeout(timer);
      }
    } catch {
      // localStorage unavailable (private browsing, sandboxed env) → skip onboarding
    }
  }, [serviceId, storageKey]);

  /** Mark onboarding as done and hide modal. */
  const completeOnboarding = useCallback(() => {
    try {
      localStorage.setItem(storageKey, 'true');
    } catch {
      // Fail silently if storage is unavailable
    }
    setShowOnboarding(false);
  }, [storageKey]);

  /** Force-show onboarding again (useful for "Ver tour" button). */
  const resetOnboarding = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // Fail silently
    }
    setShowOnboarding(true);
  }, [storageKey]);

  /** Check programmatically if onboarding was already seen. */
  const hasSeenOnboarding = useCallback((): boolean => {
    try {
      return localStorage.getItem(storageKey) === 'true';
    } catch {
      return false;
    }
  }, [storageKey]);

  return {
    /** Whether the onboarding modal should be rendered. */
    showOnboarding,
    /** Call when user completes or dismisses onboarding. Persists to localStorage. */
    completeOnboarding,
    /** Call to show onboarding again (e.g., from a "Ver tour" help button). */
    resetOnboarding,
    /** Returns true if user has already completed onboarding for this service. */
    hasSeenOnboarding,
  };
}

export default useServiceOnboarding;
