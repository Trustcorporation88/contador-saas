/**
 * ServiceOnboarding — Modal de boas-vindas contextual por serviço.
 *
 * Exibido automaticamente na primeira visita de um usuário a um serviço.
 * Guia o usuário em 3 etapas: O que é → O que precisa ter → Tempo estimado.
 * Persiste no localStorage para não reaparecer após a primeira conclusão.
 *
 * Uso:
 *   const { showOnboarding, completeOnboarding } = useServiceOnboarding('nfe-emissao');
 *
 *   {showOnboarding && (
 *     <ServiceOnboarding
 *       serviceId="nfe-emissao"
 *       onClose={completeOnboarding}
 *       onGoToForm={completeOnboarding}
 *     />
 *   )}
 */

import React, { useState } from 'react';
import { ArrowRight, ArrowLeft, X, CheckCircle, Clock, AlertTriangle, BookOpen } from 'lucide-react';
import { SERVICES_HELP } from '../../config/servicesHelp';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ServiceOnboardingProps {
  /** ID do serviço conforme SERVICES_HELP (ex: 'nfe-emissao') */
  serviceId: string;
  /** Chamado ao fechar sem concluir */
  onClose: () => void;
  /** Chamado ao clicar em "Ir para o formulário" (última etapa) */
  onGoToForm: () => void;
  /** Oculta o botão "Pular" se true */
  forceComplete?: boolean;
}

// ── Step content builders ──────────────────────────────────────────────────

function WhatIsStep({ whatIs }: { whatIs: string }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
        <BookOpen className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-500" />
        <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">{whatIs}</p>
      </div>
    </div>
  );
}

type ServiceField = { required: boolean; name: string; label: string; description: string; example: string };

function RequiredFieldsStep({ fields }: { fields: ServiceField[] }) {
  const required = fields.filter(f => f.required);
  const optional = fields.filter(f => !f.required);

  return (
    <div className="space-y-4">
      {required.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Obrigatórios ({required.length})
          </p>
          <ul className="space-y-2">
            {required.map(f => (
              <li key={f.name} className="flex items-start gap-2.5 rounded-lg border border-green-100 bg-green-50 p-3 dark:border-green-900/30 dark:bg-green-900/10">
                <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{f.label}</p>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{f.description}</p>
                  {f.example && (
                    <p className="mt-1 font-mono text-xs text-blue-600 dark:text-blue-400">
                      Ex: {f.example}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {optional.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Opcionais ({optional.length})
          </p>
          <ul className="space-y-1.5">
            {optional.map(f => (
              <li key={f.name} className="flex items-center gap-2 rounded px-2 py-1.5 text-sm text-gray-600 dark:text-gray-400">
                <span className="text-gray-300 dark:text-gray-600">○</span>
                <span>{f.label}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function SummaryStep({
  estimatedTime,
  tips,
  commonErrors,
}: {
  estimatedTime: string;
  tips: string[];
  commonErrors: string[];
}) {
  return (
    <div className="space-y-4">
      {/* Time estimate */}
      <div className="flex items-center gap-3 rounded-lg bg-purple-50 p-4 dark:bg-purple-900/20">
        <Clock className="h-8 w-8 text-purple-500" />
        <div>
          <p className="text-2xl font-bold text-purple-700 dark:text-purple-300">{estimatedTime}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">para completar este processo</p>
        </div>
      </div>

      {/* Quick tips */}
      {tips.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            💡 Dicas rápidas
          </p>
          <ul className="space-y-1">
            {tips.slice(0, 3).map((tip, i) => (
              <li key={i} className="flex items-start gap-1.5 text-sm text-gray-600 dark:text-gray-400">
                <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-400" />
                {tip}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Common errors */}
      {commonErrors.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800/40 dark:bg-amber-900/10">
          <p className="mb-1.5 flex items-center gap-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
            <AlertTriangle className="h-3.5 w-3.5" />
            Erros comuns a evitar
          </p>
          <ul className="space-y-1">
            {commonErrors.slice(0, 2).map((err, i) => (
              <li key={i} className="text-xs text-amber-800 dark:text-amber-300">
                • {err}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function ServiceOnboarding({
  serviceId,
  onClose,
  onGoToForm,
  forceComplete = false,
}: ServiceOnboardingProps) {
  const [step, setStep] = useState(0);
  const service = SERVICES_HELP[serviceId];

  if (!service) return null;

  type StepDef = { title: string; content: React.ReactNode };

  const steps: StepDef[] = [
    {
      title: '📖 O que é este serviço?',
      content: <WhatIsStep whatIs={service.whatIs} />,
    },
    {
      title: '✅ O que você precisa ter em mãos',
      content: <RequiredFieldsStep fields={service.fields as ServiceField[]} />,
    },
    {
      title: '⏱️ Resumo e dicas rápidas',
      content: (
        <SummaryStep
          estimatedTime={service.estimatedTime}
          tips={service.tips}
          commonErrors={service.commonErrors}
        />
      ),
    },
  ];

  const isFirst = step === 0;
  const isLast  = step === steps.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-title"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-gray-800">

        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4 dark:border-gray-700">
          <h2 id="onboarding-title" className="text-base font-bold text-gray-900 dark:text-white">
            {service.title}
          </h2>
          {!forceComplete && (
            <button
              onClick={onClose}
              className="rounded-md p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
              aria-label="Fechar"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* ── Progress bar ── */}
        <div className="flex gap-1.5 px-6 pt-4">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
                i <= step ? 'bg-blue-500' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            />
          ))}
        </div>

        {/* ── Step indicator ── */}
        <p className="px-6 pt-2 text-xs text-gray-400 dark:text-gray-500">
          Etapa {step + 1} de {steps.length}
        </p>

        {/* ── Content ── */}
        <div className="min-h-[220px] overflow-y-auto px-6 pb-2 pt-3">
          <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-200">
            {steps[step].title}
          </h3>
          {steps[step].content}
        </div>

        {/* ── Actions ── */}
        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4 dark:border-gray-700">
          {/* Back / Skip */}
          <button
            onClick={() => (isFirst ? onClose() : setStep(s => s - 1))}
            className="flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-700 dark:hover:text-gray-300"
          >
            {isFirst ? (
              forceComplete ? null : 'Pular'
            ) : (
              <>
                <ArrowLeft className="h-4 w-4" />
                Anterior
              </>
            )}
          </button>

          {/* Next / Go to form */}
          <button
            onClick={() => (isLast ? onGoToForm() : setStep(s => s + 1))}
            className="flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 active:bg-blue-800"
          >
            {isLast ? 'Ir para o formulário' : 'Próximo'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default ServiceOnboarding;
