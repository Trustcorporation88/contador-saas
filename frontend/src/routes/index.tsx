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
            element: <Placeholder title="Dashboard Executivo" task="Task 3.3" />,
          },
          {
            path: 'empresas',
            element: <Placeholder title="Empresas" task="Task 3.4" />,
          },
          {
            path: 'contas',
            element: <Placeholder title="Plano de Contas" task="Task 3.5" />,
          },
          {
            path: 'lancamentos',
            element: <Placeholder title="Lançamentos Contábeis" task="Tasks 3.6–3.7" />,
          },
          {
            path: 'relatorios/balanco',
            element: <Placeholder title="Balanço Patrimonial" task="Task 3.8" />,
          },
          {
            path: 'relatorios/dre',
            element: <Placeholder title="DRE" task="Task 3.9" />,
          },
          {
            path: 'relatorios/outros',
            element: <Placeholder title="Outros Relatórios" task="Task 3.10" />,
          },
          {
            path: 'impostos',
            element: <Placeholder title="Apuração de Impostos" task="Task 3.11" />,
          },
          {
            path: 'auditoria',
            element: <Placeholder title="Auditoria & Logs" task="Task 3.12" />,
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
