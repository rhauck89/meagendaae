import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Clock, Calendar as CalendarIcon, Plus, Trash2, Bell } from 'lucide-react';

const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

const SettingsPage = () => {
  const { companyId } = useAuth();
  const [hours, setHours] = useState<any[]>([]);
  const [exceptions, setExceptions] = useState<any[]>([]);
  const [newException, setNewException] = useState({ date: '', reason: '', is_closed: true });
  const [remindersEnabled, setRemindersEnabled] = useState(true);

  useEffect(() => {
    if (companyId) {
      fetchHours();
      fetchExceptions();
      fetchReminderSetting();
    }
  }, [companyId]);

  const fetchHours = async () => {
    const { data } = await supabase
      .from('business_hours')
      .select('*')
      .eq('company_id', companyId!)
      .order('day_of_week');
    if (data) setHours(data);
  };

  const fetchExceptions = async () => {
    const { data } = await supabase
      .from('business_exceptions')
      .select('*')
      .eq('company_id', companyId!)
      .order('exception_date');
    if (data) setExceptions(data);
  };

  const fetchReminderSetting = async () => {
    const { data } = await supabase
      .from('companies')
      .select('reminders_enabled')
      .eq('id', companyId!)
      .single();
    if (data) setRemindersEnabled(data.reminders_enabled ?? true);
  };

  const toggleReminders = async (enabled: boolean) => {
    setRemindersEnabled(enabled);
    await supabase
      .from('companies')
      .update({ reminders_enabled: enabled } as any)
      .eq('id', companyId!);
    toast.success(enabled ? 'Lembretes ativados' : 'Lembretes desativados');
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
        <p className="text-sm text-muted-foreground">Horários de funcionamento, exceções e lembretes</p>
      </div>

      {/* Reminder Settings */}
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
            <Switch
              checked={remindersEnabled}
              onCheckedChange={toggleReminders}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" /> Horários de Funcionamento
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {hours.map((h) => (
              <div key={h.id} className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="w-24 font-medium text-sm">{dayNames[h.day_of_week]}</div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Fechado</Label>
                  <Switch
                    checked={h.is_closed}
                    onCheckedChange={(v) => updateHour(h.id, 'is_closed', v)}
                  />
                </div>
                {!h.is_closed && (
                  <>
                    <Input
                      type="time"
                      value={h.open_time || ''}
                      onChange={(e) => updateHour(h.id, 'open_time', e.target.value)}
                      className="w-28"
                    />
                    <span className="text-xs text-muted-foreground">Almoço:</span>
                    <Input
                      type="time"
                      value={h.lunch_start || ''}
                      onChange={(e) => updateHour(h.id, 'lunch_start', e.target.value)}
                      className="w-28"
                    />
                    <span className="text-xs">-</span>
                    <Input
                      type="time"
                      value={h.lunch_end || ''}
                      onChange={(e) => updateHour(h.id, 'lunch_end', e.target.value)}
                      className="w-28"
                    />
                    <span className="text-xs text-muted-foreground">Fecha:</span>
                    <Input
                      type="time"
                      value={h.close_time || ''}
                      onChange={(e) => updateHour(h.id, 'close_time', e.target.value)}
                      className="w-28"
                    />
                  </>
                )}
              </div>
            ))}
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
