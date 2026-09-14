import { useEffect, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Bell, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { AlertaService, type Alerta } from '../../services/alertaService';

const ICONE = {
  critico: AlertCircle,
  atencao: AlertTriangle,
  info: Info,
} as const;

const COR = {
  critico: 'text-red-600',
  atencao: 'text-amber-600',
  info: 'text-gray-500',
} as const;

function iconeDe(sev: string) {
  return ICONE[sev as keyof typeof ICONE] ?? Info;
}
function corDe(sev: string) {
  return COR[sev as keyof typeof COR] ?? 'text-gray-500';
}

/**
 * Sino de alertas fiscais da empresa selecionada. Os alertas são gerados pelo
 * motor diário no backend; aqui é só leitura. Aparece só quando há empresa
 * selecionada e algum alerta aberto.
 */
export default function AlertasSino() {
  const companyId = useAuthStore((s) => s.currentCompanyId);
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ['alertas', companyId],
    queryFn: () => AlertaService.listar(companyId as string),
    enabled: !!companyId,
    // Alertas mudam no cron diário; não precisa insistir.
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const alertas: Alerta[] = data ?? [];
  const total = alertas.length;

  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [aberto]);

  if (!companyId || total === 0) return null;

  const temCritico = alertas.some((a) => a.severidade === 'critico');

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setAberto((o) => !o)}
        className="relative flex items-center justify-center rounded-2xl border border-white/70 bg-white/85 p-2.5 text-ink-700 shadow-sm transition hover:border-primary-200 hover:text-primary-700"
        aria-label={`${total} alerta(s) fiscal(is)`}
      >
        <Bell className="h-4 w-4" />
        <span
          className={`absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-[11px] font-bold text-white ${temCritico ? 'bg-red-600' : 'bg-amber-500'}`}
        >
          {total}
        </span>
      </button>

      {aberto && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-[24px] border border-white/80 bg-white/95 py-2 shadow-panel backdrop-blur-xl animate-fade-in">
          <div className="border-b border-ink-100 px-4 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-400">Alertas fiscais</p>
            <p className="mt-1 text-sm font-semibold text-ink-900">{total} em aberto nesta empresa</p>
          </div>
          <div className="max-h-80 overflow-auto">
            {alertas.map((a) => {
              const Icone = iconeDe(a.severidade);
              return (
                <div key={a.id} className="flex gap-2.5 px-4 py-3 border-b border-ink-50 last:border-0">
                  <Icone className={`mt-0.5 h-4 w-4 shrink-0 ${corDe(a.severidade)}`} />
                  <p className="text-sm leading-snug text-ink-700">{a.mensagem}</p>
                </div>
              );
            })}
          </div>
          <div className="px-4 py-2">
            <p className="text-[11px] text-ink-400">
              Faturamento considera apenas notas emitidas no ProContador.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
