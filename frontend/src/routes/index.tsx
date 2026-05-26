import React, { lazy, Suspense } from "react";
import {
  createBrowserRouter,
  RouterProvider,
  Navigate,
  Outlet,
} from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import AppLayout from "../components/Layout/AppLayout";
import type { UserRole } from "../types";
import { canAccessPath, getDefaultRoute } from "../utils/access";
import { PUBLIC_ACCESS_ENABLED } from "../config/publicAccess";

// Loading component
const LoadingScreen: React.FC = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="text-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
      <p className="text-gray-600 dark:text-gray-400">Carregando...</p>
    </div>
  </div>
);

// Lazy loaded pages
const LoginPage = lazy(() => import("../pages/Login/LoginPage"));
const ServicesDashboard = lazy(() =>
  import("../pages/Dashboard/ServicesDashboard").then((m) => ({
    default: m.ServicesDashboard,
  })),
);
const DashboardPage = lazy(() => import("../pages/Dashboard/DashboardPage"));
const EmpresasPage = lazy(() => import("../pages/Empresas/EmpresasPage"));
const ContasPage = lazy(() => import("../pages/Contas/ContasPage"));
const LancamentosPage = lazy(
  () => import("../pages/Lancamentos/LancamentosPage"),
);
const LancadorPage = lazy(() => import("../pages/Lancamentos/LancadorPage"));
const DocumentosPage = lazy(() => import("../pages/Documentos/DocumentosPage"));
const ContasReceberPage = lazy(
  () => import("../pages/ContasReceber/ContasReceberPage"),
);
const ContasPagarPage = lazy(
  () => import("../pages/ContasPagar/ContasPagarPage"),
);
const FluxoCaixaPage = lazy(() => import("../pages/Relatorios/FluxoCaixaPage"));
const BalancoPage = lazy(() => import("../pages/Relatorios/BalancoPage"));
const DREPage = lazy(() => import("../pages/Relatorios/DREPage"));
const OutrosPage = lazy(() => import("../pages/Relatorios/OutrosPage"));
const ImpostosPage = lazy(() => import("../pages/Impostos/ImpostosPage"));
const AuditoriaPage = lazy(() => import("../pages/Auditoria/AuditoriaPage"));
const ConfiguracoesPage = lazy(
  () => import("../pages/Configuracoes/ConfiguracoesPage"),
);
const ClientePage = lazy(() => import("../pages/Cliente/ClientePage"));
const ServicesCatalogPage = lazy(
  () => import("../pages/Servicos/ServicesCatalogPage"),
);
const ServiceDetailPage = lazy(
  () => import("../pages/ServiceDetail/ServiceDetailPage"),
);
// M�dulos inovadores
const SaudePage = lazy(() => import("../pages/Saude/SaudePage"));
const SimuladorPage = lazy(() => import("../pages/Simulador/SimuladorPage"));
const BenchmarkPage = lazy(() => import("../pages/Benchmark/BenchmarkPage"));
const RiscoFiscalPage = lazy(
  () => import("../pages/RiscoFiscal/RiscoFiscalPage"),
);
const OpenFinancePage = lazy(
  () => import("../pages/OpenFinance/OpenFinancePage"),
);
const CopilotoPage = lazy(() => import("../pages/Copiloto/CopilotoPage"));
const ProvaHashPage = lazy(() => import("../pages/ProvaHash/ProvaHashPage"));
const DASPage = lazy(() => import("../pages/DAS/DASPage"));
const ServicesHubPage = lazy(() => import("../pages/ServicesHub"));

// --- Route guard -------------------------------------------------------------

function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (PUBLIC_ACCESS_ENABLED) return <Outlet />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function DefaultHomeRedirect() {
  const role = useAuthStore((s) => s.user?.role);
  return <Navigate to={getDefaultRoute(role)} replace />;
}

function RoleRoute({
  allowedPath,
  children,
}: {
  allowedPath: string;
  children: React.ReactElement;
}) {
  const role = useAuthStore((s) => s.user?.role) as UserRole | undefined;
  if (!canAccessPath(role, allowedPath)) {
    return <Navigate to={getDefaultRoute(role)} replace />;
  }
  return children;
}

// --- Placeholder lazy pages (implementados nas tasks 3.3�3.13) ---------------

const Placeholder: React.FC<{ title: string; task: string }> = ({
  title,
  task,
}) => (
  <div className="p-8">
    <div className="card max-w-lg">
      <div className="card-body text-center py-12">
        <div className="text-4xl mb-4">???</div>
        <h2 className="mb-2">{title}</h2>
        <p className="text-sm text-gray-500">Implementado na {task}</p>
      </div>
    </div>
  </div>
);

// --- Router definition --------------------------------------------------------

const router = createBrowserRouter([
  {
    path: "/login",
    element: PUBLIC_ACCESS_ENABLED ? (
      <Navigate to="/cliente" replace />
    ) : (
      <Suspense fallback={<LoadingScreen />}>
        <LoginPage />
      </Suspense>
    ),
  },
  {
    path: "/",
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          {
            index: true,
            element: (
              <Suspense fallback={<LoadingScreen />}>
                <ServicesDashboard />
              </Suspense>
            ),
          },
          {
            path: "dashboard",
            element: (
              <RoleRoute allowedPath="/dashboard">
                <Suspense fallback={<LoadingScreen />}>
                  <DashboardPage />
                </Suspense>
              </RoleRoute>
            ),
          },
          {
            path: "servicos",
            element: (
              <RoleRoute allowedPath="/servicos">
                <Suspense fallback={<LoadingScreen />}>
                  <ServicesDashboard />
                </Suspense>
              </RoleRoute>
            ),
          },
          {
            path: "servicos/catalogo",
            element: (
              <RoleRoute allowedPath="/servicos">
                <Suspense fallback={<LoadingScreen />}>
                  <ServicesCatalogPage />
                </Suspense>
              </RoleRoute>
            ),
          },
          {
            path: "servicos/hub",
            element: (
              <RoleRoute allowedPath="/servicos">
                <Suspense fallback={<LoadingScreen />}>
                  <ServicesHubPage />
                </Suspense>
              </RoleRoute>
            ),
          },
          {
            path: "servicos/:id",
            element: (
              <RoleRoute allowedPath="/servicos">
                <Suspense fallback={<LoadingScreen />}>
                  <ServiceDetailPage />
                </Suspense>
              </RoleRoute>
            ),
          },
          {
            path: "cliente",
            element: (
              <RoleRoute allowedPath="/cliente">
                <Suspense fallback={<LoadingScreen />}>
                  <ClientePage />
                </Suspense>
              </RoleRoute>
            ),
          },
          {
            path: "empresas",
            element: (
              <RoleRoute allowedPath="/empresas">
                <Suspense fallback={<LoadingScreen />}>
                  <EmpresasPage />
                </Suspense>
              </RoleRoute>
            ),
          },
          {
            path: "contas",
            element: (
              <RoleRoute allowedPath="/contas">
                <Suspense fallback={<LoadingScreen />}>
                  <ContasPage />
                </Suspense>
              </RoleRoute>
            ),
          },
          {
            path: "lancamentos",
            element: (
              <RoleRoute allowedPath="/lancamentos">
                <Suspense fallback={<LoadingScreen />}>
                  <LancamentosPage />
                </Suspense>
              </RoleRoute>
            ),
          },
          {
            path: "documentos",
            element: (
              <RoleRoute allowedPath="/documentos">
                <Suspense fallback={<LoadingScreen />}>
                  <DocumentosPage />
                </Suspense>
              </RoleRoute>
            ),
          },
          {
            path: "contas-receber",
            element: (
              <RoleRoute allowedPath="/contas-receber">
                <Suspense fallback={<LoadingScreen />}>
                  <ContasReceberPage />
                </Suspense>
              </RoleRoute>
            ),
          },
          {
            path: "contas-pagar",
            element: (
              <RoleRoute allowedPath="/contas-pagar">
                <Suspense fallback={<LoadingScreen />}>
                  <ContasPagarPage />
                </Suspense>
              </RoleRoute>
            ),
          },
          {
            path: "impostos/das",
            element: (
              <RoleRoute allowedPath="/impostos">
                <Suspense fallback={<LoadingScreen />}>
                  <DASPage />
                </Suspense>
              </RoleRoute>
            ),
          },
          {
            path: "lancamentos/novo",
            element: (
              <RoleRoute allowedPath="/lancamentos">
                <Suspense fallback={<LoadingScreen />}>
                  <LancadorPage />
                </Suspense>
              </RoleRoute>
            ),
          },
          {
            path: "lancamentos/:id/editar",
            element: (
              <RoleRoute allowedPath="/lancamentos">
                <Suspense fallback={<LoadingScreen />}>
                  <LancadorPage />
                </Suspense>
              </RoleRoute>
            ),
          },
          {
            path: "relatorios/fluxo-caixa",
            element: (
              <RoleRoute allowedPath="/relatorios/fluxo-caixa">
                <Suspense fallback={<LoadingScreen />}>
                  <FluxoCaixaPage />
                </Suspense>
              </RoleRoute>
            ),
          },
          {
            path: "relatorios/balanco",
            element: (
              <RoleRoute allowedPath="/relatorios/balanco">
                <Suspense fallback={<LoadingScreen />}>
                  <BalancoPage />
                </Suspense>
              </RoleRoute>
            ),
          },
          {
            path: "relatorios/dre",
            element: (
              <RoleRoute allowedPath="/relatorios/dre">
                <Suspense fallback={<LoadingScreen />}>
                  <DREPage />
                </Suspense>
              </RoleRoute>
            ),
          },
          {
            path: "relatorios/outros",
            element: (
              <RoleRoute allowedPath="/relatorios/outros">
                <Suspense fallback={<LoadingScreen />}>
                  <OutrosPage />
                </Suspense>
              </RoleRoute>
            ),
          },
          {
            path: "impostos",
            element: (
              <RoleRoute allowedPath="/impostos">
                <Suspense fallback={<LoadingScreen />}>
                  <ImpostosPage />
                </Suspense>
              </RoleRoute>
            ),
          },
          {
            path: "auditoria",
            element: (
              <RoleRoute allowedPath="/auditoria">
                <Suspense fallback={<LoadingScreen />}>
                  <AuditoriaPage />
                </Suspense>
              </RoleRoute>
            ),
          },
          {
            path: "configuracoes",
            element: (
              <RoleRoute allowedPath="/configuracoes">
                <Suspense fallback={<LoadingScreen />}>
                  <ConfiguracoesPage />
                </Suspense>
              </RoleRoute>
            ),
          },
          // -- M�dulos inovadores --------------------------------------------
          {
            path: "saude",
            element: (
              <RoleRoute allowedPath="/saude">
                <Suspense fallback={<LoadingScreen />}>
                  <SaudePage />
                </Suspense>
              </RoleRoute>
            ),
          },
          {
            path: "simulador",
            element: (
              <RoleRoute allowedPath="/simulador">
                <Suspense fallback={<LoadingScreen />}>
                  <SimuladorPage />
                </Suspense>
              </RoleRoute>
            ),
          },
          {
            path: "benchmark",
            element: (
              <RoleRoute allowedPath="/benchmark">
                <Suspense fallback={<LoadingScreen />}>
                  <BenchmarkPage />
                </Suspense>
              </RoleRoute>
            ),
          },
          {
            path: "risco-fiscal",
            element: (
              <RoleRoute allowedPath="/risco-fiscal">
                <Suspense fallback={<LoadingScreen />}>
                  <RiscoFiscalPage />
                </Suspense>
              </RoleRoute>
            ),
          },
          {
            path: "open-finance",
            element: (
              <RoleRoute allowedPath="/open-finance">
                <Suspense fallback={<LoadingScreen />}>
                  <OpenFinancePage />
                </Suspense>
              </RoleRoute>
            ),
          },
          {
            path: "copiloto",
            element: (
              <RoleRoute allowedPath="/copiloto">
                <Suspense fallback={<LoadingScreen />}>
                  <CopilotoPage />
                </Suspense>
              </RoleRoute>
            ),
          },
          {
            path: "prova-hash",
            element: (
              <RoleRoute allowedPath="/prova-hash">
                <Suspense fallback={<LoadingScreen />}>
                  <ProvaHashPage />
                </Suspense>
              </RoleRoute>
            ),
          },
        ],
      },
    ],
  },
  { path: "*", element: <Navigate to="/" replace /> },
]);

export const AppRouter: React.FC = () => <RouterProvider router={router} />;
