import PDFDocument from 'pdfkit';
import { ChatHistoryService } from './chatHistoryService';
import { Readable } from 'stream';

export class PDFExportService {
  /**
   * Gera PDF da sessão de chat
   */
  static generateSessionPDF(sessionId: string): Readable {
    const session = ChatHistoryService.getSession(sessionId);
    if (!session) throw new Error(`Sessão ${sessionId} não encontrada`);

    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
    });

    // Cabeçalho
    doc.fontSize(20).font('Helvetica-Bold').text('Relatório de Análise Contábil', {
      align: 'center',
    });

    doc.fontSize(12).font('Helvetica').text(`Empresa: ${session.companyName}`, {
      align: 'center',
    });

    doc.fontSize(10).text(`Sessão: ${session.id}`, {
      align: 'center',
    });

    doc.fontSize(9).text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, {
      align: 'center',
    });

    doc.moveTo(40, doc.y + 10).lineTo(555, doc.y + 10).stroke();
    doc.moveDown(1);

    // Histórico de conversa
    doc.fontSize(14).font('Helvetica-Bold').text('Histórico da Conversa', {
      underline: true,
    });
    doc.moveDown(0.5);

    session.messages.forEach((msg, idx) => {
      const role = msg.role === 'user' ? '👤 Usuário' : '🤖 Copiloto';
      const timestamp = new Date(msg.timestamp).toLocaleTimeString('pt-BR');

      doc.fontSize(10).font('Helvetica-Bold').text(`${role} (${timestamp})`, {
        color: msg.role === 'user' ? '#667eea' : '#764ba2',
      });

      doc.fontSize(9).font('Helvetica').text(msg.content, {
        align: 'left',
        width: 475,
      });

      doc.moveDown(0.5);
    });

    // Rodapé
    doc.moveDown(1);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.fontSize(8).text('Este relatório foi gerado automaticamente pelo Copiloto Contábil.', {
      align: 'center',
      color: '#999',
    });

    doc.end();
    return doc;
  }

  /**
   * Gera PDF com análise financeira + chat
   */
  static generateAnalysisPDF(
    sessionId: string,
    financialData: any,
  ): Readable {
    const session = ChatHistoryService.getSession(sessionId);
    if (!session) throw new Error(`Sessão ${sessionId} não encontrada`);

    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
    });

    // Cabeçalho
    doc.fontSize(20).font('Helvetica-Bold').text('Análise Financeira Completa', {
      align: 'center',
    });

    doc.fontSize(12).font('Helvetica').text(`${session.companyName}`, {
      align: 'center',
    });

    doc.fontSize(9).text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, {
      align: 'center',
    });

    doc.moveTo(40, doc.y + 10).lineTo(555, doc.y + 10).stroke();
    doc.moveDown(1);

    // Dados Financeiros
    if (financialData) {
      doc.fontSize(14).font('Helvetica-Bold').text('Dados Financeiros', {
        underline: true,
      });
      doc.moveDown(0.5);

      const balance = financialData.balance || {};
      const dre = financialData.dre || {};

      doc.fontSize(10).font('Helvetica-Bold').text('Balanço Patrimonial:');
      doc.fontSize(9).font('Helvetica');
      doc.text(`  • Ativo Total: R$ ${(balance.ativoTotal || 0).toLocaleString('pt-BR')}`);
      doc.text(`  • Passivo Total: R$ ${(balance.passivoTotal || 0).toLocaleString('pt-BR')}`);
      doc.text(`  • Patrimônio Líquido: R$ ${(balance.patrimonioLiquido || 0).toLocaleString('pt-BR')}`);
      doc.text(`  • Ativo Circulante: R$ ${(balance.ativoCirculante || 0).toLocaleString('pt-BR')}`);
      doc.text(`  • Passivo Circulante: R$ ${(balance.passivoCirculante || 0).toLocaleString('pt-BR')}`);

      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica-Bold').text('Demonstração de Resultado:');
      doc.fontSize(9).font('Helvetica');
      doc.text(`  • Receita Líquida: R$ ${(dre.receitaLiquida || 0).toLocaleString('pt-BR')}`);
      doc.text(`  • Custo de Vendas: R$ ${(dre.custoVendas || 0).toLocaleString('pt-BR')}`);
      doc.text(`  • Impostos: R$ ${(dre.impostos || 0).toLocaleString('pt-BR')}`);
      doc.text(`  • Lucro Líquido: R$ ${(dre.lucroLiquido || 0).toLocaleString('pt-BR')}`);

      doc.moveDown(1);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(1);
    }

    // Histórico de conversa
    doc.fontSize(14).font('Helvetica-Bold').text('Análise do Copiloto', {
      underline: true,
    });
    doc.moveDown(0.5);

    session.messages.forEach((msg) => {
      const role = msg.role === 'user' ? 'Pergunta' : 'Resposta';
      const timestamp = new Date(msg.timestamp).toLocaleTimeString('pt-BR');

      doc.fontSize(9).font('Helvetica-Bold').text(`${role} (${timestamp})`, {
        color: msg.role === 'user' ? '#667eea' : '#764ba2',
      });

      doc.fontSize(8).font('Helvetica').text(msg.content, {
        align: 'left',
        width: 475,
      });

      doc.moveDown(0.3);
    });

    // Rodapé
    doc.moveDown(1);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.fontSize(7).text('Relatório confidencial gerado pelo Copiloto Contábil. Uso restrito.', {
      align: 'center',
      color: '#999',
    });

    doc.end();
    return doc;
  }
}
