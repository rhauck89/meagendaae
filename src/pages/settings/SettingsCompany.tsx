import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Building2, Camera, Phone, MapPin, Globe, Instagram, Facebook, ShieldCheck } from 'lucide-react';
import SettingsBreadcrumb from '@/components/SettingsBreadcrumb';
import AmenitiesSettings from '@/components/AmenitiesSettings';
import ImageCropDialog from '@/components/ImageCropDialog';
import type { CropMode } from '@/components/ImageCropDialog';

const SettingsCompany = () => {
  const { companyId } = useAuth();
  const [companyLogoUrl, setCompanyLogoUrl] = useState('');
  const [companyCoverUrl, setCompanyCoverUrl] = useState('');
  const [logoUploading, setLogoUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [companyPhone, setCompanyPhone] = useState('');
  const [companyWhatsapp, setCompanyWhatsapp] = useState('');
  const [companyAddress, setCompanyAddress] = useState('');
  const [companyAddressNumber, setCompanyAddressNumber] = useState('');
  const [companyDistrict, setCompanyDistrict] = useState('');
  const [companyCity, setCompanyCity] = useState('');
  const [companyState, setCompanyState] = useState('');
  const [companyPostalCode, setCompanyPostalCode] = useState('');
  const [companyGoogleMapsUrl, setCompanyGoogleMapsUrl] = useState('');
  const [companyInstagram, setCompanyInstagram] = useState('');
  const [companyFacebook, setCompanyFacebook] = useState('');
  const [companyWebsite, setCompanyWebsite] = useState('');
  const [brStates, setBrStates] = useState<{ id: number; name: string; uf: string }[]>([]);
  const [brCities, setBrCities] = useState<{ id: number; name: string }[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);

  // Professional permissions
  const [profPermClients, setProfPermClients] = useState(true);
  const [profPermPromotions, setProfPermPromotions] = useState(true);
  const [profPermEvents, setProfPermEvents] = useState(true);
  const [profPermRequests, setProfPermRequests] = useState(true);
  const [profPermFinance, setProfPermFinance] = useState(true);

  const [cropImage, setCropImage] = useState<string | null>(null);
  const [cropMode, setCropMode] = useState<CropMode>('avatar');
  const logoInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (companyId) fetchData();
  }, [companyId]);

  useEffect(() => {
    supabase.from('brazilian_states' as any).select('id, name, uf').order('name').then(({ data }) => {
      if (data) setBrStates(data as any);
    });
  }, []);

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

  const fetchData = async () => {
    const { data } = await supabase.from('companies').select('*').eq('id', companyId!).single();
    if (data) {
      setCompanyLogoUrl((data as any).logo_url ?? '');
      setCompanyCoverUrl((data as any).cover_url ?? '');
      setCompanyPhone((data as any).phone ?? '');
      setCompanyWhatsapp((data as any).whatsapp ?? '');
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
      setProfPermClients((data as any).prof_perm_clients ?? true);
      setProfPermPromotions((data as any).prof_perm_promotions ?? true);
      setProfPermEvents((data as any).prof_perm_events ?? true);
      setProfPermRequests((data as any).prof_perm_requests ?? true);
      setProfPermFinance((data as any).prof_perm_finance ?? true);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>, mode: CropMode) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) { toast.error('Formato não suportado. Use JPG, PNG ou WebP.'); return; }
    const maxMB = mode === 'cover' ? 10 : 5;
    if (file.size > maxMB * 1024 * 1024) { toast.error(`Imagem deve ter no máximo ${maxMB}MB`); return; }
    setCropMode(mode);
    const reader = new FileReader();
    reader.onload = () => setCropImage(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCroppedLogo = async (blob: Blob) => {
    if (!companyId) return;
    setCropImage(null);
    setLogoUploading(true);
    try {
      const filePath = `${companyId}/logo.jpg`;
      const file = new File([blob], 'logo.jpg', { type: 'image/jpeg' });
      const { error: uploadError } = await supabase.storage.from('logos').upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(filePath);
      const logoUrl = `${publicUrl}?t=${Date.now()}`;
      await supabase.from('companies').update({ logo_url: logoUrl } as any).eq('id', companyId);
      setCompanyLogoUrl(logoUrl);
      toast.success('Logo atualizado!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar logo');
    } finally {
      setLogoUploading(false);
    }
  };

  const handleCroppedCover = async (blob: Blob) => {
    if (!companyId) return;
    setCropImage(null);
    setCoverUploading(true);
    try {
      const filePath = `${companyId}/cover.jpg`;
      const file = new File([blob], 'cover.jpg', { type: 'image/jpeg' });
      const { error: uploadError } = await supabase.storage.from('logos').upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(filePath);
      const coverUrl = `${publicUrl}?t=${Date.now()}`;
      await supabase.from('companies').update({ cover_url: coverUrl } as any).eq('id', companyId);
      setCompanyCoverUrl(coverUrl);
      toast.success('Capa atualizada!');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar capa');
    } finally {
      setCoverUploading(false);
    }
  };

  const save = async () => {
    await supabase.from('companies').update({
      phone: companyPhone, whatsapp: companyWhatsapp,
      address: companyAddress, address_number: companyAddressNumber,
      district: companyDistrict, city: companyCity, state: companyState,
      postal_code: companyPostalCode, google_maps_url: companyGoogleMapsUrl,
      instagram: companyInstagram, facebook: companyFacebook, website: companyWebsite,
      prof_perm_clients: profPermClients,
      prof_perm_promotions: profPermPromotions,
      prof_perm_events: profPermEvents,
      prof_perm_requests: profPermRequests,
      prof_perm_finance: profPermFinance,
    } as any).eq('id', companyId!);
    toast.success('Dados da empresa salvos');
  };

  return (
    <div className="space-y-6">
      <SettingsBreadcrumb current="Empresa" />
      <div>
        <h2 className="text-xl font-display font-bold">Empresa</h2>
        <p className="text-sm text-muted-foreground">Logo, imagens, contato, endereço e redes sociais</p>
      </div>

      {/* Logo & Cover */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Camera className="h-5 w-5" /> Imagens</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="relative">
              {companyLogoUrl ? (
                <img src={companyLogoUrl} alt="Logo" className="w-20 h-20 rounded-xl object-cover border" />
              ) : (
                <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center border"><Building2 className="w-8 h-8 text-muted-foreground" /></div>
              )}
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleImageSelect(e, 'avatar')} />
              <label
                className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer shadow-md hover:opacity-90"
                onClick={() => logoInputRef.current?.click()}
              >
                <Camera className="w-3.5 h-3.5" />
              </label>
            </div>
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">Logo da empresa</p>
              <p className="text-xs text-muted-foreground">Recomendado: 400x400px</p>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-sm font-medium">Foto de capa</p>
            <p className="text-xs text-muted-foreground">Recomendado: 1200x400px</p>
            <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleImageSelect(e, 'cover')} />
            {companyCoverUrl ? (
              <div className="relative">
                <img src={companyCoverUrl} alt="Capa" className="w-full h-32 rounded-xl object-cover border" />
                <Button
                  variant="secondary"
                  size="sm"
                  className="absolute bottom-2 right-2 gap-1.5 opacity-80 hover:opacity-100"
                  onClick={() => coverInputRef.current?.click()}
                  disabled={coverUploading}
                >
                  <Camera className="w-3.5 h-3.5" /> {coverUploading ? 'Enviando...' : 'Alterar'}
                </Button>
              </div>
            ) : (
              <div
                className="flex items-center justify-center w-full h-32 rounded-xl border-2 border-dashed border-muted-foreground/30 cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => coverInputRef.current?.click()}
              >
                <div className="text-center"><Camera className="w-6 h-6 mx-auto text-muted-foreground mb-1" /><span className="text-xs text-muted-foreground">Clique para enviar a capa</span></div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Phone className="h-5 w-5" /> Contato</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">WhatsApp</Label><Input value={companyWhatsapp} onChange={(e) => setCompanyWhatsapp(e.target.value)} placeholder="(11) 99999-9999" /></div>
            <div className="space-y-1"><Label className="text-xs">Telefone</Label><Input value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} placeholder="(11) 3333-3333" /></div>
          </div>
        </CardContent>
      </Card>

      {/* Address */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" /> Endereço</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2 space-y-1"><Label className="text-xs">Rua</Label><Input value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs">Número</Label><Input value={companyAddressNumber} onChange={(e) => setCompanyAddressNumber(e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1"><Label className="text-xs">Bairro</Label><Input value={companyDistrict} onChange={(e) => setCompanyDistrict(e.target.value)} /></div>
            <div className="space-y-1">
              <Label className="text-xs">Estado</Label>
              <Select value={companyState} onValueChange={(v) => { setCompanyState(v); setCompanyCity(''); }}>
                <SelectTrigger><SelectValue placeholder="Selecione o estado" /></SelectTrigger>
                <SelectContent>{brStates.map(s => <SelectItem key={s.id} value={s.uf}>{s.name} ({s.uf})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Cidade</Label>
              <Select value={companyCity} onValueChange={setCompanyCity} disabled={!companyState || loadingCities}>
                <SelectTrigger><SelectValue placeholder={loadingCities ? 'Carregando...' : 'Selecione a cidade'} /></SelectTrigger>
                <SelectContent>{brCities.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs">CEP</Label><Input value={companyPostalCode} onChange={(e) => setCompanyPostalCode(e.target.value)} placeholder="00000-000" /></div>
            <div className="space-y-1"><Label className="text-xs">Link do Google Maps</Label><Input value={companyGoogleMapsUrl} onChange={(e) => setCompanyGoogleMapsUrl(e.target.value)} /></div>
          </div>
        </CardContent>
      </Card>

      {/* Social */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Globe className="h-5 w-5" /> Redes Sociais</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1"><Label className="text-xs flex items-center gap-1"><Instagram className="w-3 h-3" /> Instagram</Label><Input value={companyInstagram} onChange={(e) => setCompanyInstagram(e.target.value)} placeholder="@suaempresa" /></div>
          <div className="space-y-1"><Label className="text-xs flex items-center gap-1"><Facebook className="w-3 h-3" /> Facebook</Label><Input value={companyFacebook} onChange={(e) => setCompanyFacebook(e.target.value)} /></div>
          <div className="space-y-1"><Label className="text-xs flex items-center gap-1"><Globe className="w-3 h-3" /> Website</Label><Input value={companyWebsite} onChange={(e) => setCompanyWebsite(e.target.value)} /></div>
        </CardContent>
      </Card>

      {/* Professional Permissions */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> Permissões do Profissional</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">Controle quais módulos aparecem no painel dos profissionais da equipe.</p>
          {([
            { label: 'Clientes', value: profPermClients, setter: setProfPermClients },
            { label: 'Promoções', value: profPermPromotions, setter: setProfPermPromotions },
            { label: 'Agenda Aberta', value: profPermEvents, setter: setProfPermEvents },
            { label: 'Solicitações', value: profPermRequests, setter: setProfPermRequests },
            { label: 'Financeiro', value: profPermFinance, setter: setProfPermFinance },
          ] as const).map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <Label className="text-sm">{item.label}</Label>
              <Switch checked={item.value} onCheckedChange={item.setter} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Amenities */}
      <AmenitiesSettings />

      <Button onClick={save}>Salvar dados da empresa</Button>

      {cropImage && (
        <ImageCropDialog
          open={!!cropImage}
          imageSrc={cropImage}
          mode={cropMode}
          onClose={() => setCropImage(null)}
          onConfirm={cropMode === 'avatar' ? handleCroppedLogo : handleCroppedCover}
        />
      )}
    </div>
  );
};

export default SettingsCompany;
