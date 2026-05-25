import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Tabela de boletos DAS (Documento de Arrecadação do Simples)
  await knex.schema.createTable('das_boletos', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
    table.uuid('tax_calculation_id').nullable().references('id').inTable('tax_calculations');
    
    // Dados do DAS
    table.date('data_emissao').notNullable();
    table.date('data_vencimento').notNullable();
    table.integer('mes_competencia').notNullable(); // 1-12
    table.integer('ano_competencia').notNullable();
    
    // Valores
    table.decimal('valor_original', 15, 2).notNullable().defaultTo(0);
    table.decimal('juros', 15, 2).defaultTo(0);
    table.decimal('multa', 15, 2).defaultTo(0);
    table.decimal('desconto', 15, 2).defaultTo(0);
    table.decimal('valor_total', 15, 2).notNullable();
    table.decimal('valor_pago', 15, 2).defaultTo(0);
    
    // Status do boleto
    table.enum('status', ['EMITIDO', 'PENDENTE', 'PAGO', 'VENCIDO', 'CANCELADO']).defaultTo('EMITIDO');
    
    // Dados da arrecadação
    table.string('codigo_receita').notNullable(); // Ex: 0200
    table.string('numero_boleto').nullable().unique();
    table.string('codigo_barras').nullable();
    table.string('linha_digitavel').nullable();
    
    // Registro de pagamento
    table.date('data_pagamento').nullable();
    table.decimal('juros_pago', 15, 2).nullable();
    table.decimal('multa_paga', 15, 2).nullable();
    table.string('numero_comprovante').nullable();
    
    // Regime tributário (para auditoria)
    table.enum('regime_tributario', ['LUCRO_REAL', 'LUCRO_PRESUMIDO', 'SIMPLES']).notNullable();
    
    // Observações e audit
    table.text('observacoes').nullable();
    table.uuid('created_by').notNullable().references('id').inTable('accounts');
    table.uuid('updated_by').nullable().references('id').inTable('accounts');
    
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.boolean('is_active').defaultTo(true);
    table.string('hash_integridade').nullable(); // SHA-256 para auditoria
  });

  // Índices para performance
  await knex.schema.table('das_boletos', (table) => {
    table.index('company_id');
    table.index('data_vencimento');
    table.index('status');
    table.index(['ano_competencia', 'mes_competencia', 'company_id']);
    table.index('numero_boleto');
  });

  // Tabela de histórico de eventos do DAS (para auditoria)
  await knex.schema.createTable('das_eventos', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('das_boleto_id').notNullable().references('id').inTable('das_boletos').onDelete('CASCADE');
    
    table.enum('tipo_evento', [
      'GERADO',
      'EMITIDO',
      'VENCIMENTO_PROXIMO',
      'VENCIDO',
      'PAGAMENTO_REGISTRADO',
      'CANCELADO',
      'ALTERADO',
    ]).notNullable();
    
    table.text('descricao').nullable();
    table.json('dados_anteriores').nullable();
    table.json('dados_novos').nullable();
    
    table.uuid('usuario_id').notNullable().references('id').inTable('accounts');
    table.timestamp('ocorrencia_at').defaultTo(knex.fn.now());
    table.string('ip_address', 45).nullable();
    table.string('user_agent').nullable();
  });

  await knex.schema.table('das_eventos', (table) => {
    table.index(['das_boleto_id']);
    table.index(['tipo_evento']);
    table.index(['ocorrencia_at']);
  });

  // Tabela de agendamentos automáticos
  await knex.schema.createTable('das_agendamentos', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.uuid('company_id').notNullable().references('id').inTable('companies').onDelete('CASCADE');
    
    table.boolean('auto_gerar').defaultTo(true); // Gerar automaticamente no vencimento
    table.integer('dias_antes_alerta').defaultTo(3); // Alertar 3 dias antes
    
    table.enum('regime_tributario', ['LUCRO_REAL', 'LUCRO_PRESUMIDO', 'SIMPLES']).notNullable();
    
    // Configurações de código de receita (por regime)
    table.json('codigos_receita').nullable(); // { "LUCRO_REAL": "0200", "SIMPLES": "0201" }
    
    table.timestamp('ultimo_agendamento').nullable();
    table.timestamp('proximo_agendamento').nullable();
    
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.boolean('is_active').defaultTo(true);
  });

  await knex.schema.table('das_agendamentos', (table) => {
    table.index('company_id');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('das_agendamentos');
  await knex.schema.dropTableIfExists('das_eventos');
  await knex.schema.dropTableIfExists('das_boletos');
}
