import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const contasExist = await knex.schema.hasTable('contas_pagar');
  if (!contasExist) {
    await knex.schema.createTable('contas_pagar', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('company_id').notNullable();
      table.uuid('created_by').notNullable();
      table.uuid('updated_by').nullable();
      table.uuid('documento_fiscal_id').nullable();
      table.string('categoria', 40).notNullable();
      table.string('numero_titulo', 60).notNullable();
      table.text('descricao').notNullable();
      table.string('fornecedor_nome', 255).notNullable();
      table.string('fornecedor_cnpj', 14).nullable();
      table.string('fornecedor_email', 255).nullable();
      table.string('fornecedor_telefone', 30).nullable();
      table.date('data_emissao').notNullable();
      table.date('data_vencimento').notNullable();
      table.decimal('valor_original', 15, 2).notNullable();
      table.decimal('valor_pago', 15, 2).defaultTo(0);
      table.decimal('juros', 15, 2).defaultTo(0);
      table.decimal('multa', 15, 2).defaultTo(0);
      table.decimal('desconto', 15, 2).defaultTo(0);
      table.string('status', 30).defaultTo('pendente');
      table.text('observacoes').nullable();
      table.boolean('is_active').defaultTo(true);
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.index(['company_id']);
      table.index(['status']);
      table.index(['categoria']);
      table.index(['data_vencimento']);
      table.index(['fornecedor_cnpj']);
      table.unique(['company_id', 'numero_titulo']);
    });
  }

  const pagamentosExist = await knex.schema.hasTable('pagamentos_contas_pagar');
  if (!pagamentosExist) {
    await knex.schema.createTable('pagamentos_contas_pagar', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('conta_pagar_id').notNullable().references('id').inTable('contas_pagar').onDelete('CASCADE');
      table.date('data_pagamento').notNullable();
      table.decimal('valor_pago', 15, 2).notNullable();
      table.decimal('juros', 15, 2).defaultTo(0);
      table.decimal('multa', 15, 2).defaultTo(0);
      table.decimal('desconto', 15, 2).defaultTo(0);
      table.string('forma_pagamento', 30).notNullable();
      table.text('observacoes').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.uuid('created_by').notNullable();
      table.index(['conta_pagar_id']);
      table.index(['data_pagamento']);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('pagamentos_contas_pagar');
  await knex.schema.dropTableIfExists('contas_pagar');
}