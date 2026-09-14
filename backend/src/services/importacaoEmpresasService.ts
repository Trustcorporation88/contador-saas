/**
 * Importação de empresas por planilha
 *
 * Fluxo em duas etapas, de propósito:
 *
 *  1. analisar(buffer): lê a planilha, normaliza e valida cada linha, e diz o
 *     que vai acontecer com ela (importar, pular por já existir, erro). NÃO
 *     cria nada e NÃO consulta CNPJ, então responde rápido e a pessoa confere
 *     antes de rodar.
 *  2. importarLote(linhas): cria as empresas de um lote pequeno, consultando o
 *     cartão do CNPJ de cada uma para completar endereço, inscrição estadual e
 *     código IBGE (a planilha não traz isso e a NF-e exige). A tela manda lote
 *     a lote e mostra o progresso; assim centenas de empresas não viram uma
 *     única requisição gigante que estoura timeout.
 *
 * Colunas esperadas (o cabeçalho é casado por nome, então a ordem pode mudar):
 *   CNPJ, CPF, CATEGORIA, REGIME TRIBUTÁRIO, NATUREZA JURÍDICA, CNAE,
 *   CÓD DOMINIO, PROJETO, RAZÃO SOCIAL, CIDADE, ESTADO, TELEFONE, E-MAIL
 */

import ExcelJS from 'exceljs';
import { getDatabase } from '../config/database';
import { CompanyService } from './companyService';
import { CnpjService } from './cnpjService';
import { UserManagementService } from './userManagementService';
import { projetoValido } from './projetoAlertaService';
import { atividadeValida } from './atividadeService';
import { logger } from '../middleware/requestLogger';

export interface LinhaImportacao {
  linha: number;
  cnpj: string;
  razao_social: string;
  email?: string;
  telefone?: string;
  cidade?: string;
  uf?: string;
  projeto?: string | null;
  atividade?: string | null;
  categoria?: string;
  situacao: 'importar' | 'existente' | 'erro';
  motivo?: string;
}

export interface ResultadoLinha {
  linha: number;
  cnpj: string;
  razao_social: string;
  ok: boolean;
  company_id?: string;
  motivo?: string;
}

const CABECALHOS: Record<string, string> = {
  'cnpj': 'cnpj',
  'cpf': 'cpf',
  'categoria': 'categoria',
  'regime tributario': 'regime',
  'natureza juridica': 'natureza',
  'cnae': 'atividade',
  'cod dominio': 'cod_dominio',
  'projeto': 'projeto',
  'razao social': 'razao_social',
  'cidade': 'cidade',
  'estado': 'uf',
  'telefone': 'telefone',
  'e-mail': 'email',
  'email': 'email',
};

/** Tira acento, quebra de linha e espaço extra para casar o cabeçalho. */
function normalizarCabecalho(v: unknown): string {
  return String(v ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function digitos(v: unknown): string {
  return String(v ?? '').replace(/\D/g, '');
}

export function cnpjValido(cnpj: string): boolean {
  const c = digitos(cnpj);
  if (c.length !== 14 || /^(\d)\1{13}$/.test(c)) return false;
  const dv = (base: string, pesos: number[]): string => {
    const soma = base.split('').reduce((acc, d, i) => acc + Number(d) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? '0' : String(11 - resto);
  };
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const p2 = [6, ...p1];
  return c[12] === dv(c.slice(0, 12), p1) && c[13] === dv(c.slice(0, 13), p2);
}

/**
 * CNPJ da planilha: o Excel guarda como número e come o zero à esquerda
 * (01477539000107 vira 1477539000107). Repõe até 14 antes de validar.
 */
export function normalizarCnpj(valor: unknown): string {
  const d = digitos(valor);
  if (!d) return '';
  return d.length < 14 ? d.padStart(14, '0') : d;
}

/**
 * Projeto: a coluna traz "LIDER ME", mas a categoria manda quando diverge.
 * Uma linha do projeto Líder marcada como MEI na categoria é LIDER_MEI, que é
 * o que decide o alerta certo (teto do MEI em vez de exclusão do Simples).
 */
export function mapearProjeto(projeto: unknown, categoria: unknown): string | null {
  const p = String(projeto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').trim().toUpperCase();
  const cat = String(categoria ?? '').trim().toUpperCase();
  if (!p) return null;

  const familia = p.startsWith('LIDER') ? 'LIDER' : p.startsWith('CBPJ') ? 'CBPJ' : null;
  if (!familia) return null;

  // A categoria da linha vence: a planilha do projeto Líder ME tem algumas
  // consultoras que ainda são MEI.
  if (cat === 'MEI') return `${familia}_MEI`;
  if (cat === 'ME') return `${familia}_ME`;
  // Sem categoria, usa o que está escrito no projeto.
  if (p.includes('MEI')) return `${familia}_MEI`;
  if (p.includes('ME')) return `${familia}_ME`;
  return null;
}

/** Atividade: "Serviço", "Serviço/Comércio", "Comércio" (com ou sem espaços). */
export function mapearAtividade(valor: unknown): string | null {
  const v = String(valor ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '').trim().toUpperCase();
  if (!v) return null;
  const temServico = v.includes('SERVICO');
  const temComercio = v.includes('COMERCIO');
  if (temServico && temComercio) return 'COMERCIO_SERVICO';
  if (temComercio) return 'COMERCIO';
  if (temServico) return 'SERVICOS';
  return null;
}

export class ImportacaoEmpresasService {

  /** Lê a planilha e devolve o diagnóstico linha a linha, sem criar nada. */
  static async analisar(buffer: Buffer): Promise<{ linhas: LinhaImportacao[]; resumo: Record<string, number> }> {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    const ws = wb.worksheets[0];
    if (!ws) throw Object.assign(new Error('Planilha vazia ou ilegível'), { status: 400 });

    // Mapa coluna -> campo, pelo cabeçalho da primeira linha.
    const colunas = new Map<number, string>();
    ws.getRow(1).eachCell((cell, col) => {
      const campo = CABECALHOS[normalizarCabecalho(cell.value)];
      if (campo) colunas.set(col, campo);
    });
    if (!Array.from(colunas.values()).includes('cnpj')) {
      throw Object.assign(new Error('A planilha precisa de uma coluna CNPJ no cabeçalho'), { status: 400 });
    }

    const db = await getDatabase();
    const linhas: LinhaImportacao[] = [];
    const vistos = new Set<string>();

    for (let n = 2; n <= ws.rowCount; n++) {
      const row = ws.getRow(n);
      const dados: Record<string, unknown> = {};
      colunas.forEach((campo, col) => {
        const v = row.getCell(col).value;
        // Célula de fórmula/rich text: pega o texto resultante.
        dados[campo] = (v && typeof v === 'object' && 'result' in (v as any))
          ? (v as any).result
          : (v && typeof v === 'object' && 'text' in (v as any))
            ? (v as any).text
            : v;
      });

      const bruto = dados.cnpj;
      if (bruto === null || bruto === undefined || String(bruto).trim() === '') continue;

      const cnpj = normalizarCnpj(bruto);
      const razao = String(dados.razao_social ?? '').trim();

      // Linhas de anotação ("MIGRANDO", "POSSUI CONTADOR") caem aqui: texto na
      // coluna do CNPJ, sem dígitos suficientes. São ignoradas em silêncio.
      if (digitos(bruto).length < 8) continue;

      const base: LinhaImportacao = {
        linha: n,
        cnpj,
        razao_social: razao,
        email: String(dados.email ?? '').trim() || undefined,
        telefone: String(dados.telefone ?? '').trim() || undefined,
        cidade: String(dados.cidade ?? '').trim() || undefined,
        uf: String(dados.uf ?? '').trim().toUpperCase() || undefined,
        categoria: String(dados.categoria ?? '').trim() || undefined,
        projeto: mapearProjeto(dados.projeto, dados.categoria),
        atividade: mapearAtividade(dados.atividade),
        situacao: 'importar',
      };

      if (!cnpjValido(cnpj)) {
        linhas.push({ ...base, situacao: 'erro', motivo: 'CNPJ inválido' });
        continue;
      }
      if (!razao) {
        linhas.push({ ...base, situacao: 'erro', motivo: 'Sem razão social' });
        continue;
      }
      if (vistos.has(cnpj)) {
        linhas.push({ ...base, situacao: 'erro', motivo: 'CNPJ repetido na planilha' });
        continue;
      }
      vistos.add(cnpj);

      const existe = await db('companies').where({ cnpj }).first('id');
      if (existe) {
        linhas.push({ ...base, situacao: 'existente', motivo: 'Já cadastrada no sistema' });
        continue;
      }

      linhas.push(base);
    }

    const resumo = {
      total: linhas.length,
      importar: linhas.filter((l) => l.situacao === 'importar').length,
      existente: linhas.filter((l) => l.situacao === 'existente').length,
      erro: linhas.filter((l) => l.situacao === 'erro').length,
    };
    return { linhas, resumo };
  }

  /**
   * Cria as empresas de um lote. Cada linha é isolada: erro numa não impede as
   * outras, e o retorno diz exatamente o que aconteceu com cada uma.
   *
   * @param criadorId quem está importando (vira vínculo automático)
   * @param atribuirPara usuário adicional que também deve enxergar as empresas
   */
  static async importarLote(
    linhas: LinhaImportacao[],
    criadorId: string,
    atribuirPara?: string,
  ): Promise<ResultadoLinha[]> {
    const resultados: ResultadoLinha[] = [];

    for (const linha of linhas) {
      const base = { linha: linha.linha, cnpj: linha.cnpj, razao_social: linha.razao_social };
      try {
        if (linha.situacao !== 'importar') {
          resultados.push({ ...base, ok: false, motivo: linha.motivo ?? 'Linha ignorada' });
          continue;
        }

        // Cartão do CNPJ: completa o que a planilha não tem (endereço, IE,
        // código IBGE). Se a consulta falhar, a empresa ainda é criada com o
        // básico; o cadastro fica incompleto para NF-e e a pessoa completa
        // depois, o que é melhor do que perder a linha inteira.
        let cartao: Awaited<ReturnType<typeof CnpjService.lookup>> | null = null;
        try {
          cartao = await CnpjService.lookup(linha.cnpj);
        } catch (e) {
          logger.debug('[IMPORTACAO] lookup falhou, seguindo com o básico', {
            cnpj: linha.cnpj, error: (e as Error).message,
          });
        }

        const endereco = cartao?.endereco;
        const empresa = await CompanyService.create({
          cnpj: linha.cnpj,
          name: cartao?.razao_social || linha.razao_social,
          tax_regime: 'simples_nacional',
          email: linha.email || cartao?.contato?.email || undefined,
          phone: linha.telefone || cartao?.contato?.telefone || undefined,
          address: endereco?.logradouro || undefined,
          endereco_numero: endereco?.numero || undefined,
          endereco_bairro: endereco?.bairro || undefined,
          city: endereco?.municipio || linha.cidade || undefined,
          state: endereco?.uf || linha.uf || undefined,
          postal_code: endereco?.cep || undefined,
          codigo_municipio: endereco?.codigo_municipio_ibge || undefined,
          inscricao_estadual: cartao?.inscricao_estadual || undefined,
          crt: cartao?.simples_nacional === false ? '3' : '1',
          projeto: projetoValido(linha.projeto) ? linha.projeto : null,
          atividade: atividadeValida(linha.atividade) ? linha.atividade : null,
        }, criadorId);

        if (atribuirPara && atribuirPara !== criadorId) {
          try {
            await UserManagementService.atribuirEmpresa(atribuirPara, empresa.id, criadorId);
          } catch (e) {
            logger.warn('[IMPORTACAO] empresa criada mas atribuição falhou', {
              companyId: empresa.id, atribuirPara, error: (e as Error).message,
            });
          }
        }

        resultados.push({ ...base, ok: true, company_id: empresa.id });
      } catch (e) {
        resultados.push({ ...base, ok: false, motivo: (e as Error).message });
      }
    }

    return resultados;
  }
}
