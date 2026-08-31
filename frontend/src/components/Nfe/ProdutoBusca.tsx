import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Search, PackageSearch, Loader2 } from 'lucide-react';
import { ProdutoService, type ProdutoRecord } from '../../services/produtoService';

interface ProdutoBuscaProps {
  companyId: string;
  /** Chamado ao escolher um produto; o campo de busca é limpo em seguida. */
  onSelect: (produto: ProdutoRecord) => void;
  placeholder?: string;
  className?: string;
}

const brl = (v: number | string) =>
  Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Espera o usuário parar de digitar antes de consultar a API. */
function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/**
 * Busca no catálogo de produtos da empresa (o que já foi emitido em NF-e ou
 * cadastrado à mão) e devolve o produto escolhido para preencher o item.
 *
 * Abrir o campo sem digitar já lista os mais emitidos, porque a maioria das
 * empresas gira em torno de poucos produtos. Navegação por teclado: setas,
 * Enter escolhe, Esc fecha.
 */
export function ProdutoBusca({
  companyId,
  onSelect,
  placeholder = 'Buscar produto já emitido ou cadastrado (nome, código ou NCM)',
  className,
}: ProdutoBuscaProps) {
  const [termo, setTermo] = useState('');
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState(0);
  const termoDebounced = useDebounced(termo, 250);
  const raiz = useRef<HTMLDivElement>(null);
  const listaId = useId();

  const { data, isFetching, isError } = useQuery({
    queryKey: ['produtos-busca', companyId, termoDebounced],
    queryFn: () => ProdutoService.buscar(companyId, termoDebounced),
    enabled: !!companyId && aberto,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
  const opcoes = useMemo(() => data ?? [], [data]);

  // Fecha ao clicar fora, sem depender de onBlur (que dispara antes do click
  // na opção e faria a lista sumir antes de registrar a escolha).
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', fora);
    return () => document.removeEventListener('mousedown', fora);
  }, [aberto]);

  useEffect(() => {
    setAtivo(0);
  }, [opcoes]);

  const escolher = (p: ProdutoRecord) => {
    onSelect(p);
    setTermo('');
    setAberto(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setAberto(true);
      setAtivo((i) => Math.min(i + 1, Math.max(opcoes.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setAtivo((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (aberto && opcoes[ativo]) {
        e.preventDefault();
        escolher(opcoes[ativo]);
      }
    } else if (e.key === 'Escape') {
      setAberto(false);
    }
  };

  return (
    <div ref={raiz} className={`relative ${className ?? ''}`}>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
          {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
        </span>
        <input
          type="text"
          className="input-field pl-9"
          placeholder={placeholder}
          value={termo}
          onChange={(e) => {
            setTermo(e.target.value);
            setAberto(true);
          }}
          onFocus={() => setAberto(true)}
          onBlur={(e) => {
            // Tab para fora fecha a lista; clique numa opção não passa por aqui
            // porque o onMouseDown da opção segura o foco no input.
            if (!raiz.current?.contains(e.relatedTarget as Node | null)) setAberto(false);
          }}
          onKeyDown={onKeyDown}
          role="combobox"
          aria-expanded={aberto}
          aria-controls={listaId}
          aria-autocomplete="list"
          autoComplete="off"
        />
      </div>

      {aberto && (
        <div
          id={listaId}
          role="listbox"
          className="absolute left-0 right-0 z-30 mt-1 max-h-72 overflow-auto rounded-xl border border-gray-200 bg-white shadow-lg"
        >
          {isError ? (
            <p className="px-4 py-3 text-sm text-red-600">
              Não foi possível consultar o catálogo de produtos.
            </p>
          ) : opcoes.length === 0 ? (
            <div className="flex items-start gap-3 px-4 py-3 text-sm text-gray-500">
              <PackageSearch className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {isFetching
                  ? 'Buscando...'
                  : termoDebounced
                    ? 'Nenhum produto encontrado. Preencha os campos abaixo: ele entra no catálogo assim que a nota for criada.'
                    : 'Nenhum produto no catálogo ainda. Os itens de cada nota criada entram aqui automaticamente.'}
              </span>
            </div>
          ) : (
            <ul>
              {opcoes.map((p, i) => (
                <li
                  key={p.id}
                  role="option"
                  aria-selected={i === ativo}
                  className={`cursor-pointer px-4 py-2.5 ${i === ativo ? 'bg-primary-50' : 'hover:bg-gray-50'}`}
                  onMouseEnter={() => setAtivo(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => escolher(p)}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="truncate text-sm font-semibold text-gray-800">{p.descricao}</span>
                    <span className="shrink-0 text-xs text-gray-500">{brl(p.valor_unitario)}</span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-gray-500">
                    {p.codigo && <span>Cód. {p.codigo}</span>}
                    {p.ncm && <span>NCM {p.ncm}</span>}
                    {p.cfop && <span>CFOP {p.cfop}</span>}
                    {p.cst_icms && <span>{p.cst_icms.length === 3 ? 'CSOSN' : 'CST'} {p.cst_icms}</span>}
                    <span>{p.unidade}</span>
                    {p.vezes_emitido > 0 && (
                      <span className="text-gray-400">
                        {p.vezes_emitido === 1 ? '1 emissão' : `${p.vezes_emitido} emissões`}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export default ProdutoBusca;
