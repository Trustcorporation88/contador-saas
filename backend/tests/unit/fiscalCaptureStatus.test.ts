/**
 * Regressão: falha parcial na captura (tipo=all) não pode marcar como erro o
 * doc type que funcionou.
 *
 * Bug: quando a NF-e falhava e a NFS-e concluía, o Python gravava status "ok"
 * para NFS-e e o Node sobrescrevia os DOIS com "error" e a mesma mensagem — a
 * tela mostrava NFS-e em erro depois de uma captura bem-sucedida.
 */
jest.mock('../../src/middleware/requestLogger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../src/config/env', () => ({
  envConfig: { database: { url: 'postgres://localhost/test' } },
}));

const estado: {
  cert: Record<string, unknown> | null;
  company: Record<string, unknown> | null;
  syncUpserts: Array<Record<string, unknown>>;
} = { cert: null, company: null, syncUpserts: [] };

jest.mock('../../src/config/database', () => {
  const query: Record<string, unknown> = {};
  let tabelaAtual = '';
  const chain = () => query;
  Object.assign(query, {
    where: jest.fn(chain),
    andWhere: jest.fn(chain),
    // whereIn/whereNotNull entraram junto com a checagem de bloqueio por
    // consumo indevido (cStat 656). Sem eles no mock, a suíte quebrava com
    // "db(...).where(...).whereIn is not a function" — limitação do mock, não
    // do produto. Devolvem lista vazia: nenhum bloqueio ativo.
    whereIn: jest.fn(chain),
    whereNotNull: jest.fn().mockResolvedValue([]),
    whereRaw: jest.fn(chain),
    andWhereRaw: jest.fn(chain),
    orderBy: jest.fn(chain),
    limit: jest.fn(chain),
    offset: jest.fn(chain),
    clone: jest.fn(chain),
    update: jest.fn().mockResolvedValue(1),
    onConflict: jest.fn(chain),
    count: jest.fn().mockResolvedValue([{ count: '0' }]),
    first: jest.fn().mockImplementation(() => {
      if (tabelaAtual === 'fiscal_certificates') return Promise.resolve(estado.cert);
      if (tabelaAtual === 'companies') return Promise.resolve(estado.company);
      return Promise.resolve(null);
    }),
    insert: jest.fn().mockImplementation((row: Record<string, unknown>) => {
      if (tabelaAtual === 'fiscal_xml_sync') estado.syncUpserts.push(row);
      return query;
    }),
    merge: jest.fn().mockResolvedValue(1),
  });
  const db: any = jest.fn((tabela: string) => {
    tabelaAtual = tabela ?? tabelaAtual;
    return query;
  });
  Object.assign(db, query, {
    schema: {
      hasTable: jest.fn().mockResolvedValue(true),
      hasColumn: jest.fn().mockResolvedValue(true),
    },
  });
  return { db, getDatabase: jest.fn().mockResolvedValue(db) };
});

jest.mock('../../src/utils/certEncryption', () => ({
  decryptSecret: jest.fn(() => 'senha-do-certificado'),
  encryptSecret: jest.fn((v: string) => v),
  decryptSecretWithLegacyFallback: jest.fn((v: string) => v),
}));

import { FiscalCaptureService } from '../../src/services/fiscalCaptureService';

const COMPANY = '11111111-2222-3333-4444-555555555555';

/**
 * Executa runSync com uma saída de scheduler controlada, curto-circuitando o
 * spawn do Python.
 */
async function runSyncCom(stdout: string, sucesso: boolean, tipo: 'nfe' | 'nfse' | 'all' = 'all') {
  estado.syncUpserts = [];
  estado.cert = {
    company_id: COMPANY,
    cnpj: '11222333000181',
    uf: 'sp',
    pfx_path: '/tmp/fiscal-certs/cert.pfx',
    pfx_data: Buffer.from('conteudo-pfx').toString('base64'),
    password_encrypted: 'cifrado',
    active: true,
    serpro_motor_enabled: false,
  };
  estado.company = { id: COMPANY, cnpj: '11222333000181' };

  const servico = FiscalCaptureService as unknown as {
    spawnPython: (...args: unknown[]) => Promise<unknown>;
  };
  const original = servico.spawnPython;
  servico.spawnPython = jest.fn().mockResolvedValue({
    success: sucesso,
    message: sucesso ? 'Captura concluída.' : 'Captura retornou código 1.',
    stdout,
    stderr: '',
  });
  try {
    return await FiscalCaptureService.runSync(COMPANY, tipo);
  } finally {
    servico.spawnPython = original;
  }
}

function docTypesMarcadosComErro(): string[] {
  return estado.syncUpserts
    .filter((row) => row.last_status === 'error')
    .map((row) => String(row.doc_type))
    .sort();
}

/** Mensagem de erro gravada para um doc type. */
function erroGravado(docType: string): string {
  const linha = estado.syncUpserts.find(
    (row) => row.doc_type === docType && row.last_status === 'error',
  );
  return String(linha?.last_error ?? '');
}

describe('runSync — status por doc type em falha parcial', () => {
  it('marca erro só na NF-e quando a NFS-e concluiu', async () => {
    const resultado = {
      ok: false,
      nfe_capturados: 0,
      nfse_capturados: 4,
      errors: ['NF-e: SEFAZ DistDFe rejeitou (cStat 656): Consumo Indevido'],
      warnings: [],
    };
    await runSyncCom(`CAPTURE_RESULT:${JSON.stringify(resultado)}`, false);
    expect(docTypesMarcadosComErro()).toEqual(['nfe']);
  });

  it('marca erro só na NFS-e quando a NF-e concluiu', async () => {
    const resultado = {
      ok: false,
      nfe_capturados: 2,
      nfse_capturados: 0,
      errors: ['NFS-e: timeout no ADN'],
      warnings: [],
    };
    await runSyncCom(`CAPTURE_RESULT:${JSON.stringify(resultado)}`, false);
    expect(docTypesMarcadosComErro()).toEqual(['nfse']);
  });

  it('CADA LINHA RECEBE SÓ O SEU ERRO, e não a mensagem combinada', async () => {
    // O defeito real, visto no banco de produção em 12/08/2026: as duas linhas
    // de fiscal_xml_sync guardavam a mesma string juntada com " | ". A linha da
    // NFS-e exibia "cStat 656", que é erro de NF-e, e a da NF-e exibia o 404 do
    // Portal Nacional. Quem fosse diagnosticar perseguiria o problema errado.
    const resultado = {
      ok: false,
      nfe_capturados: 0,
      nfse_capturados: 0,
      errors: [
        'NF-e: SEFAZ DistDFe rejeitou (cStat 656): Consumo Indevido',
        'NFS-e: 404 Client Error: Not Found for url: https://adn.nfse.gov.br/...',
      ],
      warnings: [],
    };
    await runSyncCom(`CAPTURE_RESULT:${JSON.stringify(resultado)}`, false);

    expect(erroGravado('nfe')).toContain('656');
    expect(erroGravado('nfe')).not.toContain('404');

    expect(erroGravado('nfse')).toContain('404');
    expect(erroGravado('nfse')).not.toContain('656');
  });

  it('marca os dois quando os dois falharam', async () => {
    const resultado = {
      ok: false,
      errors: ['NF-e: erro A', 'NFS-e: erro B'],
      warnings: [],
    };
    await runSyncCom(`CAPTURE_RESULT:${JSON.stringify(resultado)}`, false);
    expect(docTypesMarcadosComErro()).toEqual(['nfe', 'nfse']);
  });

  it('sem resultado estruturado, marca todos os pedidos (não sabe qual falhou)', async () => {
    await runSyncCom('processo morreu sem imprimir resultado', false);
    expect(docTypesMarcadosComErro()).toEqual(['nfe', 'nfse']);
  });

  it('captura bem-sucedida não grava erro em ninguém', async () => {
    const resultado = {
      ok: true,
      nfe_capturados: 3,
      nfse_capturados: 1,
      errors: [],
      warnings: [],
    };
    await runSyncCom(`CAPTURE_RESULT:${JSON.stringify(resultado)}`, true);
    expect(docTypesMarcadosComErro()).toEqual([]);
  });

  it('não devolve stdout/stderr do Python na resposta da API', async () => {
    const resultado = { ok: false, errors: ['NF-e: erro'], warnings: [] };
    const resposta = await runSyncCom(
      `caminho interno /app/automacao-xml\nCAPTURE_RESULT:${JSON.stringify(resultado)}`,
      false,
    );
    expect(resposta).not.toHaveProperty('stdout');
    expect(resposta).not.toHaveProperty('stderr');
    expect(resposta.message).toBeTruthy();
  });
});
