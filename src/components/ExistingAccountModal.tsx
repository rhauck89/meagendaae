
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LogIn, MessageCircle, Mail, RotateCcw, X, AlertTriangle, KeyRound } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ExistingAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  email: string;
  whatsapp: string;
  companyId: string;
  onLoginSuccess: () => void;
  onUseDifferentEmail: () => void;
}

export function ExistingAccountModal({ 
  isOpen, 
  onClose, 
  email, 
  whatsapp,
  companyId,
  onLoginSuccess,
  onUseDifferentEmail 
}: ExistingAccountModalProps) {
  const [view, setView] = useState<'options' | 'password' | 'forgot' | 'whatsapp-sent'>('options');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        if (error.message.includes('Invalid login credentials')) {
          toast.error('Senha incorreta. Tente novamente ou recupere sua senha.');
        } else {
          toast.error(error.message);
        }
      } else {
        toast.success('Bem-vindo de volta!');
        onLoginSuccess();
        onClose();
      }
    } catch (err: any) {
      toast.error('Erro ao realizar login');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success('E-mail de recuperação enviado! Verifique sua caixa de entrada.');
      setView('options');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar e-mail de recuperação');
    } finally {
      setLoading(false);
    }
  };

  const handleWhatsAppCode = async () => {
    setLoading(true);
    try {
      // For now, we'll send a magic link to email and notify that they can check there
      // In a real production setup, we'd trigger a WhatsApp message with the magic link or OTP
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          emailRedirectTo: window.location.origin,
        }
      });
      
      if (error) throw error;
      
      // Attempt to send WhatsApp notification via Edge Function if possible
      try {
        await supabase.functions.invoke('whatsapp-integration', {
          body: {
            action: 'send-message',
            companyId,
            phone: whatsapp,
            message: `Olá! Notamos que você está tentando agendar. Para facilitar seu acesso, enviamos um link de login para seu e-mail ${email}. Basta clicar nele para continuar seu agendamento.`
          }
        });
      } catch (e) {
        console.warn('Failed to send WhatsApp notification:', e);
      }

      setView('whatsapp-sent');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao solicitar acesso rápido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[400px] rounded-[2.5rem] bg-[#0B132B] border-white/10 text-white p-0 overflow-hidden border-2 shadow-2xl">
        <div className="p-8">
          <DialogHeader className="mb-6">
            <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mb-4 mx-auto border border-amber-500/20">
              <KeyRound className="w-8 h-8 text-amber-500" />
            </div>
            <DialogTitle className="text-2xl font-black tracking-tight text-center">Já encontramos sua conta</DialogTitle>
            <DialogDescription className="text-slate-400 text-center text-sm font-medium mt-2">
              O e-mail <span className="text-white font-bold">{email}</span> já está cadastrado em nossa rede.
            </DialogDescription>
          </DialogHeader>

          {view === 'options' && (
            <div className="space-y-3">
              <Button 
                onClick={() => setView('password')}
                className="w-full h-14 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold flex items-center justify-start gap-4 px-6 transition-all"
              >
                <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center">
                  <LogIn className="w-5 h-5 text-blue-400" />
                </div>
                Entrar com senha
              </Button>

              <Button 
                onClick={handleWhatsAppCode}
                disabled={loading}
                className="w-full h-14 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold flex items-center justify-start gap-4 px-6 transition-all"
              >
                <div className="w-10 h-10 bg-green-500/20 rounded-xl flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-green-400" />
                </div>
                Acesso rápido via WhatsApp
              </Button>

              <div className="grid grid-cols-2 gap-3 mt-4">
                <Button 
                  variant="ghost" 
                  onClick={() => setView('forgot')}
                  className="text-[10px] uppercase tracking-widest font-black text-slate-400 hover:text-white hover:bg-transparent p-0 h-auto"
                >
                  Recuperar senha
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={onUseDifferentEmail}
                  className="text-[10px] uppercase tracking-widest font-black text-slate-400 hover:text-white hover:bg-transparent p-0 h-auto"
                >
                  Usar outro e-mail
                </Button>
              </div>
            </div>
          )}

          {view === 'password' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2">Sua Senha</Label>
                <Input 
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha"
                  className="rounded-2xl h-14 bg-white/5 border-white/10 text-white font-bold"
                  autoFocus
                  onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                />
              </div>
              <Button 
                onClick={handleLogin}
                disabled={loading || !password}
                className="w-full h-14 rounded-full bg-amber-500 hover:bg-amber-600 text-black font-black text-lg transition-all"
              >
                {loading ? "Entrando..." : "Confirmar e Entrar"}
              </Button>
              <button 
                onClick={() => setView('options')}
                className="w-full text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white py-2"
              >
                Voltar às opções
              </button>
            </div>
          )}

          {view === 'forgot' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300 text-center">
              <div className="w-12 h-12 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
                <RotateCcw className="w-6 h-6 text-purple-400" />
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                Enviaremos um link de redefinição para <span className="text-white font-bold">{email}</span>
              </p>
              <Button 
                onClick={handleForgotPassword}
                disabled={loading}
                className="w-full h-14 rounded-full bg-white text-black font-black text-lg transition-all"
              >
                {loading ? "Enviando..." : "Enviar E-mail"}
              </Button>
              <button 
                onClick={() => setView('options')}
                className="w-full text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white py-2"
              >
                Cancelar
              </button>
            </div>
          )}

          {view === 'whatsapp-sent' && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300 text-center">
              <div className="w-12 h-12 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-2">
                <MessageCircle className="w-6 h-6 text-green-400" />
              </div>
              <p className="text-sm text-slate-400 leading-relaxed">
                Enviamos instruções de acesso para seu <span className="text-white font-bold">WhatsApp</span> e <span className="text-white font-bold">E-mail</span>.
              </p>
              <p className="text-[10px] text-slate-500 italic">
                Verifique seu WhatsApp e sua caixa de entrada para continuar.
              </p>
              <Button 
                onClick={onClose}
                className="w-full h-14 rounded-full bg-green-500 hover:bg-green-600 text-black font-black text-lg transition-all"
              >
                Entendi
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
