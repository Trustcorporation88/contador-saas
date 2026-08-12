/**
 * Manifestação do Destinatário — o passo que destrava o XML das notas de entrada.
 *
 * O PROBLEMA QUE ISSO RESOLVE
 *
 * A Distribuição DFe entrega, para nota emitida CONTRA o CNPJ do cliente, apenas
 * o RESUMO (resNFe): chave, CNPJ do emitente, valor, data. Sem itens, sem NCM,
 * sem CFOP, sem impostos. Dá para saber que a nota existe; não dá para
 * escriturar.
 *
 * Em 12/08/2026 a captura desta empresa trouxe 8 documentos e os 8 eram resumo.
 * A SEFAZ só libera o XML completo depois que o destinatário se manifesta.
 *
 * SÓ CIÊNCIA DA OPERAÇÃO (210210), E É DELIBERADO
 *
 * Dos quatro eventos de manifestação, este é o único que não declara nada sobre
 * o negócio — diz apenas "tomei conhecimento de que esta nota existe" — e já
 * basta para liberar o download. Os outros três (Confirmação da Operação,
 * Desconhecimento, Operação não Realizada) são declarações de conteúdo e
 * IRREVERSÍVEIS; a Confirmação ainda impede o emitente de cancelar a nota.
 *
 * Automatizar aqueles seria o sistema declarando fato fiscal no lugar do
 * contador. Quem confirma operação é gente, com o documento na mão.
 *
 * O script Python tem uma trava que aborta se a pynfe montar um tpEvento
 * diferente de 210210 — porque um remapeamento de índices numa versão futura
 * enviaria Confirmação sem ninguém perceber.
 */

import { spawn } from 'child_process';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { getDatabase } from '../config/database';
import { logger } from '../middleware/requestLogger';
import { decryptSecret, decryptSecretWithLegacyFallback } from '../utils/certEncryption';
import { getAutomationDir, getPythonBin } from './nfeEmitter';

const PREFIXO_RESULTADO = 'MANIFEST_RESULT:';
const SCRIPT = 'manifestar_nfe.py';

/**
 * Em que ambiente manifestar.
 *
 * NÃO é o ambiente de emissão. Escrevi assim na primeira versão — usando
 * getAmbiente(), que lê NFE_AMBIENTE — e o resultado em produção foi o esperado
 * para quem erra isso: as 8 notas voltaram com cStat 136, "Evento registrado,
 * mas não vinculado a NF-e". O evento foi aceito e não colou, porque a nota do
 * fornecedor vive em PRODUÇÃO e o evento foi para homologação.
 *
 * Manifestação tem de ir onde a NOTA está, e a nota está onde a captura a
 * buscou. Por isso o critério é FISCAL_HOMOLOGACAO — a mesma variável que a
 * captura usa — e não a da emissão: a emissão pode ficar em homologação por
 * meses enquanto a captura trabalha com documentos reais.
 */
export function ambienteDaManifestacao(): 'homologacao' | 'producao' {
  const bruto = String(process.env.FISCAL_HOMOLOGACAO || '').toLowerCase();
  const emHomologacao = ['1', 'true', 'yes'].includes(bruto);
  return emHomologacao ? 'homologacao' : 'producao';
}

export interface ManifestacaoResult {
  ok: boolean;
  chave: string;
  cStat: string;
  motivo: string;
  protocolo?: string;
  dhRegEvento?: string;
  /** true quando a SEFAZ respondeu duplicidade: já havia manifestação. */
  ja_manifestado?: boolean;
  /** cStat 136: evento aceito, mas a nota não existe no ambiente consultado. */
  nao_vinculado?: boolean;
  xml_evento?: string;
  ambiente?: string;
}

function getTimeoutMs(): number {
  const bruto = Number(process.env.NFE_MANIFEST_TIMEOUT_MS);
  return Number.isFinite(bruto) && bruto > 0 ? bruto : 120_000;
}

function digits(valor: unknown): string {
  return String(valor ?? '').replace(/\D/g, '');
}

function extrair(stdout: string): ManifestacaoResult | null {
  const linha = stdout.split(/\r?\n/).find((l) => l.startsWith(PREFIXO_RESULTADO));
  if (!linha) return null;
  try {
    return JSON.parse(linha.slice(PREFIXO_RESULTADO.length)) as ManifestacaoResult;
  } catch {
    return null;
  }
}

function spawnManifestar(payloadFile: string): Promise<ManifestacaoResult> {
  const automationDir = getAutomationDir();
  const scriptPath = path.join(automationDir, SCRIPT);

  return new Promise((resolve) => {
    const child = spawn(getPythonBin(), [scriptPath, payloadFile], {
      cwd: automationDir,
      timeout: getTimeoutMs(),
      killSignal: 'SIGKILL',
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('error', (erro) => {
      resolve({
        ok: false, chave: '', cStat: '',
        motivo: `não foi possível executar o manifestador: ${erro.message}`,
      });
    });

    child.on('close', (code, signal) => {
      const resultado = extrair(stdout);
      if (resultado) return resolve(resultado);

      if (signal === 'SIGKILL') {
        // Timeout depois de enviar é ambíguo: a SEFAZ pode ter registrado o
        // evento e a resposta se perdido. A mensagem precisa dizer isso, senão o
        // usuário reenvia e recebe duplicidade sem entender.
        return resolve({
          ok: false, chave: '', cStat: '',
          motivo: 'a manifestação excedeu o tempo limite. Pode ter sido registrada na SEFAZ — '
            + 'consulte antes de reenviar.',
        });
      }

      logger.error('Manifestação: Python não devolveu resultado', { code, signal, stderr });
      resolve({
        ok: false, chave: '', cStat: '',
        motivo: `o manifestador falhou${stderr ? `: ${stderr.slice(-400)}` : ''}`,
      });
    });
  });
}

/** Materializa o .pfx no disco a partir do que está cifrado no banco. */
async function certificadoDaEmpresa(companyId: string): Promise<{ caminho: string; senha: string }> {
  const db = await getDatabase();
  const cert = await db('fiscal_certificates')
    .where({ company_id: companyId, active: true })
    .first();

  if (!cert) {
    throw Object.assign(
      new Error('Certificado digital A1 não configurado para esta empresa.'),
      { status: 422 },
    );
  }

  const senha = decryptSecret(cert.password_encrypted);
  const dados = cert.pfx_data
    ? decryptSecretWithLegacyFallback(cert.pfx_data as string)
    : null;

  const destino = path.join(
    process.env.FISCAL_CERTS_DIR || path.join(os.tmpdir(), 'fiscal-certs'),
    `${companyId}.pfx`,
  );

  if (dados) {
    // 0700/0600: o .pfx carrega a chave privada da empresa.
    await fs.ensureDir(path.dirname(destino), { mode: 0o700 });
    await fs.writeFile(destino, Buffer.from(dados, 'base64'), { mode: 0o600 });
    return { caminho: destino, senha };
  }

  const doDisco = String(cert.pfx_path || '');
  if (doDisco && (await fs.pathExists(doDisco))) return { caminho: doDisco, senha };

  throw Object.assign(
    new Error('Certificado A1 não encontrado no servidor. Cadastre o .pfx novamente.'),
    { status: 422 },
  );
}

export class ManifestacaoService {
  /**
   * Dá ciência de UMA nota. Devolve o resultado da SEFAZ.
   *
   * Grava o resultado em fiscal_xml_captures.metadata para que a tela saiba o que
   * já foi manifestado — sem isso o usuário não tem como distinguir "ainda é
   * resumo porque não manifestei" de "manifestei e o XML não veio".
   */
  static async darCiencia(companyId: string, chave: string): Promise<ManifestacaoResult> {
    const db = await getDatabase();
    const chaveLimpa = digits(chave);

    if (chaveLimpa.length !== 44) {
      throw Object.assign(
        new Error(`Chave de acesso inválida: precisa de 44 dígitos, recebeu ${chaveLimpa.length}.`),
        { status: 400 },
      );
    }

    const company = await db('companies').where({ id: companyId }).first();
    if (!company) {
      throw Object.assign(new Error('Empresa não encontrada'), { status: 404 });
    }
    if (!digits(company.cnpj)) {
      throw Object.assign(
        new Error('Empresa sem CNPJ cadastrado; a manifestação identifica o destinatário pelo CNPJ.'),
        { status: 422 },
      );
    }
    if (String(company.state || '').trim().length !== 2) {
      throw Object.assign(
        new Error('Empresa sem UF cadastrada (sigla de 2 letras).'),
        { status: 422 },
      );
    }

    const { caminho: certPath, senha: certSenha } = await certificadoDaEmpresa(companyId);

    const payloadFile = path.join(os.tmpdir(), `manifest-${randomUUID()}.json`);
    try {
      // 0600: o arquivo carrega a senha do certificado em texto claro.
      await fs.writeFile(
        payloadFile,
        JSON.stringify({
          ambiente: ambienteDaManifestacao(),
          cert_path: certPath,
          cert_senha: certSenha,
          uf: String(company.state).toUpperCase(),
          cnpj: digits(company.cnpj),
          chave: chaveLimpa,
          modelo: 55,
          n_seq_evento: 1,
        }),
        { mode: 0o600 },
      );

      const resultado = await spawnManifestar(payloadFile);

      const ambiente = ambienteDaManifestacao();

      logger.info('Manifestação do destinatário', {
        companyId,
        chave: chaveLimpa,
        ambiente,
        ok: resultado.ok,
        cStat: resultado.cStat,
        jaManifestado: resultado.ja_manifestado,
        naoVinculado: resultado.nao_vinculado,
      });

      // cStat 136 merece explicação, não um "falhou" seco. O evento FOI aceito
      // pela SEFAZ; o que não aconteceu foi a vinculação, porque a nota não
      // existe no ambiente consultado. Sem esta mensagem o usuário reenvia e
      // recebe 136 de novo, sem nunca saber que o problema é de ambiente.
      if (resultado.nao_vinculado) {
        resultado.motivo = `${resultado.motivo || 'Evento registrado, mas não vinculado à NF-e'} `
          + `— a nota não existe no ambiente de ${ambiente}. `
          + (ambiente === 'homologacao'
            ? 'Notas de fornecedor vivem em produção: remova a variável FISCAL_HOMOLOGACAO '
              + 'para manifestar no ambiente certo.'
            : 'Confira se a chave está correta e se a nota é realmente destinada a este CNPJ.');
      }

      if (resultado.ok) {
        await ManifestacaoService.registrarNoMetadata(companyId, chaveLimpa, resultado);
      }

      return { ...resultado, chave: chaveLimpa };
    } finally {
      await fs.remove(payloadFile).catch(() => undefined);
    }
  }

  /**
   * Anota a manifestação no metadata da captura.
   *
   * Só anota se a linha existir: manifestar uma chave que não está capturada é
   * legítimo (o usuário pode ter a chave por fora), e criar registro de captura
   * aqui inventaria um documento que não foi baixado.
   */
  private static async registrarNoMetadata(
    companyId: string,
    chave: string,
    resultado: ManifestacaoResult,
  ): Promise<void> {
    const db = await getDatabase();
    const linha = await db('fiscal_xml_captures')
      .where({ company_id: companyId, chave })
      .first();
    if (!linha) return;

    let metadata: Record<string, unknown> = {};
    try {
      metadata = linha.metadata
        ? (typeof linha.metadata === 'string' ? JSON.parse(linha.metadata) : linha.metadata)
        : {};
    } catch {
      metadata = {};
    }

    metadata.manifestacao = {
      tp_evento: '210210',
      descricao: 'Ciencia da Operacao',
      cStat: resultado.cStat,
      protocolo: resultado.protocolo ?? '',
      registrado_em: resultado.dhRegEvento || new Date().toISOString(),
      ja_manifestado: Boolean(resultado.ja_manifestado),
    };

    await db('fiscal_xml_captures')
      .where({ company_id: companyId, chave })
      .update({ metadata: JSON.stringify(metadata) });
  }

  /**
   * Dá ciência em lote nos resumos que ainda não foram manifestados.
   *
   * Sequencial de propósito: são eventos fiscais, e disparar em paralelo contra o
   * Ambiente Nacional é a receita para tomar consumo indevido — o mesmo erro que
   * travou a captura hoje. Um limite por chamada evita também prender a
   * requisição HTTP por minutos.
   */
  static async darCienciaNosResumos(
    companyId: string,
    limite = 20,
  ): Promise<{ total: number; manifestados: number; falhas: number; resultados: ManifestacaoResult[] }> {
    const db = await getDatabase();

    const resumos = await db('fiscal_xml_captures')
      .where({ company_id: companyId, doc_type: 'nfe_resumo' })
      .orderBy('captured_at', 'asc')
      .limit(limite);

    const pendentes = resumos.filter((linha: { metadata?: unknown }) => {
      try {
        const meta = typeof linha.metadata === 'string'
          ? JSON.parse(linha.metadata)
          : (linha.metadata ?? {});
        return !meta?.manifestacao;
      } catch {
        return true;
      }
    });

    const resultados: ManifestacaoResult[] = [];
    let manifestados = 0;
    let falhas = 0;

    for (const linha of pendentes as Array<{ chave: string }>) {
      // eslint-disable-next-line no-await-in-loop
      const resultado = await ManifestacaoService.darCiencia(companyId, linha.chave);
      resultados.push(resultado);
      if (resultado.ok) manifestados += 1;
      else falhas += 1;
    }

    return { total: pendentes.length, manifestados, falhas, resultados };
  }
}

export default ManifestacaoService;
