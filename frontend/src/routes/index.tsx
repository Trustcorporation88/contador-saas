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
import BalancoPage from '../pages/Relatorios/BalancoPage';
import DREPage from '../pages/Relatorios/DREPage';
import OutrosPage from '../pages/Relatorios/OutrosPage';
import ImpostosPage from '../pages/Impostos/ImpostosPage';
import AuditoriaPage from '../pages/Auditoria/AuditoriaPage';

// ─── Route guard ─────────────────────────────────────────────────────────────

function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
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
          { index: true, element: <Navigate to="/dashboard" replace /> },
          {
            path: 'dashboard',
            element: <DashboardPage />,
          },
          {
            path: 'empresas',
            element: <EmpresasPage />,
          },
          {
            path: 'contas',
            element: <ContasPage />,
          },
          {
            path: 'lancamentos',
            element: <LancamentosPage />,
          },
          {
            path: 'lancamentos/novo',
            element: <LancadorPage />,
          },
          {
            path: 'lancamentos/:id/editar',
            element: <LancadorPage />,
          },
          {
            path: 'relatorios/balanco',
            element: <BalancoPage />,
          },
          {
            path: 'relatorios/dre',
            element: <DREPage />,
          },
          {
            path: 'relatorios/outros',
            element: <OutrosPage />,
          },
          {
            path: 'impostos',
            element: <ImpostosPage />,
          },
          {
            path: 'auditoria',
            element: <AuditoriaPage />,
          },
          {
            path: 'configuracoes',
            element: <Placeholder title="Configurações" task="Task 3.13" />,
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]);

export const AppRouter: React.FC = () => <RouterProvider router={router} />;
