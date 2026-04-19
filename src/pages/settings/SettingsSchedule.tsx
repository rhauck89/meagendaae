import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Clock, Calendar as CalendarIcon, Plus, Trash2, Timer, RefreshCw, Zap, Grid3X3, Inbox, Shield } from 'lucide-react';
import SettingsBreadcrumb from '@/components/SettingsBreadcrumb';

const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const SettingsSchedule = () => {
  const { companyId } = useAuth();
  const [hours, setHours] = useState<any[]>([]);
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [newException, setNewException] = useState({ date: '', reason: '', is_closed: true });
  const [bufferMinutes, setBufferMinutes] = useState(0);
  const [bookingMode, setBookingMode] = useState<string>('fixed_grid');
  const [fixedSlotInterval, setFixedSlotInterval] = useState<number>(15);
  const [allowCustomRequests, setAllowCustomRequests] = useState(false);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [profPermBookingMode, setProfPermBookingMode] = useState(false);
  const [profPermGridInterval, setProfPermGridInterval] = useState(false);

  useEffect(() => {
    if (companyId) { fetchHours(); fetchExceptions(); fetchCompanySettings(); }
  }, [companyId]);

  const fetchCompanySettings = async () => {
    const { data } = await supabase.from('companies').select('buffer_minutes, booking_mode, fixed_slot_interval, allow_custom_requests, prof_perm_booking_mode, prof_perm_grid_interval').eq('id', companyId!).single();
    if (data) {
      setBufferMinutes((data as any).buffer_minutes ?? 0);
      setBookingMode((data as any).booking_mode ?? 'intelligent');
      setFixedSlotInterval((data as any).fixed_slot_interval ?? 15);
      setAllowCustomRequests((data as any).allow_custom_requests ?? false);
      setProfPermBookingMode((data as any).prof_perm_booking_mode ?? false);
      setProfPermGridInterval((data as any).prof_perm_grid_interval ?? false);
    }
  };

  const fetchHours = async () => {
    const { data } = await supabase.from('business_hours').select('*').eq('company_id', companyId!).order('day_of_week');
    if (data && data.length > 0) { setHours(data); } else {
      const defaults = Array.from({ length: 7 }, (_, i) => ({ company_id: companyId!, day_of_week: i, open_time: '09:00', close_time: '18:00', lunch_start: '12:00', lunch_end: '13:00', is_closed: i === 0 }));
      await supabase.from('business_hours').insert(defaults);
      const { data: newData } = await supabase.from('business_hours').select('*').eq('company_id', companyId!).order('day_of_week');
      if (newData) setHours(newData);
    }
  };

  const fetchExceptions = async () => {
    const { data } = await supabase.from('business_exceptions').select('*').eq('company_id', companyId!).order('exception_date');
    if (data) setExceptions(data);
  };

  const updateHour = async (id: string, field: string, value: any) => {
    await supabase.from('business_hours').update({ [field]: value } as any).eq('id', id);
    fetchHours();
  };

  const saveBuffer = async () => {
    await supabase.from('companies').update({ buffer_minutes: bufferMinutes } as any).eq('id', companyId!);
    toast.success('Intervalo salvo');
  };

  const saveBookingMode = async () => {
    await supabase.from('companies').update({ booking_mode: bookingMode, fixed_slot_interval: fixedSlotInterval } as any).eq('id', companyId!);
    toast.success('Modo de agendamento salvo');
  };

  const saveCustomRequests = async () => {
    await supabase.from('companies').update({ allow_custom_requests: allowCustomRequests } as any).eq('id', companyId!);
    toast.success(allowCustomRequests ? 'Solicitações personalizadas ativadas' : 'Solicitações personalizadas desativadas');
  };

  const addException = async () => {
    if (!newException.date) return toast.error('Selecione uma data');
    await supabase.from('business_exceptions').insert({ company_id: companyId!, exception_date: newException.date, reason: newException.reason, is_closed: newException.is_closed });
    toast.success('Exceção adicionada');
    setNewException({ date: '', reason: '', is_closed: true });
    fetchExceptions();
  };

  const deleteException = async (id: string) => {
    await supabase.from('business_exceptions').delete().eq('id', id);
    fetchExceptions();
  };

  const handleSyncScheduleToAll = async () => {
    if (!companyId) return;
    setSyncing(true);
    try {
      const { data: companyHours, error: hoursError } = await supabase
        .from('business_hours')
        .select('day_of_week, open_time, close_time, lunch_start, lunch_end, is_closed')
        .eq('company_id', companyId)
        .order('day_of_week');

      if (hoursError || !companyHours || companyHours.length === 0) {
        toast.error('Horários da empresa não encontrados');
        return;
      }

      const { data: activeCollaborators, error: collabError } = await supabase
        .from('collaborators')
        .select('profile_id')
        .eq('company_id', companyId)
        .eq('active', true);

      if (collabError || !activeCollaborators || activeCollaborators.length === 0) {
        toast.error('Nenhum profissional ativo encontrado');
        return;
      }

      let successCount = 0;

      for (const collab of activeCollaborators) {
        await supabase
          .from('professional_working_hours')
          .delete()
          .eq('professional_id', collab.profile_id)
          .eq('company_id', companyId);

        const profHours = companyHours.map((h) => ({
          professional_id: collab.profile_id,
          company_id: companyId,
          day_of_week: h.day_of_week,
          open_time: h.open_time,
          close_time: h.close_time,
          lunch_start: h.lunch_start,
          lunch_end: h.lunch_end,
          is_closed: h.is_closed,
        }));

        const { error: insertError } = await supabase
          .from('professional_working_hours')
          .insert(profHours);

        if (!insertError) successCount++;
      }

      toast.success(`Horários aplicados para ${successCount} profissional(is)`);
    } catch (err) {
      toast.error('Erro ao sincronizar horários');
    } finally {
      setSyncing(false);
      setSyncDialogOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <SettingsBreadcrumb current="Agenda" />
      <div>
        <h2 className="text-xl font-display font-bold">Agenda</h2>
        <p className="text-sm text-muted-foreground">Horários de funcionamento, intervalos e exceções</p>
      </div>

      {/* Booking Mode */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" /> Modo de Agendamento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <RadioGroup value={bookingMode} onValueChange={setBookingMode} className="space-y-3">
            <div className={`flex items-start gap-3 p-4 rounded-lg border transition-colors ${bookingMode === 'intelligent' ? 'border-primary bg-primary/5' : 'bg-card'}`}>
              <RadioGroupItem value="intelligent" id="mode-intelligent" className="mt-1" />
              <div className="space-y-1">
                <Label htmlFor="mode-intelligent" className="font-medium cursor-pointer flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  Agendamento Inteligente
                  <span className="text-xs text-primary font-normal">(recomendado)</span>
                </Label>
                <p className="text-xs text-muted-foreground">
                  Os horários disponíveis são calculados dinamicamente com base na duração do serviço e no intervalo entre atendimentos. Evita lacunas inutilizáveis na agenda.
                </p>
                <p className="text-xs text-muted-foreground italic">
                  Ex: Serviço de 30min + 5min intervalo → próximo horário às 07:35
                </p>
              </div>
            </div>
            <div className={`flex items-start gap-3 p-4 rounded-lg border transition-colors ${bookingMode === 'fixed_grid' ? 'border-primary bg-primary/5' : 'bg-card'}`}>
              <RadioGroupItem value="fixed_grid" id="mode-fixed" className="mt-1" />
              <div className="space-y-1">
                <Label htmlFor="mode-fixed" className="font-medium cursor-pointer flex items-center gap-2">
                  <Grid3X3 className="h-4 w-4 text-primary" />
                  Grade Fixa de Horários
                </Label>
                <p className="text-xs text-muted-foreground">
                  Os horários seguem intervalos fixos independentemente da duração do serviço.
                </p>
                <p className="text-xs text-muted-foreground italic">
                  Ex: Intervalo de 30min → 07:00, 07:30, 08:00, 08:30...
                </p>
              </div>
            </div>
          </RadioGroup>

          {bookingMode === 'fixed_grid' && (
            <div className="pl-8 space-y-2">
              <Label className="text-xs">Intervalo da grade</Label>
              <Select value={String(fixedSlotInterval)} onValueChange={(v) => setFixedSlotInterval(Number(v))}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10 minutos</SelectItem>
                  <SelectItem value="15">15 minutos</SelectItem>
                  <SelectItem value="20">20 minutos</SelectItem>
                  <SelectItem value="30">30 minutos</SelectItem>
                  <SelectItem value="45">45 minutos</SelectItem>
                  <SelectItem value="60">60 minutos</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <Button size="sm" onClick={saveBookingMode}>Salvar modo</Button>
        </CardContent>
      </Card>

      {/* Custom Requests */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Inbox className="h-5 w-5" /> Solicitações de Horário Personalizado</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Permitir solicitações fora do horário</Label>
              <p className="text-xs text-muted-foreground">Clientes podem solicitar horários personalizados na página de agendamento</p>
            </div>
            <Switch checked={allowCustomRequests} onCheckedChange={setAllowCustomRequests} />
          </div>
          <Button size="sm" onClick={saveCustomRequests}>Salvar</Button>
        </CardContent>
      </Card>

      {/* Professional Permissions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" /> Permissões dos Profissionais
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Por padrão, profissionais herdam as configurações da empresa. Ative as opções abaixo para permitir personalização individual.
          </p>
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Permitir alterar tipo de agenda</Label>
              <p className="text-xs text-muted-foreground">Inteligente, Grade fixa ou Híbrido</p>
            </div>
            <Switch checked={profPermBookingMode} onCheckedChange={setProfPermBookingMode} />
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="space-y-0.5">
              <Label className="text-sm font-medium">Permitir alterar intervalo da grade</Label>
              <p className="text-xs text-muted-foreground">15, 30, 45 ou 60 minutos</p>
            </div>
            <Switch checked={profPermGridInterval} onCheckedChange={setProfPermGridInterval} />
          </div>
          <Button size="sm" onClick={async () => {
            await supabase.from('companies').update({
              prof_perm_booking_mode: profPermBookingMode,
              prof_perm_grid_interval: profPermGridInterval,
            } as any).eq('id', companyId!);
            toast.success('Permissões salvas');
          }}>Salvar permissões</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Timer className="h-5 w-5" /> Intervalo entre Agendamentos</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Minutos de intervalo</Label>
              <Input type="number" min={0} max={60} value={bufferMinutes} onChange={(e) => setBufferMinutes(parseInt(e.target.value, 10) || 0)} className="w-28" />
            </div>
            <Button size="sm" onClick={saveBuffer}>Salvar</Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">Tempo adicionado após cada agendamento</p>
        </CardContent>
      </Card>

      {/* Business Hours */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Horários de Funcionamento</CardTitle>
            <Button size="sm" variant="outline" onClick={() => setSyncDialogOpen(true)} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Aplicar para todos profissionais
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {hours.map((h) => {
              const hasBreak = !!(h.lunch_start && h.lunch_end);
              return (
                <div key={h.id} className="p-4 rounded-lg border bg-card space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{dayNames[h.day_of_week]}</span>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Aberto</Label>
                      <Switch checked={!h.is_closed} onCheckedChange={(v) => updateHour(h.id, 'is_closed', !v)} />
                    </div>
                  </div>
                  {!h.is_closed && (
                    <div className="space-y-3 pl-1">
                      <div className="flex items-center gap-3">
                        <div className="space-y-1"><Label className="text-xs text-muted-foreground">Início</Label><Input type="time" value={h.open_time || ''} onChange={(e) => updateHour(h.id, 'open_time', e.target.value)} className="w-28" /></div>
                        <div className="space-y-1"><Label className="text-xs text-muted-foreground">Fim</Label><Input type="time" value={h.close_time || ''} onChange={(e) => updateHour(h.id, 'close_time', e.target.value)} className="w-28" /></div>
                      </div>
                      <div className="flex items-center gap-2 pt-1">
                        <Switch checked={hasBreak} onCheckedChange={(v) => { if (v) { updateHour(h.id, 'lunch_start', '12:00'); updateHour(h.id, 'lunch_end', '13:00'); } else { updateHour(h.id, 'lunch_start', null); updateHour(h.id, 'lunch_end', null); } }} />
                        <Label className="text-xs text-muted-foreground">Pausa / Almoço</Label>
                      </div>
                      {hasBreak && (
                        <div className="flex items-center gap-3 pl-1">
                          <div className="space-y-1"><Label className="text-xs text-muted-foreground">Início pausa</Label><Input type="time" value={h.lunch_start || ''} onChange={(e) => updateHour(h.id, 'lunch_start', e.target.value)} className="w-28" /></div>
                          <div className="space-y-1"><Label className="text-xs text-muted-foreground">Fim pausa</Label><Input type="time" value={h.lunch_end || ''} onChange={(e) => updateHour(h.id, 'lunch_end', e.target.value)} className="w-28" /></div>
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

      {/* Exceptions */}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><CalendarIcon className="h-5 w-5" /> Exceções (Feriados / Dias Especiais)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1"><Label className="text-xs">Data</Label><Input type="date" value={newException.date} onChange={(e) => setNewException({ ...newException, date: e.target.value })} /></div>
            <div className="space-y-1"><Label className="text-xs">Motivo</Label><Input value={newException.reason} onChange={(e) => setNewException({ ...newException, reason: e.target.value })} placeholder="Ex: Feriado" /></div>
            <div className="flex items-center gap-2"><Label className="text-xs">Fechado</Label><Switch checked={newException.is_closed} onCheckedChange={(v) => setNewException({ ...newException, is_closed: v })} /></div>
            <Button onClick={addException} size="sm"><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>
          </div>
          <div className="space-y-2">
            {exceptions.map((ex) => (
              <div key={ex.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <span className="font-medium text-sm">{ex.exception_date}</span>
                <span className="text-sm text-muted-foreground">{ex.reason}</span>
                <span className="text-xs">{ex.is_closed ? '🔴 Fechado' : '🟢 Aberto'}</span>
                <Button variant="ghost" size="sm" className="ml-auto" onClick={() => deleteException(ex.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Sync Confirmation Dialog */}
      <AlertDialog open={syncDialogOpen} onOpenChange={setSyncDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Aplicar horário da empresa para todos profissionais?</AlertDialogTitle>
            <AlertDialogDescription>
              Isso irá substituir os horários individuais configurados para cada profissional ativo.
              Profissionais desabilitados não serão afetados. Agendamentos já marcados não serão alterados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={syncing}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSyncScheduleToAll} disabled={syncing}>
              {syncing ? 'Aplicando...' : 'Confirmar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SettingsSchedule;
