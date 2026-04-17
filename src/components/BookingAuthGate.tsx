import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Sparkles } from 'lucide-react';
import { z } from 'zod';
import { PasswordInput, generateStrongPassword } from '@/components/PasswordInput';
import { AuthErrorDialog } from '@/components/AuthErrorDialog';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-filled client info from booking form */
  defaultName: string;
  defaultEmail: string;
  defaultWhatsapp: string;
  /** Called once user is authenticated (signed in or signed up) */
  onAuthenticated: () => void;
}

const credentialsSchema = z.object({
  email: z.string().trim().email('Email inválido').max(255),
  password: z.string().min(8, 'A senha deve ter no mínimo 8 caracteres').max(72),
  fullName: z.string().trim().min(1, 'Nome obrigatório').max(100),
});

export const BookingAuthGate = ({
  open,
  onOpenChange,
  defaultName,
  defaultEmail,
  defaultWhatsapp,
  onAuthenticated,
}: Props) => {
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorModal, setErrorModal] = useState<{ open: boolean; message: string }>({ open: false, message: '' });

  const handleSubmit = async () => {
    const parsed = credentialsSchema.safeParse({
      email,
      password,
      fullName: defaultName,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setLoading(true);
    try {
      // 1. Try to sign in with existing credentials
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: parsed.data.email,
        password: parsed.data.password,
      });

      if (!signInError) {
        toast.success('Login realizado!');
        onOpenChange(false);
        onAuthenticated();
        return;
      }

      // 2. If invalid credentials, try to sign up (account might not exist)
      const isInvalidCreds = /invalid login|invalid credentials/i.test(signInError.message);
      if (!isInvalidCreds) {
        toast.error(signInError.message);
        return;
      }

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
          data: {
            full_name: parsed.data.fullName,
            whatsapp: defaultWhatsapp,
            role: 'client',
          },
        },
      });

      if (signUpError) {
        const { diagnoseAuthError } = await import('@/lib/auth-errors');
        toast.error(diagnoseAuthError(signUpError));
        return;
      }

      // 3. Link any existing client records by phone OR email
      if (signUpData.user) {
        await supabase.rpc('link_client_to_user', {
          p_user_id: signUpData.user.id,
          p_phone: defaultWhatsapp || null,
          p_email: parsed.data.email,
        } as any);
      }

      toast.success('Conta criada! Você está logado.');
      onOpenChange(false);
      onAuthenticated();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao autenticar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Crie sua conta para finalizar
          </DialogTitle>
          <DialogDescription>
            Para acompanhar agendamentos, cashback e fidelidade, finalize seu cadastro.
            Se já tem conta, é só informar a senha — entramos automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="auth-gate-email">Email</Label>
            <Input
              id="auth-gate-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              autoComplete="email"
            />
          </div>

          <div className="space-y-2">
          <PasswordInput
            id="auth-gate-password"
            label="Senha"
            value={password}
            onChange={setPassword}
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !loading) handleSubmit();
            }}
          />
          <p className="text-xs text-muted-foreground">
            Se já tem conta, use sua senha. Caso contrário, criaremos a conta agora.
          </p>
        </div>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full"
          size="lg"
        >
          {loading ? 'Processando...' : 'Continuar e confirmar agendamento'}
        </Button>
      </DialogContent>
    </Dialog>
  );
};
