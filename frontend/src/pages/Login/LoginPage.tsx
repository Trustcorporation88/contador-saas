import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Lock, Mail } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { AuthService } from '../../services/authService';

const BRAND_LOGO = '/brand/procontador-logo.png';

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

const forgotSchema = z.object({
  email: z.string().email('Informe um e-mail válido'),
});
type ForgotForm = z.infer<typeof forgotSchema>;

const resetSchema = z
  .object({
    token: z.string().min(10, 'Informe o token de recuperação'),
    newPassword: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .regex(/[A-Z]/, 'Inclua pelo menos uma letra maiúscula')
      .regex(/\d/, 'Inclua pelo menos um número')
      .regex(/[^A-Za-z0-9]/, 'Inclua pelo menos um caractere especial'),
    confirmPassword: z.string().min(8, 'Confirme a nova senha'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });
type ResetForm = z.infer<typeof resetSchema>;

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
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryHint, setRecoveryHint] = useState('');

  const { login, verifyMfa, loading } = useAuth();

  const loginForm = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });
  const forgotForm = useForm<ForgotForm>({ resolver: zodResolver(forgotSchema) });
  const resetForm = useForm<ResetForm>({ resolver: zodResolver(resetSchema) });
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

  const onForgotSubmit = async (data: ForgotForm) => {
    setApiError('');
    setRecoveryHint('');
    try {
      const response = await AuthService.forgotPassword({ email: data.email });
      if (response.debugToken) {
        setRecoveryHint(`Token de recuperação (ambiente não-produtivo): ${response.debugToken}`);
        resetForm.setValue('token', response.debugToken);
      } else {
        setRecoveryHint('Se o e-mail existir, você receberá instruções para redefinir a senha.');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Não foi possível solicitar recuperação agora.';
      setApiError(message);
    }
  };

  const onResetSubmit = async (data: ResetForm) => {
    setApiError('');
    setRecoveryHint('');
    try {
      await AuthService.resetPassword({ token: data.token, newPassword: data.newPassword });
      setRecoveryHint('Senha redefinida com sucesso. Faça login com a nova senha.');
      setShowRecovery(false);
      resetForm.reset();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Não foi possível redefinir a senha.';
      setApiError(message);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-8">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-[-8%] top-[-10%] h-72 w-72 rounded-full bg-primary-200/40 blur-3xl" />
        <div className="absolute bottom-[-12%] right-[-8%] h-80 w-80 rounded-full bg-primary-400/20 blur-3xl" />
      </div>

      <div className="relative z-10 grid w-full max-w-5xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="hidden rounded-[32px] border border-white/70 bg-[linear-gradient(145deg,rgba(16,101,79,0.95),rgba(7,39,32,0.96))] p-8 text-white shadow-[0_30px_90px_rgba(7,39,32,0.32)] lg:block">
          <div className="flex h-full flex-col justify-between">
            <div>
              <img
                src={BRAND_LOGO}
                alt="ProContador"
                width={220}
                height={220}
                className="mb-6 h-auto w-[min(100%,13.5rem)] rounded-2xl object-contain shadow-[0_18px_50px_rgba(0,0,0,0.35)]"
              />
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-primary-100/80">Plataforma contábil</p>
              <h1 className="mt-3 text-4xl font-extrabold leading-tight tracking-tight text-white">
                Contabilidade operacional com cara de produto premium.
              </h1>
              <p className="mt-5 max-w-md text-sm leading-7 text-white/72">
                Navegue por empresas, lançamentos, relatórios, risco fiscal e inteligência operacional em uma interface mais clara, segura e executiva.
              </p>
            </div>

            <div className="space-y-3 rounded-[28px] border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
              <div className="flex items-start gap-3">
                <div className="mt-1 h-2.5 w-2.5 rounded-full bg-primary-300" />
                <p className="text-sm text-white/80">Operação multiempresa com contexto visual mais legível.</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-1 h-2.5 w-2.5 rounded-full bg-primary-300" />
                <p className="text-sm text-white/80">Fluxos financeiros, fiscais e de auditoria em um shell unificado.</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="mt-1 h-2.5 w-2.5 rounded-full bg-primary-300" />
                <p className="text-sm text-white/80">Base preparada para IA, Open Finance e prova criptográfica.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full max-w-md justify-self-center lg:max-w-none lg:self-center">
          <div className="mb-8 text-center lg:hidden">
            <img
              src={BRAND_LOGO}
              alt="ProContador"
              width={112}
              height={112}
              className="mx-auto mb-4 h-28 w-28 rounded-2xl object-contain shadow-lg shadow-primary-200/60"
            />
            <h1 className="text-2xl font-bold text-gray-900">ProContador</h1>
            <p className="mt-1 text-sm text-gray-500">Sistema Contábil · Lei 6.404/76</p>
          </div>

          <div className="card card-body rounded-[32px] border-white/80 bg-white/82 shadow-[0_28px_80px_rgba(12,18,16,0.12)] backdrop-blur-2xl">
          {step === 'credentials' ? (
            /* ── Etapa 1: e-mail + senha ──────────────────────────── */
            <>
              <div className="mb-6 text-center">
                <img
                  src={BRAND_LOGO}
                  alt="ProContador"
                  width={72}
                  height={72}
                  className="mx-auto mb-3 hidden h-[4.5rem] w-[4.5rem] rounded-xl object-contain lg:block"
                />
                <p className="shell-title">Acesso restrito</p>
                <h2 className="mt-2 text-base font-semibold text-gray-700">
                  Acesso ao Sistema
                </h2>
              </div>
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

                {recoveryHint && (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                    {recoveryHint}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setShowRecovery((prev) => !prev);
                    setApiError('');
                    setRecoveryHint('');
                  }}
                  className="text-sm font-medium text-primary-700 hover:text-primary-800"
                >
                  {showRecovery ? 'Fechar recuperação de senha' : 'Esqueci minha senha'}
                </button>

                {showRecovery && (
                  <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50/70 p-4">
                    <div className="space-y-3">
                      <Input
                        label="E-mail para recuperação"
                        type="email"
                        autoComplete="email"
                        placeholder="seu@email.com.br"
                        error={forgotForm.formState.errors.email?.message}
                        {...forgotForm.register('email')}
                      />
                      <Button type="button" className="w-full justify-center" loading={loading} onClick={forgotForm.handleSubmit(onForgotSubmit)}>
                        Enviar instruções de recuperação
                      </Button>
                    </div>

                    <div className="space-y-3">
                      <Input
                        label="Token de recuperação"
                        type="text"
                        placeholder="Cole o token recebido"
                        error={resetForm.formState.errors.token?.message}
                        {...resetForm.register('token')}
                      />
                      <Input
                        label="Nova senha"
                        type="password"
                        autoComplete="new-password"
                        placeholder="Nova senha"
                        error={resetForm.formState.errors.newPassword?.message}
                        {...resetForm.register('newPassword')}
                      />
                      <Input
                        label="Confirmar nova senha"
                        type="password"
                        autoComplete="new-password"
                        placeholder="Confirme a nova senha"
                        error={resetForm.formState.errors.confirmPassword?.message}
                        {...resetForm.register('confirmPassword')}
                      />
                      <Button type="button" className="w-full justify-center" loading={loading} onClick={resetForm.handleSubmit(onResetSubmit)}>
                        Redefinir senha
                      </Button>
                    </div>
                  </div>
                )}

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
            © {new Date().getFullYear()} ProContador · LGPD compliant
          </p>
        </div>
      </div>
    </div>
  );
}
