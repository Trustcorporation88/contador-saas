import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, FileText, Download, Ban, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { CompanyService, type DocumentoLookupResult } from '../../services/companyService';
import {
  NfeService,
  type CreateNfePayload,
  type NfeItemPayload,
  type NfeRecord,
} from '../../services/nfeService';

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
  const [formaPagamento, setFormaPagamento] = useState('01');
  const [frete, setFrete] = useState(0);
  const [desconto, setDesconto] = useState(0);
  const [infoAdicional, setInfoAdicional] = useState('');
  const [itens, setItens] = useState<ItemForm[]>([novoItem()]);

  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState<NfeRecord | null>(null);

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
          inscricao_estadual: destIe || undefined,
          indicador_ie: Number(indicadorIe),
          endereco: {
            logradouro,
            numero,
            bairro,
            municipio,
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
      const criada = await NfeService.create(companyId, payload);
      return NfeService.authorize(companyId, criada.id);
    },
    onSuccess: async (nfe) => {
      setErro('');
      setResultado(nfe);
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

  const validar = (): string | null => {
    if (destCpfCnpj.replace(/\D/g, '').length < 11) return 'Informe um CPF/CNPJ válido do destinatário.';
    if (!destNome.trim()) return 'Informe a razão social / nome do destinatário.';
    if (!logradouro || !bairro || !municipio || !uf || !cep)
      return 'Preencha o endereço completo do destinatário.';
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
        if (data.endereco?.logradouro) setLogradouro(data.endereco.logradouro);
        if (data.endereco?.numero) setNumero(data.endereco.numero);
        if (data.endereco?.bairro) setBairro(data.endereco.bairro);
        if (data.endereco?.municipio) setMunicipio(data.endereco.municipio);
        if (data.endereco?.uf) setUf(data.endereco.uf.toUpperCase());
        if (data.endereco?.cep) setCep(data.endereco.cep);
        setCnpjLookupInfo('CNPJ consultado: razão social e endereço preenchidos automaticamente.');
      } else {
        if (data.nome) setDestNome(data.nome);
        const end = data.endereco;
        if (end?.logradouro) setLogradouro(end.logradouro);
        if (end?.numero) setNumero(end.numero);
        if (end?.bairro) setBairro(end.bairro);
        if (end?.municipio) setMunicipio(end.municipio);
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
          <Input label="Inscrição Estadual" value={destIe} onChange={(e) => setDestIe(e.target.value)} />
          <div className="w-full">
            <label className="input-label">Indicador IE</label>
            <select className="input-field" value={indicadorIe} onChange={(e) => setIndicadorIe(Number(e.target.value))}>
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
          <Input label="Série" type="number" value={serie} onChange={(e) => setSerie(Number(e.target.value))} />
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
            Emitir NF-e
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
