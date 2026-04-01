import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Scissors } from 'lucide-react';
import { Link } from 'react-router-dom';

const friendlyError = (msg: string): string => {
  if (msg.includes('Invalid login')) return 'Email ou senha incorretos.';
  if (msg.includes('already registered')) return 'Este email já está cadastrado. Tente fazer login.';
  if (msg.includes('valid email')) return 'Insira um email válido.';
  if (msg.includes('least 6')) return 'A senha deve ter no mínimo 6 caracteres.';
  if (msg.includes('rate limit') || msg.includes('too many')) return 'Muitas tentativas. Aguarde um momento e tente novamente.';
  return 'Erro ao processar. Tente novamente.';
};

const Auth = () => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const firstInputRef = useRef<HTMLInputElement>(null);
  const emailInputRef = useRef<HTMLInputElement>(null);

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
    if (password.length < 6) {
      newErrors.password = 'A senha deve ter no mínimo 6 caracteres.';
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
        const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        
        // Check user roles to determine redirect
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', data.user.id);
        
        const roles = rolesData?.map(r => r.role) || [];
        const isSuperAdmin = roles.includes('super_admin');
        
        toast.success('Login realizado com sucesso!');
        navigate(isSuperAdmin ? '/super-admin' : '/dashboard');
      } else {
        const { error: authError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName.trim() } },
        });
        if (authError) throw authError;
        toast.success('Conta criada com sucesso!');
        navigate('/dashboard');
      }
    } catch (error: any) {
      toast.error(friendlyError(error.message || ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-14 h-14 bg-primary rounded-2xl flex items-center justify-center">
            <Scissors className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-2xl font-display">
              {isLogin ? 'Entrar' : 'Criar Conta'}
            </CardTitle>
            <CardDescription>
              {isLogin
                ? 'Acesse seu painel de agendamentos'
                : 'Crie sua conta para começar a agendar'}
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
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); setErrors((p) => ({ ...p, password: '' })); }}
                placeholder="Mínimo 6 caracteres"
                autoComplete={isLogin ? 'current-password' : 'new-password'}
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
    </div>
  );
};

export default Auth;
