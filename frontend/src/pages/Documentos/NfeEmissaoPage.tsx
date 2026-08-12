import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Trash2,
  FileText,
  Download,
  Ban,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Pencil,
  Printer,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { CompanyService, type DocumentoLookupResult } from '../../services/companyService';
import {
  NfeService,
  type CreateNfePayload,
  type NfeItemPayload,
  type NfeItemRecord,
  type NfeRecord,
} from '../../services/nfeService';
import { textoLivre } from '../../utils/textoLimpo';

interface ItemForm extends NfeItemPayload {
  _key: string;
}

function novoItem(): ItemForm {
  return {
    _key: Math.random().toString(36).slice(2),
    codigo_produto: '',
    descricao: '',
    ncm: '',
    cfop: '5102',
    unidade: 'UN',
    quantidade: 1,
    valor_unitario: 0,
    aliquota_icms: 0,
    aliquota_pis: 0,
    aliquota_cofins: 0,
  };
}

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

/** Evita gravar o texto literal "undefined"/"null" vindo de APIs mal mapeadas. */
/**
 * Mantido como nome local por já ser usado em vários pontos desta página.
 * A regra vive em utils/textoLimpo, compartilhada com o cadastro de empresas e
 * espelhada no backend: antes, cada tela tinha a sua, e a do cadastro só pegava
 * a palavra "undefined" SOZINHA — deixava passar "undefined SETE DE SETEMBRO".
 */
const cleanAddr = textoLivre;

export default function NfeEmissaoPage() {
  const companyId = useAuthStore((s) => s.currentCompanyId) || '';
  const qc = useQueryClient();

  // Destinatário
  const [destCpfCnpj, setDestCpfCnpj] = useState('');
  const [destNome, setDestNome] = useState('');
  const [destEmail, setDestEmail] = useState('');
  const [destIe, setDestIe] = useState('');
  const [indicadorIe, setIndicadorIe] = useState(9);
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [municipio, setMunicipio] = useState('');
  const [uf, setUf] = useState('');
  const [cep, setCep] = useState('');
  const [codMunicipio, setCodMunicipio] = useState('');
  const [cnpjLookupLoading, setCnpjLookupLoading] = useState(false);
  const [cnpjLookupInfo, setCnpjLookupInfo] = useState('');

  // Dados da nota
  const [naturezaOperacao, setNaturezaOperacao] = useState('VENDA DE MERCADORIA');
  const [serie, setSerie] = useState(1);
  const [numeroManual, setNumeroManual] = useState<string>('');
  const [usarNumeroManual, setUsarNumeroManual] = useState(false);
  const [confirmarNumeroManual, setConfirmarNumeroManual] = useState(false);
  const [checkNumeracao, setCheckNumeracao] = useState<string>('');
  const [checkOk, setCheckOk] = useState(false);
  const [checkSalto, setCheckSalto] = useState(false);
  const [checkReutilizavel, setCheckReutilizavel] = useState(false);
  const [checkLoading, setCheckLoading] = useState(false);
  const [formaPagamento, setFormaPagamento] = useState('01');
  const [frete, setFrete] = useState(0);
  const [desconto, setDesconto] = useState(0);
  const [infoAdicional, setInfoAdicional] = useState('');
  const [itens, setItens] = useState<ItemForm[]>([novoItem()]);

  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState<NfeRecord | null>(null);
  /** Nota PENDENTE/RASCUNHO carregada no formulário para editar e reenviar. */
  const [editando, setEditando] = useState<{
    id: string;
    numero: number;
    serie: number;
    status: string;
    status_motivo?: string;
  } | null>(null);
  const [editLoading, setEditLoading] = useState(false);

  const totalProdutos = useMemo(
    () => itens.reduce((s, i) => s + Number(i.quantidade || 0) * Number(i.valor_unitario || 0), 0),
    [itens],
  );
  const totalNota = totalProdutos + Number(frete || 0) - Number(desconto || 0);

  const { data: lista, isLoading } = useQuery({
    queryKey: ['nfe-list', companyId],
    queryFn: () => NfeService.list(companyId, { limit: 20 }),
    enabled: !!companyId,
  });

  const emitirMutation = useMutation({
    mutationFn: async (): Promise<NfeRecord> => {
      const payload: CreateNfePayload = {
        serie: Number(serie) || 1,
        natureza_operacao: naturezaOperacao,
        forma_pagamento: formaPagamento,
        valor_frete: Number(frete) || 0,
        valor_desconto: Number(desconto) || 0,
        informacoes_adicionais: infoAdicional || undefined,
        destinatario: {
          cpf_cnpj: destCpfCnpj.replace(/\D/g, ''),
          razao_social: destNome,
          email: destEmail || undefined,
          inscricao_estadual:
            Number(indicadorIe) === 9
              ? undefined
              : Number(indicadorIe) === 2
                ? 'ISENTO'
                : destIe || undefined,
          indicador_ie: Number(indicadorIe),
          endereco: {
            logradouro: cleanAddr(logradouro),
            numero: cleanAddr(numero) || 'S/N',
            bairro: cleanAddr(bairro),
            municipio: cleanAddr(municipio),
            uf: uf.toUpperCase(),
            cep: cep.replace(/\D/g, ''),
            cod_municipio: codMunicipio.replace(/\D/g, '') || undefined,
          },
        },
        itens: itens.map((i) => ({
          codigo_produto: i.codigo_produto,
          descricao: i.descricao,
          ncm: i.ncm ? i.ncm.replace(/\D/g, '').slice(0, 8) : undefined,
          cfop: i.cfop.replace(/\D/g, '').slice(0, 4),
          unidade: i.unidade || 'UN',
          quantidade: Number(i.quantidade),
          valor_unitario: Number(i.valor_unitario),
          aliquota_icms: Number(i.aliquota_icms) || 0,
          aliquota_pis: Number(i.aliquota_pis) || 0,
          aliquota_cofins: Number(i.aliquota_cofins) || 0,
        })),
      };

      if (usarNumeroManual) {
        const n = Number(numeroManual);
        if (!Number.isInteger(n) || n < 1) {
          throw new Error('Informe um número de NF-e válido.');
        }
        // Reemissão (PENDENTE/RASCUNHO): se a verificação liberou o número
        // (checkOk) e ele é reutilizável / sem lacuna, não exige clique extra
        // no checkbox — o banner de edição já explica o fluxo.
        // Emissão nova ou salto de numeração: exige checkbox explícito.
        const confirmado =
          confirmarNumeroManual
          || (Boolean(editando) && checkOk && (checkReutilizavel || !checkSalto));
        if (!checkOk || !confirmado) {
          throw new Error(
            editando
              ? 'Clique em Verificar no SEFAZ e confirme o checkbox antes de atualizar e reenviar.'
              : 'Valide o número/série no SEFAZ e confirme o checkbox antes de emitir.',
          );
        }
        payload.numero = n;
        payload.confirmar_numero_manual = true;
      }

      const criada = await NfeService.create(companyId, payload);
      return NfeService.authorize(companyId, criada.id);
    },
    onSuccess: async (nfe) => {
      setErro('');
      setResultado(nfe);
      setEditando(null);
      await qc.invalidateQueries({ queryKey: ['nfe-list', companyId] });
    },
    onError: (e: Error) => {
      setResultado(null);
      setErro(e.message);
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async ({ id, justificativa }: { id: string; justificativa: string }) =>
      NfeService.cancel(companyId, id, justificativa),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['nfe-list', companyId] });
    },
    onError: (e: Error) => setErro(e.message),
  });

  // Nota PENDENTE = uma tentativa de emissão anterior falhou (SEFAZ
  // rejeitou, rede caiu, etc.). "Tentar novamente" chama o mesmo endpoint de
  // autorização — o backend agora aceita reprocessar notas PENDENTE, não só
  // RASCUNHO, para não deixar o número/série travado sem saída.
  const retryMutation = useMutation({
    mutationFn: async (id: string) => NfeService.authorize(companyId, id),
    onSuccess: async (nfe) => {
      setErro('');
      setResultado(nfe);
      await qc.invalidateQueries({ queryKey: ['nfe-list', companyId] });
    },
    onError: (e: Error) => setErro(e.message),
  });

  const validar = (): string | null => {
    if (destCpfCnpj.replace(/\D/g, '').length < 11) return 'Informe um CPF/CNPJ válido do destinatário.';
    if (!destNome.trim()) return 'Informe a razão social / nome do destinatário.';
    const log = cleanAddr(logradouro);
    const bai = cleanAddr(bairro);
    const mun = cleanAddr(municipio);
    if (!log || !bai || !mun || !uf || !cep)
      return 'Preencha o endereço completo do destinatário (logradouro, bairro, município, UF e CEP).';
    if (Number(indicadorIe) === 1) {
      const ie = destIe.replace(/\D/g, '');
      if (!ie || /^0+$/.test(ie)) {
        return 'Contribuinte ICMS exige Inscrição Estadual válida (ou selecione Isento / Não contribuinte).';
      }
    }
    if (itens.length === 0) return 'Adicione ao menos um item.';
    for (const i of itens) {
      if (!i.descricao.trim()) return 'Todos os itens precisam de descrição.';
      if (!i.cfop) return 'Informe o CFOP de cada item.';
      if (Number(i.quantidade) <= 0 || Number(i.valor_unitario) <= 0)
        return 'Quantidade e valor unitário devem ser maiores que zero.';
    }
    return null;
  };

  const handleEmitir = () => {
    const v = validar();
    if (v) {
      setErro(v);
      setResultado(null);
      return;
    }
    setErro('');
    emitirMutation.mutate();
  };

  const updateItem = (key: string, patch: Partial<ItemForm>) =>
    setItens((prev) => prev.map((i) => (i._key === key ? { ...i, ...patch } : i)));

  const handleCancelar = (nfe: NfeRecord) => {
    const justificativa = window.prompt(
      'Justificativa do cancelamento (mínimo 15 caracteres):',
    );
    if (!justificativa) return;
    if (justificativa.trim().length < 15) {
      setErro('A justificativa de cancelamento deve ter no mínimo 15 caracteres.');
      return;
    }
    cancelMutation.mutate({ id: nfe.id, justificativa: justificativa.trim() });
  };

  const handleDownloadXml = async (nfe: NfeRecord) => {
    try {
      const blob = await NfeService.downloadXml(companyId, nfe.id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `nfe-${nfe.numero}.xml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  /**
   * Abre o DANFE em outra aba, para conferir e imprimir.
   *
   * Não usa <a href> porque a rota exige token no cabeçalho. E não revoga a URL
   * na hora: o object URL precisa continuar válido enquanto a aba estiver
   * aberta — revogar imediatamente, como faz o download de XML (onde o arquivo
   * já foi salvo), deixaria a aba em branco.
   */
  const handleDanfe = async (nfe: NfeRecord) => {
    try {
      const blob = await NfeService.downloadDanfe(companyId, nfe.id);
      const url = URL.createObjectURL(blob);
      const aba = window.open(url, '_blank');
      if (!aba) {
        // Bloqueador de pop-up: cai para download, que não depende de aba nova.
        const a = document.createElement('a');
        a.href = url;
        a.download = `danfe-${nfe.numero}.pdf`;
        a.click();
      }
      // 60s é folga suficiente para o navegador ler o blob e renderizar.
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (e) {
      setErro((e as Error).message);
    }
  };

  const parseDestEndereco = (raw?: string) => {
    if (!raw) return null;
    try {
      return JSON.parse(raw) as {
        endereco?: {
          logradouro?: string;
          numero?: string;
          bairro?: string;
          municipio?: string;
          uf?: string;
          cep?: string;
          cod_municipio?: string;
        };
        inscricao_estadual?: string;
        indicador_ie?: number;
      };
    } catch {
      return null;
    }
  };

  const mapItensParaForm = (itensDb: NfeItemRecord[]): ItemForm[] => {
    if (!itensDb.length) return [novoItem()];
    return itensDb.map((item) => ({
      _key: Math.random().toString(36).slice(2),
      codigo_produto: item.codigo_produto || '',
      descricao: item.descricao || '',
      ncm: item.ncm || '',
      cfop: item.cfop || '5102',
      unidade: item.unidade || 'UN',
      quantidade: Number(item.quantidade) || 1,
      valor_unitario: Number(item.valor_unitario) || 0,
      aliquota_icms: Number(item.aliquota_icms) || 0,
      aliquota_pis: Number(item.aliquota_pis) || 0,
      aliquota_cofins: Number(item.aliquota_cofins) || 0,
    }));
  };

  /** Carrega PENDENTE/RASCUNHO no formulário para o usuário editar e reemitir. */
  const handleEditarNota = async (nfe: NfeRecord) => {
    if (nfe.status !== 'PENDENTE' && nfe.status !== 'RASCUNHO') {
      setErro('Só é possível editar notas em RASCUNHO ou PENDENTE.');
      return;
    }
    setEditLoading(true);
    setErro('');
    setResultado(null);
    try {
      const detail = await NfeService.get(companyId, nfe.id);
      const destMeta = parseDestEndereco(detail.dest_endereco);
      const end = destMeta?.endereco;

      setDestCpfCnpj(detail.dest_cpf_cnpj || '');
      setDestNome(detail.dest_razao_social || '');
      setDestEmail(detail.dest_email || '');
      {
        const ind = Number(destMeta?.indicador_ie ?? 9);
        const ieRaw = String(destMeta?.inscricao_estadual || '').trim();
        const ieDigits = ieRaw.replace(/\D/g, '');
        if (ind === 2 || ieRaw.toUpperCase() === 'ISENTO') {
          setIndicadorIe(2);
          setDestIe('ISENTO');
        } else if (ind === 9 || !ieDigits || /^0+$/.test(ieDigits)) {
          setIndicadorIe(9);
          setDestIe('');
        } else {
          setIndicadorIe(1);
          setDestIe(ieDigits);
        }
      }
      setLogradouro(cleanAddr(end?.logradouro));
      setNumero(cleanAddr(end?.numero) || 'S/N');
      setBairro(cleanAddr(end?.bairro));
      setMunicipio(cleanAddr(end?.municipio));
      setUf((end?.uf || '').toUpperCase());
      setCep(end?.cep || '');
      setCodMunicipio(end?.cod_municipio || '');

      setNaturezaOperacao(detail.natureza_operacao || 'VENDA DE MERCADORIA');
      setSerie(Number(detail.serie) || 1);
      setUsarNumeroManual(true);
      setNumeroManual(String(detail.numero));
      setFrete(Number(detail.valor_frete) || 0);
      setDesconto(Number(detail.valor_desconto) || 0);
      setInfoAdicional(detail.informacoes_adicionais || '');
      setItens(mapItensParaForm(detail.itens || []));

      setEditando({
        id: detail.id,
        numero: detail.numero,
        serie: detail.serie,
        status: detail.status,
        status_motivo: detail.status_motivo,
      });

      // Revalida número; em reemissão (PENDENTE/RASCUNHO) já confirma o checkbox
      // para não bloquear "Atualizar e reenviar" com clique extra.
      setCheckLoading(true);
      setCheckNumeracao('');
      setCheckOk(false);
      setCheckSalto(false);
      setCheckReutilizavel(false);
      setConfirmarNumeroManual(false);
      try {
        const result = await NfeService.verificarNumeracao(companyId, {
          serie: Number(detail.serie) || 1,
          numero: Number(detail.numero),
        });
        const reutilizavel = Boolean(result.reutilizavel);
        const salto = result.disponivel && result.salto_numeracao && !reutilizavel;
        setCheckNumeracao(result.mensagem);
        setCheckOk(result.disponivel);
        setCheckSalto(salto);
        setCheckReutilizavel(reutilizavel);
        // Disponível (e sem lacuna) ou reutilizável: confirma automaticamente na edição.
        setConfirmarNumeroManual(Boolean(result.disponivel && (!salto || reutilizavel)));
        if (result.disponivel) setErro('');
      } catch (e) {
        // Em edição, se a verificação falhar por rede, ainda permite confirmar
        // manualmente depois — mas deixa checkOk false até o usuário clicar em Verificar.
        setCheckOk(false);
        setCheckNumeracao(e instanceof Error ? e.message : 'Falha na verificação');
      } finally {
        setCheckLoading(false);
      }

      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível carregar a nota para edição.');
      setEditando(null);
    } finally {
      setEditLoading(false);
    }
  };

  const cancelarEdicao = () => {
    setEditando(null);
    setUsarNumeroManual(false);
    setNumeroManual('');
    setConfirmarNumeroManual(false);
    setCheckNumeracao('');
    setCheckOk(false);
    setCheckSalto(false);
    setCheckReutilizavel(false);
  };

  const preencherDestinatarioPorDocumento = async () => {
    const documento = destCpfCnpj.replace(/\D/g, '');
    if (documento.length !== 11 && documento.length !== 14) return;

    setCnpjLookupLoading(true);
    setCnpjLookupInfo('');
    try {
      const data: DocumentoLookupResult = await CompanyService.lookupDocumento(documento);

      if (data.tipo === 'cnpj') {
        if (data.razao_social) setDestNome(data.razao_social);
        if (data.contato?.email && !destEmail) setDestEmail(data.contato.email);
        const end = data.endereco;
        const log = cleanAddr(end?.logradouro);
        const num = cleanAddr(end?.numero);
        const bai = cleanAddr(end?.bairro);
        const mun = cleanAddr(end?.municipio);
        if (log) setLogradouro(log);
        else setLogradouro('');
        setNumero(num || 'S/N');
        if (bai) setBairro(bai);
        if (mun) setMunicipio(mun);
        if (end?.uf) setUf(end.uf.toUpperCase());
        if (end?.cep) setCep(end.cep);
        const ibge = cleanAddr(end?.codigo_municipio_ibge).replace(/\D/g, '');
        if (ibge.length === 7) setCodMunicipio(ibge);

        if (!log || !bai || !mun || !end?.cep) {
          setCnpjLookupInfo(
            'CNPJ consultado, mas o endereço na Receita está incompleto. Preencha logradouro/número manualmente.',
          );
        } else {
          setCnpjLookupInfo('CNPJ consultado: razão social e endereço preenchidos automaticamente.');
        }
      } else {
        if (data.nome) setDestNome(data.nome);
        const end = data.endereco;
        const log = cleanAddr(end?.logradouro);
        const num = cleanAddr(end?.numero);
        if (log) setLogradouro(log);
        else setLogradouro('');
        if (num) setNumero(num);
        else if (log) setNumero('S/N');
        if (end?.bairro) setBairro(cleanAddr(end.bairro));
        if (end?.municipio) setMunicipio(cleanAddr(end.municipio));
        if (end?.uf) setUf(end.uf.toUpperCase());
        if (end?.cep) setCep(end.cep);
        setCnpjLookupInfo('CPF consultado: nome e endereço preenchidos quando disponíveis.');
      }
    } catch {
      setCnpjLookupInfo('Não foi possível consultar esse documento agora. Você pode preencher manualmente.');
    } finally {
      setCnpjLookupLoading(false);
    }
  };

  if (!companyId) {
    return (
      <div className="p-6">
        <div className="card p-6 text-sm text-gray-600">
          Selecione uma empresa para emitir NF-e.
        </div>
      </div>
    );
  }

  const ambiente = resultado?.ambiente || 'homologacao';

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-600 text-white">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Emissão de NF-e</h1>
            <p className="text-sm text-gray-500">Nota Fiscal Eletrônica modelo 55</p>
          </div>
        </div>
        <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            O ambiente de emissão (<strong>homologação</strong> ou produção) é definido no servidor
            pela variável <code>NFE_AMBIENTE</code>. Em homologação as notas <strong>não têm valor
            fiscal</strong>. Valide em homologação com o certificado A1 real antes de liberar produção.
          </span>
        </div>
      </header>

      {erro && (
        <div className="flex items-start gap-2 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          <Ban className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{erro}</span>
        </div>
      )}

      {editando && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <Pencil className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1 space-y-1">
            <p className="font-semibold">
              Editando NF-e {editando.numero} série {editando.serie} ({editando.status})
            </p>
            <p>
              Altere os dados necessários e clique em <strong>Atualizar e reenviar</strong>. A
              numeração é validada ao abrir a edição; o checkbox de confirmação já fica marcado
              quando o número estiver liberado.
            </p>
            {editando.status_motivo?.toLowerCase().includes('lote processado') && (
              <p className="text-amber-800">
                Atenção: o motivo &quot;Lote processado&quot; pode indicar que a SEFAZ já processou
                o lote. Antes de reenviar, use <strong>Verificar no SEFAZ</strong> — se o número já
                estiver autorizado, não reemita (risco de duplicidade cStat 539).
              </p>
            )}
            <button
              type="button"
              className="text-xs font-semibold text-amber-900 underline"
              onClick={cancelarEdicao}
            >
              Cancelar edição
            </button>
          </div>
        </div>
      )}

      {resultado && (
        <div className="flex items-start gap-2 rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">
              NF-e {resultado.numero} {resultado.status === 'AUTORIZADA' ? 'autorizada' : resultado.status} ({ambiente})
            </p>
            {resultado.protocolo && <p>Protocolo: {resultado.protocolo}</p>}
            {resultado.chave_acesso && <p className="break-all">Chave: {resultado.chave_acesso}</p>}
            {resultado.status_motivo && <p>{resultado.status_motivo}</p>}
          </div>
        </div>
      )}

      {/* Destinatário */}
      <section className="card space-y-4 p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-700">Destinatário</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Input
            label="CPF / CNPJ"
            value={destCpfCnpj}
            hint={
              cnpjLookupLoading
                ? 'Consultando CNPJ...'
                : cnpjLookupInfo || 'Ao sair do campo, buscamos CPF/CNPJ automaticamente.'
            }
            onChange={(e) => {
              setDestCpfCnpj(e.target.value);
              setCnpjLookupInfo('');
            }}
            onBlur={preencherDestinatarioPorDocumento}
          />
          <Input label="Razão social / Nome" value={destNome} onChange={(e) => setDestNome(e.target.value)} />
          <Input label="E-mail" type="email" value={destEmail} onChange={(e) => setDestEmail(e.target.value)} />
          <Input
            label="Inscrição Estadual"
            value={destIe}
            onChange={(e) => setDestIe(e.target.value)}
            disabled={indicadorIe === 9}
            hint={
              indicadorIe === 9
                ? 'Não contribuinte: IE não é informada na NF-e'
                : indicadorIe === 2
                  ? 'Use ISENTO (ou deixe que o sistema preencha)'
                  : 'Obrigatória para contribuinte ICMS'
            }
          />
          <div className="w-full">
            <label className="input-label">Indicador IE</label>
            <select
              className="input-field"
              value={indicadorIe}
              onChange={(e) => {
                const v = Number(e.target.value);
                setIndicadorIe(v);
                if (v === 9) setDestIe('');
                if (v === 2) setDestIe('ISENTO');
              }}
            >
              <option value={1}>1 - Contribuinte ICMS</option>
              <option value={2}>2 - Isento de IE</option>
              <option value={9}>9 - Não contribuinte</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input label="Logradouro" value={logradouro} onChange={(e) => setLogradouro(e.target.value)} />
          <Input label="Número" value={numero} onChange={(e) => setNumero(e.target.value)} />
          <Input label="Bairro" value={bairro} onChange={(e) => setBairro(e.target.value)} />
          <Input label="Município" value={municipio} onChange={(e) => setMunicipio(e.target.value)} />
          <Input label="UF" maxLength={2} value={uf} onChange={(e) => setUf(e.target.value.toUpperCase())} />
          <Input label="CEP" value={cep} onChange={(e) => setCep(e.target.value)} />
          <Input label="Cód. IBGE do município" hint="7 dígitos" value={codMunicipio} onChange={(e) => setCodMunicipio(e.target.value)} />
        </div>
      </section>

      {/* Itens */}
      <section className="card space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-gray-700">Itens / Produtos</h2>
          <Button variant="secondary" size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setItens((p) => [...p, novoItem()])}>
            Adicionar item
          </Button>
        </div>
        <div className="space-y-4">
          {itens.map((item, idx) => (
            <div key={item._key} className="rounded-xl border border-gray-200 p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500">Item {idx + 1}</span>
                {itens.length > 1 && (
                  <button
                    type="button"
                    className="text-red-500 hover:text-red-700"
                    onClick={() => setItens((p) => p.filter((i) => i._key !== item._key))}
                    aria-label="Remover item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Input label="Código" value={item.codigo_produto} onChange={(e) => updateItem(item._key, { codigo_produto: e.target.value })} />
                <Input label="Descrição" value={item.descricao} onChange={(e) => updateItem(item._key, { descricao: e.target.value })} />
                <Input
                  label="NCM (8 dígitos)"
                  placeholder="84212300"
                  maxLength={10}
                  value={item.ncm}
                  onChange={(e) =>
                    updateItem(item._key, {
                      ncm: e.target.value.replace(/\D/g, '').slice(0, 8),
                    })
                  }
                />
                <Input
                  label="CFOP"
                  placeholder="5102"
                  maxLength={4}
                  value={item.cfop}
                  onChange={(e) =>
                    updateItem(item._key, {
                      cfop: e.target.value.replace(/\D/g, '').slice(0, 4),
                    })
                  }
                />
                <Input label="Unidade" value={item.unidade} onChange={(e) => updateItem(item._key, { unidade: e.target.value })} />
                <Input label="Quantidade" type="number" step="0.0001" value={item.quantidade} onChange={(e) => updateItem(item._key, { quantidade: Number(e.target.value) })} />
                <Input label="Valor unitário" type="number" step="0.01" value={item.valor_unitario} onChange={(e) => updateItem(item._key, { valor_unitario: Number(e.target.value) })} />
                <Input label="Alíq. ICMS %" type="number" step="0.01" value={item.aliquota_icms} onChange={(e) => updateItem(item._key, { aliquota_icms: Number(e.target.value) })} />
                <Input label="Alíq. PIS %" type="number" step="0.01" value={item.aliquota_pis} onChange={(e) => updateItem(item._key, { aliquota_pis: Number(e.target.value) })} />
                <Input label="Alíq. COFINS %" type="number" step="0.01" value={item.aliquota_cofins} onChange={(e) => updateItem(item._key, { aliquota_cofins: Number(e.target.value) })} />
              </div>
              <p className="mt-2 text-right text-xs text-gray-500">
                Subtotal: {brl(Number(item.quantidade || 0) * Number(item.valor_unitario || 0))}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Dados da nota */}
      <section className="card space-y-4 p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-700">Dados da nota</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Input label="Natureza da operação" value={naturezaOperacao} onChange={(e) => setNaturezaOperacao(e.target.value)} />
          <Input
            label="Série"
            type="number"
            value={serie}
            onChange={(e) => {
              setSerie(Number(e.target.value));
              setCheckOk(false);
              setCheckSalto(false);
              setConfirmarNumeroManual(false);
              setCheckNumeracao('');
            }}
          />
          <div className="w-full space-y-2">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={usarNumeroManual}
                onChange={(e) => {
                  setUsarNumeroManual(e.target.checked);
                  setCheckOk(false);
                  setCheckSalto(false);
                  setConfirmarNumeroManual(false);
                  setCheckNumeracao('');
                }}
              />
              Informar número manualmente
            </label>
            <Input
              label="Número da NF-e"
              type="number"
              disabled={!usarNumeroManual}
              value={numeroManual}
              onChange={(e) => {
                setNumeroManual(e.target.value);
                setCheckOk(false);
                setCheckSalto(false);
                setConfirmarNumeroManual(false);
                setCheckNumeracao('');
              }}
              hint={usarNumeroManual ? 'Ex.: 189 após a 188' : 'Automático se desmarcado'}
            />
          </div>
          <div className="w-full">
            <label className="input-label">Forma de pagamento</label>
            <select className="input-field" value={formaPagamento} onChange={(e) => setFormaPagamento(e.target.value)}>
              <option value="01">Dinheiro</option>
              <option value="03">Cartão de crédito</option>
              <option value="04">Cartão de débito</option>
              <option value="15">Boleto bancário</option>
              <option value="17">PIX</option>
              <option value="90">Sem pagamento</option>
            </select>
          </div>
          <Input label="Frete (R$)" type="number" step="0.01" value={frete} onChange={(e) => setFrete(Number(e.target.value))} />
          <Input label="Desconto (R$)" type="number" step="0.01" value={desconto} onChange={(e) => setDesconto(Number(e.target.value))} />
        </div>

        {usarNumeroManual && (
          <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4">
            <p className="text-sm text-amber-900">
              Antes de emitir, valide número/série na base e na SEFAZ. A confirmação definitiva de
              duplicidade também ocorre na autorização (cStat 539).
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                loading={checkLoading}
                onClick={async () => {
                  setCheckLoading(true);
                  setCheckNumeracao('');
                  setCheckOk(false);
                  setCheckSalto(false);
                  setCheckReutilizavel(false);
                  setConfirmarNumeroManual(false);
                  try {
                    const n = Number(numeroManual);
                    const result = await NfeService.verificarNumeracao(companyId, {
                      serie: Number(serie) || 1,
                      numero: n,
                    });
                    const reutilizavel = Boolean(result.reutilizavel);
                    const salto = result.disponivel && result.salto_numeracao && !reutilizavel;
                    setCheckNumeracao(result.mensagem);
                    setCheckOk(result.disponivel);
                    setCheckSalto(salto);
                    setCheckReutilizavel(reutilizavel);
                    // Disponível (sem lacuna) ou reutilizável: confirma automaticamente.
                    setConfirmarNumeroManual(Boolean(result.disponivel && (!salto || reutilizavel)));
                    if (result.disponivel) setErro('');
                  } catch (e) {
                    setCheckOk(false);
                    setCheckSalto(false);
                    setCheckReutilizavel(false);
                    setCheckNumeracao(e instanceof Error ? e.message : 'Falha na verificação');
                  } finally {
                    setCheckLoading(false);
                  }
                }}
              >
                Verificar no SEFAZ
              </Button>
            </div>
            {checkNumeracao && (
              <p
                className={`text-sm ${
                  !checkOk
                    ? 'text-red-700'
                    : checkReutilizavel || checkSalto
                      ? 'text-amber-800'
                      : 'text-emerald-800'
                }`}
              >
                {checkNumeracao}
              </p>
            )}
            <label className="flex items-start gap-2 text-sm text-gray-800">
              <input
                type="checkbox"
                className="mt-1"
                checked={confirmarNumeroManual}
                disabled={!checkOk}
                onChange={(e) => setConfirmarNumeroManual(e.target.checked)}
              />
              <span>
                {checkReutilizavel ? (
                  <>
                    Confirmo a reemissão do número <strong>{numeroManual}</strong> série{' '}
                    <strong>{serie}</strong> (nota pendente/rascunho será atualizada e reenviada à
                    SEFAZ).
                  </>
                ) : (
                  <>
                    Confirmo que o número <strong>{numeroManual}</strong> série{' '}
                    <strong>{serie}</strong> está correto e foi validado (livre na base / SEFAZ
                    online).
                  </>
                )}
              </span>
            </label>
          </div>
        )}
        <div className="w-full">
          <label className="input-label">Informações complementares</label>
          <textarea
            className="input-field min-h-[72px]"
            value={infoAdicional}
            onChange={(e) => setInfoAdicional(e.target.value)}
          />
        </div>
        <div className="flex flex-col items-end gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-gray-600">
            <p>Produtos: <strong>{brl(totalProdutos)}</strong></p>
            <p className="text-lg font-bold text-gray-900">Total da nota: {brl(totalNota)}</p>
          </div>
          <Button size="lg" loading={emitirMutation.isPending} onClick={handleEmitir} icon={<FileText className="h-4 w-4" />}>
            {editando ? 'Atualizar e reenviar' : 'Emitir NF-e'}
          </Button>
        </div>
      </section>

      {/* Notas emitidas */}
      <section className="card space-y-3 p-5">
        <h2 className="text-sm font-bold uppercase tracking-wide text-gray-700">NF-e recentes</h2>
        {isLoading ? (
          <p className="text-sm text-gray-500">Carregando...</p>
        ) : !lista?.data.length ? (
          <p className="text-sm text-gray-500">Nenhuma NF-e emitida ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left text-xs uppercase text-gray-500">
                  <th className="py-2 pr-3">Número</th>
                  <th className="py-2 pr-3">Destinatário</th>
                  <th className="py-2 pr-3">Valor</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Ações</th>
                </tr>
              </thead>
              <tbody>
                {lista.data.map((nfe) => (
                  <tr key={nfe.id} className="border-b border-gray-100">
                    <td className="py-2 pr-3">{nfe.numero}/{nfe.serie}</td>
                    <td className="py-2 pr-3">{nfe.dest_razao_social}</td>
                    <td className="py-2 pr-3">{brl(Number(nfe.valor_total))}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={
                          nfe.status === 'AUTORIZADA'
                            ? 'rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700'
                            : nfe.status === 'CANCELADA'
                              ? 'rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold text-gray-600'
                              : nfe.status === 'PENDENTE'
                                ? 'rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700'
                                : 'rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700'
                        }
                      >
                        {nfe.status}
                      </span>
                      {nfe.status === 'PENDENTE' && nfe.status_motivo && (
                        <p className="mt-1 max-w-xs text-xs text-amber-700">{nfe.status_motivo}</p>
                      )}
                    </td>
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="text-gray-500 hover:text-primary-600"
                          title="Baixar XML"
                          onClick={() => handleDownloadXml(nfe)}
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        {/*
                          DANFE só aparece para nota autorizada ou cancelada:
                          são as únicas que têm XML autorizado. Mostrar o botão
                          em rascunho convidaria a um clique que só devolve erro.
                          A cancelada mantém o botão porque o DANFE dela sai com
                          a marca d'água de cancelamento e serve de comprovante.
                        */}
                        {(nfe.status === 'AUTORIZADA' || nfe.status === 'CANCELADA') && (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-md border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                            title="Abrir DANFE em PDF para imprimir"
                            onClick={() => handleDanfe(nfe)}
                          >
                            <Printer className="h-3.5 w-3.5" />
                            DANFE
                          </button>
                        )}
                        {(nfe.status === 'PENDENTE' || nfe.status === 'RASCUNHO') && (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-md border border-primary-300 bg-primary-50 px-2 py-1 text-xs font-semibold text-primary-800 hover:bg-primary-100 disabled:opacity-50"
                            title="Editar dados e reenviar à SEFAZ"
                            disabled={editLoading}
                            onClick={() => handleEditarNota(nfe)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                            Editar
                          </button>
                        )}
                        {nfe.status === 'PENDENTE' && (
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-50"
                            title="Tentar novamente (reenviar à SEFAZ sem alterar dados)"
                            disabled={retryMutation.isPending}
                            onClick={() => retryMutation.mutate(nfe.id)}
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Tentar novamente
                          </button>
                        )}
                        {nfe.status === 'AUTORIZADA' && (
                          <button
                            type="button"
                            className="text-gray-500 hover:text-red-600"
                            title="Cancelar NF-e"
                            onClick={() => handleCancelar(nfe)}
                          >
                            <Ban className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
