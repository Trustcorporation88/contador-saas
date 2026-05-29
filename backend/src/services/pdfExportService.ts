import PDFDocument from 'pdfkit';
import { ChatHistoryService } from './chatHistoryService';
import { Readable } from 'stream';

export class PDFExportService {
  /**
   * Gera PDF da sessao de chat
   */
  static generateSessionPDF(sessionId: string): Readable {
    const session = ChatHistoryService.getSession(sessionId);
    if (!session) throw new Error(`Sessao ${sessionId} nao encontrada`);

    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
    });

    // Cabecalho
    doc.fillColor('#000000');
    doc.fontSize(20).font('Helvetica-Bold').text('Relatorio de Analise Contabil', {
      align: 'center',
    });

    doc.fontSize(12).font('Helvetica').text(`Empresa: ${session.companyName}`, {
      align: 'center',
    });

    doc.fontSize(10).text(`Sessao: ${session.id}`, {
      align: 'center',
    });

    doc.fontSize(9).text(`Gerado em: ${new Date().toLocaleString('pt-BR')}`, {
      align: 'center',
    });

    doc.moveTo(40, doc.y + 10).lineTo(555, doc.y + 10).stroke();
    doc.moveDown(1);

    // Historico de conversa
    doc.fontSize(14).font('Helvetica-Bold').text('Historico da Conversa', {
      underline: true,
    });
    doc.moveDown(0.5);

    session.messages.forEach((msg) => {
      const role = msg.role === 'user' ? 'Usuario' : 'Copiloto';
      const timestamp = new Date(msg.timestamp).toLocaleTimeString('pt-BR');
      const color = msg.role === 'user' ? '#667eea' : '#764ba2';

      doc.fillColor(color);
      doc.fontSize(10).font('Helvetica-Bold').text(`${role} (${timestamp})`);

      doc.fillColor('#000000');
      doc.fontSize(9).font('Helvetica').text(msg.content, {
        align: 'left',
        width: 475,
      });

      doc.moveDown(0.5);
    });

    // Rodape
    doc.moveDown(1);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.fillColor('#999999');
    doc.fontSize(8).text('Este relatorio foi gerado automaticamente pelo Copiloto Contabil.', {
      align: 'center',
    });

    doc.end();
    return doc as unknown as Readable;
  }

  /**
   * Gera PDF com analise financeira + chat
   */
  static generateAnalysisPDF(
    sessionId: string,
    financialData: any,
  ): Readable {
    const session = ChatHistoryService.getSession(sessionId);
    if (!session) throw new Error(`Sessao ${sessionId} nao encontrada`);

    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
    });

    // Cabecalho
    doc.fillColor('#000000');
    doc.fontSize(20).font('Helvetica-Bold').text('Analise Financeira Completa', {
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

      doc.fontSize(10).font('Helvetica-Bold').text('Balanco Patrimonial:');
      doc.fontSize(9).font('Helvetica');
      doc.text(`  - Ativo Total: R$ ${(balance.ativoTotal || 0).toLocaleString('pt-BR')}`);
      doc.text(`  - Passivo Total: R$ ${(balance.passivoTotal || 0).toLocaleString('pt-BR')}`);
      doc.text(`  - Patrimonio Liquido: R$ ${(balance.patrimonioLiquido || 0).toLocaleString('pt-BR')}`);
      doc.text(`  - Ativo Circulante: R$ ${(balance.ativoCirculante || 0).toLocaleString('pt-BR')}`);
      doc.text(`  - Passivo Circulante: R$ ${(balance.passivoCirculante || 0).toLocaleString('pt-BR')}`);

      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica-Bold').text('Demonstracao de Resultado:');
      doc.fontSize(9).font('Helvetica');
      doc.text(`  - Receita Liquida: R$ ${(dre.receitaLiquida || 0).toLocaleString('pt-BR')}`);
      doc.text(`  - Custo de Vendas: R$ ${(dre.custoVendas || 0).toLocaleString('pt-BR')}`);
      doc.text(`  - Impostos: R$ ${(dre.impostos || 0).toLocaleString('pt-BR')}`);
      doc.text(`  - Lucro Liquido: R$ ${(dre.lucroLiquido || 0).toLocaleString('pt-BR')}`);

      doc.moveDown(1);
      doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
      doc.moveDown(1);
    }

    // Historico de conversa
    doc.fontSize(14).font('Helvetica-Bold').text('Analise do Copiloto', {
      underline: true,
    });
    doc.moveDown(0.5);

    session.messages.forEach((msg) => {
      const role = msg.role === 'user' ? 'Pergunta' : 'Resposta';
      const timestamp = new Date(msg.timestamp).toLocaleTimeString('pt-BR');
      const color = msg.role === 'user' ? '#667eea' : '#764ba2';

      doc.fillColor(color);
      doc.fontSize(9).font('Helvetica-Bold').text(`${role} (${timestamp})`);

      doc.fillColor('#000000');
      doc.fontSize(8).font('Helvetica').text(msg.content, {
        align: 'left',
        width: 475,
      });

      doc.moveDown(0.3);
    });

    // Rodape
    doc.moveDown(1);
    doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
    doc.fillColor('#999999');
    doc.fontSize(7).text('Relatorio confidencial gerado pelo Copiloto Contabil. Uso restrito.', {
      align: 'center',
    });

    doc.end();
    return doc as unknown as Readable;
  }
}
