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
import { Bell, Cake } from 'lucide-react';
import SettingsBreadcrumb from '@/components/SettingsBreadcrumb';

const SettingsAutomation = () => {
  const { companyId } = useAuth();
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [birthdayEnabled, setBirthdayEnabled] = useState(true);
  const [birthdayDiscountType, setBirthdayDiscountType] = useState('none');
  const [birthdayDiscountValue, setBirthdayDiscountValue] = useState(0);

  useEffect(() => {
    if (companyId) fetchData();
  }, [companyId]);

  const fetchData = async () => {
    const { data } = await supabase.from('companies').select('*').eq('id', companyId!).single();
    if (data) {
      setRemindersEnabled(data.reminders_enabled ?? true);
      setBirthdayEnabled((data as any).birthday_enabled ?? true);
      setBirthdayDiscountType((data as any).birthday_discount_type ?? 'none');
      setBirthdayDiscountValue((data as any).birthday_discount_value ?? 0);
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
    await supabase.from('companies').update({ birthday_discount_type: birthdayDiscountType, birthday_discount_value: birthdayDiscountValue } as any).eq('id', companyId!);
    toast.success('Desconto de aniversário salvo');
  };

  return (
    <div className="space-y-6">
      <SettingsBreadcrumb current="Automação" />
      <div>
        <h2 className="text-xl font-display font-bold">Automação</h2>
        <p className="text-sm text-muted-foreground">Lembretes automáticos e mensagens de aniversário</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" /> Lembretes Automáticos</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <p className="font-medium">Enviar lembretes de agendamento</p>
              <p className="text-sm text-muted-foreground">Dispara eventos 24h e 3h antes do horário agendado</p>
            </div>
            <Switch checked={remindersEnabled} onCheckedChange={toggleReminders} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Cake className="h-5 w-5" /> Aniversário de Clientes</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <p className="font-medium">Enviar mensagem de aniversário</p>
              <p className="text-sm text-muted-foreground">Dispara evento 3 dias antes do aniversário via webhook</p>
            </div>
            <Switch checked={birthdayEnabled} onCheckedChange={toggleBirthday} />
          </div>
          {birthdayEnabled && (
            <div className="flex flex-wrap items-end gap-3 p-3 rounded-lg bg-muted/50">
              <div className="space-y-1">
                <Label className="text-xs">Tipo de desconto</Label>
                <Select value={birthdayDiscountType} onValueChange={setBirthdayDiscountType}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sem desconto</SelectItem>
                    <SelectItem value="percentage">Percentual</SelectItem>
                    <SelectItem value="fixed">Valor fixo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {birthdayDiscountType !== 'none' && (
                <div className="space-y-1">
                  <Label className="text-xs">{birthdayDiscountType === 'percentage' ? 'Percentual (%)' : 'Valor (R$)'}</Label>
                  <Input type="number" value={birthdayDiscountValue} onChange={(e) => setBirthdayDiscountValue(Number(e.target.value))} className="w-28" min={0} />
                </div>
              )}
              <Button size="sm" onClick={saveBirthdayDiscount}>Salvar</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsAutomation;
