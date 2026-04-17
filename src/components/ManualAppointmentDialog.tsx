import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogBody, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { format, addMinutes } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { formatWhatsApp, isValidWhatsApp, openWhatsApp } from '@/lib/whatsapp';
import { calculateAvailableSlots } from '@/lib/availability-engine';
import { Search, CalendarIcon, Clock, User, Scissors } from 'lucide-react';

interface ManualAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  userId?: string;
  isAdmin: boolean;
  profileId: string | null;
  onCreated: () => void;
  initialDate?: Date;
  initialTime?: string;
  initialProfessionalId?: string;
}

export function ManualAppointmentDialog({
  open,
  onOpenChange,
  companyId,
  userId,
  isAdmin,
  profileId,
  onCreated,
  initialDate,
  initialTime,
  initialProfessionalId,
}: ManualAppointmentDialogProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  // Step 1: Client selection
  const [clientSearch, setClientSearch] = useState('');
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [clientsLoading, setClientsLoading] = useState(false);

  // Step 2: Professional selection (admin only)
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [selectedProfessional, setSelectedProfessional] = useState<string>('');

  // Step 3: Service selection
  const [services, setServices] = useState<any[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);

  // Step 4: Date & time
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);

  // Step 5: WhatsApp confirmation
  const [sendWhatsApp, setSendWhatsApp] = useState(false);

  useEffect(() => {
    if (open) {
      resetForm();
      fetchProfessionals();
      fetchServices();
    }
  }, [open]);

  const resetForm = () => {
    setStep(1);
    setClientSearch('');
    setClients([]);
    setSelectedClient(null);
    setSelectedProfessional(initialProfessionalId || (isAdmin ? '' : (profileId || '')));
    setSelectedServices([]);
    setSelectedDate(initialDate || undefined);
    setAvailableSlots([]);
    setSelectedSlot(initialTime || null);
    setSendWhatsApp(false);
  };

  const searchClients = async (query: string) => {
    setClientSearch(query);
    if (query.length < 2) { setClients([]); return; }
    setClientsLoading(true);
    const { data } = await supabase
      .from('clients')
      .select('id, name, whatsapp, email')
      .eq('company_id', companyId)
      .or(`name.ilike.%${query}%,whatsapp.ilike.%${query}%`)
      .order('name')
      .limit(10);
    setClients(data || []);
    setClientsLoading(false);
  };

  const fetchProfessionals = async () => {
    const { data } = await supabase
      .from('collaborators')
      .select('profile_id, active, profile:profiles(full_name)')
      .eq('company_id', companyId)
      .eq('active', true);
    setProfessionals(data || []);
    if (!isAdmin && profileId) {
      setSelectedProfessional(profileId);
    }
  };

  const fetchServices = async () => {
    const { data } = await supabase
      .from('services')
      .select('id, name, duration_minutes, price')
      .eq('company_id', companyId)
      .eq('active', true)
      .order('name');
    setServices(data || []);
  };

  const fetchSlots = async (date: Date) => {
    if (!selectedProfessional) return;
    setSlotsLoading(true);
    setSelectedSlot(null);
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const [profHoursRes, bizHoursRes, blocksRes, exceptionsRes, companyRes, apptsRes] = await Promise.all([
        supabase.from('professional_working_hours').select('*').eq('professional_id', selectedProfessional).eq('company_id', companyId),
        supabase.from('business_hours').select('*').eq('company_id', companyId),
        supabase.from('blocked_times').select('*').eq('professional_id', selectedProfessional).eq('block_date', dateStr),
        supabase.from('business_exceptions').select('*').eq('company_id', companyId).eq('exception_date', dateStr),
        supabase.from('companies').select('buffer_minutes').eq('id', companyId).single(),
        supabase.from('appointments').select('id, start_time, end_time').eq('professional_id', selectedProfessional).eq('company_id', companyId).gte('start_time', `${dateStr}T00:00:00`).lt('start_time', `${dateStr}T23:59:59`).not('status', 'in', '("cancelled","no_show")'),
      ]);

      const totalDuration = selectedServices.reduce((sum, sId) => {
        const svc = services.find(s => s.id === sId);
        return sum + (svc?.duration_minutes || 0);
      }, 0);

      const slots = calculateAvailableSlots({
        date,
        totalDuration,
        businessHours: bizHoursRes.data || [],
        exceptions: exceptionsRes.data || [],
        existingAppointments: apptsRes.data || [],
        bufferMinutes: companyRes.data?.buffer_minutes || 0,
        professionalHours: profHoursRes.data && profHoursRes.data.length > 0 ? profHoursRes.data : undefined,
        blockedTimes: blocksRes.data || [],
      });
      setAvailableSlots(slots);
    } catch (err) {
      console.error('Failed to fetch slots:', err);
      toast.error('Erro ao buscar horários');
    } finally {
      setSlotsLoading(false);
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      fetchSlots(date);
    }
  };

  const totalDuration = selectedServices.reduce((sum, sId) => {
    const svc = services.find(s => s.id === sId);
    return sum + (svc?.duration_minutes || 0);
  }, 0);

  const totalPrice = selectedServices.reduce((sum, sId) => {
    const svc = services.find(s => s.id === sId);
    return sum + (svc?.price || 0);
  }, 0);

  const handleConfirm = async () => {
    if (!selectedClient || !selectedProfessional || selectedServices.length === 0 || !selectedDate || !selectedSlot) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setLoading(true);
    try {
      const [h, m] = selectedSlot.split(':').map(Number);
      const startDate = new Date(selectedDate);
      startDate.setHours(h, m, 0, 0);
      const endDate = addMinutes(startDate, totalDuration);
      const startTime = startDate.toISOString();
      const endTime = endDate.toISOString();

      // Last-second availability check
      const { data: conflicts } = await supabase
        .from('appointments')
        .select('id')
        .eq('professional_id', selectedProfessional)
        .eq('company_id', companyId)
        .lt('start_time', endTime)
        .gt('end_time', startTime)
        .not('status', 'in', '("cancelled","no_show")')
        .limit(1);

      if (conflicts && conflicts.length > 0) {
        toast.error('Este horário acabou de ser reservado. Escolha outro.');
        fetchSlots(selectedDate);
        setLoading(false);
        return;
      }

      // Create appointment via RPC
      const { error } = await supabase.rpc('create_appointment', {
        p_professional_id: selectedProfessional,
        p_client_id: selectedClient.id,
        p_start_time: startTime,
        p_end_time: endTime,
        p_total_price: totalPrice,
        p_client_name: selectedClient.name,
        p_client_whatsapp: selectedClient.whatsapp || '',
        p_notes: 'Agendamento manual',
      });

      if (error) throw error;

      // Insert appointment services
      const { data: newAppt } = await supabase
        .from('appointments')
        .select('id')
        .eq('professional_id', selectedProfessional)
        .eq('start_time', startTime)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (newAppt) {
        const svcInserts = selectedServices.map(sId => {
          const svc = services.find(s => s.id === sId);
          return {
            appointment_id: newAppt.id,
            service_id: sId,
            duration_minutes: svc?.duration_minutes || 0,
            price: svc?.price || 0,
          };
        });
        await supabase.from('appointment_services').insert(svcInserts);
      }

      // Send WhatsApp if requested
      if (sendWhatsApp && selectedClient.whatsapp) {
        const profName = professionals.find(p => p.profile_id === selectedProfessional)?.profile?.full_name || 'Profissional';
        const serviceNames = selectedServices.map(sId => services.find(s => s.id === sId)?.name).filter(Boolean).join(', ');
        const dateFormatted = format(selectedDate, "dd 'de' MMMM, yyyy", { locale: ptBR });
        openWhatsApp(selectedClient.whatsapp, `Olá ${selectedClient.name}! 👋\n\nSeu horário foi agendado com sucesso! ✅\n\n✂️ Serviço: ${serviceNames}\n👤 Profissional: ${profName}\n📅 Data: ${dateFormatted}\n🕐 Horário: ${selectedSlot}\n\nNos vemos em breve!`);
      }

      toast.success('Agendamento criado com sucesso!');
      onCreated();
      onOpenChange(false);
    } catch (err: any) {
      console.error('Manual appointment error:', err);
      toast.error(err.message || 'Erro ao criar agendamento');
    } finally {
      setLoading(false);
    }
  };

  const canProceedStep1 = !!selectedClient;
  const canProceedStep2 = !!selectedProfessional;
  const canProceedStep3 = selectedServices.length > 0;
  const canProceedStep4 = !!selectedSlot;

  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar cliente por nome ou WhatsApp..."
          value={clientSearch}
          onChange={e => searchClients(e.target.value)}
          className="pl-10"
        />
      </div>
      {clientsLoading && <p className="text-sm text-muted-foreground">Buscando...</p>}
      {selectedClient && (
        <div className="p-3 rounded-lg border bg-primary/5 border-primary/20">
          <p className="font-medium">{selectedClient.name}</p>
          <p className="text-sm text-muted-foreground">{selectedClient.whatsapp || 'Sem WhatsApp'}</p>
          <Button variant="ghost" size="sm" className="mt-1 text-xs" onClick={() => setSelectedClient(null)}>Trocar cliente</Button>
        </div>
      )}
      {!selectedClient && clients.length > 0 && (
        <div className="space-y-1 max-h-[200px] overflow-y-auto">
          {clients.map(c => (
            <div key={c.id} className="flex items-center justify-between p-2 rounded-lg border hover:bg-muted/50 cursor-pointer" onClick={() => { setSelectedClient(c); setClients([]); }}>
              <div>
                <p className="font-medium text-sm">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.whatsapp || c.email || ''}</p>
              </div>
            </div>
          ))}
        </div>
      )}
      {!selectedClient && clientSearch.length >= 2 && clients.length === 0 && !clientsLoading && (
        <p className="text-sm text-muted-foreground">Nenhum cliente encontrado. Cadastre primeiro na página de Clientes.</p>
      )}
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-3">
      <Label>Selecione o profissional</Label>
      <div className="space-y-2">
        {professionals.map(p => (
          <div
            key={p.profile_id}
            className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedProfessional === p.profile_id ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'}`}
            onClick={() => setSelectedProfessional(p.profile_id)}
          >
            <p className="font-medium">{(p.profile as any)?.full_name || 'Sem nome'}</p>
          </div>
        ))}
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-3">
      <Label>Selecione os serviços</Label>
      <div className="space-y-2 max-h-[300px] overflow-y-auto">
        {services.map(svc => {
          const isSelected = selectedServices.includes(svc.id);
          return (
            <div
              key={svc.id}
              className={`p-3 rounded-lg border cursor-pointer transition-colors ${isSelected ? 'bg-primary/10 border-primary' : 'hover:bg-muted/50'}`}
              onClick={() => {
                setSelectedServices(prev =>
                  isSelected ? prev.filter(id => id !== svc.id) : [...prev, svc.id]
                );
                setSelectedDate(undefined);
                setAvailableSlots([]);
                setSelectedSlot(null);
              }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">{svc.name}</p>
                  <p className="text-xs text-muted-foreground">{svc.duration_minutes} min</p>
                </div>
                <span className="font-semibold text-sm">R$ {Number(svc.price).toFixed(2)}</span>
              </div>
            </div>
          );
        })}
      </div>
      {selectedServices.length > 0 && (
        <div className="flex items-center justify-between pt-2 border-t">
          <span className="text-sm text-muted-foreground">Total: {totalDuration} min</span>
          <span className="font-bold">R$ {totalPrice.toFixed(2)}</span>
        </div>
      )}
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4">
        <div>
          <Label className="mb-2 block">Data</Label>
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleDateSelect}
            disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
            locale={ptBR}
            className="rounded-md border"
          />
        </div>
        <div>
          <Label className="mb-2 block">Horários disponíveis</Label>
          {!selectedDate ? (
            <p className="text-sm text-muted-foreground">Selecione uma data</p>
          ) : slotsLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : availableSlots.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum horário disponível</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[280px] overflow-y-auto">
              {availableSlots.map(slot => (
                <Button
                  key={slot}
                  size="sm"
                  variant={selectedSlot === slot ? 'default' : 'outline'}
                  onClick={() => setSelectedSlot(slot)}
                >
                  {slot}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderStep5 = () => {
    const profName = professionals.find(p => p.profile_id === selectedProfessional)?.profile?.full_name || 'Profissional';
    const serviceNames = selectedServices.map(sId => services.find(s => s.id === sId)?.name).filter(Boolean).join(', ');
    return (
      <div className="space-y-4">
        <div className="p-4 rounded-lg border bg-muted/30 space-y-2">
          <p><strong>Cliente:</strong> {selectedClient?.name}</p>
          <p><strong>Profissional:</strong> {profName}</p>
          <p><strong>Serviços:</strong> {serviceNames}</p>
          <p><strong>Data:</strong> {selectedDate ? format(selectedDate, "dd/MM/yyyy", { locale: ptBR }) : ''}</p>
          <p><strong>Horário:</strong> {selectedSlot}</p>
          <p><strong>Valor:</strong> R$ {totalPrice.toFixed(2)}</p>
        </div>
        {selectedClient?.whatsapp && (
          <div className="flex items-center gap-2">
            <Checkbox
              id="sendWhatsApp"
              checked={sendWhatsApp}
              onCheckedChange={(checked) => setSendWhatsApp(!!checked)}
            />
            <label htmlFor="sendWhatsApp" className="text-sm cursor-pointer">
              Enviar confirmação via WhatsApp para o cliente
            </label>
          </div>
        )}
      </div>
    );
  };

  const stepTitles = ['Selecionar cliente', 'Selecionar profissional', 'Selecionar serviços', 'Data e horário', 'Confirmar'];
  const totalSteps = isAdmin ? 5 : 4;
  const currentStep = !isAdmin && step >= 2 ? step + 1 : step;

  const getEffectiveStep = () => {
    if (!isAdmin && step >= 2) return step + 1;
    return step;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" /> Agendar manualmente
          </DialogTitle>
          <DialogDescription>
            Etapa {step} de {totalSteps}: {stepTitles[getEffectiveStep() - 1]}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {/* Progress */}
          <div className="flex gap-1">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div key={i} className={`h-1 flex-1 rounded-full ${i < step ? 'bg-primary' : 'bg-muted'}`} />
            ))}
          </div>

          {getEffectiveStep() === 1 && renderStep1()}
          {getEffectiveStep() === 2 && renderStep2()}
          {getEffectiveStep() === 3 && renderStep3()}
          {getEffectiveStep() === 4 && renderStep4()}
          {getEffectiveStep() === 5 && renderStep5()}
        </DialogBody>

        <DialogFooter>
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(s => s - 1)}>Voltar</Button>
          )}
          {getEffectiveStep() < 5 && (
            <Button
              onClick={() => setStep(s => s + 1)}
              disabled={
                (getEffectiveStep() === 1 && !canProceedStep1) ||
                (getEffectiveStep() === 2 && !canProceedStep2) ||
                (getEffectiveStep() === 3 && !canProceedStep3) ||
                (getEffectiveStep() === 4 && !canProceedStep4)
              }
            >
              Próximo
            </Button>
          )}
          {getEffectiveStep() === 5 && (
            <Button onClick={handleConfirm} disabled={loading}>
              {loading ? 'Criando...' : 'Confirmar agendamento'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
