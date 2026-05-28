import { FC, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Lightbulb,
  Sparkles,
  ChevronRight,
  PlayCircle,
  MessageCircle,
} from "lucide-react";
import { getServiceById } from "../../config/services";
import {
  SERVICES_HELP,
  SERVICE_HELP,
  type ServiceHelpV2,
} from "../../config/servicesHelp";
import {
  ServiceWizard,
  type WizardStep,
} from "../../components/ServiceWizard/ServiceWizard";
import { useFirstUse } from "../../hooks/useFirstUse";
import { QuickTip, FAQ, InlineHelp } from "../../components/HelpCenter";
import { ServiceChat } from "../../components/ServiceChat/ServiceChat";
import { cn } from "../../utils/cn";

type TabId = "about" | "variables" | "howto" | "chat";

const TABS: { id: TabId; label: string; icon: typeof CheckCircle2 }[] = [
  { id: "about", label: "O que é?", icon: Lightbulb },
  { id: "variables", label: "O que preciso?", icon: CheckCircle2 },
  { id: "howto", label: "Como usar?", icon: PlayCircle },
  { id: "chat", label: "Tirar dúvidas", icon: MessageCircle },
];

/**
 * ServiceDetailPage — página intermediária entre o catálogo de serviços e o formulário real.
 *
 * Rota: `/servicos/:id`
 *
 * Estrutura:
 *  - Header com breadcrumb, ícone e título do serviço
 *  - Abas: O que é? | O que preciso? | Como usar?
 *  - Ações: "Wizard guiado" e "Ir ao formulário"
 *
 * Fontes de dados:
 *  - `SERVICES` (config/services.ts) — metadado visual e rota
 *  - `SERVICES_HELP` v2 — campos, dicas, erros comuns, exemplos
 *  - `SERVICE_HELP` v1 — FAQs e variáveis detalhadas (fallback)
 */
const ServiceDetailPage: FC = () => {
  const { id = "" } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const service = getServiceById(id);
  const helpV2: ServiceHelpV2 | undefined = SERVICES_HELP[id];
  const helpV1 = SERVICE_HELP[id];

  const [activeTab, setActiveTab] = useState<TabId>("about");
  const [wizardOpen, setWizardOpen] = useState(false);

  const { markAsUsed } = useFirstUse(id);

  const Icon = service?.icon;

  // Build wizard steps from the help data
  const wizardSteps = useMemo<WizardStep[]>(() => {
    if (!helpV2) return [];
    const required = helpV2.fields.filter((f) => f.required);
    return [
      {
        title: "O que você vai fazer",
        description: helpV2.whatIs,
      },
      {
        title: "O que você precisa ter em mãos",
        description: `Para concluir, separe os seguintes dados (${required.length} obrigatórios):`,
        content: (
          <ul className="space-y-2 max-w-md mx-auto text-left">
            {required.map((f) => (
              <li
                key={f.name}
                className="flex items-start gap-2 rounded-lg border border-green-100 bg-green-50 p-3 dark:border-green-900/30 dark:bg-green-900/10"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-500" />
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                    {f.label}
                  </p>
                  {f.example && (
                    <p className="mt-0.5 font-mono text-xs text-blue-600 dark:text-blue-400">
                      Ex.: {f.example}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ),
      },
      {
        title: "Quanto tempo leva",
        description: `Tempo estimado: ${helpV2.estimatedTime}. Você pode salvar e continuar depois.`,
        visual: (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-900/30">
            <Clock className="h-10 w-10 text-primary-600 dark:text-primary-400" />
          </div>
        ),
      },
    ];
  }, [helpV2]);

  // Fallback: serviço sem cadastro de ajuda
  if (!service) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <QuickTip type="warning">
          Serviço <code className="font-mono">{id}</code> não encontrado.{" "}
          <Link to="/servicos" className="underline">
            Voltar ao catálogo
          </Link>
          .
        </QuickTip>
      </div>
    );
  }

  const goToForm = () => {
    markAsUsed();
    navigate(service.route);
  };

  const startWizard = () => setWizardOpen(true);
  const finishWizard = () => {
    setWizardOpen(false);
    goToForm();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6 lg:p-8">
      {/* ─── Breadcrumb ─────────────────────────────────────────────── */}
      <nav
        aria-label="Caminho"
        className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400"
      >
        <Link
          to="/servicos"
          className="hover:text-primary-600 dark:hover:text-primary-400"
        >
          Serviços
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="font-medium text-gray-800 dark:text-gray-200">
          {service.title}
        </span>
      </nav>

      {/* ─── Header ─────────────────────────────────────────────────── */}
      <header className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-6">
        <div className="flex items-start gap-4">
          {Icon && (
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
              <Icon className="h-6 w-6" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-2xl">
              {service.title}
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
              {service.description}
            </p>
            {helpV2?.estimatedTime && (
              <p className="mt-2 inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
                <Clock className="h-3.5 w-3.5" /> Tempo estimado:{" "}
                {helpV2.estimatedTime}
              </p>
            )}
          </div>
        </div>

        {/* Ações principais */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={startWizard}
            disabled={wizardSteps.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-primary-200 bg-primary-50 px-4 py-2 text-sm font-medium text-primary-700 transition-colors hover:bg-primary-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-primary-800 dark:bg-primary-900/30 dark:text-primary-300 dark:hover:bg-primary-900/50"
          >
            <Sparkles className="h-4 w-4" />
            Wizard guiado
          </button>
          <button
            type="button"
            onClick={goToForm}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700"
          >
            Ir ao formulário
            <ArrowRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("chat")}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <MessageCircle className="h-4 w-4 text-primary-500" />
            Tirar dúvidas com IA
          </button>
          <Link
            to="/servicos"
            className="ml-auto inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </div>
      </header>

      {/* ─── Sem cadastro de ajuda detalhada ──────────────────────────── */}
      {!helpV2 && !helpV1 && (
        <InlineHelp variant="subtle" title="Documentação em construção">
          Este serviço ainda não tem guia detalhado. Você pode acessar o
          formulário diretamente e consultar a documentação geral em{" "}
          <Link
            to="/servicos"
            className="font-medium underline-offset-4 hover:underline"
          >
            Guia operacional dos serviços
          </Link>
          .
        </InlineHelp>
      )}

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Detalhes do serviço"
        className="flex gap-1 overflow-x-auto rounded-xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-gray-800/50"
      >
        {TABS.map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.id;
          if (tab.id !== "chat" && !helpV2 && !helpV1) return null;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.id}`}
              id={`tab-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-white text-primary-700 shadow-sm dark:bg-gray-900 dark:text-primary-300"
                  : "text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200",
                tab.id === "chat" && !isActive
                  ? "border border-dashed border-primary-200 dark:border-primary-800"
                  : "",
              )}
            >
              <TabIcon className="h-4 w-4" />
              {tab.label}
              {tab.id === "chat" && (
                <span className="ml-1 rounded-full bg-primary-100 px-1.5 py-0.5 text-xs font-semibold text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
                  IA
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Paineis */}
      <div
        id={`panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`tab-${activeTab}`}
        className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800 sm:p-6"
      >
        {activeTab === "about" && (
          <AboutPanel help={helpV2} helpV1={helpV1} />
        )}
        {activeTab === "variables" && (
          <VariablesPanel help={helpV2} helpV1={helpV1} />
        )}
        {activeTab === "howto" && (
          <HowToPanel help={helpV2} helpV1={helpV1} />
        )}
        {activeTab === "chat" && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary-600 dark:text-primary-400" />
              <h2 className="text-base font-semibold text-gray-900 dark:text-white">
                Tire suas dúvidas sobre {service.title}
              </h2>
              <span className="rounded-full bg-primary-100 px-2 py-0.5 text-xs font-semibold text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">
                IA
              </span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Pergunte em linguagem natural. A IA responde com base na documentação deste serviço.
            </p>
            <ServiceChat
              serviceName={service.title}
              serviceDescription={service.description}
              helpV2={helpV2}
              helpV1={helpV1}
            />
          </div>
        )}
      </div>

      {/* ─── Wizard ────────────────────────────────────────────────── */}
      {wizardSteps.length > 0 && (
        <ServiceWizard
          serviceId={id}
          open={wizardOpen}
          steps={wizardSteps}
          onComplete={finishWizard}
          onSkip={() => setWizardOpen(false)}
        />
      )}
    </div>
  );
};

// ─── Painéis ──────────────────────────────────────────────────────────────

const AboutPanel: FC<{ help?: ServiceHelpV2; helpV1?: any }> = ({
  help,
  helpV1,
}) => {
  const whatIs = help?.whatIs ?? helpV1?.whatIs;
  const whenToUse = help?.whenToUse ?? helpV1?.whenToUse;

  return (
    <div className="space-y-5">
      {whatIs && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
            <Lightbulb className="h-4 w-4 text-amber-500" />O que é?
          </h2>
          <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            {whatIs}
          </p>
        </section>
      )}

      {whenToUse && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            Quando usar?
          </h2>
          <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            {whenToUse}
          </p>
        </section>
      )}

      {help?.examples && help.examples.length > 0 && (
        <section>
          <h2 className="mb-3 text-base font-semibold text-gray-900 dark:text-white">
            Exemplos práticos
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {help.examples.map((ex, i) => (
              <article
                key={i}
                className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40"
              >
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {ex.title}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
                  {ex.description}
                </p>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

const VariablesPanel: FC<{ help?: ServiceHelpV2; helpV1?: any }> = ({
  help,
  helpV1,
}) => {
  const fields = help?.fields ?? helpV1?.variables ?? [];
  const required = fields.filter((f: any) => f.required);
  const optional = fields.filter((f: any) => !f.required);

  if (fields.length === 0) {
    return (
      <QuickTip type="info">
        Esse serviço não tem variáveis detalhadas cadastradas ainda.
      </QuickTip>
    );
  }

  return (
    <div className="space-y-5">
      {required.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Obrigatórios ({required.length})
          </h2>
          <ul className="space-y-2">
            {required.map((f: any) => (
              <FieldRow key={f.name} field={f} required />
            ))}
          </ul>
        </section>
      )}

      {optional.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Opcionais ({optional.length})
          </h2>
          <ul className="space-y-2">
            {optional.map((f: any) => (
              <FieldRow key={f.name} field={f} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
};

const FieldRow: FC<{ field: any; required?: boolean }> = ({
  field,
  required,
}) => (
  <li
    className={cn(
      "rounded-lg border p-3",
      required
        ? "border-green-100 bg-green-50/50 dark:border-green-900/30 dark:bg-green-900/10"
        : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900/40",
    )}
  >
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <span className="text-sm font-medium text-gray-900 dark:text-white">
        {field.label}
      </span>
      <span className="text-xs text-gray-500 dark:text-gray-400">
        {field.type}
      </span>
    </div>
    {field.description && (
      <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-400">
        {field.description}
      </p>
    )}
    {field.example && (
      <p className="mt-1.5 font-mono text-xs text-blue-600 dark:text-blue-400">
        Ex.: {field.example}
      </p>
    )}
    {field.tips && field.tips.length > 0 && (
      <ul className="mt-2 space-y-0.5 border-t border-gray-200 pt-2 dark:border-gray-700">
        {field.tips.map((t: string, i: number) => (
          <li key={i} className="text-xs text-gray-500 dark:text-gray-400">
            💡 {t}
          </li>
        ))}
      </ul>
    )}
  </li>
);

const HowToPanel: FC<{ help?: ServiceHelpV2; helpV1?: any }> = ({
  help,
  helpV1,
}) => {
  const tips: string[] = help?.tips ?? helpV1?.tips ?? [];
  const commonErrorsV2: string[] = help?.commonErrors ?? [];
  const commonErrorsV1 = (helpV1?.commonErrors ?? []) as Array<{
    error: string;
    solution: string;
  }>;
  const faqs = (helpV1?.faqs ?? []) as Array<{
    question: string;
    answer: string;
  }>;

  return (
    <div className="space-y-6">
      {tips.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            Dicas práticas
          </h2>
          <ul className="space-y-2">
            {tips.map((tip, i) => (
              <li
                key={i}
                className="flex items-start gap-2 rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-300"
              >
                <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400" />
                {tip}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(commonErrorsV1.length > 0 || commonErrorsV2.length > 0) && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-gray-900 dark:text-white">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Erros comuns
          </h2>
          <ul className="space-y-2">
            {commonErrorsV1.map((e, i) => (
              <li
                key={`v1-${i}`}
                className="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/30 dark:bg-amber-900/10"
              >
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  {e.error}
                </p>
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                  → {e.solution}
                </p>
              </li>
            ))}
            {commonErrorsV2.map((err, i) => (
              <li
                key={`v2-${i}`}
                className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900/30 dark:bg-amber-900/10 dark:text-amber-300"
              >
                {err}
              </li>
            ))}
          </ul>
        </section>
      )}

      {faqs.length > 0 && (
        <FAQ
          items={faqs.map((f) => ({ question: f.question, answer: f.answer }))}
          title="Perguntas frequentes"
          searchable={faqs.length >= 5}
        />
      )}
    </div>
  );
};

export default ServiceDetailPage;
