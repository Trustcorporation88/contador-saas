#!/usr/bin/env node
/**
 * Teste dos Endpoints de Lançamentos Recorrentes
 * Script para validar funcionamento de:
 * - POST /api/v1/companies/:id/recurring-transactions (criar)
 * - GET /api/v1/companies/:id/recurring-transactions (listar)
 * - GET /api/v1/companies/:id/recurring-transactions/:templateId (buscar)
 * - PATCH /api/v1/companies/:id/recurring-transactions/:templateId (atualizar)
 * - GET /api/v1/companies/:id/recurring-transactions/:templateId/executions (execuções)
 * - GET /api/v1/companies/:id/recurring-transactions/executions/all (todas execuções)
 */

const axios = require('axios');

// Configuração
const API_BASE = 'https://contador-saas-api.onrender.com/api/v1';
// Para testes locais, descomente:
// const API_BASE = 'http://localhost:3000/api/v1';

// Token de autenticação (será obtido ou fornecido)
let TOKEN = '';
let COMPANY_ID = '';
let TEMPLATE_ID = '';

/**
 * Utilitário para fazer requisições com tratamento de erros
 */
async function request(method, url, data = null, token = TOKEN) {
  try {
    const config = {
      method,
      url: `${API_BASE}${url}`,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    };

    if (data) {
      config.data = data;
    }

    console.log(`\n📡 ${method.toUpperCase()} ${url}`);
    console.log('Payload:', data ? JSON.stringify(data, null, 2) : 'N/A');

    const response = await axios(config);
    console.log(`✅ Status: ${response.status}`);
    console.log('Response:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.log(`❌ Erro: ${error.response?.status || error.code}`);
    console.log('Message:', error.response?.data?.error || error.message);
    throw error;
  }
}

/**
 * Suite de testes
 */
async function runTests() {
  try {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║ TESTE DE LANÇAMENTOS RECORRENTES       ║');
    console.log('╚════════════════════════════════════════╝');

    // 1. Verificar autenticação e obter company ID
    console.log('\n\n📋 Teste 1: Obter dados da empresa (para testar token)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    if (!TOKEN) {
      console.log('\n⚠️  TOKEN não definido. Defina TOKEN antes de rodar testes.');
      console.log('   export TOKEN="seu_token_aqui"');
      process.exit(1);
    }

    if (!COMPANY_ID) {
      console.log('\n⚠️  COMPANY_ID não definido. Defina COMPANY_ID antes de rodar testes.');
      console.log('   export COMPANY_ID="uuid_da_empresa"');
      process.exit(1);
    }

    // 2. Criar template de lançamento recorrente
    console.log('\n\n📋 Teste 2: Criar template de lançamento recorrente');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const createPayload = {
      description: 'Aluguel - Loja Centro (Teste Recorrência)',
      amount: 2500.50,
      debitAccount: 'USE_YOUR_DEBIT_ACCOUNT_ID', // Substitua
      creditAccount: 'USE_YOUR_CREDIT_ACCOUNT_ID', // Substitua
      frequency: 'MENSAL',
      startDate: '2025-01-01',
      endDate: '2026-12-31',
    };

    console.log('\n⚠️  IMPORTANTE: Substitua os account IDs antes de rodar!');
    console.log('Contas de exemplo:');
    console.log('  debitAccount: Despesa com Aluguel (conta débito)');
    console.log('  creditAccount: Caixa/Banco (conta crédito)');

    // Template para teste
    const templateResponse = await request(
      'POST',
      `/companies/${COMPANY_ID}/recurring-transactions`,
      createPayload,
    );

    TEMPLATE_ID = templateResponse.id;

    // 3. Listar templates
    console.log('\n\n📋 Teste 3: Listar templates de lançamentos recorrentes');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const listResponse = await request(
      'GET',
      `/companies/${COMPANY_ID}/recurring-transactions?page=1&limit=10&status=active`,
    );

    console.log(`Total de templates: ${listResponse.pagination?.total || 'N/A'}`);

    // 4. Buscar template específico
    console.log('\n\n📋 Teste 4: Buscar template específico por ID');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const getResponse = await request(
      'GET',
      `/companies/${COMPANY_ID}/recurring-transactions/${TEMPLATE_ID}`,
    );

    console.log(`Template ID: ${getResponse.id}`);
    console.log(`Status: ${getResponse.isActive ? 'Ativo' : 'Inativo'}`);

    // 5. Atualizar template (ativar/desativar)
    console.log('\n\n📋 Teste 5: Atualizar template (desativar)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const updatePayload = {
      isActive: false,
    };

    const updateResponse = await request(
      'PATCH',
      `/companies/${COMPANY_ID}/recurring-transactions/${TEMPLATE_ID}`,
      updatePayload,
    );

    console.log(`Template status após update: ${updateResponse.isActive ? 'Ativo' : 'Inativo'}`);

    // 6. Reativar template
    console.log('\n\n📋 Teste 6: Reativar template');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const reactivatePayload = {
      isActive: true,
    };

    const reactivateResponse = await request(
      'PATCH',
      `/companies/${COMPANY_ID}/recurring-transactions/${TEMPLATE_ID}`,
      reactivatePayload,
    );

    console.log(`Template status após reativação: ${reactivateResponse.isActive ? 'Ativo' : 'Inativo'}`);

    // 7. Listar execuções de um template
    console.log('\n\n📋 Teste 7: Listar execuções de um template específico');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const executionsResponse = await request(
      'GET',
      `/companies/${COMPANY_ID}/recurring-transactions/${TEMPLATE_ID}/executions?page=1&limit=10`,
    );

    console.log(`Total de execuções: ${executionsResponse.pagination?.total || 0}`);

    // 8. Listar TODAS as execuções da empresa
    console.log('\n\n📋 Teste 8: Listar TODAS as execuções da empresa');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const allExecutionsResponse = await request(
      'GET',
      `/companies/${COMPANY_ID}/recurring-transactions/executions/all?page=1&limit=20`,
    );

    console.log(`Total de execuções (todas): ${allExecutionsResponse.pagination?.total || 0}`);

    // 9. Deletar template (soft delete)
    console.log('\n\n📋 Teste 9: Deletar template (soft delete)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const deleteResponse = await request(
      'DELETE',
      `/companies/${COMPANY_ID}/recurring-transactions/${TEMPLATE_ID}`,
    );

    console.log('Template deletado com sucesso (soft delete)');

    // ✅ Todos os testes passaram
    console.log('\n\n╔════════════════════════════════════════╗');
    console.log('║   ✅ TODOS OS TESTES PASSARAM!         ║');
    console.log('╚════════════════════════════════════════╝\n');

    console.log('📝 Resumo:');
    console.log('  ✅ POST   - Criar template');
    console.log('  ✅ GET    - Listar templates');
    console.log('  ✅ GET    - Buscar template específico');
    console.log('  ✅ PATCH  - Atualizar template (desativar)');
    console.log('  ✅ PATCH  - Atualizar template (reativar)');
    console.log('  ✅ GET    - Listar execuções de template');
    console.log('  ✅ GET    - Listar todas as execuções');
    console.log('  ✅ DELETE - Deletar template\n');

    console.log('🔄 Cron Job:');
    console.log('  Horário: 00:05 UTC diariamente');
    console.log('  Ação: Buscar templates com próxima execução = hoje');
    console.log('  Resultado: Cria lançamento contábil automaticamente\n');
  } catch (error) {
    console.log('\n\n╔════════════════════════════════════════╗');
    console.log('║   ❌ ERRO NOS TESTES                  ║');
    console.log('╚════════════════════════════════════════╝\n');
    console.log('Erro:', error.message);
    process.exit(1);
  }
}

// Executar testes
runTests().then(() => {
  console.log('\n✅ Suite de testes concluída!\n');
  process.exit(0);
});
