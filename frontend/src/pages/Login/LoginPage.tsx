import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { TrendingUp, Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';

// ─── Validation schemas ───────────────────────────────────────────────────────

const loginSchema = z.object({
  email:    z.string().email('E-mail inválido'),
  password: z.string().min(6, 'Mínimo 6 caracteres'),
});
type LoginForm = z.infer<typeof loginSchema>;

const mfaSchema = z.object({
  totpToken: z
    .string()
    .length(6, 'Exatamente 6 dígitos')
    .regex(/^\d{6}$/, 'Apenas dígitos numéricos'),
});
type MfaForm = z.infer<typeof mfaSchema>;

// ─── Error alert ──────────────────────────────────────────────────────────────

function ErrorAlert({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
    >
      {message}
    </div>
  );
}

// ─── LoginPage ────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const [step, setStep]           = useState<'credentials' | 'mfa'>('credentials');
  const [tempToken, setTempToken] = useState('');
  const [showPwd, setShowPwd]     = useState(false);
  const [apiError, setApiError]   = useState('');

  const { login, verifyMfa, loading } = useAuth();

  const loginForm = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });
  const mfaForm   = useForm<MfaForm>({
    resolver: zodResolver(mfaSchema),
    defaultValues: { totpToken: '' },
  });

  // ── Handlers ──────────────────────────────────────────────────────────────

  const onLoginSubmit = async (data: LoginForm) => {
    setApiError('');
    const res = await login(data);
    if (res.requiresMfa && res.tempToken) {
      setTempToken(res.tempToken);
      setStep('mfa');
      mfaForm.reset();
    } else if (!res.success && res.error) {
      setApiError(res.error);
    }
  };

  const onMfaSubmit = async (data: MfaForm) => {
    setApiError('');
    const res = await verifyMfa(tempToken, data.totpToken);
    if (!res.success && res.error) setApiError(res.error);
  };

  const goBack = () => { setStep('credentials'); setApiError(''); setTempToken(''); };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary-50 to-indigo-100 p-4">
      <div className="w-full max-w-md">

        {/* Brand */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-600 shadow-lg shadow-primary-200">
            <TrendingUp className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Contador SaaS</h1>
          <p className="mt-1 text-sm text-gray-500">Sistema Contábil · Lei 6.404/76</p>
        </div>

        <div className="card card-body">
          {step === 'credentials' ? (
            /* ── Etapa 1: e-mail + senha ──────────────────────────── */
            <>
              <h2 className="mb-6 text-center text-base font-semibold text-gray-700">
                Acesso ao Sistema
              </h2>
              <form
                onSubmit={loginForm.handleSubmit(onLoginSubmit)}
                noValidate
                className="space-y-4"
              >
                <Input
                  label="E-mail"
                  type="email"
                  autoComplete="email"
                  placeholder="seu@email.com.br"
                  icon={<Mail className="h-4 w-4" />}
                  error={loginForm.formState.errors.email?.message}
                  {...loginForm.register('email')}
                />

                <div className="relative">
                  <Input
                    label="Senha"
                    type={showPwd ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    icon={<Lock className="h-4 w-4" />}
                    error={loginForm.formState.errors.password?.message}
                    {...loginForm.register('password')}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    tabIndex={-1}
                    aria-label={showPwd ? 'Ocultar senha' : 'Mostrar senha'}
                    className="absolute right-3 top-[2.15rem] text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                {apiError && <ErrorAlert message={apiError} />}

                <Button type="submit" className="w-full justify-center" loading={loading}>
                  Entrar
                </Button>
              </form>
            </>
          ) : (
            /* ── Etapa 2: TOTP MFA ────────────────────────────────── */
            <>
              <div className="mb-6 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary-100">
                  <Lock className="h-6 w-6 text-primary-600" />
                </div>
                <h2 className="text-base font-semibold text-gray-700">
                  Verificação em Dois Fatores
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Digite o código de 6 dígitos do seu aplicativo autenticador
                </p>
              </div>

              <form
                onSubmit={mfaForm.handleSubmit(onMfaSubmit)}
                noValidate
                className="space-y-4"
              >
                {/* Controller para permitir onChange customizado (auto-submit) */}
                <Controller
                  name="totpToken"
                  control={mfaForm.control}
                  render={({ field, fieldState }) => (
                    <Input
                      label="Código TOTP"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="000000"
                      maxLength={6}
                      className="text-center text-xl tracking-[0.5em] font-mono"
                      error={fieldState.error?.message}
                      value={field.value}
                      name={field.name}
                      ref={field.ref}
                      autoFocus
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                        field.onChange(val);
                        if (val.length === 6) mfaForm.handleSubmit(onMfaSubmit)();
                      }}
                    />
                  )}
                />

                {apiError && <ErrorAlert message={apiError} />}

                <Button type="submit" className="w-full justify-center" loading={loading}>
                  Verificar código
                </Button>

                <button
                  type="button"
                  onClick={goBack}
                  className="w-full text-center text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  ← Voltar ao login
                </button>
              </form>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-gray-400">
          © {new Date().getFullYear()} Contador SaaS · LGPD compliant
        </p>
      </div>
    </div>
  );
}
