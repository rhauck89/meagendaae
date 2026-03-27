import { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Scissors, Sparkles, ChevronRight, ChevronLeft, Clock, Upload, Palette,
  CheckCircle2, Copy, Link2, Building2, Image as ImageIcon, Briefcase, UserPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface CompanySetupProps {
  onComplete: () => void;
}

type OnboardingStep = 'company' | 'hours' | 'branding' | 'service' | 'professional' | 'done';

const STEPS: OnboardingStep[] = ['company', 'hours', 'branding', 'service', 'professional', 'done'];

const stepMeta: Record<OnboardingStep, { icon: any; title: string; desc: string }> = {
  company: { icon: Building2, title: 'Seu negócio', desc: 'Nome e tipo do seu estabelecimento' },
  hours: { icon: Clock, title: 'Horários', desc: 'Defina o funcionamento semanal' },
  branding: { icon: Palette, title: 'Identidade visual', desc: 'Logo e cores do seu negócio' },
  service: { icon: Briefcase, title: 'Primeiro serviço', desc: 'Cadastre seu primeiro serviço' },
  professional: { icon: UserPlus, title: 'Primeiro profissional', desc: 'Adicione um profissional' },
  done: { icon: CheckCircle2, title: 'Tudo pronto!', desc: 'Compartilhe seu link de agendamento' },
};

const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const CompanySetup = ({ onComplete }: CompanySetupProps) => {
  const { user } = useAuth();
  const [step, setStep] = useState<OnboardingStep>('company');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 1: Company
  const [companyName, setCompanyName] = useState('');
  const [businessType, setBusinessType] = useState<'barbershop' | 'esthetic'>('barbershop');
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companySlug, setCompanySlug] = useState('');

  // Step 2: Hours
  const [hours, setHours] = useState(
    Array.from({ length: 7 }, (_, i) => ({
      day_of_week: i,
      open_time: '09:00',
      close_time: '18:00',
      lunch_start: '12:00',
      lunch_end: '13:00',
      is_closed: i === 0,
    }))
  );

  // Step 3: Branding
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Step 4: Service
  const [serviceName, setServiceName] = useState('');
  const [serviceDuration, setServiceDuration] = useState(30);
  const [servicePrice, setServicePrice] = useState(50);

  // Step 5: Professional
  const [profName, setProfName] = useState('');
  const [profEmail, setProfEmail] = useState('');

  const currentStepIndex = STEPS.indexOf(step);

  const handleCreateCompany = async () => {
    if (!user || !companyName.trim()) return;
    setLoading(true);
    try {
      const slug = companyName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      const { data: company, error } = await supabase
        .from('companies')
        .insert({
          name: companyName.trim(),
          slug,
          owner_id: user.id,
          business_type: businessType,
        })
        .select()
        .single();

      if (error) throw error;

      await supabase.from('profiles').update({ company_id: company.id }).eq('user_id', user.id);

      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', user.id)
        .eq('role', 'professional')
        .maybeSingle();

      if (!existingRole) {
        await supabase.from('user_roles').insert({
          user_id: user.id,
          company_id: company.id,
          role: 'professional' as const,
        });
      }

      setCompanyId(company.id);
      setCompanySlug(slug);
      toast.success('Empresa criada!');
      setStep('hours');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar empresa');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveHours = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const rows = hours.map((h) => ({ ...h, company_id: companyId }));
      await supabase.from('business_hours').insert(rows);
      toast.success('Horários configurados!');
      setStep('branding');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar horários');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Imagem deve ter no máximo 2MB');
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const handleSaveBranding = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      let logoUrl: string | null = null;

      if (logoFile) {
        const ext = logoFile.name.split('.').pop();
        const filePath = `${companyId}/logo.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('logos')
          .upload(filePath, logoFile, { upsert: true });

        if (uploadError) throw uploadError;

        const { data: publicUrl } = supabase.storage.from('logos').getPublicUrl(filePath);
        logoUrl = publicUrl.publicUrl;
      }

      if (logoUrl) {
        await supabase.from('companies').update({ logo_url: logoUrl } as any).eq('id', companyId);
      }

      toast.success('Identidade visual salva!');
      setStep('service');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar branding');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateService = async () => {
    if (!companyId || !serviceName.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('services').insert({
        company_id: companyId,
        name: serviceName.trim(),
        duration_minutes: serviceDuration,
        price: servicePrice,
      });
      if (error) throw error;
      toast.success('Serviço criado!');
      setStep('professional');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar serviço');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProfessional = async () => {
    if (!companyId || !profName.trim() || !profEmail.trim()) return;
    setLoading(true);
    try {
      const response = await supabase.functions.invoke('create-collaborator', {
        body: {
          name: profName.trim(),
          email: profEmail.trim(),
          company_id: companyId,
          collaborator_type: 'commissioned',
          payment_type: 'none',
          commission_value: 0,
          role: 'collaborator',
        },
      });

      if (response.error) throw new Error(response.error.message);
      if (!response.data?.success) throw new Error(response.data?.error || 'Erro');

      toast.success('Profissional adicionado!');
      setStep('done');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar profissional');
    } finally {
      setLoading(false);
    }
  };

  const prefix = businessType === 'esthetic' ? 'estetica' : 'barbearia';
  const bookingUrl = companySlug ? `${window.location.origin}/${prefix}/${companySlug}` : '';

  const updateHour = (dayIndex: number, field: string, value: any) => {
    setHours((prev) =>
      prev.map((h) => (h.day_of_week === dayIndex ? { ...h, [field]: value } : h))
    );
  };

  const StepIcon = stepMeta[step].icon;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex gap-1 mb-6">
          {STEPS.map((s, i) => (
            <div
              key={s}
              className={cn(
                'h-1.5 flex-1 rounded-full transition-colors',
                i <= currentStepIndex ? 'bg-primary' : 'bg-muted'
              )}
            />
          ))}
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader className="text-center space-y-3">
            <div className="mx-auto w-14 h-14 bg-primary rounded-2xl flex items-center justify-center">
              <StepIcon className="h-7 w-7 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-2xl font-display">{stepMeta[step].title}</CardTitle>
              <CardDescription>{stepMeta[step].desc}</CardDescription>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* ───── Step 1: Company ───── */}
            {step === 'company' && (
              <>
                <div className="space-y-2">
                  <Label>Nome do estabelecimento</Label>
                  <Input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Ex: Barbearia do João"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de negócio</Label>
                  <Select value={businessType} onValueChange={(v) => setBusinessType(v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="barbershop">
                        <span className="flex items-center gap-2"><Scissors className="h-4 w-4" /> Barbearia</span>
                      </SelectItem>
                      <SelectItem value="esthetic">
                        <span className="flex items-center gap-2"><Sparkles className="h-4 w-4" /> Estética</span>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" disabled={loading || !companyName.trim()} onClick={handleCreateCompany}>
                  {loading ? 'Criando...' : 'Continuar'} <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </>
            )}

            {/* ───── Step 2: Hours ───── */}
            {step === 'hours' && (
              <>
                <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                  {hours.map((h) => (
                    <div key={h.day_of_week} className="flex flex-wrap items-center gap-2 p-2.5 rounded-lg bg-muted/50">
                      <span className="w-20 text-sm font-medium">{dayNames[h.day_of_week]}</span>
                      <Switch
                        checked={!h.is_closed}
                        onCheckedChange={(v) => updateHour(h.day_of_week, 'is_closed', !v)}
                      />
                      {!h.is_closed && (
                        <>
                          <Input type="time" value={h.open_time} onChange={(e) => updateHour(h.day_of_week, 'open_time', e.target.value)} className="w-24 h-8 text-xs" />
                          <span className="text-xs text-muted-foreground">almoço</span>
                          <Input type="time" value={h.lunch_start} onChange={(e) => updateHour(h.day_of_week, 'lunch_start', e.target.value)} className="w-24 h-8 text-xs" />
                          <span className="text-xs">-</span>
                          <Input type="time" value={h.lunch_end} onChange={(e) => updateHour(h.day_of_week, 'lunch_end', e.target.value)} className="w-24 h-8 text-xs" />
                          <Input type="time" value={h.close_time} onChange={(e) => updateHour(h.day_of_week, 'close_time', e.target.value)} className="w-24 h-8 text-xs" />
                        </>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep('company')} className="flex-1">
                    <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
                  </Button>
                  <Button className="flex-1" disabled={loading} onClick={handleSaveHours}>
                    {loading ? 'Salvando...' : 'Continuar'} <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </>
            )}

            {/* ───── Step 3: Branding ───── */}
            {step === 'branding' && (
              <>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Logo do estabelecimento</Label>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-primary transition-colors"
                    >
                      {logoPreview ? (
                        <img src={logoPreview} alt="Logo" className="w-20 h-20 mx-auto rounded-xl object-cover" />
                      ) : (
                        <div className="space-y-2">
                          <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">Clique para enviar sua logo</p>
                          <p className="text-xs text-muted-foreground">PNG, JPG até 2MB</p>
                        </div>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={handleLogoSelect}
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep('hours')} className="flex-1">
                    <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
                  </Button>
                  <Button className="flex-1" disabled={loading} onClick={handleSaveBranding}>
                    {loading ? 'Salvando...' : 'Continuar'} <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </>
            )}

            {/* ───── Step 4: First Service ───── */}
            {step === 'service' && (
              <>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Nome do serviço</Label>
                    <Input
                      value={serviceName}
                      onChange={(e) => setServiceName(e.target.value)}
                      placeholder="Ex: Corte masculino"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Duração (min)</Label>
                      <Input
                        type="number"
                        value={serviceDuration}
                        onChange={(e) => setServiceDuration(parseInt(e.target.value, 10) || 0)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Preço (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={servicePrice}
                        onChange={(e) => setServicePrice(parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep('branding')} className="flex-1">
                    <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
                  </Button>
                  <Button className="flex-1" disabled={loading || !serviceName.trim()} onClick={handleCreateService}>
                    {loading ? 'Criando...' : 'Continuar'} <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </>
            )}

            {/* ───── Step 5: First Professional ───── */}
            {step === 'professional' && (
              <>
                <p className="text-sm text-muted-foreground">
                  Adicione um profissional que atenderá seus clientes. Você pode pular e fazer isso depois.
                </p>
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input value={profName} onChange={(e) => setProfName(e.target.value)} placeholder="Nome completo" />
                  </div>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input type="email" value={profEmail} onChange={(e) => setProfEmail(e.target.value)} placeholder="email@exemplo.com" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep('service')} className="flex-1">
                    <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setStep('done')}
                    className="text-muted-foreground"
                  >
                    Pular
                  </Button>
                  <Button className="flex-1" disabled={loading || !profName.trim() || !profEmail.trim()} onClick={handleCreateProfessional}>
                    {loading ? 'Criando...' : 'Continuar'} <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </>
            )}

            {/* ───── Step 6: Done ───── */}
            {step === 'done' && (
              <>
                <div className="text-center space-y-4">
                  <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="h-8 w-8 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Seu estabelecimento está configurado! Compartilhe o link abaixo para seus clientes agendarem online.
                  </p>
                </div>
                {bookingUrl && (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1">
                      <Link2 className="h-4 w-4" /> Link de agendamento
                    </Label>
                    <div className="flex items-center gap-2">
                      <Input value={bookingUrl} readOnly className="bg-muted text-sm" />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => {
                          navigator.clipboard.writeText(bookingUrl);
                          toast.success('Link copiado!');
                        }}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
                <Button className="w-full" onClick={onComplete}>
                  Ir para o Dashboard <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CompanySetup;
