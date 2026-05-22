import { FC, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../utils/cn';

export interface WizardStep {
  title: string;
  description: string;
  visual?: React.ReactNode;
  content?: React.ReactNode;
}

export interface ServiceWizardProps {
  serviceId: string;
  steps: WizardStep[];
  onComplete: () => void;
  onSkip: () => void;
  open: boolean;
  className?: string;
}

/**
 * ServiceWizard - Modal de onboarding para primeiro uso de serviço
 * 
 * Features:
 * - Modal responsivo (desktop) / fullscreen (mobile)
 * - Navegação entre steps (Próximo/Anterior/Pular)
 * - Progress indicator visual
 * - Checkbox "Não mostrar novamente"
 * - Animações suaves entre steps
 * - Keyboard accessible
 */
export const ServiceWizard: FC<ServiceWizardProps> = ({
  serviceId,
  steps,
  onComplete,
  onSkip,
  open,
  className,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');

  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === steps.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setDirection('forward');
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    setDirection('backward');
    setCurrentStep(currentStep - 1);
  };

  const handleSkip = () => {
    if (dontShowAgain) {
      localStorage.setItem(`wizard_skip_${serviceId}`, 'true');
    }
    onSkip();
  };

  const handleComplete = () => {
    if (dontShowAgain) {
      localStorage.setItem(`wizard_completed_${serviceId}`, 'true');
    }
    onComplete();
  };

  const handleDontShowAgain = (checked: boolean) => {
    setDontShowAgain(checked);
  };

  const slideVariants = {
    enter: (direction: 'forward' | 'backward') => ({
      x: direction === 'forward' ? 300 : -300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: 'forward' | 'backward') => ({
      x: direction === 'forward' ? -300 : 300,
      opacity: 0,
    }),
  };

  if (!open) return null;

  const currentStepData = steps[currentStep];

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100]"
            onClick={handleSkip}
          />

          {/* Modal */}
          <div className="fixed inset-0 z-[101] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className={cn(
                'relative w-full max-w-3xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl overflow-hidden',
                'max-h-[90vh] flex flex-col',
                className
              )}
            >
              {/* Header */}
              <div className="relative px-6 py-5 border-b border-gray-200 dark:border-gray-800">
                <button
                  onClick={handleSkip}
                  className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  aria-label="Fechar"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>

                {/* Progress Bar */}
                <div className="mb-4">
                  <div className="flex items-center gap-2">
                    {steps.map((_, index) => (
                      <div
                        key={index}
                        className={cn(
                          'flex-1 h-2 rounded-full transition-all duration-300',
                          index <= currentStep
                            ? 'bg-primary-600'
                            : 'bg-gray-200 dark:bg-gray-700'
                        )}
                      />
                    ))}
                  </div>
                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
                    Passo {currentStep + 1} de {steps.length}
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-6 py-8">
                <AnimatePresence mode="wait" custom={direction}>
                  <motion.div
                    key={currentStep}
                    custom={direction}
                    variants={slideVariants}
                    initial="enter"
                    animate="center"
                    exit="exit"
                    transition={{
                      x: { type: 'spring', stiffness: 300, damping: 30 },
                      opacity: { duration: 0.2 },
                    }}
                  >
                    {/* Visual/Icon */}
                    {currentStepData.visual && (
                      <div className="flex justify-center mb-6">
                        {currentStepData.visual}
                      </div>
                    )}

                    {/* Title */}
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white text-center mb-4">
                      {currentStepData.title}
                    </h2>

                    {/* Description */}
                    <p className="text-lg text-gray-600 dark:text-gray-300 text-center mb-6 leading-relaxed">
                      {currentStepData.description}
                    </p>

                    {/* Custom Content */}
                    {currentStepData.content && (
                      <div className="mt-8">
                        {currentStepData.content}
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Footer */}
              <div className="px-6 py-5 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                {/* Don't Show Again Checkbox */}
                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="checkbox"
                    id="dont-show-again"
                    checked={dontShowAgain}
                    onChange={(e) => handleDontShowAgain(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <label
                    htmlFor="dont-show-again"
                    className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer select-none"
                  >
                    Não mostrar este guia novamente
                  </label>
                </div>

                {/* Navigation Buttons */}
                <div className="flex items-center justify-between gap-3">
                  <button
                    onClick={handleSkip}
                    className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
                  >
                    Pular
                  </button>

                  <div className="flex items-center gap-3">
                    {!isFirstStep && (
                      <button
                        onClick={handlePrevious}
                        className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Anterior
                      </button>
                    )}

                    <button
                      onClick={handleNext}
                      className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors shadow-sm"
                    >
                      {isLastStep ? (
                        <>
                          <Check className="w-4 h-4" />
                          Começar
                        </>
                      ) : (
                        <>
                          Próximo
                          <ChevronRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ServiceWizard;
