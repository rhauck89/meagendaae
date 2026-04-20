import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogBody, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Copy, Link2, Search, X, Building2, Clock, Briefcase, Globe, ExternalLink, Lock } from 'lucide-react';

const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const bookingModeLabel = (mode: string) => {
  if (mode === 'smart') return 'Inteligente';
  if (mode === 'fixed_grid') return 'Grade fixa';
  if (mode === 'hybrid') return 'Híbrido';
  return mode;
};

interface ProfessionalPanelProps {
  collaborator: any;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}

const ProfessionalPanel = ({ collaborator, open, onOpenChange, onUpdated }: ProfessionalPanelProps) => {
  const { companyId } = useAuth();
  const [slug, setSlug] = useState(collaborator?.slug || '');
  const [services, setServices] = useState<any[]>([]);
  const [assignedServiceIds, setAssignedServiceIds] = useState<string[]>([]);
  const [priceOverrides, setPriceOverrides] = useState<Record<string, string>>({});
  const [profHours, setProfHours] = useState<any[]>([]);
  const [companySlug, setCompanySlug] = useState('');
  const [businessType, setBusinessType] = useState('barbershop');
  const [company, setCompany] = useState<any>(null);
  const [inheriting, setInheriting] = useState(true);
  const [savingInherit, setSavingInherit] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (open && collaborator && companyId) {
      fetchData();
    }
  }, [open, collaborator, companyId]);

  const fetchData = async () => {
    const profileId = collaborator.profile_id;

    const [servicesRes, assignedRes, hoursRes, companyRes] = await Promise.all([
      supabase.from('services').select('*').eq('company_id', companyId!).eq('active', true).order('name'),
      supabase.from('service_professionals').select('*').eq('professional_id', profileId),
      supabase.from('professional_working_hours' as any).select('*').eq('professional_id', profileId).order('day_of_week'),
      supabase.from('companies').select('slug, business_type, booking_mode, fixed_slot_interval, prof_perm_booking_mode, prof_perm_grid_interval').eq('id', companyId!).single(),
    ]);

    if (servicesRes.data) setServices(servicesRes.data);
    if (assignedRes.data) {
      if (assignedRes.data.length === 0 && servicesRes.data && servicesRes.data.length > 0) {
        const links = servicesRes.data.map((s: any) => ({
          service_id: s.id,
          professional_id: profileId,
          company_id: companyId,
        }));
        await supabase.from('service_professionals').insert(links as any);
        setAssignedServiceIds(servicesRes.data.map((s: any) => s.id));
      } else {
        setAssignedServiceIds(assignedRes.data.map((r: any) => r.service_id));
        const overrides: Record<string, string> = {};
        assignedRes.data.forEach((r: any) => {
          if (r.price_override != null) overrides[r.service_id] = String(r.price_override);
        });
        setPriceOverrides(overrides);
      }
    }
    const hasCustomHours = hoursRes.data && (hoursRes.data as any[]).length > 0;
    if (hasCustomHours) {
      setProfHours(hoursRes.data as any[]);
      setInheriting(false);
    } else {
      setProfHours([]);
      setInheriting(true);
    }
    if (companyRes.data) {
      const c = companyRes.data as any;
      setCompany(c);
      setCompanySlug(c.slug || '');
      setBusinessType(c.business_type || 'barbershop');
    }
    const existingSlug = collaborator.slug || '';
    if (!existingSlug && collaborator.profile?.full_name) {
      const autoSlug = collaborator.profile.full_name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      setSlug(autoSlug);
      await supabase.from('collaborators').update({ slug: autoSlug } as any).eq('id', collaborator.id);
    } else {
      setSlug(existingSlug);
    }
  };

  const handleToggleInherit = async (next: boolean) => {
    setSavingInherit(true);
    const profileId = collaborator.profile_id;
    try {
      if (next) {
        // Inherit: remove custom professional hours
        await supabase.from('professional_working_hours' as any).delete().eq('professional_id', profileId);
        setProfHours([]);
        setInheriting(true);
        toast.success('Configurações herdadas da empresa');
      } else {
        // Customize: seed defaults from company
        const defaults = Array.from({ length: 7 }, (_, i) => ({
          professional_id: profileId,
          company_id: companyId!,
          day_of_week: i,
          open_time: '09:00',
          close_time: '18:00',
          lunch_start: '12:00',
          lunch_end: '13:00',
          is_closed: i === 0,
        }));
        await supabase.from('professional_working_hours' as any).insert(defaults);
        const { data } = await supabase.from('professional_working_hours' as any)
          .select('*').eq('professional_id', profileId).order('day_of_week');
        if (data) setProfHours(data as any[]);
        setInheriting(false);
        toast.success('Personalização ativada');
      }
      onUpdated();
    } catch (e: any) {
      toast.error('Não foi possível atualizar agora');
    } finally {
      setSavingInherit(false);
    }
  };

  const updateProfHour = async (id: string, field: string, value: any) => {
    await supabase.from('professional_working_hours' as any).update({ [field]: value }).eq('id', id);
    const { data } = await supabase.from('professional_working_hours' as any).select('*')
      .eq('professional_id', collaborator.profile_id).order('day_of_week');
    if (data) setProfHours(data as any[]);
  };

  const updateBookingConfig = async (field: 'booking_mode' | 'grid_interval', value: any) => {
    await supabase.from('collaborators').update({ [field]: value } as any).eq('id', collaborator.id);
    toast.success('Configuração salva');
    onUpdated();
  };

  const filteredServices = useMemo(() => {
    if (!searchQuery.trim()) return services;
    const q = searchQuery.toLowerCase();
    return services.filter(s => s.name.toLowerCase().includes(q));
  }, [services, searchQuery]);

  const allFilteredSelected = filteredServices.length > 0 && filteredServices.every(s => assignedServiceIds.includes(s.id));
  const someFilteredSelected = filteredServices.some(s => assignedServiceIds.includes(s.id));
  const selectAllRef = useRef<HTMLButtonElement>(null);

  const toggleService = async (serviceId: string, checked: boolean) => {
    const profileId = collaborator.profile_id;
    if (checked) {
      await supabase.from('service_professionals').insert({
        service_id: serviceId,
        professional_id: profileId,
        company_id: companyId,
      } as any);
      setAssignedServiceIds((prev) => [...prev, serviceId]);
    } else {
      await supabase.from('service_professionals').delete()
        .eq('service_id', serviceId)
        .eq('professional_id', profileId);
      setAssignedServiceIds((prev) => prev.filter((id) => id !== serviceId));
    }
  };

  const handleSelectAll = async (checked: boolean) => {
    const profileId = collaborator.profile_id;
    const targetIds = filteredServices.map(s => s.id);

    if (checked) {
      const toAdd = targetIds.filter(id => !assignedServiceIds.includes(id));
      if (toAdd.length > 0) {
        const links = toAdd.map(id => ({
          service_id: id,
          professional_id: profileId,
          company_id: companyId,
        }));
        await supabase.from('service_professionals').insert(links as any);
        setAssignedServiceIds(prev => [...new Set([...prev, ...toAdd])]);
      }
    } else {
      for (const id of targetIds) {
        await supabase.from('service_professionals').delete()
          .eq('service_id', id)
          .eq('professional_id', profileId);
      }
      setAssignedServiceIds(prev => prev.filter(id => !targetIds.includes(id)));
    }
    toast.success(checked ? 'Todos os serviços selecionados' : 'Seleção limpa');
  };

  const savePriceOverride = async (serviceId: string) => {
    const value = priceOverrides[serviceId];
    const numVal = value ? parseFloat(value) : null;
    await supabase.from('service_professionals').update({ price_override: numVal } as any)
      .eq('service_id', serviceId)
      .eq('professional_id', collaborator.profile_id);
    toast.success('Preço atualizado');
  };

  const saveSlug = async () => {
    const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
    if (!cleanSlug) return toast.error('Slug inválido');
    await supabase.from('collaborators').update({ slug: cleanSlug } as any).eq('id', collaborator.id);
    setSlug(cleanSlug);
    toast.success('Link atualizado');
    onUpdated();
  };

  const prefix = businessType === 'esthetic' ? 'estetica' : 'barbearia';
  const bookingUrl = slug && companySlug
    ? `${window.location.origin}/${prefix}/${companySlug}/${slug}`
    : '';

  const canEditMode = !!company?.prof_perm_booking_mode;
  const canEditInterval = !!company?.prof_perm_grid_interval;
  const collabBookingMode = (collaborator as any)?.booking_mode || company?.booking_mode || 'hybrid';
  const collabGridInterval = (collaborator as any)?.grid_interval || company?.fixed_slot_interval || 15;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Agenda de {collaborator?.profile?.full_name}</DialogTitle>
        </DialogHeader>

        <DialogBody className="space-y-6">
          {/* ========== SEÇÃO 1: HERDAR DA EMPRESA ========== */}
          <section className="rounded-lg border bg-card p-4 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="rounded-md bg-primary/10 p-2">
                  <Building2 className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <Label className="text-sm font-semibold">Herdar configurações da empresa</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {inheriting
                      ? 'Este profissional segue os horários e modo de agenda padrões.'
                      : 'Personalização ativa — horários e modo independentes.'}
                  </p>
                </div>
              </div>
              <Switch checked={inheriting} disabled={savingInherit} onCheckedChange={handleToggleInherit} />
            </div>

            {inheriting ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                <div className="rounded-md bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Horário</p>
                  <p className="text-sm font-medium mt-1">Padrão da empresa</p>
                </div>
                <div className="rounded-md bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Modo de agenda</p>
                  <p className="text-sm font-medium mt-1">{bookingModeLabel(company?.booking_mode || 'hybrid')}</p>
                </div>
                <div className="rounded-md bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground">Intervalo</p>
                  <p className="text-sm font-medium mt-1">{company?.fixed_slot_interval || 15} min</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4 pt-2">
                {/* Modo de agenda + intervalo */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Modo de agenda</Label>
                    {canEditMode ? (
                      <Select value={collabBookingMode} onValueChange={(v) => updateBookingConfig('booking_mode', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="smart">Inteligente</SelectItem>
                          <SelectItem value="fixed_grid">Grade fixa</SelectItem>
                          <SelectItem value="hybrid">Híbrido</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                        <Lock className="h-3 w-3 text-muted-foreground" />
                        {bookingModeLabel(collabBookingMode)}
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Intervalo entre atendimentos</Label>
                    {canEditInterval ? (
                      <Select value={String(collabGridInterval)} onValueChange={(v) => updateBookingConfig('grid_interval', Number(v))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10 minutos</SelectItem>
                          <SelectItem value="15">15 minutos</SelectItem>
                          <SelectItem value="20">20 minutos</SelectItem>
                          <SelectItem value="30">30 minutos</SelectItem>
                          <SelectItem value="60">60 minutos</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-sm">
                        <Lock className="h-3 w-3 text-muted-foreground" />
                        {collabGridInterval} min
                      </div>
                    )}
                  </div>
                </div>

                {/* Horários semanais */}
                <div className="space-y-2">
                  <Label className="text-xs">Horários semanais</Label>
                  <div className="space-y-2">
                    {profHours.map((h: any) => (
                      <div key={h.id} className="flex flex-wrap items-center gap-2 p-3 rounded-lg bg-muted/40 border">
                        <div className="w-20 font-medium text-sm">{dayNames[h.day_of_week]}</div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={!h.is_closed}
                            onCheckedChange={(v) => updateProfHour(h.id, 'is_closed', !v)}
                          />
                          <span className="text-xs text-muted-foreground">{h.is_closed ? 'Fechado' : 'Aberto'}</span>
                        </div>
                        {!h.is_closed && (
                          <div className="flex flex-wrap items-center gap-2 ml-auto">
                            <Input type="time" value={h.open_time || ''} onChange={(e) => updateProfHour(h.id, 'open_time', e.target.value)} className="w-[110px] h-8" />
                            <span className="text-xs text-muted-foreground hidden sm:inline">almoço</span>
                            <Input type="time" value={h.lunch_start || ''} onChange={(e) => updateProfHour(h.id, 'lunch_start', e.target.value)} className="w-[110px] h-8" />
                            <span className="text-xs">–</span>
                            <Input type="time" value={h.lunch_end || ''} onChange={(e) => updateProfHour(h.id, 'lunch_end', e.target.value)} className="w-[110px] h-8" />
                            <Input type="time" value={h.close_time || ''} onChange={(e) => updateProfHour(h.id, 'close_time', e.target.value)} className="w-[110px] h-8" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* ========== SEÇÃO 2: SERVIÇOS ATENDIDOS ========== */}
          <section className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-primary/10 p-2">
                <Briefcase className="h-4 w-4 text-primary" />
              </div>
              <div>
                <Label className="text-sm font-semibold">Serviços atendidos</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {assignedServiceIds.length} de {services.length} serviços vinculados
                </p>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar serviço..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-8 h-9"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 px-3 py-2 rounded-md bg-muted/60 border">
              <Checkbox
                ref={selectAllRef}
                checked={allFilteredSelected ? true : someFilteredSelected ? 'indeterminate' : false}
                onCheckedChange={(checked) => handleSelectAll(!!checked)}
              />
              <span className="font-medium text-sm">Selecionar todos</span>
            </div>

            <div className="max-h-[320px] overflow-y-auto space-y-2 pr-1">
              {filteredServices.map((svc) => {
                const isAssigned = assignedServiceIds.includes(svc.id);
                return (
                  <div key={svc.id} className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-muted/40 border">
                    <Checkbox
                      checked={isAssigned}
                      onCheckedChange={(checked) => toggleService(svc.id, !!checked)}
                    />
                    <div className="flex-1 min-w-[140px]">
                      <p className="font-medium text-sm">{svc.name}</p>
                      <p className="text-xs text-muted-foreground">
                        R$ {Number(svc.price).toFixed(2)} • {svc.duration_minutes} min
                      </p>
                    </div>
                    {isAssigned && (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Preço especial"
                          value={priceOverrides[svc.id] || ''}
                          onChange={(e) => setPriceOverrides({ ...priceOverrides, [svc.id]: e.target.value })}
                          className="w-28 h-8"
                        />
                        <Button size="sm" variant="outline" className="h-8" onClick={() => savePriceOverride(svc.id)}>
                          OK
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
              {filteredServices.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Nenhum serviço encontrado</p>
              )}
            </div>
          </section>

          {/* ========== SEÇÃO 3: PÁGINA PÚBLICA ========== */}
          <section className="rounded-lg border bg-card p-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="rounded-md bg-primary/10 p-2">
                <Globe className="h-4 w-4 text-primary" />
              </div>
              <div>
                <Label className="text-sm font-semibold">Página pública</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Link exclusivo para agendamentos deste profissional.</p>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Identificador (slug)</Label>
              <div className="flex gap-2">
                <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="ex: joao" className="h-9" />
                <Button size="sm" onClick={saveSlug}>Salvar</Button>
              </div>
            </div>

            {bookingUrl && (
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1"><Link2 className="h-3 w-3" /> Link de agendamento</Label>
                <div className="flex items-center gap-2">
                  <Input value={bookingUrl} readOnly className="bg-muted text-sm h-9" />
                  <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => {
                    navigator.clipboard.writeText(bookingUrl);
                    toast.success('Link copiado!');
                  }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-9 w-9" asChild>
                    <a href={bookingUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              </div>
            )}
          </section>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
};

export default ProfessionalPanel;
