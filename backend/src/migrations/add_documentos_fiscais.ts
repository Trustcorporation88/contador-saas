/**
 * Database Migration: Add Documentos Fiscais Tables
 * Cria tabelas para lançamento de documentos fiscais (NFe, Boletos, Recibos, Cupons)
 */

import { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  // Tabela principal: documentos_fiscais
  const docsExists = await knex.schema.hasTable('documentos_fiscais');
  
  if (!docsExists) {
    await knex.schema.createTable('documentos_fiscais', (table) => {
      // Identificadores
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('company_id').notNullable();
      
      // Tipo e Números
      table.enum('tipo', ['nfe', 'boleto', 'recibo', 'cupom_fiscal']).notNullable();
      table.string('numero', 20).notNullable(); // Número do documento
      table.string('serie', 10).notNullable(); // Série (ex: "1" para NFe)
      
      // Datas
      table.date('data_emissao').notNullable();
      table.date('data_vencimento').nullable(); // Opcional para alguns tipos
      
      // Valores
      table.decimal('valor_total', 14, 2).notNullable();
      table.decimal('valor_impostos', 14, 2).defaultTo(0);
      table.decimal('valor_desconto', 14, 2).defaultTo(0);
      
      // Descrição e Notas
      table.text('descricao').notNullable();
      table.text('observacoes').nullable();
      
      // Cliente/Fornecedor (Contraparte)
      table.enum('contraparte_tipo', ['cliente', 'fornecedor']).notNullable();
      table.string('contraparte_cnpj', 18).notNullable(); // CNPJ formatado
      table.string('contraparte_nome', 255).notNullable();
      table.string('contraparte_email', 255).nullable();
      table.string('contraparte_telefone', 20).nullable();
      
      // Status
      table.enum('status', ['rascunho', 'registrado', 'cancelado']).defaultTo('rascunho');
      table.boolean('registrado_no_diario').defaultTo(false);
      table.uuid('lancamento_diario_id').nullable(); // Referência ao diário se foi criado
      
      // Soft delete
      table.boolean('is_active').defaultTo(true);
      
      // Timestamps
      table.timestamp('created_at').defaultTo(knex.fn.now());
      table.timestamp('updated_at').defaultTo(knex.fn.now());
      table.uuid('created_by').notNullable(); // Usuário que criou
      table.uuid('updated_by').nullable(); // Usuário que atualizou por último
      
      // Índices
      table.index(['company_id']);
      table.index(['contraparte_cnpj']);
      table.index(['data_emissao']);
      table.index(['status']);
      table.index(['tipo']);
      table.unique(['company_id', 'tipo', 'serie', 'numero']); // Combo: empresa + tipo + série + número
    });
  }

  // Tabela: itens_documento_fiscal (itens individuais do documento)
  const itensExists = await knex.schema.hasTable('itens_documentos_fiscais');
  
  if (!itensExists) {
    await knex.schema.createTable('itens_documentos_fiscais', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('documento_fiscal_id').notNullable().references('id').inTable('documentos_fiscais').onDelete('CASCADE');
      
      // Item details
      table.string('descricao', 500).notNullable();
      table.string('codigo_produto', 50).nullable(); // Ex: SKU
      table.decimal('quantidade', 10, 4).notNullable();
      table.decimal('valor_unitario', 14, 2).notNullable();
      table.decimal('valor_total', 14, 2).notNullable();
      
      // Impostos (opcionais)
      table.decimal('aliquota_icms', 5, 2).nullable();
      table.decimal('valor_icms', 14, 2).defaultTo(0);
      table.decimal('aliquota_ipi', 5, 2).nullable();
      table.decimal('valor_ipi', 14, 2).defaultTo(0);
      table.decimal('aliquota_pis', 5, 2).nullable();
      table.decimal('aliquota_cofins', 5, 2).nullable();
      
      // Ordem
      table.integer('ordem').defaultTo(0);
      
      // Timestamps
      table.timestamp('created_at').defaultTo(knex.fn.now());
      
      // Índice
      table.index(['documento_fiscal_id']);
    });
  }

  // Tabela: anexos_documento (para arquivos/comprovantes)
  const anexosExists = await knex.schema.hasTable('anexos_documentos_fiscais');
  
  if (!anexosExists) {
    await knex.schema.createTable('anexos_documentos_fiscais', (table) => {
      table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      table.uuid('documento_fiscal_id').notNullable().references('id').inTable('documentos_fiscais').onDelete('CASCADE');
      
      // Arquivo
      table.string('nome_arquivo', 255).notNullable();
      table.string('tipo_arquivo', 50).notNullable(); // pdf, jpg, png, etc
      table.string('url_arquivo', 500).notNullable(); // URL no S3 ou local
      table.integer('tamanho_bytes').nullable();
      
      // Metadata
      table.string('descricao', 255).nullable();
      table.enum('tipo_anexo', ['xml', 'imagem', 'pdf', 'outro']).notNullable();
      
      // Timestamps
      table.timestamp('uploaded_at').defaultTo(knex.fn.now());
      table.uuid('uploaded_by').notNullable();
      
      // Índice
      table.index(['documento_fiscal_id']);
    });
  }
}

/**
 * Down migration - drop tables
 */
export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('anexos_documentos_fiscais');
  await knex.schema.dropTableIfExists('itens_documentos_fiscais');
  await knex.schema.dropTableIfExists('documentos_fiscais');
}
