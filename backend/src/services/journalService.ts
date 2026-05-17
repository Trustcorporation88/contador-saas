/**
 * Journal Entry Service
 * Lógica de negócio para lançamentos contábeis
 * Implementa partidas dobradas, validação de saldo, e hash de auditoria
 * Lei 6.404/76 - Contabilidade Societária Brasileira
 */

import crypto from 'crypto';
import { getDatabase } from '../config/database';
import { logger } from '../middleware/requestLogger';
import {
  CreateJournalEntryDTO,
  UpdateJournalEntryDTO,
  JournalEntryResponse,
  JournalLineResponse,
  PaginatedJournalResponse,
  JournalFilters,
  JournalDTOValidator,
} from '../models/dtos/journalDTO';

/**
 * JournalService - Gerencia lançamentos contábeis
 * Responsável por criação, listagem, atualização, exclusão e postagem
 * Garante partidas dobradas: sum(debits) = sum(credits)
 */
export class JournalService {

  /**
   * Criar novo lançamento contábil
   * Valida partidas dobradas e que todas as contas existem na empresa
   *
   * @param companyId - ID da empresa (isolamento multi-tenant)
   * @param userId    - ID do usuário criador
   * @param data      - CreateJournalEntryDTO
   * @returns JournalEntryResponse com linhas incluídas
   */
  static async create(
    companyId: string,
    userId: string,
    data: CreateJournalEntryDTO,
  ): Promise<JournalEntryResponse> {
    const db = await getDatabase();

    // 1. Validar DTO
    const validation = JournalDTOValidator.validateCreateDTO(data);
    if (!validation.isValid) {
      const msg = Object.entries(validation.errors)
        .map(([k, v]) => `${k}: ${v}`)
        .join('; ');
      throw Object.assign(new Error(`Validation error: ${msg}`), { status: 400 });
    }

    // 2. Validar que todas as contas existem e pertencem à empresa
    const accountIds = [...new Set(data.lines.map(l => l.account_id))];
    const accounts = await db('accounts')
      .whereIn('id', accountIds)
      .where('company_id', companyId)
      .where('is_active', true)
      .select('id', 'code', 'name');

    if (accounts.length !== accountIds.length) {
      const foundIds = new Set(accounts.map((a: { id: string }) => a.id));
      const missing = accountIds.filter(id => !foundIds.has(id));
      throw Object.assign(
        new Error(`Contas não encontradas ou inativas: ${missing.join(', ')}`),
        { status: 422 },
      );
    }

    // 3. Calcular totais
    const totalDebit = data.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
    const totalCredit = data.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);

    // 4. Gerar hash de integridade (SHA-256)
    const hashPayload = JSON.stringify({
      company_id: companyId,
      entry_date: data.entry_date,
      lines: data.lines.map(l => ({
        account_id: l.account_id,
        debit: l.debit,
        credit: l.credit,
      })),
    });
    const dataHash = crypto.createHash('sha256').update(hashPayload).digest('hex');

    // 5. Inserir em transação
    const trx = await db.transaction();
    try {
      // Inserir cabeçalho
      const [entry] = await trx('journal_entries').insert({
        company_id: companyId,
        created_by: userId,
        entry_date: data.entry_date,
        description: data.description || null,
        reference_type: data.reference_type || null,
        reference_number: data.reference_number || null,
        reference_issuer: data.reference_issuer || null,
        total_debit: totalDebit,
        total_credit: totalCredit,
        is_posted: false,
        data_hash: dataHash,
      }).returning('*');

      // Inserir linhas
      const lineInserts = data.lines.map((line, index) => ({
        journal_entry_id: entry.id,
        account_id: line.account_id,
        cost_center_id: line.cost_center_id || null,
        debit: Number(line.debit) || 0,
        credit: Number(line.credit) || 0,
        description: line.description || null,
        line_number: index + 1,
      }));

      const insertedLines = await trx('journal_lines').insert(lineInserts).returning('*');

      await trx.commit();

      // Montar resposta com dados de conta
      const accountMap = new Map(accounts.map((a: { id: string; code: string; name: string }) => [a.id, a]));
      const lines: JournalLineResponse[] = insertedLines.map((l: Record<string, unknown>) => {
        const acc = accountMap.get(l.account_id as string) as { id: string; code: string; name: string } | undefined;
        return {
          id: l.id as string,
          journal_entry_id: l.journal_entry_id as string,
          account_id: l.account_id as string,
          account_code: acc?.code,
          account_name: acc?.name,
          cost_center_id: l.cost_center_id as string | undefined,
          debit: Number(l.debit),
          credit: Number(l.credit),
          description: l.description as string | undefined,
          line_number: l.line_number as number,
        };
      });

      logger.info('Journal entry created', { companyId, entryId: entry.id, totalDebit, totalCredit });

      return this.formatEntry(entry, lines);
    } catch (err) {
      await trx.rollback();
      throw err;
    }
  }

  /**
   * Listar lançamentos com paginação e filtros
   */
  static async list(companyId: string, filters: JournalFilters): Promise<PaginatedJournalResponse> {
    const db = await getDatabase();
    const page = Math.max(1, Number(filters.page) || 1);
    const limit = Math.min(500, Math.max(1, Number(filters.limit) || 20));
    const offset = (page - 1) * limit;

    let query = db('journal_entries').where('company_id', companyId);

    // Filtros
    if (filters.date_from) query = query.where('entry_date', '>=', filters.date_from);
    if (filters.date_to) query = query.where('entry_date', '<=', filters.date_to);
    if (typeof filters.is_posted === 'boolean') query = query.where('is_posted', filters.is_posted);
    if (filters.reference_type) query = query.where('reference_type', filters.reference_type);
    if (filters.search) {
      query = query.where(function () {
        this.whereILike('description', `%${filters.search}%`)
          .orWhereILike('reference_number', `%${filters.search}%`)
          .orWhereILike('reference_issuer', `%${filters.search}%`);
      });
    }

    // Filtrar por conta afetada (join nas lines)
    if (filters.account_id) {
      query = query.whereIn('id', function () {
        this.select('journal_entry_id')
          .from('journal_lines')
          .where('account_id', filters.account_id!);
      });
    }

    // Contar total
    const [{ count }] = await query.clone().count('* as count');
    const total = Number(count);

    // Buscar dados
    const rows = await query
      .orderBy('entry_date', 'desc')
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset)
      .select('*');

    return {
      data: rows.map((r: Record<string, unknown>) => this.formatEntry(r)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Buscar lançamento por ID com linhas
   */
  static async getById(entryId: string, companyId: string): Promise<JournalEntryResponse> {
    const db = await getDatabase();

    const entry = await db('journal_entries')
      .where('id', entryId)
      .where('company_id', companyId)
      .first();

    if (!entry) {
      throw Object.assign(new Error('Lançamento não encontrado'), { status: 404 });
    }

    // Buscar linhas com dados da conta
    const lines = await db('journal_lines as jl')
      .join('accounts as a', 'jl.account_id', 'a.id')
      .where('jl.journal_entry_id', entryId)
      .orderBy('jl.line_number', 'asc')
      .select(
        'jl.id',
        'jl.journal_entry_id',
        'jl.account_id',
        'a.code as account_code',
        'a.name as account_name',
        'jl.cost_center_id',
        'jl.debit',
        'jl.credit',
        'jl.description',
        'jl.line_number',
      );

    return this.formatEntry(entry, lines.map((l: Record<string, unknown>) => ({
      id: l.id as string,
      journal_entry_id: l.journal_entry_id as string,
      account_id: l.account_id as string,
      account_code: l.account_code as string,
      account_name: l.account_name as string,
      cost_center_id: l.cost_center_id as string | undefined,
      debit: Number(l.debit),
      credit: Number(l.credit),
      description: l.description as string | undefined,
      line_number: l.line_number as number,
    })));
  }

  /**
   * Atualizar lançamento (apenas DRAFT)
   */
  static async update(
    entryId: string,
    companyId: string,
    userId: string,
    data: UpdateJournalEntryDTO,
  ): Promise<JournalEntryResponse> {
    const db = await getDatabase();

    // Buscar e validar que existe e é DRAFT
    const existing = await db('journal_entries')
      .where('id', entryId)
      .where('company_id', companyId)
      .first();

    if (!existing) {
      throw Object.assign(new Error('Lançamento não encontrado'), { status: 404 });
    }
    if (existing.is_posted) {
      throw Object.assign(
        new Error('Lançamento já postado não pode ser alterado'),
        { status: 409 },
      );
    }

    // Validar DTO
    const validation = JournalDTOValidator.validateUpdateDTO(data);
    if (!validation.isValid) {
      const msg = Object.entries(validation.errors).map(([k, v]) => `${k}: ${v}`).join('; ');
      throw Object.assign(new Error(`Validation error: ${msg}`), { status: 400 });
    }

    const trx = await db.transaction();
    try {
      // Atualizar linhas se fornecidas
      let newLines: JournalLineResponse[] | undefined;
      let totalDebit = Number(existing.total_debit);
      let totalCredit = Number(existing.total_credit);

      if (data.lines && data.lines.length > 0) {
        // Validar contas
        const accountIds = [...new Set(data.lines.map(l => l.account_id))];
        const accounts = await trx('accounts')
          .whereIn('id', accountIds)
          .where('company_id', companyId)
          .where('is_active', true)
          .select('id', 'code', 'name');

        if (accounts.length !== accountIds.length) {
          const foundIds = new Set(accounts.map((a: { id: string }) => a.id));
          const missing = accountIds.filter(id => !foundIds.has(id));
          throw Object.assign(
            new Error(`Contas não encontradas: ${missing.join(', ')}`),
            { status: 422 },
          );
        }

        totalDebit = data.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0);
        totalCredit = data.lines.reduce((s, l) => s + (Number(l.credit) || 0), 0);

        // Deletar linhas antigas
        await trx('journal_lines').where('journal_entry_id', entryId).delete();

        // Inserir novas linhas
        const lineInserts = data.lines.map((line, index) => ({
          journal_entry_id: entryId,
          account_id: line.account_id,
          cost_center_id: line.cost_center_id || null,
          debit: Number(line.debit) || 0,
          credit: Number(line.credit) || 0,
          description: line.description || null,
          line_number: index + 1,
        }));
        const inserted = await trx('journal_lines').insert(lineInserts).returning('*');

        const accountMap = new Map(accounts.map((a: { id: string; code: string; name: string }) => [a.id, a]));
        newLines = inserted.map((l: Record<string, unknown>) => {
          const acc = accountMap.get(l.account_id as string) as { id: string; code: string; name: string } | undefined;
          return {
            id: l.id as string,
            journal_entry_id: l.journal_entry_id as string,
            account_id: l.account_id as string,
            account_code: acc?.code,
            account_name: acc?.name,
            cost_center_id: l.cost_center_id as string | undefined,
            debit: Number(l.debit),
            credit: Number(l.credit),
            description: l.description as string | undefined,
            line_number: l.line_number as number,
          };
        });
      }

      // Montar patch do cabeçalho
      const patch: Record<string, unknown> = { updated_at: new Date() };
      if (data.entry_date !== undefined) patch.entry_date = data.entry_date;
      if (data.description !== undefined) patch.description = data.description;
      if (data.reference_type !== undefined) patch.reference_type = data.reference_type;
      if (data.reference_number !== undefined) patch.reference_number = data.reference_number;
      if (data.reference_issuer !== undefined) patch.reference_issuer = data.reference_issuer;
      if (data.lines) {
        patch.total_debit = totalDebit;
        patch.total_credit = totalCredit;

        // Atualizar hash
        const hashPayload = JSON.stringify({
          company_id: companyId,
          entry_date: data.entry_date ?? existing.entry_date,
          lines: data.lines.map(l => ({ account_id: l.account_id, debit: l.debit, credit: l.credit })),
        });
        patch.data_hash = crypto.createHash('sha256').update(hashPayload).digest('hex');
      }

      const [updated] = await trx('journal_entries')
        .where('id', entryId)
        .update(patch)
        .returning('*');

      await trx.commit();

      logger.info('Journal entry updated', { companyId, entryId, userId });

      return this.formatEntry(updated, newLines);
    } catch (err) {
      await trx.rollback();
      throw err;
    }
  }

  /**
   * Deletar lançamento (apenas DRAFT)
   */
  static async delete(entryId: string, companyId: string): Promise<void> {
    const db = await getDatabase();

    const entry = await db('journal_entries')
      .where('id', entryId)
      .where('company_id', companyId)
      .first();

    if (!entry) {
      throw Object.assign(new Error('Lançamento não encontrado'), { status: 404 });
    }
    if (entry.is_posted) {
      throw Object.assign(
        new Error('Lançamento postado não pode ser excluído. Use estorno.'),
        { status: 409 },
      );
    }

    const trx = await db.transaction();
    try {
      await trx('journal_lines').where('journal_entry_id', entryId).delete();
      await trx('journal_entries').where('id', entryId).delete();
      await trx.commit();
      logger.info('Journal entry deleted', { companyId, entryId });
    } catch (err) {
      await trx.rollback();
      throw err;
    }
  }

  /**
   * Postar lançamento (DRAFT → POSTED)
   * Torna o lançamento imutável após validar equilíbrio
   */
  static async post(entryId: string, companyId: string, userId: string): Promise<JournalEntryResponse> {
    const db = await getDatabase();

    const entry = await db('journal_entries')
      .where('id', entryId)
      .where('company_id', companyId)
      .first();

    if (!entry) {
      throw Object.assign(new Error('Lançamento não encontrado'), { status: 404 });
    }
    if (entry.is_posted) {
      throw Object.assign(new Error('Lançamento já está postado'), { status: 409 });
    }

    // Verificar equilíbrio
    const totalDebit = Number(entry.total_debit);
    const totalCredit = Number(entry.total_credit);
    if (Math.abs(totalDebit - totalCredit) >= 0.01) {
      throw Object.assign(
        new Error(`Lançamento desbalanceado: débitos (${totalDebit.toFixed(2)}) ≠ créditos (${totalCredit.toFixed(2)})`),
        { status: 422 },
      );
    }

    const [updated] = await db('journal_entries')
      .where('id', entryId)
      .update({ is_posted: true, updated_at: new Date() })
      .returning('*');

    logger.info('Journal entry posted', { companyId, entryId, userId });
    return this.getById(entryId, companyId);
  }

  /**
   * Estornar lançamento postado
   * Cria novo lançamento com débitos e créditos invertidos
   */
  static async reverse(
    entryId: string,
    companyId: string,
    userId: string,
    reverseDate?: string,
  ): Promise<JournalEntryResponse> {
    const db = await getDatabase();

    const original = await this.getById(entryId, companyId);

    if (!original.is_posted) {
      throw Object.assign(
        new Error('Apenas lançamentos postados podem ser estornados'),
        { status: 409 },
      );
    }
    if (!original.lines || original.lines.length === 0) {
      throw Object.assign(new Error('Lançamento sem linhas para estornar'), { status: 422 });
    }

    // Criar lançamento invertido
    const reversedLines = original.lines.map(l => ({
      account_id: l.account_id,
      debit: l.credit,   // inverte
      credit: l.debit,   // inverte
      description: l.description,
      cost_center_id: l.cost_center_id,
    }));

    const reverseEntry = await this.create(companyId, userId, {
      entry_date: reverseDate || new Date().toISOString().split('T')[0],
      description: `ESTORNO: ${original.description || original.id}`,
      reference_type: original.reference_type as string | undefined,
      reference_number: original.reference_number,
      reference_issuer: original.reference_issuer,
      lines: reversedLines,
    });

    // Auto-postar o estorno
    await db('journal_entries')
      .where('id', reverseEntry.id)
      .update({ is_posted: true });

    logger.info('Journal entry reversed', { companyId, originalId: entryId, reverseId: reverseEntry.id });

    return this.getById(reverseEntry.id, companyId);
  }

  /**
   * Formatar entrada para resposta
   */
  private static formatEntry(row: Record<string, unknown>, lines?: JournalLineResponse[]): JournalEntryResponse {
    return {
      id: row.id as string,
      company_id: row.company_id as string,
      created_by: row.created_by as string,
      entry_date: row.entry_date as string,
      description: row.description as string | undefined,
      reference_type: row.reference_type as string | undefined,
      reference_number: row.reference_number as string | undefined,
      reference_issuer: row.reference_issuer as string | undefined,
      total_debit: Number(row.total_debit),
      total_credit: Number(row.total_credit),
      is_posted: Boolean(row.is_posted),
      data_hash: row.data_hash as string | undefined,
      lines,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };
  }
}
