import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Webhook, Send, History } from 'lucide-react';
import { toast } from 'sonner';

const eventTypes = [
  { value: 'appointment_created', label: 'Agendamento Criado', desc: 'Quando um novo agendamento é feito' },
  { value: 'appointment_cancelled', label: 'Agendamento Cancelado', desc: 'Quando um agendamento é cancelado' },
  { value: 'appointment_reminder', label: 'Lembrete', desc: 'Lembrete antes do horário' },
  { value: 'client_return_due', label: 'Retorno do Cliente', desc: 'Quando o cliente deve retornar' },
  { value: 'birthday_message', label: 'Aniversário', desc: 'Mensagem de aniversário do cliente' },
  { value: 'slot_available', label: 'Vaga Disponível', desc: 'Quando uma vaga é liberada' },
] as const;

const Automations = () => {
  const { companyId } = useAuth();
  const [configs, setConfigs] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (companyId) {
      fetchConfigs();
      fetchEvents();
    }
  }, [companyId]);

  const fetchConfigs = async () => {
    const { data } = await supabase
      .from('webhook_configs')
      .select('*')
      .eq('company_id', companyId!);
    if (data) {
      setConfigs(data);
      const urlMap: Record<string, string> = {};
      data.forEach((c) => { urlMap[c.event_type] = c.url; });
      setUrls(urlMap);
    }
  };

  const fetchEvents = async () => {
    const { data } = await supabase
      .from('webhook_events')
      .select('*')
      .eq('company_id', companyId!)
      .order('created_at', { ascending: false })
      .limit(20);
    if (data) setEvents(data);
  };

  const saveWebhook = async (eventType: string) => {
    const url = urls[eventType];
    if (!url?.trim()) return toast.error('Informe a URL');
    const existing = configs.find((c) => c.event_type === eventType);
    if (existing) {
      await supabase.from('webhook_configs').update({ url }).eq('id', existing.id);
    } else {
      await supabase.from('webhook_configs').insert({
        company_id: companyId!,
        event_type: eventType as any,
        url,
      });
    }
    toast.success('Webhook salvo');
    fetchConfigs();
  };

  const testWebhook = async (eventType: string) => {
    const url = urls[eventType];
    if (!url) return toast.error('Configure a URL primeiro');
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: eventType, test: true, timestamp: new Date().toISOString() }),
      });
      toast.success('Teste enviado!');
    } catch {
      toast.error('Erro ao enviar teste');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-display font-bold">Automações & Webhooks</h2>
        <p className="text-sm text-muted-foreground">Configure URLs para receber eventos automaticamente</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {eventTypes.map((et) => (
          <Card key={et.value}>
            <CardContent className="p-5">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1">
                  <p className="font-semibold">{et.label}</p>
                  <p className="text-sm text-muted-foreground">{et.desc}</p>
                </div>
                <div className="flex gap-2 flex-1">
                  <Input
                    value={urls[et.value] || ''}
                    onChange={(e) => setUrls({ ...urls, [et.value]: e.target.value })}
                    placeholder="https://sua-url.com/webhook"
                    className="flex-1"
                  />
                  <Button size="sm" onClick={() => saveWebhook(et.value)}>Salvar</Button>
                  <Button size="sm" variant="outline" onClick={() => testWebhook(et.value)}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" /> Últimos Eventos
          </CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum evento registrado</p>
          ) : (
            <div className="space-y-2">
              {events.map((ev) => (
                <div key={ev.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 text-sm">
                  <Badge variant="outline">{ev.event_type}</Badge>
                  <span className="text-muted-foreground flex-1 truncate">
                    {JSON.stringify(ev.payload).slice(0, 80)}
                  </span>
                  <Badge variant={ev.status === 'sent' ? 'default' : 'secondary'}>{ev.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Automations;
