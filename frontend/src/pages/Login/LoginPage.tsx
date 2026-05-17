import { TrendingUp } from 'lucide-react';

/**
 * LoginPage — estrutura visual criada na Task 3.1.
 * Integração completa com API + MFA implementada na Task 3.2.
 */
export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-600 shadow-lg">
            <TrendingUp className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Contador SaaS</h1>
          <p className="mt-1 text-sm text-gray-500">Sistema Contábil · Lei 6.404/76</p>
        </div>

        {/* Card placeholder */}
        <div className="card card-body">
          <h2 className="mb-6 text-center text-base font-semibold text-gray-700">
            Acesso ao Sistema
          </h2>

          {/* Form fields — funcionais na Task 3.2 */}
          <div className="space-y-4">
            <div>
              <label className="input-label">E-mail</label>
              <input
                type="email"
                className="input-field"
                placeholder="seu@email.com.br"
                disabled
              />
            </div>
            <div>
              <label className="input-label">Senha</label>
              <input
                type="password"
                className="input-field"
                placeholder="••••••••"
                disabled
              />
            </div>
            <button className="btn-primary w-full justify-center" disabled>
              Entrar
            </button>
          </div>

          <p className="mt-4 text-center text-xs text-gray-400">
            Autenticação completa implementada na Task 3.2
          </p>
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} Contador SaaS · LGPD compliant
        </p>
      </div>
    </div>
  );
}
