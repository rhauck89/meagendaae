import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Clock, Calendar as CalendarIcon, Plus, Trash2, Timer } from 'lucide-react';
import SettingsBreadcrumb from '@/components/SettingsBreadcrumb';

const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const SettingsSchedule = () => {
  const { companyId } = useAuth();
  const [hours, setHours] = useState<any[]>([]);
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [newException, setNewException] = useState({ date: '', reason: '', is_closed: true });
  const [bufferMinutes, setBufferMinutes] = useState(0);

  useEffect(() => {
    if (companyId) { fetchHours(); fetchExceptions(); fetchBuffer(); }
  }, [companyId]);

  const fetchBuffer = async () => {
    const { data } = await supabase.from('companies').select('buffer_minutes').eq('id', companyId!).single();
    if (data) setBufferMinutes((data as any).buffer_minutes ?? 0);
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
    await supabase.from('business_hours').update({ [field]: value }).eq('id', id);
    fetchHours();
  };

  const saveBuffer = async () => {
    await supabase.from('companies').update({ buffer_minutes: bufferMinutes } as any).eq('id', companyId!);
    toast.success('Intervalo salvo');
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

  return (
    <div className="space-y-6">
      <SettingsBreadcrumb current="Agenda" />
      <div>
        <h2 className="text-xl font-display font-bold">Agenda</h2>
        <p className="text-sm text-muted-foreground">Horários de funcionamento, intervalos e exceções</p>
      </div>

      {/* Buffer */}
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
        <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="h-5 w-5" /> Horários de Funcionamento</CardTitle></CardHeader>
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
    </div>
  );
};

export default SettingsSchedule;
