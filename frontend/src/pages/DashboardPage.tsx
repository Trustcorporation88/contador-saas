import React from 'react';
import CopilotoChat from '../components/CopilotoChat';

export const DashboardPage: React.FC = () => {
  const financialData = {
    companyName: 'Contador Dev',
    balance: {
      ativoTotal: 100000,
      passivoTotal: 40000,
      patrimonioLiquido: 60000,
      ativoCirculante: 60000,
      passivoCirculante: 20000,
    },
    dre: {
      receitaLiquida: 28000,
      custoVendas: 8400,
      impostos: 5600,
      lucroLiquido: 14000,
    },
  };

  const handleExport = (sessionId: string) => {
    console.log('Exportar sessão:', sessionId);
    // Implementar exportação PDF
  };

  return (
    <div className="dashboard">
      <h1>Dashboard Financeiro</h1>
      <CopilotoChat
        companyName={financialData.companyName}
        financialData={financialData}
        onExport={handleExport}
      />
    </div>
  );
};

export default DashboardPage;
