import React from 'react';
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Outlet,
} from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import AppLayout from '../components/Layout/AppLayout';
import LoginPage from '../pages/Login/LoginPage';
import DashboardPage from '../pages/Dashboard/DashboardPage';
import EmpresasPage from '../pages/Empresas/EmpresasPage';
import ContasPage from '../pages/Contas/ContasPage';
import LancamentosPage from '../pages/Lancamentos/LancamentosPage';
import LancadorPage from '../pages/Lancamentos/LancadorPage';
import DocumentosPage from '../pages/Documentos/DocumentosPage';
import ContasReceberPage from '../pages/ContasReceber/ContasReceberPage';
import ContasPagarPage from '../pages/ContasPagar/ContasPagarPage';
import FluxoCaixaPage from '../pages/Relatorios/FluxoCaixaPage';
import BalancoPage from '../pages/Relatorios/BalancoPage';
import DREPage from '../pages/Relatorios/DREPage';
import OutrosPage from '../pages/Relatorios/OutrosPage';
import ImpostosPage from '../pages/Impostos/ImpostosPage';
import AuditoriaPage from '../pages/Auditoria/AuditoriaPage';
import ConfiguracoesPage from '../pages/Configuracoes/ConfiguracoesPage';
import ClientePage from '../pages/Cliente/ClientePage';
// Módulos inovadores
import SaudePage from '../pages/Saude/SaudePage';
import SimuladorPage from '../pages/Simulador/SimuladorPage';
import BenchmarkPage from '../pages/Benchmark/BenchmarkPage';
import RiscoFiscalPage from '../pages/RiscoFiscal/RiscoFiscalPage';
import OpenFinancePage from '../pages/OpenFinance/OpenFinancePage';
import CopilotoPage from '../pages/Copiloto/CopilotoPage';
import ProvaHashPage from '../pages/ProvaHash/ProvaHashPage';
import type { UserRole } from '../types';
import { canAccessPath, getDefaultRoute } from '../utils/access';

// ─── Route guard ─────────────────────────────────────────────────────────────

function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function DefaultHomeRedirect() {
  const role = useAuthStore((s) => s.user?.role);
  return <Navigate to={getDefaultRoute(role)} replace />;
}

function RoleRoute({ allowedPath, children }: { allowedPath: string; children: React.ReactElement }) {
  const role = useAuthStore((s) => s.user?.role) as UserRole | undefined;
  if (!canAccessPath(role, allowedPath)) {
    return <Navigate to={getDefaultRoute(role)} replace />;
  }
  return children;
}

// ─── Placeholder lazy pages (implementados nas tasks 3.3–3.13) ───────────────

const Placeholder: React.FC<{ title: string; task: string }> = ({ title, task }) => (
  <div className="p-8">
    <div className="card max-w-lg">
      <div className="card-body text-center py-12">
        <div className="text-4xl mb-4">🏗️</div>
        <h2 className="mb-2">{title}</h2>
        <p className="text-sm text-gray-500">Implementado na {task}</p>
      </div>
    </div>
  </div>
);

// ─── Router definition ────────────────────────────────────────────────────────

const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <DefaultHomeRedirect /> },
          {
            path: 'dashboard',
            element: <RoleRoute allowedPath="/dashboard"><DashboardPage /></RoleRoute>,
          },
          {
            path: 'cliente',
            element: <RoleRoute allowedPath="/cliente"><ClientePage /></RoleRoute>,
          },
          {
            path: 'empresas',
            element: <RoleRoute allowedPath="/empresas"><EmpresasPage /></RoleRoute>,
          },
          {
            path: 'contas',
            element: <RoleRoute allowedPath="/contas"><ContasPage /></RoleRoute>,
          },
          {
            path: 'lancamentos',
            element: <RoleRoute allowedPath="/lancamentos"><LancamentosPage /></RoleRoute>,
          },
          {
            path: 'documentos',
            element: <RoleRoute allowedPath="/documentos"><DocumentosPage /></RoleRoute>,
          },
          {
            path: 'contas-receber',
            element: <RoleRoute allowedPath="/contas-receber"><ContasReceberPage /></RoleRoute>,
          },
          {
            path: 'contas-pagar',
            element: <RoleRoute allowedPath="/contas-pagar"><ContasPagarPage /></RoleRoute>,
          },
          {
            path: 'lancamentos/novo',
            element: <RoleRoute allowedPath="/lancamentos"><LancadorPage /></RoleRoute>,
          },
          {
            path: 'lancamentos/:id/editar',
            element: <RoleRoute allowedPath="/lancamentos"><LancadorPage /></RoleRoute>,
          },
          {
            path: 'relatorios/fluxo-caixa',
            element: <RoleRoute allowedPath="/relatorios/fluxo-caixa"><FluxoCaixaPage /></RoleRoute>,
          },
          {
            path: 'relatorios/balanco',
            element: <RoleRoute allowedPath="/relatorios/balanco"><BalancoPage /></RoleRoute>,
          },
          {
            path: 'relatorios/dre',
            element: <RoleRoute allowedPath="/relatorios/dre"><DREPage /></RoleRoute>,
          },
          {
            path: 'relatorios/outros',
            element: <RoleRoute allowedPath="/relatorios/outros"><OutrosPage /></RoleRoute>,
          },
          {
            path: 'impostos',
            element: <RoleRoute allowedPath="/impostos"><ImpostosPage /></RoleRoute>,
          },
          {
            path: 'auditoria',
            element: <RoleRoute allowedPath="/auditoria"><AuditoriaPage /></RoleRoute>,
          },
          {
            path: 'configuracoes',
            element: <RoleRoute allowedPath="/configuracoes"><ConfiguracoesPage /></RoleRoute>,
          },
          // ── Módulos inovadores ────────────────────────────────────────────
          {
            path: 'saude',
            element: <RoleRoute allowedPath="/saude"><SaudePage /></RoleRoute>,
          },
          {
            path: 'simulador',
            element: <RoleRoute allowedPath="/simulador"><SimuladorPage /></RoleRoute>,
          },
          {
            path: 'benchmark',
            element: <RoleRoute allowedPath="/benchmark"><BenchmarkPage /></RoleRoute>,
          },
          {
            path: 'risco-fiscal',
            element: <RoleRoute allowedPath="/risco-fiscal"><RiscoFiscalPage /></RoleRoute>,
          },
          {
            path: 'open-finance',
            element: <RoleRoute allowedPath="/open-finance"><OpenFinancePage /></RoleRoute>,
          },
          {
            path: 'copiloto',
            element: <RoleRoute allowedPath="/copiloto"><CopilotoPage /></RoleRoute>,
          },
          {
            path: 'prova-hash',
            element: <RoleRoute allowedPath="/prova-hash"><ProvaHashPage /></RoleRoute>,
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

export const AppRouter: React.FC = () => <RouterProvider router={router} />;
