import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Lock, User, Mail, Phone, Cake, Sparkles, Loader2 } from 'lucide-react';
import { z } from 'zod';
import { formatWhatsApp } from '@/lib/whatsapp';
import { PasswordInput } from '@/components/PasswordInput';

interface CompleteSignupModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName?: string;
  defaultEmail?: string;
  defaultWhatsapp?: string;
  defaultBirthDate?: string;
  companyId: string;
  /** Called after successful signup/login + client linkage. Useful for redirecting. */
  onSuccess?: () => void;
}

const signupSchema = z
  .object({
    fullName: z.string().trim().min(1, 'Nome obrigatório').max(100, 'Nome muito longo'),
    email: z.string().trim().email('Email inválido').max(255),
    whatsapp: z.string().trim().min(10, 'WhatsApp inválido').max(20),
    birthDate: z.string().optional().or(z.literal('')),
    password: z.string().min(8, 'Senha deve ter no mínimo 8 caracteres').max(72),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem',
    path: ['confirmPassword'],
  });

export const CompleteSignupModal = ({
  open,
  onOpenChange,
  defaultName = '',
  defaultEmail = '',
  defaultWhatsapp = '',
  defaultBirthDate = '',
  companyId,
  onSuccess,
}: CompleteSignupModalProps) => {
  const [fullName, setFullName] = useState(defaultName);
  const [email, setEmail] = useState(defaultEmail);
  const [whatsapp, setWhatsapp] = useState(defaultWhatsapp);
  const [birthDate, setBirthDate] = useState(defaultBirthDate);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleWhatsappChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 11);
    let masked = digits;
    if (digits.length > 7) masked = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    else if (digits.length > 2) masked = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    setWhatsapp(masked);
  };

  const ensureClientRecord = async (formattedPhone: string) => {
    // SECURITY DEFINER RPC: links existing records, then creates if missing.
    const { data, error } = await supabase.rpc('complete_client_signup' as any, {
      p_company_id: companyId,
      p_name: fullName,
      p_whatsapp: formattedPhone || null,
      p_email: email,
      p_birth_date: birthDate || null,
    } as any);

    if (error) {
      console.error('[CompleteSignup] complete_client_signup RPC failed:', error);
      throw new Error('Não foi possível vincular sua conta. Tente novamente.');
    }
    return data as string;
  };

  const handleSubmit = async () => {
    const parsed = signupSchema.safeParse({
      fullName,
      email,
      whatsapp,
      birthDate,
      password,
      confirmPassword,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setLoading(true);
    try {
      const formattedPhone = formatWhatsApp(whatsapp);

      // Check if already authenticated
      const { data: { user: currentUser } } = await supabase.auth.getUser();

      let userId: string | null = currentUser?.id ?? null;

      if (!userId) {
        // Try sign in first (account may already exist)
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });

        if (!signInError) {
          const { data: { user } } = await supabase.auth.getUser();
          userId = user?.id ?? null;
        } else {
          const isInvalidCreds = /invalid login|invalid credentials/i.test(signInError.message);
          if (!isInvalidCreds) {
            toast.error(signInError.message);
            return;
          }

          // Sign up new account
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: parsed.data.email,
            password: parsed.data.password,
            options: {
              emailRedirectTo: `${window.location.origin}/`,
              data: {
                full_name: parsed.data.fullName,
                whatsapp: formattedPhone,
                role: 'client',
              },
            },
          });

          if (signUpError) {
            const { diagnoseAuthError } = await import('@/lib/auth-errors');
            toast.error(diagnoseAuthError(signUpError));
            return;
          }
          userId = signUpData.user?.id ?? null;
        }
      }

      if (!userId) {
        toast.error('Erro ao autenticar. Tente novamente.');
        return;
      }

      await ensureClientRecord(formattedPhone);

      toast.success('Cadastro concluído com sucesso 🎉');
      onOpenChange(false);

      if (onSuccess) {
        onSuccess();
      } else {
        // Default: redirect to portal
        window.location.href = '/minha-conta';
      }
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao finalizar cadastro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !loading && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Finalizar seu cadastro
          </DialogTitle>
          <DialogDescription>
            Crie sua senha para acessar seus agendamentos, cashback e pontos de fidelidade.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="cs-name" className="flex items-center gap-1 text-sm">
              <User className="h-3 w-3" /> Nome completo
            </Label>
            <Input
              id="cs-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Seu nome"
              autoComplete="name"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cs-whatsapp" className="flex items-center gap-1 text-sm">
              <Phone className="h-3 w-3" /> WhatsApp
            </Label>
            <Input
              id="cs-whatsapp"
              value={whatsapp}
              onChange={(e) => handleWhatsappChange(e.target.value)}
              placeholder="(11) 99999-9999"
              maxLength={15}
              autoComplete="tel"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cs-email" className="flex items-center gap-1 text-sm">
              <Mail className="h-3 w-3" /> Email
            </Label>
            <Input
              id="cs-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              autoComplete="email"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cs-birth" className="flex items-center gap-1 text-sm">
              <Cake className="h-3 w-3" /> Data de nascimento <span className="text-muted-foreground text-xs">(opcional)</span>
            </Label>
            <Input
              id="cs-birth"
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
            />
          </div>

          <PasswordInput
            id="cs-password"
            label="Senha"
            value={password}
            onChange={setPassword}
            placeholder="Mínimo 8 caracteres"
            autoComplete="new-password"
          />

          <div className="space-y-1.5">
            <Label htmlFor="cs-confirm" className="flex items-center gap-1 text-sm">
              <Lock className="h-3 w-3" /> Confirmar senha
            </Label>
            <Input
              id="cs-confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Repita a senha"
              autoComplete="new-password"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !loading) handleSubmit();
              }}
            />
          </div>
        </div>

        <Button onClick={handleSubmit} disabled={loading} className="w-full" size="lg">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Finalizando seu cadastro...
            </>
          ) : (
            'Concluir cadastro'
          )}
        </Button>
      </DialogContent>
    </Dialog>
  );
};
