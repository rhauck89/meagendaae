import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Copy, Link2 } from 'lucide-react';

const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

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
      supabase.from('companies').select('slug, business_type').eq('id', companyId!).single(),
    ]);

    if (servicesRes.data) setServices(servicesRes.data);
    if (assignedRes.data) {
      setAssignedServiceIds(assignedRes.data.map((r: any) => r.service_id));
      const overrides: Record<string, string> = {};
      assignedRes.data.forEach((r: any) => {
        if (r.price_override != null) overrides[r.service_id] = String(r.price_override);
      });
      setPriceOverrides(overrides);
    }
    if (hoursRes.data && (hoursRes.data as any[]).length > 0) {
      setProfHours(hoursRes.data as any[]);
    } else {
      // Initialize default professional hours
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
      const { data: newH } = await supabase.from('professional_working_hours' as any).select('*').eq('professional_id', profileId).order('day_of_week');
      if (newH) setProfHours(newH as any[]);
    }
    if (companyRes.data) {
      setCompanySlug((companyRes.data as any).slug || '');
      setBusinessType((companyRes.data as any).business_type || 'barbershop');
    }
    setSlug(collaborator.slug || '');
  };

  const saveSlug = async () => {
    const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
    if (!cleanSlug) return toast.error('Slug inválido');
    await supabase.from('collaborators').update({ slug: cleanSlug } as any).eq('id', collaborator.id);
    setSlug(cleanSlug);
    toast.success('Slug salvo');
    onUpdated();
  };

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

  const savePriceOverride = async (serviceId: string) => {
    const value = priceOverrides[serviceId];
    const numVal = value ? parseFloat(value) : null;
    await supabase.from('service_professionals').update({ price_override: numVal } as any)
      .eq('service_id', serviceId)
      .eq('professional_id', collaborator.profile_id);
    toast.success('Preço atualizado');
  };

  const updateProfHour = async (id: string, field: string, value: any) => {
    await supabase.from('professional_working_hours' as any).update({ [field]: value }).eq('id', id);
    const { data } = await supabase.from('professional_working_hours' as any).select('*')
      .eq('professional_id', collaborator.profile_id).order('day_of_week');
    if (data) setProfHours(data as any[]);
  };

  const prefix = businessType === 'esthetic' ? 'estetica' : 'barbearia';
  const bookingUrl = slug && companySlug
    ? `${window.location.origin}/${prefix}/${companySlug}/${slug}`
    : '';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar Profissional: {collaborator?.profile?.full_name}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="link" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="link">Link & Slug</TabsTrigger>
            <TabsTrigger value="services">Serviços</TabsTrigger>
            <TabsTrigger value="hours">Horários</TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Slug do profissional</Label>
              <div className="flex gap-2">
                <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="ex: joao" />
                <Button size="sm" onClick={saveSlug}>Salvar</Button>
              </div>
            </div>
            {bookingUrl && (
              <div className="space-y-2">
                <Label className="flex items-center gap-1"><Link2 className="h-4 w-4" /> Link de agendamento</Label>
                <div className="flex items-center gap-2">
                  <Input value={bookingUrl} readOnly className="bg-muted text-sm" />
                  <Button variant="outline" size="icon" onClick={() => {
                    navigator.clipboard.writeText(bookingUrl);
                    toast.success('Link copiado!');
                  }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="services" className="space-y-3 mt-4">
            <p className="text-sm text-muted-foreground">Selecione os serviços que este profissional realiza:</p>
            {services.map((svc) => {
              const isAssigned = assignedServiceIds.includes(svc.id);
              return (
                <div key={svc.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Checkbox
                    checked={isAssigned}
                    onCheckedChange={(checked) => toggleService(svc.id, !!checked)}
                  />
                  <div className="flex-1">
                    <p className="font-medium text-sm">{svc.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Preço base: R$ {Number(svc.price).toFixed(2)} • {svc.duration_minutes} min
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
                        className="w-32"
                      />
                      <Button size="sm" variant="outline" onClick={() => savePriceOverride(svc.id)}>
                        OK
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </TabsContent>

          <TabsContent value="hours" className="space-y-3 mt-4">
            <p className="text-sm text-muted-foreground">Horários específicos deste profissional (sobrepõem os horários da empresa):</p>
            {profHours.map((h: any) => (
              <div key={h.id} className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="w-24 font-medium text-sm">{dayNames[h.day_of_week]}</div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Aberto</Label>
                  <Switch
                    checked={!h.is_closed}
                    onCheckedChange={(v) => updateProfHour(h.id, 'is_closed', !v)}
                  />
                </div>
                {!h.is_closed && (
                  <>
                    <Input type="time" value={h.open_time || ''} onChange={(e) => updateProfHour(h.id, 'open_time', e.target.value)} className="w-24" />
                    <span className="text-xs text-muted-foreground">Almoço:</span>
                    <Input type="time" value={h.lunch_start || ''} onChange={(e) => updateProfHour(h.id, 'lunch_start', e.target.value)} className="w-24" />
                    <span className="text-xs">-</span>
                    <Input type="time" value={h.lunch_end || ''} onChange={(e) => updateProfHour(h.id, 'lunch_end', e.target.value)} className="w-24" />
                    <Input type="time" value={h.close_time || ''} onChange={(e) => updateProfHour(h.id, 'close_time', e.target.value)} className="w-24" />
                  </>
                )}
              </div>
            ))}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ProfessionalPanel;
