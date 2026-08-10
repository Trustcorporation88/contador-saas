/**
 * Sincroniza a tabela de Classificação Tributária (cClassTrib) com o SVRS.
 *
 *   npm run sync:class-trib
 *
 * Serve para a primeira carga e para forçar a atualização depois de uma
 * publicação, sem esperar o cron das 4h.
 *
 * Diferente do agendado, aqui a falha SAI COM CÓDIGO 1: quem rodou está olhando
 * e precisa ver o erro. No cron, falhar em silêncio (com registro) é o certo,
 * porque derrubar o agendador por indisponibilidade do portal seria pior.
 */

import { initializeDatabase, closeDatabase } from '../config/database';
import { sincronizar } from '../services/classTribSyncService';
import { listarVigentes, ultimaSincronizacao } from '../services/classTribService';

async function main(): Promise<void> {
  await initializeDatabase();

  console.log('Sincronizando cClassTrib com o SVRS...');
  const r = await sincronizar();

  if (r.status === 'erro') {
    console.error(`\nFALHOU: ${r.erro}`);
    console.error('A tabela anterior foi preservada — nada foi apagado.');
    process.exitCode = 1;
    return;
  }

  const paraNfe = await listarVigentes({ documento: 'NFE' });
  const ultima = await ultimaSincronizacao();

  console.log(`\nRecebidos:   ${r.total_recebido} códigos`);
  console.log(`Novos:       ${r.inseridos}`);
  console.log(`Alterados:   ${r.atualizados}`);
  console.log(`Inalterados: ${r.inalterados}`);
  if (r.ausentes > 0) {
    console.log(`Ausentes na origem: ${r.ausentes} (marcados, não apagados)`);
  }
  console.log(`\nVigentes hoje para NF-e: ${paraNfe.length}`);
  console.log(`Registrado em: ${ultima?.concluido_em?.toISOString() ?? '—'}`);
}

main()
  .catch((erro) => {
    console.error('Erro inesperado:', erro instanceof Error ? erro.message : erro);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeDatabase().catch(() => undefined);
  });
