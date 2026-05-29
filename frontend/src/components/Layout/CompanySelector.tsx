import { useEffect, useRef, useState } from "react";
import { Building2, ChevronDown, Check, AlertCircle } from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { CompanyService, type APICompany } from "../../services/companyService";

export default function CompanySelector() {
  const currentCompanyId = useAuthStore((s) => s.currentCompanyId);
  const setCurrentCompany = useAuthStore((s) => s.setCurrentCompany);
  const [open, setOpen] = useState(false);
  const [companies, setCompanies] = useState<APICompany[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    CompanyService.list({ limit: 50 })
      .then((res) => {
        if (!active) return;
        const list = res.data || [];
        setCompanies(list);
        if (!currentCompanyId && list.length > 0) {
          setCurrentCompany(list[0].id);
        }
      })
      .catch(() => { if (active) setError("Falha ao carregar empresas"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const current = companies.find((c) => c.id === currentCompanyId);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-2xl border border-white/70 bg-white/85 px-3 py-2.5 text-sm shadow-sm transition hover:border-primary-200 hover:bg-white"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 text-white">
          <Building2 className="h-4 w-4" />
        </div>
        <div className="hidden text-left sm:block">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-400">Empresa ativa</p>
          <p className="max-w-[200px] truncate font-semibold leading-tight text-ink-900">
            {loading ? "Carregando..." : current?.name ?? "Nenhuma selecionada"}
          </p>
        </div>
        <ChevronDown className="h-3.5 w-3.5 text-ink-400" />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-[24px] border border-white/80 bg-white/95 py-2 shadow-panel backdrop-blur-xl animate-fade-in">
          <div className="border-b border-ink-100 px-4 py-2">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-ink-400">Trocar empresa</p>
          </div>
          <div className="max-h-80 overflow-y-auto py-1">
            {error && (
              <div className="mx-3 my-2 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}
            {!loading && companies.length === 0 && !error && (
              <p className="px-4 py-3 text-sm text-ink-500">Nenhuma empresa cadastrada ainda.</p>
            )}
            {companies.map((c) => {
              const isActive = c.id === currentCompanyId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => { setCurrentCompany(c.id); setOpen(false); }}
                  className={"flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm transition hover:bg-primary-50 " + (isActive ? "bg-primary-50/60" : "")}
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink-900">{c.name}</p>
                    <p className="text-xs text-ink-400">CNPJ {c.cnpj}</p>
                  </div>
                  {isActive && <Check className="h-4 w-4 flex-shrink-0 text-primary-600" />}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}