import { useState, useRef, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import {
  Scissors, Sparkles, ChevronRight, ChevronLeft, Clock, Upload, Palette,
  CheckCircle2, Copy, Link2, Building2, Phone, ChevronsUpDown, Check, MapPin, X
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { formatWhatsApp, isValidWhatsApp } from '@/lib/whatsapp';
import { ThemeSelector } from './ThemeSelector';
import type { ThemeVariation } from '@/lib/theme-catalog';

interface CompanySetupProps {
  onComplete: () => void;
}

type OnboardingStep = 'company' | 'categories' | 'hours' | 'branding' | 'theme' | 'done';

const STEPS: OnboardingStep[] = ['company', 'categories', 'hours', 'branding', 'theme', 'done'];

const stepMeta: Record<OnboardingStep, { icon: any; title: string; desc: string }> = {
  company: { icon: Building2, title: 'Seu negócio', desc: 'Tipo, nome e localização do seu estabelecimento' },
  categories: { icon: Grid3X3, title: 'Segmento', desc: 'Escolha as categorias que melhor definem seu negócio' },
  hours: { icon: Clock, title: 'Horários', desc: 'Defina o funcionamento semanal' },
  branding: { icon: Palette, title: 'Identidade visual', desc: 'Logo do seu negócio (opcional)' },
  theme: { icon: Palette, title: 'Tema da sua marca', desc: 'Escolha um estilo visual personalizado' },
  done: { icon: CheckCircle2, title: 'Tudo pronto!', desc: 'Compartilhe seu link de agendamento' },
};

import { Grid3X3 } from 'lucide-react';

const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const CompanySetup = ({ onComplete }: CompanySetupProps) => {
  const { user } = useAuth();
  const [step, setStep] = useState<OnboardingStep>('company');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Step 1: Company
  const [businessType, setBusinessType] = useState<'barbershop' | 'esthetic'>('barbershop');
  const [companyName, setCompanyName] = useState('');
  const [companyWhatsApp, setCompanyWhatsApp] = useState('');
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [companySlug, setCompanySlug] = useState('');

  // Location
  const [brStates, setBrStates] = useState<{ id: number; name: string; uf: string }[]>([]);
  const [brCities, setBrCities] = useState<{ id: number; name: string }[]>([]);
  const [selectedState, setSelectedState] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [stateOpen, setStateOpen] = useState(false);
  const [cityOpen, setCityOpen] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [loadingCities, setLoadingCities] = useState(false);

  // Step 2: Categories
  const [categories, setCategories] = useState<any[]>([]);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedSubcategoryIds, setSelectedSubcategoryIds] = useState<string[]>([]);

  // Step 3: Hours
  const [hours, setHours] = useState(
    Array.from({ length: 7 }, (_, i) => ({
      day_of_week: i,
      open_time: '09:00',
      close_time: '18:00',
      lunch_start: '12:00',
      lunch_end: '13:00',
      is_closed: i === 0,
      break_enabled: i !== 0,
    }))
  );

  // Step 4: Branding
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Step 5: Theme
  const [themeOpen, setThemeOpen] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<ThemeVariation | null>(null);
  const [savingTheme, setSavingTheme] = useState(false);

  const currentStepIndex = STEPS.indexOf(step);

  // Load states
  useEffect(() => {
    supabase.from('brazilian_states' as any).select('id, name, uf').order('name').then(({ data }) => {
      if (data) setBrStates(data as any);
    });
  }, []);

  // Load cities when state changes
  useEffect(() => {
    if (!selectedState) { setBrCities([]); return; }
    const stateRecord = brStates.find(s => s.uf === selectedState);
    if (!stateRecord) { setBrCities([]); return; }
    setLoadingCities(true);
    supabase.from('brazilian_cities' as any).select('id, name').eq('state_id', stateRecord.id).order('name').then(({ data }) => {
      if (data) setBrCities(data as any);
      setLoadingCities(false);
    });
  }, [selectedState, brStates]);

  // Load categories
  useEffect(() => {
    supabase.from('categories').select('*').order('name').then(({ data }) => {
      if (data) setCategories(data);
    });
  }, []);

  // Load subcategories when category changes
  useEffect(() => {
    if (!selectedCategoryId) {
      setSubcategories([]);
      return;
    }
    supabase.from('subcategories').select('*').eq('category_id', selectedCategoryId).order('name').then(({ data }) => {
      if (data) setSubcategories(data);
    });
  }, [selectedCategoryId]);

  // Filter cities for search
  const filteredCities = useMemo(() => {
    const unique = brCities.filter(
      (city, index, self) => index === self.findIndex(c => c.name === city.name)
    );
    if (!citySearch) return unique.slice(0, 50);
    const search = citySearch.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return unique.filter(c =>
      c.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(search)
    ).slice(0, 50);
  }, [brCities, citySearch]);

  const companyNamePlaceholder = businessType === 'barbershop'
    ? 'Ex: Barbearia do João'
    : 'Ex: Salão da Jack';

  const isCompanyStepValid = companyName.trim() && companyWhatsApp.trim() && isValidWhatsApp(companyWhatsApp) && selectedState && selectedCity;

  const handleCreateCompany = async () => {
    if (!user || !companyName.trim()) return;
    if (!companyWhatsApp.trim() || !isValidWhatsApp(companyWhatsApp)) {
      toast.error('Informe um WhatsApp válido');
      return;
    }
    if (!selectedState || !selectedCity) {
      toast.error('Selecione o estado e a cidade');
      return;
    }
    setLoading(true);
    try {
      const slug = companyName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      const phone = formatWhatsApp(companyWhatsApp);

      const { data: company, error } = await supabase
        .from('companies')
        .insert({
          name: companyName.trim(),
          slug,
          owner_id: user.id,
          business_type: businessType,
          phone,
          timezone: 'America/Sao_Paulo',
          state: selectedState,
          city: selectedCity,
        } as any)
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

      // Welcome email — fire-and-forget, must not break the flow
      try {
        const { sendWelcomeCompanyEmail } = await import('@/lib/email');
        if (user.email) {
          void sendWelcomeCompanyEmail({
            email: user.email,
            name: (user.user_metadata as any)?.full_name || companyName.trim(),
            companyName: companyName.trim(),
          });
        }
      } catch (e) {
        console.warn('[email] welcome company failed', e);
      }

      setStep('categories');
    } catch (err: any) {
      toast.error('Erro ao criar empresa. Tente novamente.');
      console.error('Company creation error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCategories = async () => {
    if (!companyId || !selectedCategoryId || selectedSubcategoryIds.length === 0) {
      toast.error('Selecione uma categoria e pelo menos uma subcategoria');
      return;
    }
    setLoading(true);
    try {
      // 1. Save company categories
      const categoryRows = selectedSubcategoryIds.map(subId => ({
        company_id: companyId,
        category_id: selectedCategoryId,
        subcategory_id: subId,
      }));
      await supabase.from('company_categories').insert(categoryRows);

      // 2. Auto-create service categories and services
      const category = categories.find(c => c.id === selectedCategoryId);
      if (category) {
        if (category.name === 'Barbearia') {
          // Create Service Categories
          const { data: catCorte } = await supabase.from('service_categories').insert({ company_id: companyId, name: 'Corte' }).select().single();
          const { data: catBarba } = await supabase.from('service_categories').insert({ company_id: companyId, name: 'Barba' }).select().single();
          const { data: catCombo } = await supabase.from('service_categories').insert({ company_id: companyId, name: 'Combo' }).select().single();

          if (catCorte) {
            await supabase.from('services').insert([
              { company_id: companyId, category_id: catCorte.id, name: 'Corte Tradicional', duration_minutes: 30, price: 40, active: true },
              { company_id: companyId, category_id: catCorte.id, name: 'Corte Degradê', duration_minutes: 40, price: 50, active: true },
              { company_id: companyId, category_id: catCorte.id, name: 'Corte Social', duration_minutes: 30, price: 35, active: true },
            ]);
          }
          if (catBarba) {
            await supabase.from('services').insert([
              { company_id: companyId, category_id: catBarba.id, name: 'Barba Simples', duration_minutes: 20, price: 25, active: true },
              { company_id: companyId, category_id: catBarba.id, name: 'Barba Completa', duration_minutes: 30, price: 35, active: true },
            ]);
          }
          if (catCombo) {
            await supabase.from('services').insert([
              { company_id: companyId, category_id: catCombo.id, name: 'Corte + Barba', duration_minutes: 60, price: 75, active: true },
            ]);
          }
        } else if (category.name === 'Estética') {
          const { data: catCabelo } = await supabase.from('service_categories').insert({ company_id: companyId, name: 'Cabelo' }).select().single();
          const { data: catUnhas } = await supabase.from('service_categories').insert({ company_id: companyId, name: 'Unhas' }).select().single();
          const { data: catSobrancelha } = await supabase.from('service_categories').insert({ company_id: companyId, name: 'Sobrancelha' }).select().single();
          const { data: catPele } = await supabase.from('service_categories').insert({ company_id: companyId, name: 'Pele' }).select().single();

          if (catCabelo) {
            await supabase.from('services').insert([
              { company_id: companyId, category_id: catCabelo.id, name: 'Corte Feminino', duration_minutes: 60, price: 80, active: true },
              { company_id: companyId, category_id: catCabelo.id, name: 'Escova', duration_minutes: 45, price: 50, active: true },
            ]);
          }
          if (catUnhas) {
            await supabase.from('services').insert([
              { company_id: companyId, category_id: catUnhas.id, name: 'Manicure', duration_minutes: 30, price: 30, active: true },
              { company_id: companyId, category_id: catUnhas.id, name: 'Pedicure', duration_minutes: 40, price: 35, active: true },
            ]);
          }
          if (catSobrancelha) {
            await supabase.from('services').insert([
              { company_id: companyId, category_id: catSobrancelha.id, name: 'Design de Sobrancelha', duration_minutes: 30, price: 40, active: true },
            ]);
          }
          if (catPele) {
            await supabase.from('services').insert([
              { company_id: companyId, category_id: catPele.id, name: 'Limpeza de Pele', duration_minutes: 60, price: 120, active: true },
            ]);
          }
        }
      }

      toast.success('Categorias e serviços iniciais criados!');
      setStep('hours');
    } catch (err: any) {
      toast.error('Erro ao salvar categorias. Tente novamente.');
      console.error('Categories save error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveHours = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const rows = hours.map((h) => ({
        company_id: companyId,
        day_of_week: h.day_of_week,
        open_time: h.open_time,
        close_time: h.close_time,
        lunch_start: h.break_enabled ? h.lunch_start : null,
        lunch_end: h.break_enabled ? h.lunch_end : null,
        is_closed: h.is_closed,
      }));
      await supabase.from('business_hours').insert(rows);
      toast.success('Horários configurados!');
      setStep('branding');
    } catch (err: any) {
      toast.error('Erro ao salvar horários. Tente novamente.');
      console.error('Hours save error:', err);
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
      setStep('theme');
    } catch (err: any) {
      toast.error('Erro ao salvar branding. Tente novamente.');
      console.error('Branding save error:', err);
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
                <div className="space-y-2">
                  <Label>Nome do estabelecimento *</Label>
                  <Input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder={companyNamePlaceholder}
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Phone className="h-4 w-4" /> WhatsApp do estabelecimento *
                  </Label>
                  <Input
                    value={companyWhatsApp}
                    onChange={(e) => setCompanyWhatsApp(e.target.value)}
                    placeholder="(31) 99999-9999"
                    type="tel"
                  />
                  {companyWhatsApp.trim() && !isValidWhatsApp(companyWhatsApp) && (
                    <p className="text-xs text-destructive">Informe um WhatsApp válido</p>
                  )}
                </div>

                {/* State */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" /> Estado *
                  </Label>
                  <Popover open={stateOpen} onOpenChange={setStateOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                        {selectedState
                          ? brStates.find(s => s.uf === selectedState)?.name || selectedState
                          : 'Selecione o estado'}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Buscar estado..." />
                        <CommandList>
                          <CommandEmpty>Nenhum estado encontrado.</CommandEmpty>
                          <CommandGroup>
                            {brStates.map((s) => (
                              <CommandItem
                                key={s.id}
                                value={s.name}
                                onSelect={() => {
                                  setSelectedState(s.uf);
                                  setSelectedCity('');
                                  setCitySearch('');
                                  setStateOpen(false);
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", selectedState === s.uf ? "opacity-100" : "opacity-0")} />
                                {s.name} ({s.uf})
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* City */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" /> Cidade *
                  </Label>
                  <Popover open={cityOpen} onOpenChange={setCityOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        className="w-full justify-between font-normal"
                        disabled={!selectedState || loadingCities}
                      >
                        {loadingCities
                          ? 'Carregando cidades...'
                          : selectedCity || 'Digite para buscar a cidade'}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0" align="start">
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="Digite o nome da cidade..."
                          value={citySearch}
                          onValueChange={setCitySearch}
                        />
                        <CommandList>
                          <CommandEmpty>
                            {citySearch ? 'Nenhuma cidade encontrada.' : 'Digite para buscar...'}
                          </CommandEmpty>
                          <CommandGroup>
                            {filteredCities.map((c) => (
                              <CommandItem
                                key={c.id}
                                value={c.name}
                                onSelect={() => {
                                  setSelectedCity(c.name);
                                  setCityOpen(false);
                                }}
                              >
                                <Check className={cn("mr-2 h-4 w-4", selectedCity === c.name ? "opacity-100" : "opacity-0")} />
                                {c.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <Button className="w-full" disabled={loading || !isCompanyStepValid} onClick={handleCreateCompany}>
                  {loading ? 'Criando...' : 'Continuar'} <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </>
            )}

            {/* ───── Step 2: Categories ───── */}
            {step === 'categories' && (
              <>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Categoria Principal</Label>
                    <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tipo de negócio" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedCategoryId && (
                    <div className="space-y-3">
                      <Label>Subcategorias (Escolha uma ou mais)</Label>
                      <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-2">
                        {subcategories.map((sub) => (
                          <div
                            key={sub.id}
                            className={cn(
                              "flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors",
                              selectedSubcategoryIds.includes(sub.id)
                                ? "bg-primary/5 border-primary"
                                : "hover:bg-muted border-transparent"
                            )}
                            onClick={() => {
                              setSelectedSubcategoryIds(prev =>
                                prev.includes(sub.id)
                                  ? prev.filter(id => id !== sub.id)
                                  : [...prev, sub.id]
                              );
                            }}
                          >
                            <span className="text-sm">{sub.name}</span>
                            {selectedSubcategoryIds.includes(sub.id) && (
                              <Check className="h-4 w-4 text-primary" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedSubcategoryIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {selectedSubcategoryIds.map(id => {
                        const sub = subcategories.find(s => s.id === id);
                        return sub ? (
                          <Badge key={id} variant="secondary" className="gap-1 px-2 py-1">
                            {sub.name}
                            <X 
                              className="h-3 w-3 cursor-pointer hover:text-destructive" 
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedSubcategoryIds(prev => prev.filter(sid => sid !== id));
                              }}
                            />
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>

                <div className="flex gap-3 pt-4">
                  <Button variant="ghost" className="flex-1" onClick={() => setStep('company')}>
                    <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
                  </Button>
                  <Button 
                    className="flex-1" 
                    disabled={loading || !selectedCategoryId || selectedSubcategoryIds.length === 0} 
                    onClick={handleSaveCategories}
                  >
                    {loading ? 'Salvando...' : 'Continuar'} <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </>
            )}

            {/* ───── Step 3: Hours ───── */}
            {step === 'hours' && (
              <>
                <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                  {hours.map((h) => (
                    <div key={h.day_of_week} className="p-2.5 rounded-lg bg-muted/50 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="w-20 text-sm font-medium">{dayNames[h.day_of_week]}</span>
                        <Switch
                          checked={!h.is_closed}
                          onCheckedChange={(v) => updateHour(h.day_of_week, 'is_closed', !v)}
                        />
                        {!h.is_closed && (
                          <div className="flex items-center gap-1 flex-1">
                            <Input type="time" value={h.open_time} onChange={(e) => updateHour(h.day_of_week, 'open_time', e.target.value)} className="w-24 h-8 text-xs" />
                            <span className="text-xs text-muted-foreground">às</span>
                            <Input type="time" value={h.close_time} onChange={(e) => updateHour(h.day_of_week, 'close_time', e.target.value)} className="w-24 h-8 text-xs" />
                          </div>
                        )}
                      </div>
                      {!h.is_closed && (
                        <div className="ml-20 pl-2 flex items-center gap-2">
                          <Checkbox
                            id={`break-${h.day_of_week}`}
                            checked={h.break_enabled}
                            onCheckedChange={(v) => updateHour(h.day_of_week, 'break_enabled', v === true)}
                          />
                          <label htmlFor={`break-${h.day_of_week}`} className="text-xs text-muted-foreground cursor-pointer">
                            Pausa / almoço
                          </label>
                          {h.break_enabled && (
                            <div className="flex items-center gap-1">
                              <Input type="time" value={h.lunch_start} onChange={(e) => updateHour(h.day_of_week, 'lunch_start', e.target.value)} className="w-24 h-7 text-xs" />
                              <span className="text-xs text-muted-foreground">-</span>
                              <Input type="time" value={h.lunch_end} onChange={(e) => updateHour(h.day_of_week, 'lunch_end', e.target.value)} className="w-24 h-7 text-xs" />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setStep('company')} className="flex-1">
                      <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
                    </Button>
                    <Button className="flex-1" disabled={loading} onClick={handleSaveHours}>
                      {loading ? 'Salvando...' : 'Continuar'} <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    className="text-muted-foreground text-sm"
                    onClick={async () => {
                      if (!companyId) return;
                      setLoading(true);
                      try {
                        const defaultRows = hours.map((h) => ({
                          company_id: companyId,
                          day_of_week: h.day_of_week,
                          open_time: h.open_time,
                          close_time: h.close_time,
                          lunch_start: h.break_enabled ? h.lunch_start : null,
                          lunch_end: h.break_enabled ? h.lunch_end : null,
                          is_closed: h.is_closed,
                        }));
                        await supabase.from('business_hours').insert(defaultRows);
                      } catch (err) {
                        console.warn('[Onboarding] Skip hours - default save failed:', err);
                      } finally {
                        setLoading(false);
                      }
                      setStep('branding');
                    }}
                    disabled={loading}
                  >
                    Pular etapa — configurar depois
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
                  <Button
                    variant="ghost"
                    onClick={() => setStep('theme')}
                    className="text-muted-foreground"
                  >
                    Pular
                  </Button>
                  <Button className="flex-1" disabled={loading} onClick={handleSaveBranding}>
                    {loading ? 'Salvando...' : 'Continuar'} <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </>
            )}

            {/* ───── Step 4: Theme ───── */}
            {step === 'theme' && (
              <>
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground text-center">
                    Escolha um tema visual personalizado para sua marca. Você poderá alterar a qualquer momento em <strong>Configurações &gt; Branding</strong>.
                  </p>

                  {selectedTheme ? (
                    <div
                      className="rounded-xl border-2 border-primary p-4 space-y-3"
                      style={{ background: selectedTheme.background_color }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold" style={{ color: selectedTheme.primary_color }}>
                          {selectedTheme.name}
                        </span>
                        <CheckCircle2 className="h-5 w-5" style={{ color: selectedTheme.primary_color }} />
                      </div>
                      <div className="flex gap-2">
                        <div className="px-3 py-2 rounded-lg text-xs font-semibold text-white flex-1 text-center" style={{ background: selectedTheme.primary_color }}>
                          Botão primário
                        </div>
                        <div className="px-3 py-2 rounded-lg text-xs font-semibold text-white flex-1 text-center" style={{ background: selectedTheme.secondary_color }}>
                          Acento
                        </div>
                      </div>
                      <Button variant="outline" size="sm" className="w-full" onClick={() => setThemeOpen(true)}>
                        Alterar tema
                      </Button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setThemeOpen(true)}
                      className="w-full border-2 border-dashed rounded-xl p-6 text-center cursor-pointer hover:border-primary transition-colors space-y-2"
                    >
                      <Palette className="h-8 w-8 mx-auto text-muted-foreground" />
                      <p className="text-sm font-medium">Escolher tema visual</p>
                      <p className="text-xs text-muted-foreground">Selecione um estilo e veja variações prontas</p>
                    </button>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setStep('branding')} className="flex-1">
                    <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setStep('done')}
                    className="text-muted-foreground"
                    disabled={savingTheme}
                  >
                    Pular
                  </Button>
                  <Button
                    className="flex-1"
                    disabled={savingTheme}
                    onClick={() => setStep('done')}
                  >
                    Continuar <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>

                <ThemeSelector
                  open={themeOpen}
                  onOpenChange={setThemeOpen}
                  initialVariationId={selectedTheme?.id}
                  onSelect={async (variation) => {
                    if (!companyId) return;
                    setSavingTheme(true);
                    try {
                      const { data: existing } = await supabase
                        .from('company_settings')
                        .select('id')
                        .eq('company_id', companyId)
                        .maybeSingle();

                      const payload = {
                        primary_color: variation.primary_color,
                        secondary_color: variation.secondary_color,
                        background_color: variation.background_color,
                        theme_style: variation.id,
                      } as any;

                      if (existing) {
                        await supabase.from('company_settings').update(payload).eq('company_id', companyId);
                      } else {
                        await supabase.from('company_settings').insert({ company_id: companyId, ...payload });
                      }
                      setSelectedTheme(variation);
                      toast.success('Tema aplicado!');
                    } catch (err) {
                      console.error('Theme save error:', err);
                      toast.error('Erro ao aplicar tema.');
                    } finally {
                      setSavingTheme(false);
                    }
                  }}
                />
              </>
            )}

            {/* ───── Step 4: Done ───── */}
            {step === 'done' && (
              <>
                <div className="text-center space-y-4">
                  <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                    <CheckCircle2 className="h-8 w-8 text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Seu estabelecimento está configurado! Agora adicione profissionais e serviços no painel.
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
