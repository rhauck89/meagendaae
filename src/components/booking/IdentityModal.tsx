
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LogIn, MessageCircle, Mail, RotateCcw, X, AlertTriangle, KeyRound, ArrowRight, ShieldCheck, UserX, CheckCircle2, UserPlus, User, Calendar } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { OTPInput } from '../auth/OTPInput';
import { normalizePhone } from '@/lib/whatsapp';

interface IdentityModalProps {
  isOpen: boolean;
  onClose: () => void;
  companyId: string;
  onLoginSuccess: (clientData?: any) => void;
  supabaseClient?: any;
}

export function IdentityModal({ 
  isOpen, 
  onClose, 
  companyId,
  onLoginSuccess,
  supabaseClient: propSupabase
}: IdentityModalProps) {
  const supabaseToUse = propSupabase || supabase;
  
  // Views: 
  // identify -> Enter WhatsApp
  // options -> WhatsApp found, choose OTP or Password
  // otp -> Verify WhatsApp code
  // password -> Enter password
  // register -> Create new account
  const [view, setView] = useState<'choice' | 'identify' | 'options' | 'otp' | 'password' | 'register' | 'forgot' | 'not_found' | 'account_found'>('choice');
  
  const [whatsapp, setWhatsapp] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [timer, setTimer] = useState(0);
  const [isNewUser, setIsNewUser] = useState(false);

  // Clear state when opening fresh
  useEffect(() => {
    if (isOpen) {
      setView('choice');
      setWhatsapp('');
      setEmail('');
      setFullName('');
      setBirthDate('');
      setPassword('');
      setOtpCode('');
      setSuccess(false);
      setLoading(false);
    }
  }, [isOpen]);

  // Timer for OTP resend
  useEffect(() => {
    let interval: any;
    if (timer > 0) {
      interval = setInterval(() => setTimer(prev => prev - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  const formatPhone = (val: string) => {
    const digits = val.replace(/\D/g, '').slice(0, 11);
    let masked = digits;
    if (digits.length > 7) masked = `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
    else if (digits.length > 2) masked = `(${digits.slice(0,2)}) ${digits.slice(2)}`;
    return masked;
  };

  const cleanPhone = (val: string) => {
    let cleaned = val.replace(/\D/g, '');
    if (cleaned && !cleaned.startsWith('55')) {
      cleaned = '55' + cleaned;
    }
    return cleaned;
  };

  const handleIdentify = async () => {
    const phone = cleanPhone(whatsapp);
    if (phone.length < 10) {
      toast.error('Informe um WhatsApp válido');
      return;
    }

    setLoading(true);
    try {
      console.log(`[IDENTITY_MODAL] Identifying: ${phone} in company ${companyId}`);
      
      // NEW GLOBAL FLOW: Search globally and get both IDs
      const { data: client, error } = await supabaseToUse.rpc('lookup_client_globally', {
        p_company_id: companyId,
        p_whatsapp: phone
      });

      if (error) throw error;

      if (client && client.client_global_id) {
        console.log('[IDENTITY_MODAL] Client found globally:', client);
        
        // Store both IDs for consistent session handling
        const clientData = Array.isArray(client) ? client[0] : client;
        setEmail(clientData.email || '');
        setFullName(clientData.name || '');
        setIsNewUser(false);
        setView('options');
        
        // Premium logging of session IDs
        console.log(`[SESSION] Global ID: ${clientData.client_global_id}, Legacy ID: ${clientData.client_legacy_id}`);
      } else {
        console.log('[IDENTITY_MODAL] Client not found globally');
        setView('not_found');
      }
    } catch (err: any) {
      console.error('[IDENTITY_MODAL] Identification error:', err);
      toast.error('Erro ao buscar cadastro. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabaseToUse.functions.invoke('whatsapp-integration', {
        body: {
          action: 'send-otp',
          companyId,
          phone: cleanPhone(whatsapp),
          email: email || null
        }
      });

      if (error || (data && data.error)) {
        throw new Error(data?.error || 'Erro ao enviar código via WhatsApp');
      }

      toast.success('Código enviado!');
      setView('otp');
      setTimer(60);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar código');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async (codeValue?: string) => {
    const codeToVerify = codeValue || otpCode;
    if (codeToVerify.length !== 6) return;
    
    setLoading(true);
    try {
      console.log(`[IDENTITY_MODAL] Verifying OTP: ${codeToVerify}`);
      const { data, error } = await supabaseToUse.functions.invoke('whatsapp-integration', {
        body: {
          action: 'verify-otp',
          phone: cleanPhone(whatsapp),
          email: email || null,
          code: codeToVerify,
          companyId,
          redirectTo: window.location.href
        }
      });

      if (error || (data && data.error)) {
        throw new Error(data?.error || 'Código inválido ou expirado.');
      }

      handleSuccess(data.session);
    } catch (err: any) {
      toast.error(err.message || 'Código inválido');
      setOtpCode('');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async () => {
    if (!email || !password) {
      toast.error('E-mail e senha são obrigatórios');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabaseToUse.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) throw error;
      handleSuccess(data.session);
    } catch (err: any) {
      toast.error('E-mail ou senha incorretos');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async () => {
    if (!fullName || !whatsapp || !email || !password) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);
    try {
      const formattedPhone = cleanPhone(whatsapp);
      const normalizedEmail = email.trim().toLowerCase();

      // INTELLIGENT VALIDATION: Check if user exists before trying to signUp
      console.log(`[IDENTITY_MODAL] Checking existence for: ${formattedPhone} / ${normalizedEmail}`);
      const { data: existence, error: existenceError } = await supabaseToUse.rpc('check_client_existence', {
        p_whatsapp: formattedPhone,
        p_email: normalizedEmail
      });

      if (existenceError) {
        console.error('[IDENTITY_MODAL] Existence check error:', existenceError);
      }

      const existResult = Array.isArray(existence) ? existence[0] : existence;

      if (existResult?.exists_globally) {
        console.log('[IDENTITY_MODAL] Account already exists globally, switching to login options');
        setEmail(existResult.client_email || email);
        setWhatsapp(formatPhone(existResult.client_whatsapp || formattedPhone));
        setFullName(existResult.client_name || fullName);
        setView('account_found');
        setLoading(false);
        return;
      }

      const { data, error } = await supabaseToUse.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            whatsapp: formattedPhone,
            role: 'client'
          }
        }
      });

      if (error) {
        // If still somehow get "User already registered", handle it gracefully
        if (error.message.includes('already registered') || error.status === 400) {
          console.log('[IDENTITY_MODAL] Auth signUp returned already registered');
          setView('account_found');
          return;
        }
        throw error;
      }

      if (data.user) {
        // Link client record globally
        await supabaseToUse.rpc('link_client_globally', {
          p_user_id: data.user.id,
          p_phone: formattedPhone,
          p_email: normalizedEmail,
          p_company_id: companyId,
          p_name: fullName.trim()
        });

        toast.success('Conta criada com sucesso!');
        handleSuccess(data.session);
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar conta');
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = async (session: any) => {
    setSuccess(true);
    console.log('[IDENTITY_MODAL] Success! Closing modal...');
    
    if (session) {
      await supabaseToUse.auth.setSession({
        access_token: session.access_token,
        refresh_token: session.refresh_token
      });
    }

    // UX PREMIUM: Wait 800ms before closing
    setTimeout(() => {
      onLoginSuccess();
      onClose();
    }, 800);
  };

  const getTitle = () => {
    if (success) return 'LOGIN OK';
    if (view === 'choice') return 'Como deseja acessar?';
    if (view === 'identify') return 'Já sou cliente';
    if (view === 'not_found') return 'Não encontramos seu cadastro 😕';
    if (view === 'account_found') return 'Conta encontrada 👋';
    if (view === 'register') return 'Criar Conta';
    if (view === 'otp') return 'Verificação';
    if (view === 'password') return 'Entrar com Senha';
    return 'Bem-vindo de volta! 👋';
  };

  const getDescription = () => {
    if (success) return 'Redirecionando...';
    if (view === 'choice') return 'Identifique-se para iniciar seu agendamento.';
    if (view === 'identify') return 'Informe seu WhatsApp para localizar seu cadastro.';
    if (view === 'not_found') return 'Parece que você ainda não tem uma conta com este número.';
    if (view === 'account_found') return 'Como deseja entrar?';
    if (view === 'register') return 'Preencha seus dados para seu primeiro agendamento.';
    if (view === 'otp') return `Digite o código enviado para ${whatsapp}`;
    if (view === 'password') return `Informe sua senha para o e-mail ${email}`;
    return 'Escolha como deseja acessar sua conta.';
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[420px] rounded-[2.5rem] bg-[#0B132B] border-white/10 text-white p-0 overflow-hidden border-2 shadow-2xl">
        {success ? (
          <div className="p-12 flex flex-col items-center justify-center space-y-6 animate-in fade-in zoom-in duration-500">
            <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.4)]">
              <ShieldCheck className="w-12 h-12 text-zinc-950" />
            </div>
            <h1 className="text-4xl font-black tracking-tighter text-center">LOGIN OK</h1>
            <p className="text-emerald-400 font-bold uppercase tracking-widest text-xs">REDIRECIONANDO...</p>
          </div>
        ) : (
          <div className="p-8">
            <DialogHeader className="mb-8 bg-transparent border-none p-0 flex flex-col items-center">
              <div className="w-20 h-20 bg-emerald-500/10 rounded-[2rem] flex items-center justify-center mb-6 border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.1)]">
                {view === 'register' ? (
                  <UserPlus className="w-10 h-10 text-emerald-500" />
                ) : view === 'otp' ? (
                  <ShieldCheck className="w-10 h-10 text-emerald-500" />
                ) : view === 'password' ? (
                  <KeyRound className="w-10 h-10 text-blue-500" />
                ) : (
                  <User className="w-10 h-10 text-amber-500" />
                )}
              </div>
              <DialogTitle className="text-3xl font-black tracking-tight text-center text-white">
                {getTitle()}
              </DialogTitle>
              <DialogDescription className="text-slate-400 text-center text-base font-medium mt-3 px-4 leading-relaxed">
                {getDescription()}
              </DialogDescription>
            </DialogHeader>

            {view === 'choice' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <Button 
                  onClick={() => setView('identify')}
                  className="w-full h-20 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold flex items-center justify-start gap-5 px-6 transition-all group"
                >
                  <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-base font-black">Já sou cliente</p>
                    <p className="text-[10px] opacity-40 uppercase tracking-widest font-black">Entrar com WhatsApp ou Senha</p>
                  </div>
                  <ArrowRight className="w-5 h-5 ml-auto opacity-20 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </Button>

                <Button 
                  onClick={() => setView('register')}
                  className="w-full h-20 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold flex items-center justify-start gap-5 px-6 transition-all group"
                >
                  <div className="w-12 h-12 bg-amber-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <UserPlus className="w-6 h-6 text-amber-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-base font-black">Sou novo por aqui</p>
                    <p className="text-[10px] opacity-40 uppercase tracking-widest font-black">Criar meu primeiro cadastro</p>
                  </div>
                  <ArrowRight className="w-5 h-5 ml-auto opacity-20 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </Button>
              </div>
            )}

            {view === 'identify' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 ml-4">Seu WhatsApp</Label>
                  <Input 
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(formatPhone(e.target.value))}
                    placeholder="(11) 99999-9999"
                    className="rounded-2xl h-16 bg-white/5 border-white/10 text-white font-bold text-lg px-6 focus:border-emerald-500/50"
                    autoFocus
                  />
                </div>
                <div className="flex gap-3">
                  <Button 
                    variant="ghost"
                    onClick={() => setView('choice')}
                    className="h-16 px-6 rounded-2xl border border-white/10 text-white font-bold"
                  >
                    Voltar
                  </Button>
                  <Button 
                    onClick={handleIdentify}
                    disabled={loading || whatsapp.length < 14}
                    className="flex-1 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-black text-lg transition-all shadow-lg shadow-emerald-500/20"
                  >
                    {loading ? "Buscando..." : "Continuar"}
                  </Button>
                </div>
              </div>
            )}

            {view === 'not_found' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300 text-center">
                <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto border border-amber-500/20">
                  <AlertTriangle className="w-10 h-10 text-amber-500" />
                </div>
                <div className="space-y-2">
                  <p className="text-white/60 text-sm">O número <span className="text-white font-bold">{whatsapp}</span> não possui um cadastro nesta empresa.</p>
                </div>
                <div className="space-y-3">
                  <Button 
                    onClick={() => setView('register')}
                    className="w-full h-16 rounded-full bg-amber-500 hover:bg-amber-600 text-zinc-950 font-black text-lg transition-all shadow-lg shadow-amber-500/20"
                  >
                    Criar cadastro
                  </Button>
                  <Button 
                    variant="ghost"
                    onClick={() => setView('identify')}
                    className="w-full h-12 text-[10px] uppercase tracking-widest font-black text-slate-400"
                  >
                    Tentar outro número
                  </Button>
                </div>
              </div>
            )}

            {view === 'account_found' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <Button 
                  onClick={handleSendOTP}
                  disabled={loading}
                  className="w-full h-20 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold flex items-center justify-start gap-5 px-6 transition-all group"
                >
                  <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <MessageCircle className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-base font-black">Entrar via WhatsApp</p>
                    <p className="text-[10px] opacity-40 uppercase tracking-widest font-black">Acesso rápido sem senha</p>
                  </div>
                  <ArrowRight className="w-5 h-5 ml-auto opacity-20 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </Button>

                <Button 
                  onClick={() => setView('password')}
                  className="w-full h-20 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold flex items-center justify-start gap-5 px-6 transition-all group"
                >
                  <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <LogIn className="w-6 h-6 text-blue-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-base font-black">Entrar com Senha</p>
                    <p className="text-[10px] opacity-40 uppercase tracking-widest font-black">Usar senha cadastrada</p>
                  </div>
                  <ArrowRight className="w-5 h-5 ml-auto opacity-20 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </Button>

                <Button 
                  variant="ghost" 
                  onClick={() => setView('register')}
                  className="w-full h-10 text-[10px] uppercase tracking-widest font-black text-slate-400"
                >
                  Voltar
                </Button>
              </div>
            )}

            {view === 'options' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <Button 
                  onClick={handleSendOTP}
                  disabled={loading}
                  className="w-full h-20 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold flex items-center justify-start gap-5 px-6 transition-all group"
                >
                  <div className="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <MessageCircle className="w-6 h-6 text-emerald-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-base font-black">Código via WhatsApp</p>
                    <p className="text-[10px] opacity-40 uppercase tracking-widest font-black">Acesso rápido sem senha</p>
                  </div>
                  <ArrowRight className="w-5 h-5 ml-auto opacity-20 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </Button>

                <Button 
                  onClick={() => setView('password')}
                  className="w-full h-20 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold flex items-center justify-start gap-5 px-6 transition-all group"
                >
                  <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                    <LogIn className="w-6 h-6 text-blue-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-base font-black">Entrar com Senha</p>
                    <p className="text-[10px] opacity-40 uppercase tracking-widest font-black">Usar senha cadastrada</p>
                  </div>
                  <ArrowRight className="w-5 h-5 ml-auto opacity-20 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                </Button>

                <Button 
                  variant="ghost" 
                  onClick={() => setView('choice')}
                  className="w-full h-12 text-[10px] uppercase tracking-widest font-black text-slate-400"
                >
                  Voltar
                </Button>
              </div>
            )}

            {view === 'register' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2">Nome Completo</Label>
                    <Input 
                      value={fullName} 
                      onChange={(e) => setFullName(e.target.value)} 
                      placeholder="Ex: Raphael Silva" 
                      className="rounded-2xl h-14 bg-white/5 border-white/10 text-white font-bold" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2">WhatsApp (Obrigatório)</Label>
                    <Input 
                      value={whatsapp} 
                      onChange={(e) => setWhatsapp(formatPhone(e.target.value))} 
                      placeholder="(11) 99999-9999" 
                      className="rounded-2xl h-14 bg-white/5 border-white/10 text-white font-bold" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2">E-mail</Label>
                    <Input 
                      type="email" 
                      value={email} 
                      onChange={(e) => setEmail(e.target.value)} 
                      placeholder="seu@email.com" 
                      className="rounded-2xl h-14 bg-white/5 border-white/10 text-white font-bold" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2">Data de Nascimento (Opcional)</Label>
                    <Input 
                      type="date" 
                      value={birthDate} 
                      onChange={(e) => setBirthDate(e.target.value)} 
                      className="rounded-2xl h-14 bg-white/5 border-white/10 text-white font-bold invert-calendar" 
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2">Crie uma Senha</Label>
                    <Input 
                      type="password" 
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)} 
                      placeholder="Mínimo 8 caracteres" 
                      className="rounded-2xl h-14 bg-white/5 border-white/10 text-white font-bold" 
                    />
                  </div>
                </div>

                <Button 
                  onClick={handleRegister}
                  disabled={loading || !fullName || cleanPhone(whatsapp).length < 10 || !email || password.length < 8}
                  className="w-full h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-black text-lg transition-all shadow-lg shadow-emerald-500/20"
                >
                  {loading ? "Criando..." : "Criar Conta e Continuar"}
                </Button>

                <Button 
                  variant="ghost" 
                  onClick={() => setView('choice')}
                  className="w-full h-10 text-[10px] uppercase tracking-widest font-black text-slate-400"
                >
                  Voltar
                </Button>
              </div>
            )}

            {view === 'otp' && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <OTPInput 
                  value={otpCode}
                  onChange={setOtpCode}
                  onComplete={(val) => handleVerifyOTP(val)}
                  disabled={loading || success}
                />

                <Button 
                  onClick={() => handleVerifyOTP()}
                  disabled={loading || success || otpCode.length !== 6}
                  className="w-full h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 text-zinc-950 font-black text-lg transition-all shadow-lg shadow-emerald-500/20"
                >
                  {loading ? "Verificando..." : "Verificar Código"}
                </Button>

                <div className="text-center">
                  {timer > 0 ? (
                    <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                      Reenviar em <span className="text-emerald-500">{timer}s</span>
                    </p>
                  ) : (
                    <button 
                      onClick={handleSendOTP}
                      className="text-xs font-black uppercase tracking-widest text-emerald-500 hover:text-emerald-400"
                    >
                      Reenviar código
                    </button>
                  )}
                </div>

                <Button 
                  variant="ghost" 
                  onClick={() => setView('options')}
                  className="w-full h-10 text-[10px] uppercase tracking-widest font-black text-slate-400"
                >
                  Usar outro método
                </Button>
              </div>
            )}

            {view === 'password' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2">E-mail</Label>
                    <Input 
                      value={email}
                      disabled
                      className="rounded-2xl h-14 bg-white/5 border-white/10 text-white font-bold opacity-50"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase tracking-widest opacity-40 ml-2">Sua Senha</Label>
                    <Input 
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Digite sua senha"
                      className="rounded-2xl h-14 bg-white/5 border-white/10 text-white font-bold"
                      autoFocus
                    />
                  </div>
                </div>

                <Button 
                  onClick={handlePasswordLogin}
                  disabled={loading || !password}
                  className="w-full h-16 rounded-full bg-blue-500 hover:bg-blue-600 text-white font-black text-lg transition-all shadow-lg shadow-blue-500/20"
                >
                  {loading ? "Entrando..." : "Entrar"}
                </Button>

                <div className="flex gap-2">
                  <Button 
                    variant="ghost" 
                    onClick={() => setView('options')}
                    className="flex-1 h-10 text-[10px] uppercase tracking-widest font-black text-slate-400"
                  >
                    Voltar
                  </Button>
                  <Button 
                    variant="ghost" 
                    onClick={() => setView('forgot')}
                    className="flex-1 h-10 text-[10px] uppercase tracking-widest font-black text-blue-400"
                  >
                    Esqueci minha senha
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
