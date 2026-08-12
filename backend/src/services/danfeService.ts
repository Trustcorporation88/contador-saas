/**
 * DANFE — o impresso que acompanha a mercadoria.
 *
 * Antes deste serviço o sistema emitia a nota e entregava só o XML. Mercadoria
 * não circula com XML: circula com DANFE. Sem isto, a emissão não servia para o
 * dia a dia de quem vende.
 *
 * DECISÃO CENTRAL, e é fiscal: o DANFE nasce do `xml_proc` — o nfeProc que a
 * SEFAZ devolve autorizado — e de nada mais. O `xml_nfe` que guardamos é um
 * rascunho de tela: vem embrulhado em nfeProc sem protocolo, sem enderEmit e
 * sem enderDest, e com indIEDest fixo em 9. Gerar DANFE a partir dele
 * produziria um papel com cara de nota fiscal sem nota fiscal por trás. Este
 * serviço recusa, e o script Python recusa de novo — de propósito, nas duas
 * camadas, porque quem chamar o script por fora também não deve conseguir.
 *
 * A renderização é do brazilfiscalreport (Python puro sobre fpdf2). Escolhido
 * por não exigir dependência de sistema nova: não há chromium nem wkhtmltopdf
 * na imagem Alpine, e colocá-los custaria centenas de MB. A marca d'água
 * "SEM VALOR FISCAL" em homologação sai da própria biblioteca, lendo o tpAmb do
 * XML — não precisamos pedir nem podemos esquecer.
 */

import { spawn } from 'child_process';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { randomUUID } from 'crypto';
import { getDatabase } from '../config/database';
import { logger } from '../middleware/requestLogger';
import { NfeStatus } from '../models/dtos/nfeDTO';
import { getAutomationDir, getPythonBin } from './nfeEmitter';

/** Marcador da linha de resultado no stdout do Python. */
const PREFIXO_RESULTADO = 'DANFE_RESULT:';

const SCRIPT = 'gerar_danfe.py';

/**
 * Teto de tempo da renderização. Não há rede aqui — é só CPU montando PDF —
 * então 60s é folgado. Existe para que um travamento do processo filho não
 * deixe a requisição HTTP aberta consumindo conexão do pool.
 */
function getTimeoutMs(): number {
  const bruto = Number(process.env.DANFE_TIMEOUT_MS);
  return Number.isFinite(bruto) && bruto > 0 ? bruto : 60_000;
}

export interface DanfeResultado {
  pdf: Buffer;
  nomeArquivo: string;
  chave: string | null;
  cancelada: boolean;
}

interface RespostaPython {
  ok: boolean;
  motivo?: string;
  arquivo?: string;
  chave?: string;
  protocolo?: string;
  cancelada?: boolean;
}

function extrairResultado(stdout: string): RespostaPython | null {
  const linha = stdout
    .split(/\r?\n/)
    .find((l) => l.startsWith(PREFIXO_RESULTADO));
  if (!linha) return null;
  try {
    return JSON.parse(linha.slice(PREFIXO_RESULTADO.length)) as RespostaPython;
  } catch {
    return null;
  }
}

function spawnDanfe(payloadFile: string): Promise<RespostaPython> {
  const automationDir = getAutomationDir();
  const scriptPath = path.join(automationDir, SCRIPT);

  return new Promise<RespostaPython>((resolve) => {
    const child = spawn(getPythonBin(), [scriptPath, payloadFile], {
      cwd: automationDir,
      timeout: getTimeoutMs(),
      killSignal: 'SIGKILL',
      // PYTHONIOENCODING explícito: sem ele o Python do Alpine pode assumir
      // ASCII e quebrar em razão social acentuada. O spawn da consulta de
      // numeração não passa isto e é um defeito conhecido — não repetir aqui.
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('error', (erro) => {
      logger.error('DANFE: falha ao iniciar o Python', { erro: erro.message, scriptPath });
      resolve({ ok: false, motivo: `não foi possível executar o gerador de DANFE: ${erro.message}` });
    });

    child.on('close', (code, signal) => {
      const resultado = extrairResultado(stdout);
      if (resultado) return resolve(resultado);

      if (signal === 'SIGKILL') {
        return resolve({ ok: false, motivo: 'a geração do DANFE excedeu o tempo limite' });
      }
      // Sem linha de resultado: o Python morreu antes de responder. O stderr
      // carrega o traceback, e é o que permite descobrir a causa — por isso
      // vai para o log inteiro e para a mensagem em pedaço.
      logger.error('DANFE: Python não devolveu resultado', { code, signal, stderr });
      resolve({
        ok: false,
        motivo: `o gerador de DANFE falhou${stderr ? `: ${stderr.slice(-400)}` : ''}`,
      });
    });
  });
}

export class DanfeService {
  /**
   * Gera o DANFE de uma NF-e autorizada.
   *
   * Erros carregam `status` deliberado para que a mensagem chegue ao usuário: o
   * errorHandler só expõe o texto quando o status foi escolhido de propósito, e
   * um 500 genérico viraria "erro interno" sem dizer o motivo.
   */
  static async gerar(id: string, companyId: string): Promise<DanfeResultado> {
    const db = await getDatabase();
    const nfe = await db('nfe')
      .where({ id, company_id: companyId })
      .select('id', 'numero', 'serie', 'status', 'chave_acesso', 'xml_proc')
      .first();

    if (!nfe) {
      throw Object.assign(new Error('NF-e não encontrada'), { status: 404 });
    }

    // Recusa antes de gastar processo: a nota que nunca foi autorizada não tem
    // DANFE — não é limitação do gerador, é o que a legislação define.
    if (!nfe.xml_proc) {
      const porStatus: Record<string, string> = {
        [NfeStatus.RASCUNHO]:
          'Esta NF-e ainda é rascunho. O DANFE só existe depois que a SEFAZ autoriza a nota.',
        [NfeStatus.PENDENTE]:
          'Esta NF-e não foi autorizada pela SEFAZ. Consulte o motivo da rejeição e emita novamente.',
        [NfeStatus.DENEGADA]:
          'Esta NF-e foi denegada pela SEFAZ. Nota denegada não gera DANFE.',
        [NfeStatus.AUTORIZADA]:
          'A NF-e está autorizada mas o XML autorizado (nfeProc) não está guardado. '
          + 'Baixe o XML no portal da SEFAZ pela chave de acesso.',
      };
      throw Object.assign(
        new Error(porStatus[String(nfe.status)] ?? 'DANFE indisponível: falta o XML autorizado desta NF-e.'),
        { status: 409 },
      );
    }

    const cancelada = String(nfe.status) === NfeStatus.CANCELADA;

    const base = path.join(os.tmpdir(), `danfe-${randomUUID()}`);
    const arquivoXml = `${base}.xml`;
    const arquivoPdf = `${base}.pdf`;
    const arquivoPayload = `${base}.json`;

    try {
      // 0600 nos três: o XML autorizado é documento fiscal do cliente, e o
      // diretório temporário é compartilhado com outros processos do container.
      await fs.writeFile(arquivoXml, String(nfe.xml_proc), { mode: 0o600 });
      await fs.writeFile(
        arquivoPayload,
        JSON.stringify({ xml: arquivoXml, saida: arquivoPdf, cancelada }),
        { mode: 0o600 },
      );

      const resultado = await spawnDanfe(arquivoPayload);

      if (!resultado.ok) {
        throw Object.assign(
          new Error(resultado.motivo || 'não foi possível gerar o DANFE'),
          { status: 422 },
        );
      }

      const pdf = await fs.readFile(arquivoPdf);
      if (!pdf.length || !pdf.subarray(0, 4).equals(Buffer.from('%PDF'))) {
        // O script disse ok mas o arquivo não é PDF. Melhor falhar aqui do que
        // entregar ao navegador um download corrompido com nome .pdf.
        throw Object.assign(
          new Error('o gerador devolveu um arquivo que não é PDF'),
          { status: 500 },
        );
      }

      const chave = String(nfe.chave_acesso || resultado.chave || '') || null;
      logger.info('DANFE gerado', {
        id, companyId, chave, cancelada, bytes: pdf.length,
      });

      return {
        pdf,
        nomeArquivo: chave ? `danfe-${chave}.pdf` : `danfe-${id}.pdf`,
        chave,
        cancelada,
      };
    } finally {
      // Documento fiscal não fica no /tmp depois da entrega.
      await Promise.all([
        fs.remove(arquivoXml).catch(() => undefined),
        fs.remove(arquivoPdf).catch(() => undefined),
        fs.remove(arquivoPayload).catch(() => undefined),
      ]);
    }
  }
}

export default DanfeService;
