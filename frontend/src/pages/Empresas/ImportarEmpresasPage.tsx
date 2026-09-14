import { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle, Play } from 'lucide-react';
import {
  ImportacaoService,
  type AnaliseImportacao,
  type LinhaImportacao,
  type ResultadoLinha,
} from '../../services/importacaoService';
import { UserManagementService } from '../../services/userManagementService';
import { rotuloProjeto, rotuloAtividade } from '../../services/companyService';
import { useAuthStore } from '../../store/authStore';

const TAMANHO_LOTE = 15;

export default function ImportarEmpresasPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const meuId = useAuthStore((s) => s.user?.id);
  const souAdmin = useAuthStore((s) => s.user?.role) === 'admin';

  const [arquivo, setArquivo] = useState<File | null>(null);
  const [analise, setAnalise] = useState<AnaliseImportacao | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const [erro, setErro] = useState('');
  const [atribuirPara, setAtribuirPara] = useState('');

  const [rodando, setRodando] = useState(false);
  const [processadas, setProcessadas] = useState(0);
  const [resultados, setResultados] = useState<ResultadoLinha[]>([]);
  const [concluido, setConcluido] = useState(false);

  // Só admin lista usuários; contador importa para a própria carteira.
  const { data: usuarios } = useQuery({
    queryKey: ['usuarios'],
    queryFn: () => UserManagementService.listar(),
    enabled: souAdmin,
  });

  const aImportar = useMemo(
    () => (analise?.linhas ?? []).filter((l) => l.situacao === 'importar'),
    [analise],
  );

  async function escolherArquivo(file: File) {
    setArquivo(file);
    setAnalise(null);
    setResultados([]);
    setConcluido(false);
    setProcessadas(0);
    setErro('');
    setAnalisando(true);
    try {
      setAnalise(await ImportacaoService.analisar(file));
    } catch (e: any) {
      setErro(e?.response?.data?.message || e?.message || 'Não foi possível ler a planilha.');
    } finally {
      setAnalisando(false);
    }
  }

  async function importar() {
    if (aImportar.length === 0) return;
    setRodando(true);
    setConcluido(false);
    setResultados([]);
    setProcessadas(0);
    const acumulado: ResultadoLinha[] = [];

    try {
      for (let i = 0; i < aImportar.length; i += TAMANHO_LOTE) {
        const lote = aImportar.slice(i, i + TAMANHO_LOTE);
        try {
          const r = await ImportacaoService.importarLote(lote, atribuirPara);
          acumulado.push(...r);
        } catch (e: any) {
          // Lote inteiro falhou (rede, timeout): marca as linhas dele e segue,
          // para uma queda no meio não perder o que ainda falta importar.
          acumulado.push(...lote.map((l) => ({
            linha: l.linha, cnpj: l.cnpj, razao_social: l.razao_social,
            ok: false, motivo: e?.response?.data?.message || 'Falha de comunicação neste lote',
          })));
        }
        setProcessadas(Math.min(i + TAMANHO_LOTE, aImportar.length));
        setResultados([...acumulado]);
      }
      setConcluido(true);
    } finally {
      setRodando(false);
    }
  }

  const sucessos = resultados.filter((r) => r.ok).length;
  const falhas = resultados.filter((r) => !r.ok);
  const progresso = aImportar.length ? Math.round((processadas / aImportar.length) * 100) : 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-ink-900">Importar empresas</h1>
        <p className="mt-1 text-sm text-ink-500">
          Envie a planilha para cadastrar várias empresas de uma vez. Os dados que faltam
          (endereço, inscrição estadual, código do município) são buscados no cartão do CNPJ
          de cada empresa durante a importação.
        </p>
      </div>

      {/* Upload */}
      <div className="glass-strip p-5">
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) escolherArquivo(f); }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={analisando || rodando}
          className="btn btn-secondary"
        >
          <Upload className="mr-2 h-4 w-4" />
          {arquivo ? 'Trocar planilha' : 'Escolher planilha'}
        </button>
        {arquivo && (
          <span className="ml-3 inline-flex items-center gap-2 text-sm text-ink-600">
            <FileSpreadsheet className="h-4 w-4" />
            {arquivo.name}
          </span>
        )}
        {analisando && <p className="mt-3 text-sm text-ink-500">Lendo a planilha...</p>}
        {erro && <p className="mt-3 text-sm text-red-600">{erro}</p>}
        <p className="mt-3 text-xs text-ink-400">
          Colunas lidas: CNPJ, CATEGORIA, CNAE (atividade), PROJETO, RAZÃO SOCIAL, CIDADE,
          ESTADO, TELEFONE e E-MAIL. A ordem não importa, o cabeçalho é que vale.
        </p>
      </div>

      {/* Resumo da análise */}
      {analise && (
        <div className="glass-strip p-5 space-y-4">
          <div className="flex flex-wrap gap-4">
            <Cartao rotulo="Serão importadas" valor={analise.resumo.importar} cor="text-emerald-700" />
            <Cartao rotulo="Já cadastradas" valor={analise.resumo.existente} cor="text-amber-700" />
            <Cartao rotulo="Com problema" valor={analise.resumo.erro} cor="text-red-700" />
          </div>

          {souAdmin && (
            <div className="max-w-md">
              <label className="input-label" htmlFor="atribuir">Atribuir as empresas também a</label>
              <select
                id="atribuir"
                className="input-field"
                value={atribuirPara}
                onChange={(e) => setAtribuirPara(e.target.value)}
                disabled={rodando}
              >
                <option value="">Somente a mim</option>
                {(usuarios ?? [])
                  .filter((u: any) => u.id !== meuId && u.ativo !== false)
                  .map((u: any) => (
                    <option key={u.id} value={u.id}>{u.nome_completo} ({u.email})</option>
                  ))}
              </select>
              <p className="mt-1 text-xs text-ink-400">
                Quem importa já enxerga as empresas. Escolha aqui quem mais precisa enxergá-las
                (a contadora que vai operar a carteira, por exemplo).
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={importar}
            disabled={rodando || aImportar.length === 0}
            className="btn btn-primary"
          >
            <Play className="mr-2 h-4 w-4" />
            {rodando ? 'Importando...' : `Importar ${aImportar.length} empresa(s)`}
          </button>

          {(rodando || concluido) && (
            <div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
                <div className="h-full bg-primary-600 transition-all" style={{ width: `${progresso}%` }} />
              </div>
              <p className="mt-2 text-sm text-ink-600">
                {processadas} de {aImportar.length} processadas
                {resultados.length > 0 && ` · ${sucessos} criadas · ${falhas.length} com falha`}
              </p>
              {rodando && (
                <p className="mt-1 text-xs text-ink-400">
                  Não feche esta página enquanto a importação estiver rodando.
                </p>
              )}
            </div>
          )}

          {concluido && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
              <CheckCircle2 className="mr-2 inline h-4 w-4" />
              Importação concluída: {sucessos} empresa(s) criada(s)
              {falhas.length > 0 && `, ${falhas.length} com falha (lista abaixo)`}.
            </div>
          )}

          {falhas.length > 0 && (
            <Tabela
              titulo="Linhas com falha"
              icone={<XCircle className="h-4 w-4 text-red-600" />}
              linhas={falhas.map((f) => ({
                a: String(f.linha), b: f.cnpj, c: f.razao_social, d: f.motivo ?? '',
              }))}
            />
          )}

          {analise.linhas.some((l) => l.situacao !== 'importar') && !concluido && (
            <Tabela
              titulo="Linhas que não serão importadas"
              icone={<AlertTriangle className="h-4 w-4 text-amber-600" />}
              linhas={analise.linhas
                .filter((l) => l.situacao !== 'importar')
                .map((l) => ({ a: String(l.linha), b: l.cnpj, c: l.razao_social, d: l.motivo ?? '' }))}
            />
          )}

          {!concluido && aImportar.length > 0 && (
            <Previa linhas={aImportar.slice(0, 10)} total={aImportar.length} />
          )}
        </div>
      )}
    </div>
  );
}

function Cartao({ rotulo, valor, cor }: { rotulo: string; valor: number; cor: string }) {
  return (
    <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wider text-ink-400">{rotulo}</p>
      <p className={`mt-1 text-2xl font-bold ${cor}`}>{valor}</p>
    </div>
  );
}

function Tabela({ titulo, icone, linhas }: {
  titulo: string; icone: React.ReactNode; linhas: Array<{ a: string; b: string; c: string; d: string }>;
}) {
  return (
    <div>
      <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-700">{icone}{titulo} ({linhas.length})</p>
      <div className="max-h-64 overflow-auto rounded-xl border border-ink-100">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-50 text-xs uppercase text-ink-500">
            <tr>
              <th className="px-3 py-2">Linha</th>
              <th className="px-3 py-2">CNPJ</th>
              <th className="px-3 py-2">Razão social</th>
              <th className="px-3 py-2">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l, i) => (
              <tr key={`${l.a}-${i}`} className="border-t border-ink-50">
                <td className="px-3 py-2 text-ink-400">{l.a}</td>
                <td className="px-3 py-2 font-mono text-xs">{l.b}</td>
                <td className="px-3 py-2">{l.c}</td>
                <td className="px-3 py-2 text-ink-600">{l.d}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Previa({ linhas, total }: { linhas: LinhaImportacao[]; total: number }) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-ink-700">
        Prévia (primeiras {linhas.length} de {total})
      </p>
      <div className="max-h-64 overflow-auto rounded-xl border border-ink-100">
        <table className="w-full text-left text-sm">
          <thead className="bg-ink-50 text-xs uppercase text-ink-500">
            <tr>
              <th className="px-3 py-2">CNPJ</th>
              <th className="px-3 py-2">Razão social</th>
              <th className="px-3 py-2">Projeto</th>
              <th className="px-3 py-2">Atividade</th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((l) => (
              <tr key={l.cnpj} className="border-t border-ink-50">
                <td className="px-3 py-2 font-mono text-xs">{l.cnpj}</td>
                <td className="px-3 py-2">{l.razao_social}</td>
                <td className="px-3 py-2">{rotuloProjeto(l.projeto) || '—'}</td>
                <td className="px-3 py-2">{rotuloAtividade(l.atividade) || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
