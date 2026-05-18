import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const contasExists = await knex.schema.hasTable('contas_receber');
  if (!contasExists) {
    await knex.schema.createTable('contas_receber', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('company_id').notNullable();
      table.uuid('created_by').notNullable();
      table.uuid('updated_by').nullable();
      table.uuid('documento_fiscal_id').nullable();
      table.string('categoria', 40).notNullable();
      table.string('numero_titulo', 60).notNullable();
      table.text('descricao').notNullable();
      table.string('cliente_nome', 255).notNullable();
      table.string('cliente_cnpj', 14).nullable();
      table.string('cliente_email', 255).nullable();
      table.string('cliente_telefone', 30).nullable();
      table.date('data_emissao').notNullable();
      table.date('data_vencimento').notNullable();
      table.decimal('valor_original', 15, 2).notNullable();
      table.decimal('valor_recebido', 15, 2).defaultTo(0);
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
      table.index(['cliente_cnpj']);
      table.unique(['company_id', 'numero_titulo']);
    });
  }

  const recebimentosExists = await knex.schema.hasTable('recebimentos_contas_receber');
  if (!recebimentosExists) {
    await knex.schema.createTable('recebimentos_contas_receber', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('conta_receber_id').notNullable().references('id').inTable('contas_receber').onDelete('CASCADE');
      table.date('data_recebimento').notNullable();
      table.decimal('valor_recebido', 15, 2).notNullable();
      table.decimal('juros', 15, 2).defaultTo(0);
      table.decimal('multa', 15, 2).defaultTo(0);
      table.decimal('desconto', 15, 2).defaultTo(0);
      table.string('forma_recebimento', 30).notNullable();
      table.text('observacoes').nullable();
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.uuid('created_by').notNullable();
      table.index(['conta_receber_id']);
      table.index(['data_recebimento']);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('recebimentos_contas_receber');
  await knex.schema.dropTableIfExists('contas_receber');
}