import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Scissors, Calendar, DollarSign, Bell, Tag, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { usePlatformSettings } from '@/hooks/usePlatformSettings';
import { PlatformFooter } from '@/components/PlatformFooter';
import { useIsMobile } from '@/hooks/use-mobile';
import { PasswordInput, generateStrongPassword } from '@/components/PasswordInput';
import { AuthErrorDialog } from '@/components/AuthErrorDialog';

// Friendly error mapping is centralized in src/lib/auth-errors.ts (diagnoseAuthError)

const benefits = [
  { icon: Calendar, text: 'Agenda inteligente' },
  { icon: DollarSign, text: 'Controle financeiro automático' },
  { icon: Bell, text: 'Lembretes para clientes' },
  { icon: Tag, text: 'Promoções para horários vazios' },
];

const Auth = () => {
  const navigate = useNavigate();
  const platform = usePlatformSettings();
  const isMobile = useIsMobile();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [errorModal, setErrorModal] = useState<{ open: boolean; message: string }>({ open: false, message: '' });
  const firstInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const passwordFieldRef = useRef<HTMLInputElement>(null);

  // Clear any corrupted/stale auth tokens when /auth is opened.
  // Fixes "Invalid Refresh Token" loops where a stale localStorage token
  // poisons subsequent signInWithPassword attempts.
  useEffect(() => {
    const recoveryParams = `${window.location.search}${window.location.hash}`;
    if (recoveryParams.includes('type=recovery') || recoveryParams.includes('code=')) {
      navigate(`/reset-password${window.location.search}${window.location.hash}`, { replace: true });
      return;
    }

    // Basic session check on mount, but without aggressive signout
    // AuthContext handles the source of truth for sessions.
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) console.error('[AUTH_DEBUG] Session check error:', error);
      if (session) {
        console.log('[AUTH_DEBUG] Valid session found on Auth mount, redirecting...');
        navigate('/dashboard');
      }
    });
  }, [navigate]);

  useEffect(() => {
    setTimeout(() => {
      if (!isLogin && firstInputRef.current) {
        firstInputRef.current.focus();
      } else if (isLogin && emailInputRef.current) {
        emailInputRef.current.focus();
      }
    }, 100);
  }, [isLogin]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!isLogin && !fullName.trim()) {
      newErrors.fullName = 'Nome é obrigatório.';
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Insira um email válido.';
    }
    if (!isLogin && password.length < 8) {
      newErrors.password = 'A senha deve ter no mínimo 8 caracteres.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      if (isLogin) {
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
        if (error) {
          // Real error visible in dev console for debugging (status + code)
          // eslint-disable-next-line no-console
          console.error('[LOGIN ERROR]', {
            message: error.message,
            status: (error as any).status,
            code: (error as any).code,
            name: error.name,
          });
          throw error;
        }
        toast.success('Login realizado com sucesso!');
        navigate('/dashboard');

        // Do not block login on secondary routing checks. AuthContext/DashboardLayout
        // will load the company state, and this avoids the login button getting stuck
        // when a profile/company query is slow.
        void supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', data.user.id)
          .then(async ({ data: rolesData }) => {
            const roles = rolesData?.map(r => r.role) || [];
            if (roles.includes('super_admin')) {
              navigate('/super-admin');
              return;
            }

            const { data: companies } = await supabase.rpc('get_user_companies');
            if (companies && companies.length > 1) {
              navigate('/select-company');
            } else if (companies && companies.length === 1) {
              await supabase.rpc('switch_active_company', { _company_id: companies[0].company_id });
            }
          })
          .catch((secondaryError) => {
            console.warn('[LOGIN] Secondary routing check failed:', secondaryError);
          });
      } else {
        const { data: signUpData, error: authError } = await supabase.functions.invoke('auth-handler', {
          body: {
            email: email.trim(),
            password: password,
            fullName: fullName.trim(),
            type: 'signup'
          }
        });

        if (authError) {
          console.error('SIGNUP ERROR:', authError);
          throw authError;
        }

        toast.success('Conta criada! Verifique seu email para confirmar antes de entrar.');
        setIsLogin(true);
      }
    } catch (error: any) {
      const { diagnoseAuthError } = await import('@/lib/auth-errors');
      const friendly = diagnoseAuthError(error);
      if (!isLogin) {
        setErrorModal({ open: true, message: friendly });
      } else {
        toast.error(friendly);
      }
    } finally {
      setLoading(false);
    }
  };

  const focusPasswordField = () => {
    setPassword('');
    setTimeout(() => {
      const el = document.getElementById('password') as HTMLInputElement | null;
      el?.focus();
    }, 80);
  };

  const handleGenerate = () => {
    const pwd = generateStrongPassword(16);
    setPassword(pwd);
    try { navigator.clipboard.writeText(pwd); } catch {}
    toast.success('Senha forte gerada e copiada 🔐');
    setTimeout(() => {
      const el = document.getElementById('password') as HTMLInputElement | null;
      el?.focus();
    }, 80);
  };

  const logoUrl = platform?.logo_light || platform?.system_logo || platform?.logo_dark;
  const logoUrlDark = platform?.logo_dark || platform?.system_logo || platform?.logo_light;

  const formContent = (
    <Card className="w-full max-w-[420px] shadow-xl border-0 rounded-2xl">
      <CardHeader className="text-center space-y-4">
        {isMobile && (
          logoUrlDark ? (
            <img src={logoUrlDark} alt={platform?.system_name || 'Logo'} className="mx-auto h-12 max-w-[160px] object-contain" />
          ) : (
            <div className="mx-auto w-12 h-12 bg-primary rounded-2xl flex items-center justify-center">
              <Scissors className="h-6 w-6 text-primary-foreground" />
            </div>
          )
        )}
        <div>
          <CardTitle className="text-2xl font-display">
            {isLogin ? 'Entrar' : 'Criar Conta'}
          </CardTitle>
          <CardDescription>
            {isLogin ? 'Acesse seu painel de agendamentos' : 'Crie sua conta para começar a agendar'}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <div className="space-y-2">
              <Label htmlFor="fullName">Nome completo</Label>
              <Input
                ref={firstInputRef}
                id="fullName"
                value={fullName}
                onChange={(e) => { setFullName(e.target.value); setErrors((p) => ({ ...p, fullName: '' })); }}
                placeholder="Seu nome"
                autoComplete="name"
              />
              {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              ref={emailInputRef}
              id="email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setErrors((p) => ({ ...p, email: '' })); }}
              placeholder="seu@email.com"
              autoComplete="email"
            />
            {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
          </div>
          <div className="space-y-2">
            <PasswordInput
              id="password"
              label="Senha"
              value={password}
              onChange={(v) => { setPassword(v); setErrors((p) => ({ ...p, password: '' })); }}
              placeholder={isLogin ? 'Sua senha' : 'Mínimo 8 caracteres'}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              showStrength={!isLogin}
            />
            {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
            {isLogin && (
              <div className="text-right">
                <Link to="/forgot-password" className="text-xs text-muted-foreground hover:text-primary hover:underline">
                  Esqueceu sua senha?
                </Link>
              </div>
            )}
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Processando...' : isLogin ? 'Entrar' : 'Criar Conta'}
          </Button>
        </form>
        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => { setIsLogin(!isLogin); setErrors({}); }}
            className="text-sm text-primary hover:underline"
          >
            {isLogin ? 'Não tem conta? Cadastre-se' : 'Já tem conta? Faça login'}
          </button>
        </div>
      </CardContent>
    </Card>
  );

  const errorDialog = (
    <AuthErrorDialog
      open={errorModal.open}
      onOpenChange={(open) => setErrorModal((s) => ({ ...s, open }))}
      message={errorModal.message}
      onAcknowledge={focusPasswordField}
      onGeneratePassword={handleGenerate}
    />
  );

  if (isMobile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        {formContent}
        <PlatformFooter className="mt-6" />
        {errorDialog}
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left branding column */}
      <div className="hidden lg:flex w-1/2 bg-primary flex-col items-center justify-center p-12 relative overflow-hidden">
        {/* Subtle decorative circles */}
        <div className="absolute top-[-80px] left-[-80px] w-64 h-64 rounded-full bg-white/5" />
        <div className="absolute bottom-[-60px] right-[-60px] w-48 h-48 rounded-full bg-white/5" />

        <div className="relative z-10 max-w-md text-center space-y-8">
          {logoUrl ? (
            <img src={logoUrl} alt={platform?.system_name || 'Logo'} className="mx-auto h-14 max-w-[200px] object-contain" />
          ) : (
            <div className="mx-auto w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center">
              <Scissors className="h-8 w-8 text-primary-foreground" />
            </div>
          )}

          <div className="space-y-3">
            <h1 className="text-3xl font-bold text-primary-foreground leading-tight">
              Gerencie sua barbearia com inteligência
            </h1>
            <p className="text-primary-foreground/70 text-lg">
              Agenda, clientes, financeiro e promoções em um só lugar.
            </p>
          </div>

          <div className="space-y-4 text-left">
            {benefits.map((b, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                  <b.icon className="h-5 w-5 text-accent" />
                </div>
                <span className="text-primary-foreground/90 text-base">{b.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right form column */}
      <div className="flex-1 flex flex-col items-center justify-center bg-background p-8">
        {formContent}
        <PlatformFooter className="mt-8" />
      </div>
      {errorDialog}
    </div>
  );
};

export default Auth;
