import { useState, useEffect } from 'react';

/**
 * Hook para tracking de primeiro uso de serviços
 * 
 * Persiste no localStorage se usuário já usou um serviço específico.
 * Útil para exibir wizard de onboarding apenas na primeira vez.
 * 
 * @param serviceId - ID único do serviço (ex: 'nfe-emission')
 * @returns { isFirstUse, markAsUsed }
 * 
 * @example
 * ```tsx
 * function NFePage() {
 *   const { isFirstUse, markAsUsed } = useFirstUse('nfe-emission');
 *   const [showWizard, setShowWizard] = useState(isFirstUse);
 *   
 *   const handleWizardComplete = () => {
 *     markAsUsed();
 *     setShowWizard(false);
 *   };
 *   
 *   return (
 *     <>
 *       <ServiceWizard open={showWizard} onComplete={handleWizardComplete} />
 *       <NFEForm />
 *     </>
 *   );
 * }
 * ```
 */
export function useFirstUse(serviceId: string) {
  const [isFirstUse, setIsFirstUse] = useState(false);
  const storageKey = `firstUse_${serviceId}`;

  useEffect(() => {
    try {
      const hasUsed = localStorage.getItem(storageKey);
      setIsFirstUse(!hasUsed);
    } catch (error) {
      // Se localStorage não disponível (SSR, privacidade), assume que não é primeiro uso
      console.warn('localStorage not available:', error);
      setIsFirstUse(false);
    }
  }, [serviceId, storageKey]);

  const markAsUsed = () => {
    try {
      localStorage.setItem(storageKey, 'true');
      setIsFirstUse(false);
    } catch (error) {
      console.warn('Failed to save first use state:', error);
    }
  };

  const reset = () => {
    try {
      localStorage.removeItem(storageKey);
      setIsFirstUse(true);
    } catch (error) {
      console.warn('Failed to reset first use state:', error);
    }
  };

  return {
    isFirstUse,
    markAsUsed,
    reset,
  };
}

export default useFirstUse;
