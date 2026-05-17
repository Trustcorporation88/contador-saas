/**
 * Export Service
 * Geração de arquivos Excel (xlsx) e PDF para relatórios financeiros
 * Utiliza: exceljs (xlsx) e pdfkit (pdf)
 */

import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import {
  BalanceSheetReport,
  IncomeStatementReport,
  TrialBalanceReport,
  LedgerReport,
} from './reportService';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de formatação
// ─────────────────────────────────────────────────────────────────────────────

function fmt(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(dateStr?: string): string {
  if (!dateStr) return 'Atual';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

// Cor padrão para cabeçalhos Excel
const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1F3864' }, // Azul escuro
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  color: { argb: 'FFFFFFFF' },
  bold: true,
  size: 11,
};

const SUBTOTAL_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFD9E1F2' }, // Azul claro
};

function applyHeaderRow(row: ExcelJS.Row): void {
  row.fill = HEADER_FILL;
  row.font = HEADER_FONT;
  row.alignment = { vertical: 'middle', horizontal: 'center' };
  row.height = 22;
}

function applySubtotalRow(row: ExcelJS.Row): void {
  row.fill = SUBTOTAL_FILL;
  row.font = { bold: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// BALANÇO PATRIMONIAL — Excel
// ─────────────────────────────────────────────────────────────────────────────

export async function exportBalanceSheetToExcel(report: BalanceSheetReport): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Contador SaaS';
  wb.created = new Date();

  const ws = wb.addWorksheet('Balanço Patrimonial');

  // Título
  ws.mergeCells('A1:D1');
  const titleCell = ws.getCell('A1');
  titleCell.value = `BALANÇO PATRIMONIAL — ${fmtDate(report.date_to)}`;
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: 'center' };

  ws.addRow([]);

  // Cabeçalho da tabela
  const header = ws.addRow(['Código', 'Conta', 'Tipo', 'Saldo (R$)']);
  applyHeaderRow(header);
  ws.columns = [
    { key: 'code', width: 14 },
    { key: 'name', width: 40 },
    { key: 'type', width: 14 },
    { key: 'balance', width: 18 },
  ];

  // Ativo Circulante
  ws.addRow(['ATIVO CIRCULANTE', '', '', '']).font = { bold: true, italic: true };
  for (const a of report.assets.current) {
    ws.addRow([a.code, a.name, a.type, fmt(a.balance)]);
  }

  // Ativo Não Circulante
  ws.addRow(['ATIVO NÃO CIRCULANTE', '', '', '']).font = { bold: true, italic: true };
  for (const a of report.assets.non_current) {
    ws.addRow([a.code, a.name, a.type, fmt(a.balance)]);
  }

  const totalAssetsRow = ws.addRow(['', 'TOTAL DO ATIVO', '', fmt(report.total_assets)]);
  applySubtotalRow(totalAssetsRow);

  ws.addRow([]);

  // Passivo Circulante
  ws.addRow(['PASSIVO CIRCULANTE', '', '', '']).font = { bold: true, italic: true };
  for (const l of report.liabilities.current) {
    ws.addRow([l.code, l.name, l.type, fmt(l.balance)]);
  }

  // Passivo Não Circulante
  ws.addRow(['PASSIVO NÃO CIRCULANTE', '', '', '']).font = { bold: true, italic: true };
  for (const l of report.liabilities.non_current) {
    ws.addRow([l.code, l.name, l.type, fmt(l.balance)]);
  }

  // Patrimônio Líquido
  ws.addRow(['PATRIMÔNIO LÍQUIDO', '', '', '']).font = { bold: true, italic: true };
  for (const e of report.equity.items) {
    ws.addRow([e.code, e.name, e.type, fmt(e.balance)]);
  }

  const totalPlRow = ws.addRow(['', 'TOTAL PASSIVO + PL', '', fmt(report.total_liabilities_and_equity)]);
  applySubtotalRow(totalPlRow);

  ws.addRow([]);
  const balancedRow = ws.addRow(['', `Equilibrado: ${report.is_balanced ? 'SIM ✓' : 'NÃO ✗'}`, '', '']);
  balancedRow.font = { bold: true, color: { argb: report.is_balanced ? 'FF007700' : 'FFCC0000' } };

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ─────────────────────────────────────────────────────────────────────────────
// DRE — Excel
// ─────────────────────────────────────────────────────────────────────────────

export async function exportIncomeStatementToExcel(report: IncomeStatementReport): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Contador SaaS';
  const ws = wb.addWorksheet('DRE');

  ws.mergeCells('A1:D1');
  const titleCell = ws.getCell('A1');
  titleCell.value = `DRE — ${fmtDate(report.date_from)} a ${fmtDate(report.date_to)}`;
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: 'center' };

  ws.addRow([]);
  const header = ws.addRow(['Código', 'Conta', 'Tipo', 'Valor (R$)']);
  applyHeaderRow(header);
  ws.columns = [
    { key: 'code', width: 14 },
    { key: 'name', width: 40 },
    { key: 'type', width: 14 },
    { key: 'value', width: 18 },
  ];

  ws.addRow(['RECEITAS', '', '', '']).font = { bold: true, italic: true };
  for (const r of report.revenues) {
    ws.addRow([r.code, r.name, r.type, fmt(r.balance)]);
  }
  const grossRow = ws.addRow(['', 'RECEITA BRUTA', '', fmt(report.gross_revenue)]);
  applySubtotalRow(grossRow);

  ws.addRow([]);
  ws.addRow(['DESPESAS', '', '', '']).font = { bold: true, italic: true };
  for (const e of report.expenses) {
    ws.addRow([e.code, e.name, e.type, fmt(e.balance)]);
  }
  const expRow = ws.addRow(['', 'TOTAL DESPESAS', '', fmt(report.total_expenses)]);
  applySubtotalRow(expRow);

  ws.addRow([]);
  const niRow = ws.addRow([
    '',
    report.net_income >= 0 ? 'LUCRO LÍQUIDO' : 'PREJUÍZO LÍQUIDO',
    '',
    fmt(Math.abs(report.net_income)),
  ]);
  niRow.font = {
    bold: true,
    size: 12,
    color: { argb: report.net_income >= 0 ? 'FF007700' : 'FFCC0000' },
  };

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ─────────────────────────────────────────────────────────────────────────────
// BALANCETE — Excel
// ─────────────────────────────────────────────────────────────────────────────

export async function exportTrialBalanceToExcel(report: TrialBalanceReport): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Contador SaaS';
  const ws = wb.addWorksheet('Balancete');

  ws.mergeCells('A1:F1');
  const titleCell = ws.getCell('A1');
  titleCell.value = `BALANCETE DE VERIFICAÇÃO — ${fmtDate(report.date_from)} a ${fmtDate(report.date_to)}`;
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: 'center' };

  ws.addRow([]);
  const header = ws.addRow(['Código', 'Conta', 'Tipo', 'Débito (R$)', 'Crédito (R$)', 'Saldo (R$)']);
  applyHeaderRow(header);
  ws.columns = [
    { key: 'code', width: 14 },
    { key: 'name', width: 40 },
    { key: 'type', width: 14 },
    { key: 'debit', width: 16 },
    { key: 'credit', width: 16 },
    { key: 'balance', width: 16 },
  ];

  for (const item of report.items) {
    ws.addRow([item.code, item.name, item.type, fmt(item.debit_total), fmt(item.credit_total), fmt(item.balance)]);
  }

  ws.addRow([]);
  const totalsRow = ws.addRow([
    '', 'TOTAIS', '',
    fmt(report.totals.debit),
    fmt(report.totals.credit),
    '',
  ]);
  applySubtotalRow(totalsRow);

  ws.addRow(['', `Equilibrado: ${report.is_balanced ? 'SIM ✓' : 'NÃO ✗'}`, '', '', '', ''])
    .font = { bold: true, color: { argb: report.is_balanced ? 'FF007700' : 'FFCC0000' } };

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVRO RAZÃO — Excel
// ─────────────────────────────────────────────────────────────────────────────

export async function exportLedgerToExcel(report: LedgerReport): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Contador SaaS';
  const ws = wb.addWorksheet('Livro Razão');

  ws.mergeCells('A1:F1');
  const titleCell = ws.getCell('A1');
  titleCell.value = `LIVRO RAZÃO — ${report.account_code} - ${report.account_name}`;
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: 'center' };

  ws.addRow([]);
  const header = ws.addRow(['Data', 'Descrição', 'Referência', 'Débito (R$)', 'Crédito (R$)', 'Saldo (R$)']);
  applyHeaderRow(header);
  ws.columns = [
    { key: 'date', width: 14 },
    { key: 'desc', width: 36 },
    { key: 'ref', width: 16 },
    { key: 'debit', width: 16 },
    { key: 'credit', width: 16 },
    { key: 'balance', width: 16 },
  ];

  for (const entry of report.entries) {
    ws.addRow([
      fmtDate(entry.date),
      entry.description ?? '',
      entry.reference_number ?? '',
      fmt(entry.debit),
      fmt(entry.credit),
      fmt(entry.running_balance),
    ]);
  }

  ws.addRow([]);
  const totalsRow = ws.addRow([
    '', 'TOTAIS', '',
    fmt(report.total_debit),
    fmt(report.total_credit),
    fmt(report.closing_balance),
  ]);
  applySubtotalRow(totalsRow);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ─────────────────────────────────────────────────────────────────────────────
// BALANÇO PATRIMONIAL — PDF
// ─────────────────────────────────────────────────────────────────────────────

export function exportBalanceSheetToPdf(report: BalanceSheetReport): Buffer {
  const chunks: Buffer[] = [];
  const doc = new PDFDocument({ size: 'A4', margin: 50 });

  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  // Cabeçalho
  doc.fontSize(16).font('Helvetica-Bold').text('BALANÇO PATRIMONIAL', { align: 'center' });
  doc.fontSize(11).font('Helvetica').text(`Data: ${fmtDate(report.date_to)}`, { align: 'center' });
  doc.moveDown();

  const addSection = (title: string): void => {
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#1F3864').text(title);
    doc.fillColor('#000000');
  };

  const addAccountLine = (code: string, name: string, balance: number): void => {
    doc.fontSize(10).font('Helvetica')
      .text(`  ${code}  ${name}`, { continued: true, width: 380 })
      .text(`R$ ${fmt(balance)}`, { align: 'right' });
  };

  const addTotal = (label: string, value: number): void => {
    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica-Bold')
      .text(label, { continued: true, width: 380 })
      .text(`R$ ${fmt(value)}`, { align: 'right' });
    doc.moveDown(0.3);
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.5);
  };

  addSection('ATIVO');
  doc.fontSize(10).font('Helvetica-Bold').text('Ativo Circulante');
  for (const a of report.assets.current) addAccountLine(a.code, a.name, a.balance);
  doc.fontSize(10).font('Helvetica-Bold').text('Ativo Não Circulante');
  for (const a of report.assets.non_current) addAccountLine(a.code, a.name, a.balance);
  addTotal('TOTAL DO ATIVO', report.total_assets);

  addSection('PASSIVO');
  doc.fontSize(10).font('Helvetica-Bold').text('Passivo Circulante');
  for (const l of report.liabilities.current) addAccountLine(l.code, l.name, l.balance);
  doc.fontSize(10).font('Helvetica-Bold').text('Passivo Não Circulante');
  for (const l of report.liabilities.non_current) addAccountLine(l.code, l.name, l.balance);

  addSection('PATRIMÔNIO LÍQUIDO');
  for (const e of report.equity.items) addAccountLine(e.code, e.name, e.balance);
  addTotal('TOTAL PASSIVO + PL', report.total_liabilities_and_equity);

  const balancedText = `Equilibrado: ${report.is_balanced ? 'SIM ✓' : 'NÃO ✗'}`;
  doc.fontSize(10).fillColor(report.is_balanced ? 'green' : 'red').text(balancedText, { align: 'right' });
  doc.fillColor('#000000');

  doc.fontSize(8).text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, { align: 'center' });

  doc.end();
  return Buffer.concat(chunks);
}

// ─────────────────────────────────────────────────────────────────────────────
// DRE — PDF
// ─────────────────────────────────────────────────────────────────────────────

export function exportIncomeStatementToPdf(report: IncomeStatementReport): Buffer {
  const chunks: Buffer[] = [];
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  doc.fontSize(16).font('Helvetica-Bold').text('DEMONSTRAÇÃO DO RESULTADO DO EXERCÍCIO (DRE)', { align: 'center' });
  doc.fontSize(11).font('Helvetica').text(
    `Período: ${fmtDate(report.date_from)} a ${fmtDate(report.date_to)}`,
    { align: 'center' },
  );
  doc.moveDown();

  const addLine = (code: string, name: string, value: number): void => {
    doc.fontSize(10).font('Helvetica')
      .text(`  ${code}  ${name}`, { continued: true, width: 380 })
      .text(`R$ ${fmt(value)}`, { align: 'right' });
  };

  const addTotal = (label: string, value: number, color = '#000000'): void => {
    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica-Bold').fillColor(color)
      .text(label, { continued: true, width: 380 })
      .text(`R$ ${fmt(value)}`, { align: 'right' });
    doc.fillColor('#000000');
    doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
    doc.moveDown(0.5);
  };

  doc.fontSize(12).font('Helvetica-Bold').fillColor('#1F3864').text('RECEITAS');
  doc.fillColor('#000000');
  for (const r of report.revenues) addLine(r.code, r.name, r.balance);
  addTotal('RECEITA BRUTA', report.gross_revenue);

  doc.fontSize(12).font('Helvetica-Bold').fillColor('#1F3864').text('DESPESAS');
  doc.fillColor('#000000');
  for (const e of report.expenses) addLine(e.code, e.name, e.balance);
  addTotal('TOTAL DESPESAS', report.total_expenses);

  const label = report.net_income >= 0 ? 'LUCRO LÍQUIDO' : 'PREJUÍZO LÍQUIDO';
  addTotal(label, Math.abs(report.net_income), report.net_income >= 0 ? 'green' : 'red');

  doc.fontSize(8).text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, { align: 'center' });

  doc.end();
  return Buffer.concat(chunks);
}

// ─────────────────────────────────────────────────────────────────────────────
// BALANCETE — PDF
// ─────────────────────────────────────────────────────────────────────────────

export function exportTrialBalanceToPdf(report: TrialBalanceReport): Buffer {
  const chunks: Buffer[] = [];
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  doc.fontSize(16).font('Helvetica-Bold').text('BALANCETE DE VERIFICAÇÃO', { align: 'center' });
  doc.fontSize(11).font('Helvetica').text(
    `Período: ${fmtDate(report.date_from)} a ${fmtDate(report.date_to)}`,
    { align: 'center' },
  );
  doc.moveDown();

  // Cabeçalho da tabela
  doc.fontSize(10).font('Helvetica-Bold');
  const COL = { code: 50, name: 130, type: 330, debit: 385, credit: 450, balance: 510 };
  doc.text('Código', COL.code, doc.y);
  doc.text('Conta', COL.name, doc.y);
  doc.text('Débito', COL.debit, doc.y);
  doc.text('Crédito', COL.credit, doc.y);
  doc.moveDown(0.2);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.3);

  for (const item of report.items) {
    const y = doc.y;
    doc.fontSize(9).font('Helvetica');
    doc.text(item.code, COL.code, y);
    doc.text(item.name.substring(0, 35), COL.name, y);
    doc.text(fmt(item.debit_total), COL.debit, y);
    doc.text(fmt(item.credit_total), COL.credit, y);
    doc.moveDown(0.4);
  }

  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica-Bold')
    .text(`TOTAL: Débitos R$ ${fmt(report.totals.debit)}  |  Créditos R$ ${fmt(report.totals.credit)}`, { align: 'center' });

  doc.fontSize(8).text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, { align: 'center' });

  doc.end();
  return Buffer.concat(chunks);
}

// ─────────────────────────────────────────────────────────────────────────────
// LIVRO RAZÃO — PDF
// ─────────────────────────────────────────────────────────────────────────────

export function exportLedgerToPdf(report: LedgerReport): Buffer {
  const chunks: Buffer[] = [];
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  doc.on('data', (chunk: Buffer) => chunks.push(chunk));

  doc.fontSize(14).font('Helvetica-Bold')
    .text(`LIVRO RAZÃO — ${report.account_code} - ${report.account_name}`, { align: 'center' });
  doc.moveDown();

  doc.fontSize(10).font('Helvetica-Bold');
  const y0 = doc.y;
  doc.text('Data', 50, y0);
  doc.text('Descrição', 110, y0);
  doc.text('Débito', 340, y0);
  doc.text('Crédito', 400, y0);
  doc.text('Saldo', 465, y0);
  doc.moveDown(0.2);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.3);

  for (const entry of report.entries) {
    const y = doc.y;
    doc.fontSize(9).font('Helvetica');
    doc.text(fmtDate(entry.date), 50, y);
    doc.text((entry.description ?? '').substring(0, 32), 110, y);
    doc.text(fmt(entry.debit), 340, y);
    doc.text(fmt(entry.credit), 400, y);
    doc.text(fmt(entry.running_balance), 465, y);
    doc.moveDown(0.4);
  }

  doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
  doc.moveDown(0.3);
  doc.fontSize(10).font('Helvetica-Bold')
    .text(`Saldo Final: R$ ${fmt(report.closing_balance)}`, { align: 'right' });

  doc.fontSize(8).text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, { align: 'center' });

  doc.end();
  return Buffer.concat(chunks);
}
