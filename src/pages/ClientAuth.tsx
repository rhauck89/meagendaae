import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { User, ArrowLeft } from 'lucide-react';
import { formatWhatsApp, isValidWhatsApp } from '@/lib/whatsapp';
import { PasswordInput, generateStrongPassword } from '@/components/PasswordInput';
import { AuthErrorDialog } from '@/components/AuthErrorDialog';

const ClientAuth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);

  const defaultTab = searchParams.get('tab') === 'signup' ? 'signup' : 'login';

  // Login form
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup form — pre-fill from query params (post-booking flow)
  const [signupName, setSignupName] = useState(searchParams.get('name') || '');
  const [signupPhone, setSignupPhone] = useState(searchParams.get('phone') || '');
  const [signupEmail, setSignupEmail] = useState(searchParams.get('email') || '');
  const [signupPassword, setSignupPassword] = useState('');

  // If already logged in, redirect to portal
  if (user) {
    navigate('/minha-conta');
    return null;
  }

  const handleLogin = async () => {
    if (!loginEmail || !loginPassword) { toast.error('Preencha email e senha'); return; }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    navigate('/minha-conta');
  };

  const handleSignup = async () => {
    if (!signupName || !signupPhone || !signupEmail || !signupPassword) {
      toast.error('Preencha todos os campos'); return;
    }
    if (!isValidWhatsApp(signupPhone)) {
      toast.error('Telefone inválido'); return;
    }
    if (signupPassword.length < 8) {
      toast.error('A senha deve ter no mínimo 8 caracteres'); return;
    }
    setLoading(true);
    const formattedPhone = formatWhatsApp(signupPhone);

    const { data, error } = await supabase.auth.signUp({
      email: signupEmail.trim(),
      password: signupPassword,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: {
          full_name: signupName,
          whatsapp: formattedPhone,
          role: 'client',
        },
      },
    });

    if (error) {
      setLoading(false);
      const { diagnoseAuthError } = await import('@/lib/auth-errors');
      toast.error(diagnoseAuthError(error));
      return;
    }

    // Link existing client records by phone
    if (data.user) {
      await supabase.rpc('link_client_to_user', {
        p_user_id: data.user.id,
        p_phone: formattedPhone,
      });
    }

    setLoading(false);
    toast.success('Conta criada! Verifique seu email para confirmar.');
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <User className="h-12 w-12 mx-auto text-primary mb-3" />
          <h1 className="text-2xl font-bold">Área do Cliente</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {defaultTab === 'signup'
              ? 'Crie sua conta para acompanhar agendamentos, cashback e pontos'
              : 'Acesse seu painel para ver agendamentos, cashback e pontos'}
          </p>
        </div>

        <Tabs defaultValue={defaultTab}>
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="login">Entrar</TabsTrigger>
            <TabsTrigger value="signup">Criar conta</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="mt-4">
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    placeholder="seu@email.com"
                  />
                </div>
                <PasswordInput
                  label="Senha"
                  value={loginPassword}
                  onChange={setLoginPassword}
                  placeholder="Sua senha"
                  autoComplete="current-password"
                  showStrength={false}
                />
                <Button className="w-full" onClick={handleLogin} disabled={loading}>
                  {loading ? 'Entrando...' : 'Entrar'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="signup" className="mt-4">
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-2">
                  <Label>Nome completo</Label>
                  <Input
                    value={signupName}
                    onChange={e => setSignupName(e.target.value)}
                    placeholder="Seu nome"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefone (WhatsApp)</Label>
                  <Input
                    value={signupPhone}
                    onChange={e => setSignupPhone(e.target.value)}
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={signupEmail}
                    onChange={e => setSignupEmail(e.target.value)}
                    placeholder="seu@email.com"
                  />
                </div>
                <PasswordInput
                  label="Senha"
                  value={signupPassword}
                  onChange={setSignupPassword}
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
                />
                <Button className="w-full" onClick={handleSignup} disabled={loading}>
                  {loading ? 'Criando...' : 'Criar conta'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Button variant="ghost" className="w-full text-sm" onClick={() => navigate('/')}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar ao início
        </Button>
      </div>
    </div>
  );
};

export default ClientAuth;
