import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Clock, Calendar as CalendarIcon, Plus, Trash2, Bell, Cake, Link2, Copy } from 'lucide-react';

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
      // Auto-initialize default hours for all 7 days
      const defaults = Array.from({ length: 7 }, (_, i) => ({
        company_id: companyId!,
        day_of_week: i,
        open_time: '09:00',
        close_time: '18:00',
        lunch_start: '12:00',
        lunch_end: '13:00',
        is_closed: i === 0, // Sunday closed by default
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
    const { data } = await supabase
      .from('companies')
      .select('reminders_enabled, birthday_enabled, birthday_discount_type, birthday_discount_value, slug, business_type')
      .eq('id', companyId!)
      .single();
    if (data) {
      setRemindersEnabled(data.reminders_enabled ?? true);
      setBirthdayEnabled((data as any).birthday_enabled ?? true);
      setBirthdayDiscountType((data as any).birthday_discount_type ?? 'none');
      setBirthdayDiscountValue((data as any).birthday_discount_value ?? 0);
      setCompanySlug((data as any).slug ?? '');
      setCompanyBusinessType((data as any).business_type ?? 'barbershop');
    }
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
          <div className="space-y-3">
            {hours.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Carregando horários...</p>
            )}
            {hours.map((h) => (
              <div key={h.id} className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="w-24 font-medium text-sm">{dayNames[h.day_of_week]}</div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Aberto</Label>
                  <Switch
                    checked={!h.is_closed}
                    onCheckedChange={(v) => updateHour(h.id, 'is_closed', !v)}
                  />
                </div>
                {!h.is_closed && (
                  <>
                    <span className="text-xs text-muted-foreground">Abre:</span>
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
