import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Clock, Calendar as CalendarIcon, Plus, Trash2, Bell, Cake, Link2, Copy, Timer, Building2, Camera, Phone, MapPin, Globe, Instagram, Facebook, Palette, RotateCcw } from 'lucide-react';
import DomainSettings from '@/components/DomainSettings';

const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const SettingsPage = () => {
  const { companyId } = useAuth();
  const [hours, setHours] = useState<any[]>([]);
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [newException, setNewException] = useState({ date: '', reason: '', is_closed: true });
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [birthdayEnabled, setBirthdayEnabled] = useState(true);
  const [birthdayDiscountType, setBirthdayDiscountType] = useState('none');
  const [birthdayDiscountValue, setBirthdayDiscountValue] = useState(0);
  const [companySlug, setCompanySlug] = useState('');
  const [companyBusinessType, setCompanyBusinessType] = useState<string>('barbershop');
  const [bufferMinutes, setBufferMinutes] = useState(0);
  const [companyName, setCompanyName] = useState('');
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyWhatsapp, setCompanyWhatsapp] = useState('');
  const [companyDescription, setCompanyDescription] = useState('');
  const [companyLogoUrl, setCompanyLogoUrl] = useState('');
  const [companyCoverUrl, setCompanyCoverUrl] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);

  // Address fields
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyAddressNumber, setCompanyAddressNumber] = useState('');
  const [companyDistrict, setCompanyDistrict] = useState('');
  const [companyCity, setCompanyCity] = useState('');
  const [companyState, setCompanyState] = useState('');
  const [brStates, setBrStates] = useState<{ id: number; name: string; uf: string }[]>([]);
  const [brCities, setBrCities] = useState<{ id: number; name: string }[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [companyPostalCode, setCompanyPostalCode] = useState('');
  const [companyGoogleMapsUrl, setCompanyGoogleMapsUrl] = useState('');

  // Social
  const [companyInstagram, setCompanyInstagram] = useState('');
  const [companyFacebook, setCompanyFacebook] = useState('');
  
  // Branding colors
  const [brandPrimaryColor, setBrandPrimaryColor] = useState('#6D28D9');
  const [brandSecondaryColor, setBrandSecondaryColor] = useState('#F59E0B');
  const [brandBackgroundColor, setBrandBackgroundColor] = useState('#0B132B');
  const [companyWebsite, setCompanyWebsite] = useState('');

  useEffect(() => {
    if (companyId) {
      fetchHours();
      fetchExceptions();
      fetchCompanySettings();
    }
  }, [companyId]);

  const fetchHours = async () => {
    const { data } = await supabase
      .from('business_hours')
      .select('*')
      .eq('company_id', companyId!)
      .order('day_of_week');

    if (data && data.length > 0) {
      setHours(data);
    } else {
      const defaults = Array.from({ length: 7 }, (_, i) => ({
        company_id: companyId!,
        day_of_week: i,
        open_time: '09:00',
        close_time: '18:00',
        lunch_start: '12:00',
        lunch_end: '13:00',
        is_closed: i === 0,
      }));
      await supabase.from('business_hours').insert(defaults);
      const { data: newData } = await supabase
        .from('business_hours')
        .select('*')
        .eq('company_id', companyId!)
        .order('day_of_week');
      if (newData) setHours(newData);
    }
  };

  const fetchExceptions = async () => {
    const { data } = await supabase
      .from('business_exceptions')
      .select('*')
      .eq('company_id', companyId!)
      .order('exception_date');
    if (data) setExceptions(data);
  };

  const fetchCompanySettings = async () => {
    const [companyRes, settingsRes] = await Promise.all([
      supabase.from('companies').select('*').eq('id', companyId!).single(),
      supabase.from('company_settings').select('primary_color, secondary_color, background_color').eq('company_id', companyId!).single(),
    ]);
    const data = companyRes.data;
    if (data) {
      setRemindersEnabled(data.reminders_enabled ?? true);
      setBirthdayEnabled((data as any).birthday_enabled ?? true);
      setBirthdayDiscountType((data as any).birthday_discount_type ?? 'none');
      setBirthdayDiscountValue((data as any).birthday_discount_value ?? 0);
      setCompanySlug((data as any).slug ?? '');
      setCompanyBusinessType((data as any).business_type ?? 'barbershop');
      setBufferMinutes((data as any).buffer_minutes ?? 0);
      setCompanyName(data.name ?? '');
      setCompanyPhone((data as any).phone ?? '');
      setCompanyWhatsapp((data as any).whatsapp ?? '');
      setCompanyDescription((data as any).description ?? '');
      setCompanyLogoUrl((data as any).logo_url ?? '');
      setCompanyCoverUrl((data as any).cover_url ?? '');
      setCompanyAddress((data as any).address ?? '');
      setCompanyAddressNumber((data as any).address_number ?? '');
      setCompanyDistrict((data as any).district ?? '');
      setCompanyCity((data as any).city ?? '');
      setCompanyState((data as any).state ?? '');
      setCompanyPostalCode((data as any).postal_code ?? '');
      setCompanyGoogleMapsUrl((data as any).google_maps_url ?? '');
      setCompanyInstagram((data as any).instagram ?? '');
      setCompanyFacebook((data as any).facebook ?? '');
      setCompanyWebsite((data as any).website ?? '');
    }
    if (settingsRes.data) {
      setBrandPrimaryColor((settingsRes.data as any).primary_color || '#6D28D9');
      setBrandSecondaryColor((settingsRes.data as any).secondary_color || '#F59E0B');
      setBrandBackgroundColor((settingsRes.data as any).background_color || '#0B132B');
    }
  };

  // Fetch Brazilian states on mount
  useEffect(() => {
    supabase.from('brazilian_states' as any).select('id, name, uf').order('name').then(({ data }) => {
      if (data) setBrStates(data as any);
    });
  }, []);

  // Fetch cities when state changes
  useEffect(() => {
    if (!companyState) { setBrCities([]); return; }
    const stateRecord = brStates.find(s => s.uf === companyState);
    if (!stateRecord) { setBrCities([]); return; }
    setLoadingCities(true);
    supabase.from('brazilian_cities' as any).select('id, name').eq('state_id', stateRecord.id).order('name').then(({ data }) => {
      if (data) setBrCities(data as any);
      setLoadingCities(false);
    });
  }, [companyState, brStates]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !companyId) return;
    setLogoUploading(true);
    const ext = file.name.split('.').pop();
    const filePath = `${companyId}/logo.${ext}`;
    const { error: uploadError } = await supabase.storage.from('logos').upload(filePath, file, { upsert: true });
    if (uploadError) {
      toast.error('Erro ao enviar logo');
      setLogoUploading(false);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(filePath);
    const logoUrl = `${publicUrl}?t=${Date.now()}`;
    await supabase.from('companies').update({ logo_url: logoUrl } as any).eq('id', companyId);
    setCompanyLogoUrl(logoUrl);
    setLogoUploading(false);
    toast.success('Logo atualizado!');
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !companyId) return;
    setCoverUploading(true);
    const ext = file.name.split('.').pop();
    const filePath = `${companyId}/cover.${ext}`;
    const { error: uploadError } = await supabase.storage.from('logos').upload(filePath, file, { upsert: true });
    if (uploadError) {
      toast.error('Erro ao enviar capa');
      setCoverUploading(false);
      return;
    }
    const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(filePath);
    const coverUrl = `${publicUrl}?t=${Date.now()}`;
    await supabase.from('companies').update({ cover_url: coverUrl } as any).eq('id', companyId);
    setCompanyCoverUrl(coverUrl);
    setCoverUploading(false);
    toast.success('Capa atualizada!');
  };

  const saveCompanyProfile = async () => {
    const updateData: any = {
      name: companyName,
      phone: companyPhone,
      whatsapp: companyWhatsapp,
      description: companyDescription,
      address: companyAddress,
      address_number: companyAddressNumber,
      district: companyDistrict,
      city: companyCity,
      state: companyState,
      postal_code: companyPostalCode,
      google_maps_url: companyGoogleMapsUrl,
      instagram: companyInstagram,
      facebook: companyFacebook,
      website: companyWebsite,
    };
    await supabase.from('companies').update(updateData).eq('id', companyId!);
    toast.success('Dados da empresa salvos');
  };

  const saveBranding = async () => {
    await supabase.from('company_settings').update({
      primary_color: brandPrimaryColor,
      secondary_color: brandSecondaryColor,
      background_color: brandBackgroundColor,
    } as any).eq('company_id', companyId!);
    toast.success('Cores da marca salvas!');
  };

  const toggleReminders = async (enabled: boolean) => {
    setRemindersEnabled(enabled);
    await supabase.from('companies').update({ reminders_enabled: enabled } as any).eq('id', companyId!);
    toast.success(enabled ? 'Lembretes ativados' : 'Lembretes desativados');
  };

  const toggleBirthday = async (enabled: boolean) => {
    setBirthdayEnabled(enabled);
    await supabase.from('companies').update({ birthday_enabled: enabled } as any).eq('id', companyId!);
    toast.success(enabled ? 'Aniversários ativados' : 'Aniversários desativados');
  };

  const saveBirthdayDiscount = async () => {
    await supabase.from('companies').update({
      birthday_discount_type: birthdayDiscountType,
      birthday_discount_value: birthdayDiscountValue,
    } as any).eq('id', companyId!);
    toast.success('Desconto de aniversário salvo');
  };

  const saveBuffer = async () => {
    await supabase.from('companies').update({ buffer_minutes: bufferMinutes } as any).eq('id', companyId!);
    toast.success('Intervalo entre agendamentos salvo');
  };

  const updateHour = async (id: string, field: string, value: any) => {
    await supabase.from('business_hours').update({ [field]: value }).eq('id', id);
    fetchHours();
  };

  const addException = async () => {
    if (!newException.date) return toast.error('Selecione uma data');
    await supabase.from('business_exceptions').insert({
      company_id: companyId!,
      exception_date: newException.date,
      reason: newException.reason,
      is_closed: newException.is_closed,
    });
    toast.success('Exceção adicionada');
    setNewException({ date: '', reason: '', is_closed: true });
    fetchExceptions();
  };

  const deleteException = async (id: string) => {
    await supabase.from('business_exceptions').delete().eq('id', id);
    fetchExceptions();
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-display font-bold">Configurações</h2>
        <p className="text-sm text-muted-foreground">Horários, lembretes e automações</p>
      </div>

      {/* Company Profile - Empresa */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" /> Empresa
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Logo */}
          <div className="flex items-center gap-4">
            <div className="relative">
              {companyLogoUrl ? (
                <img src={companyLogoUrl} alt="Logo" className="w-20 h-20 rounded-xl object-cover border" />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center border">
                  <Building2 className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
              <label className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer shadow-md hover:opacity-90">
                <Camera className="w-3.5 h-3.5" />
                <input type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} disabled={logoUploading} />
              </label>
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">Logo da empresa</p>
              <p className="text-xs text-muted-foreground">Recomendado: 400x400px</p>
            </div>
          </div>

          {/* Cover */}
          <div className="space-y-2">
            <p className="text-sm font-medium">Foto de capa</p>
            <p className="text-xs text-muted-foreground">Recomendado: 1200x400px</p>
            {companyCoverUrl ? (
              <div className="relative">
                <img src={companyCoverUrl} alt="Capa" className="w-full h-32 rounded-xl object-cover border" />
                <label className="absolute bottom-2 right-2 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium cursor-pointer shadow-md hover:opacity-90">
                  <Camera className="w-3.5 h-3.5 inline mr-1" /> Alterar
                  <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} disabled={coverUploading} />
                </label>
              </div>
            ) : (
              <label className="flex items-center justify-center w-full h-32 rounded-xl border-2 border-dashed border-muted-foreground/30 cursor-pointer hover:border-primary/50 transition-colors">
                <div className="text-center">
                  <Camera className="w-6 h-6 mx-auto text-muted-foreground mb-1" />
                  <span className="text-xs text-muted-foreground">Clique para enviar a capa</span>
                </div>
                <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} disabled={coverUploading} />
              </label>
            )}
          </div>

          {/* Name */}
          <div className="space-y-1">
            <Label className="text-xs">Nome da empresa</Label>
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label className="text-xs">Descrição</Label>
            <Textarea
              value={companyDescription}
              onChange={(e) => setCompanyDescription(e.target.value)}
              placeholder="Descreva sua empresa..."
              rows={3}
            />
          </div>
        </CardContent>
      </Card>

      {/* Contato */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" /> Contato
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">WhatsApp</Label>
              <Input value={companyWhatsapp} onChange={(e) => setCompanyWhatsapp(e.target.value)} placeholder="(11) 99999-9999" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Telefone</Label>
              <Input value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} placeholder="(11) 3333-3333" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Endereço */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" /> Endereço
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1">
              <Label className="text-xs">Rua</Label>
              <Input value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} placeholder="Rua Example" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Número</Label>
              <Input value={companyAddressNumber} onChange={(e) => setCompanyAddressNumber(e.target.value)} placeholder="123" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Bairro</Label>
              <Input value={companyDistrict} onChange={(e) => setCompanyDistrict(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cidade</Label>
              <Input value={companyCity} onChange={(e) => setCompanyCity(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Estado</Label>
              <Input value={companyState} onChange={(e) => setCompanyState(e.target.value)} placeholder="SP" />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">CEP</Label>
              <Input value={companyPostalCode} onChange={(e) => setCompanyPostalCode(e.target.value)} placeholder="00000-000" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Link do Google Maps</Label>
              <Input value={companyGoogleMapsUrl} onChange={(e) => setCompanyGoogleMapsUrl(e.target.value)} placeholder="https://maps.google.com/..." />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Redes Sociais */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" /> Redes Sociais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1"><Instagram className="w-3 h-3" /> Instagram</Label>
            <Input value={companyInstagram} onChange={(e) => setCompanyInstagram(e.target.value)} placeholder="@suaempresa" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1"><Facebook className="w-3 h-3" /> Facebook</Label>
            <Input value={companyFacebook} onChange={(e) => setCompanyFacebook(e.target.value)} placeholder="https://facebook.com/suaempresa" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1"><Globe className="w-3 h-3" /> Website</Label>
            <Input value={companyWebsite} onChange={(e) => setCompanyWebsite(e.target.value)} placeholder="https://www.suaempresa.com" />
          </div>
        </CardContent>
      </Card>

      {/* Branding Colors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" /> Cores da Marca
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Personalize as cores das suas páginas públicas. As alterações serão aplicadas em tempo real.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-xs">Cor primária</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={brandPrimaryColor}
                  onChange={(e) => setBrandPrimaryColor(e.target.value)}
                  className="w-10 h-10 rounded-lg border cursor-pointer"
                  style={{ padding: 0 }}
                />
                <Input
                  value={brandPrimaryColor}
                  onChange={(e) => setBrandPrimaryColor(e.target.value)}
                  className="font-mono text-xs"
                  maxLength={7}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">Botões, links, destaques</p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Cor secundária</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={brandSecondaryColor}
                  onChange={(e) => setBrandSecondaryColor(e.target.value)}
                  className="w-10 h-10 rounded-lg border cursor-pointer"
                  style={{ padding: 0 }}
                />
                <Input
                  value={brandSecondaryColor}
                  onChange={(e) => setBrandSecondaryColor(e.target.value)}
                  className="font-mono text-xs"
                  maxLength={7}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">Hover, acentos</p>
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Cor de fundo</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={brandBackgroundColor}
                  onChange={(e) => setBrandBackgroundColor(e.target.value)}
                  className="w-10 h-10 rounded-lg border cursor-pointer"
                  style={{ padding: 0 }}
                />
                <Input
                  value={brandBackgroundColor}
                  onChange={(e) => setBrandBackgroundColor(e.target.value)}
                  className="font-mono text-xs"
                  maxLength={7}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">Fundo das páginas públicas</p>
            </div>
          </div>

          {/* Preview */}
          <div className="mt-4 p-4 rounded-xl border" style={{ background: brandBackgroundColor }}>
            <p className="text-xs font-semibold mb-2" style={{ color: brandPrimaryColor }}>Prévia das cores</p>
            <div className="flex gap-2">
              <button
                className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: brandPrimaryColor, color: '#FFFFFF' }}
              >
                Botão primário
              </button>
              <button
                className="px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: brandSecondaryColor, color: '#FFFFFF' }}
              >
                Botão secundário
              </button>
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={saveBranding} variant="outline" className="flex-1 sm:flex-none">
              Salvar cores
            </Button>
            <Button
              onClick={() => {
                setBrandPrimaryColor('#7C3AED');
                setBrandSecondaryColor('#111827');
                setBrandBackgroundColor('#0B132B');
              }}
              variant="ghost"
              className="flex-1 sm:flex-none text-muted-foreground"
            >
              <RotateCcw className="h-4 w-4 mr-1" /> Restaurar padrão
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Custom Domain */}
      {companyId && <DomainSettings companyId={companyId} companySlug={companySlug} />}

      {/* Save all profile data */}
      <Button onClick={saveCompanyProfile} className="w-full sm:w-auto">
        Salvar dados da empresa
      </Button>

      {/* Public Booking Link */}
      {companySlug && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" /> Link de Agendamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Compartilhe este link com seus clientes para agendamento online:
              </p>
              {(() => {
                const prefix = companyBusinessType === 'esthetic' ? 'estetica' : 'barbearia';
                const bookingUrl = `${window.location.origin}/${prefix}/${companySlug}`;
                return (
                  <div className="flex items-center gap-2">
                    <Input value={bookingUrl} readOnly className="bg-muted" />
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
                );
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Buffer Time */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Timer className="h-5 w-5" /> Intervalo entre Agendamentos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Minutos de intervalo</Label>
              <Input
                type="number"
                min={0}
                max={60}
                value={bufferMinutes}
                onChange={(e) => setBufferMinutes(parseInt(e.target.value, 10) || 0)}
                className="w-28"
              />
            </div>
            <Button size="sm" onClick={saveBuffer}>Salvar</Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Tempo adicionado após cada agendamento (ex: 5 min para limpeza/preparação)
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" /> Lembretes Automáticos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <p className="font-medium">Enviar lembretes de agendamento</p>
              <p className="text-sm text-muted-foreground">
                Dispara eventos 24h e 3h antes do horário agendado
              </p>
            </div>
            <Switch checked={remindersEnabled} onCheckedChange={toggleReminders} />
          </div>
        </CardContent>
      </Card>

      {/* Birthday Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cake className="h-5 w-5" /> Aniversário de Clientes
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <p className="font-medium">Enviar mensagem de aniversário</p>
              <p className="text-sm text-muted-foreground">
                Dispara evento 3 dias antes do aniversário via webhook
              </p>
            </div>
            <Switch checked={birthdayEnabled} onCheckedChange={toggleBirthday} />
          </div>

          {birthdayEnabled && (
            <div className="flex flex-wrap items-end gap-3 p-3 rounded-lg bg-muted/50">
              <div className="space-y-1">
                <Label className="text-xs">Tipo de desconto</Label>
                <Select value={birthdayDiscountType} onValueChange={setBirthdayDiscountType}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem desconto</SelectItem>
                    <SelectItem value="percentage">Percentual</SelectItem>
                    <SelectItem value="fixed">Valor fixo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {birthdayDiscountType !== 'none' && (
                <div className="space-y-1">
                  <Label className="text-xs">
                    {birthdayDiscountType === 'percentage' ? 'Percentual (%)' : 'Valor (R$)'}
                  </Label>
                  <Input
                    type="number"
                    value={birthdayDiscountValue}
                    onChange={(e) => setBirthdayDiscountValue(Number(e.target.value))}
                    className="w-28"
                    min={0}
                  />
                </div>
              )}
              <Button size="sm" onClick={saveBirthdayDiscount}>
                Salvar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" /> Horários de Funcionamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {hours.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Carregando horários...</p>
            )}
            {hours.map((h) => {
              const hasBreak = !!(h.lunch_start && h.lunch_end);
              return (
                <div key={h.id} className="p-4 rounded-lg border bg-card space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{dayNames[h.day_of_week]}</span>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Aberto</Label>
                      <Switch
                        checked={!h.is_closed}
                        onCheckedChange={(v) => updateHour(h.id, 'is_closed', !v)}
                      />
                    </div>
                  </div>

                  {!h.is_closed && (
                    <div className="space-y-3 pl-1">
                      <div className="flex items-center gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Início</Label>
                          <Input
                            type="time"
                            value={h.open_time || ''}
                            onChange={(e) => updateHour(h.id, 'open_time', e.target.value)}
                            className="w-28"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">Fim</Label>
                          <Input
                            type="time"
                            value={h.close_time || ''}
                            onChange={(e) => updateHour(h.id, 'close_time', e.target.value)}
                            className="w-28"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <Switch
                          checked={hasBreak}
                          onCheckedChange={(v) => {
                            if (v) {
                              updateHour(h.id, 'lunch_start', '12:00');
                              updateHour(h.id, 'lunch_end', '13:00');
                            } else {
                              updateHour(h.id, 'lunch_start', null);
                              updateHour(h.id, 'lunch_end', null);
                            }
                          }}
                        />
                        <Label className="text-xs text-muted-foreground">Pausa / Almoço</Label>
                      </div>

                      {hasBreak && (
                        <div className="flex items-center gap-3 pl-1">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Início pausa</Label>
                            <Input
                              type="time"
                              value={h.lunch_start || ''}
                              onChange={(e) => updateHour(h.id, 'lunch_start', e.target.value)}
                              className="w-28"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Fim pausa</Label>
                            <Input
                              type="time"
                              value={h.lunch_end || ''}
                              onChange={(e) => updateHour(h.id, 'lunch_end', e.target.value)}
                              className="w-28"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" /> Exceções (Feriados / Dias Especiais)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Data</Label>
              <Input
                type="date"
                value={newException.date}
                onChange={(e) => setNewException({ ...newException, date: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Motivo</Label>
              <Input
                value={newException.reason}
                onChange={(e) => setNewException({ ...newException, reason: e.target.value })}
                placeholder="Ex: Feriado"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">Fechado</Label>
              <Switch
                checked={newException.is_closed}
                onCheckedChange={(v) => setNewException({ ...newException, is_closed: v })}
              />
            </div>
            <Button onClick={addException} size="sm">
              <Plus className="h-4 w-4 mr-1" /> Adicionar
            </Button>
          </div>
          <div className="space-y-2">
            {exceptions.map((ex) => (
              <div key={ex.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <span className="font-medium text-sm">{ex.exception_date}</span>
                <span className="text-sm text-muted-foreground">{ex.reason}</span>
                <span className="text-xs">{ex.is_closed ? '🔴 Fechado' : '🟢 Aberto'}</span>
                <Button variant="ghost" size="sm" className="ml-auto" onClick={() => deleteException(ex.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsPage;
