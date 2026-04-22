import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';
import {
  MessageSquare, Wifi, WifiOff, QrCode, RefreshCw, Send, Plus, Trash2, Power,
  CheckCircle2, AlertCircle, Clock, TrendingUp, Users, Star, FileText, History,
  Smartphone,
} from 'lucide-react';
import {
  getInstance, connectInstance, disconnectInstance, setInstanceStatus, sendTest,
  listAutomations, upsertAutomation, toggleAutomation,
  listTemplates, saveTemplate, deleteTemplate,
  listLogs, listMetrics,
  AUTOMATION_DEFINITIONS,
  type WhatsAppInstance, type WhatsAppAutomation, type WhatsAppTemplate,
  type WhatsAppLog, type WhatsAppMetric, type WhatsAppAutomationTrigger,
} from '@/integrations/whatsapp';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const TEMPLATE_VARIABLES = [
  '{{nome}}', '{{empresa}}', '{{servico}}', '{{profissional}}',
  '{{data}}', '{{hora}}', '{{link_agendamento}}', '{{pontos}}', '{{cashback}}',
];

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  disconnected: { label: 'Desconectado', variant: 'secondary' },
  connecting: { label: 'Conectando', variant: 'outline' },
  connected: { label: 'Conectado', variant: 'default' },
  error: { label: 'Erro', variant: 'destructive' },
};

export default function WhatsAppCenter() {
  const { companyId } = useAuth();
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [instance, setInstance] = useState<WhatsAppInstance | null>(null);
  const [automations, setAutomations] = useState<WhatsAppAutomation[]>([]);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [logs, setLogs] = useState<WhatsAppLog[]>([]);
  const [metrics, setMetrics] = useState<WhatsAppMetric[]>([]);

  const reload = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [i, a, t, l, m] = await Promise.all([
        getInstance(companyId),
        listAutomations(companyId),
        listTemplates(companyId),
        listLogs(companyId, { limit: 100 }),
        listMetrics(companyId, 30),
      ]);
      setInstance(i);
      setAutomations(a);
      setTemplates(t);
      setLogs(l);
      setMetrics(m);
    } catch (e) {
      console.error(e);
      toast.error('Erro ao carregar WhatsApp Center');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, [companyId]);

  if (!companyId) {
    return (
      <div className="p-6">
        <Card><CardContent className="py-10 text-center text-muted-foreground">Selecione uma empresa para acessar o WhatsApp Center.</CardContent></Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <MessageSquare className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">WhatsApp Center</h1>
          <p className="text-sm text-muted-foreground">Conexão, automações e mensagens da sua empresa</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="grid grid-cols-2 md:grid-cols-5 h-auto">
          <TabsTrigger value="overview" className="gap-2"><TrendingUp className="h-4 w-4" />Visão Geral</TabsTrigger>
          <TabsTrigger value="connection" className="gap-2"><Wifi className="h-4 w-4" />Conexão</TabsTrigger>
          <TabsTrigger value="automations" className="gap-2"><RefreshCw className="h-4 w-4" />Automações</TabsTrigger>
          <TabsTrigger value="templates" className="gap-2"><FileText className="h-4 w-4" />Templates</TabsTrigger>
          <TabsTrigger value="history" className="gap-2"><History className="h-4 w-4" />Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><OverviewTab loading={loading} instance={instance} logs={logs} metrics={metrics} /></TabsContent>
        <TabsContent value="connection"><ConnectionTab companyId={companyId} instance={instance} onChange={reload} /></TabsContent>
        <TabsContent value="automations"><AutomationsTab companyId={companyId} automations={automations} templates={templates} onChange={reload} /></TabsContent>
        <TabsContent value="templates"><TemplatesTab companyId={companyId} templates={templates} onChange={reload} /></TabsContent>
        <TabsContent value="history"><HistoryTab companyId={companyId} logs={logs} onChange={reload} /></TabsContent>
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OVERVIEW
// ─────────────────────────────────────────────────────────────────────────────
function OverviewTab({ loading, instance, logs, metrics }: { loading: boolean; instance: WhatsAppInstance | null; logs: WhatsAppLog[]; metrics: WhatsAppMetric[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const sentToday = logs.filter(l => l.created_at.startsWith(today)).length;
  const sentMonth = logs.filter(l => l.created_at.startsWith(month)).length;
  const delivered = logs.filter(l => l.status === 'delivered' || l.status === 'read').length;
  const total = logs.length || 1;
  const replyRate = Math.round((delivered / total) * 100);

  const chartData = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 29; i >= 0; i--) {
      const d = format(subDays(new Date(), i), 'yyyy-MM-dd');
      map.set(d, 0);
    }
    metrics.forEach(m => map.set(m.metric_date, m.sent_count));
    logs.forEach(l => {
      const d = l.created_at.slice(0, 10);
      if (map.has(d)) map.set(d, (map.get(d) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([date, count]) => ({ date, count }));
  }, [metrics, logs]);
  const maxCount = Math.max(1, ...chartData.map(d => d.count));

  if (loading) {
    return <div className="grid grid-cols-2 md:grid-cols-3 gap-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}</div>;
  }

  const statusInfo = STATUS_BADGE[instance?.status ?? 'disconnected'];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <StatCard icon={instance?.status === 'connected' ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <AlertCircle className="h-5 w-5 text-muted-foreground" />} label="Status" value={statusInfo.label} />
        <StatCard icon={<Send className="h-5 w-5 text-primary" />} label="Hoje" value={sentToday.toString()} />
        <StatCard icon={<TrendingUp className="h-5 w-5 text-primary" />} label="Este mês" value={sentMonth.toString()} />
        <StatCard icon={<CheckCircle2 className="h-5 w-5 text-primary" />} label="Taxa entrega" value={`${replyRate}%`} />
        <StatCard icon={<Users className="h-5 w-5 text-primary" />} label="Reativados" value="0" />
        <StatCard icon={<Star className="h-5 w-5 text-primary" />} label="Avaliações" value="0" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Mensagens — últimos 30 dias</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-1 h-40">
            {chartData.map(({ date, count }) => (
              <div key={date} className="flex-1 flex flex-col items-center gap-1" title={`${date}: ${count}`}>
                <div className="w-full bg-primary/20 hover:bg-primary/40 transition-colors rounded-t" style={{ height: `${(count / maxCount) * 100}%`, minHeight: '2px' }} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Últimas mensagens</CardTitle></CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhuma mensagem enviada ainda.</p>
          ) : (
            <div className="space-y-2">
              {logs.slice(0, 5).map(l => (
                <div key={l.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{l.client_name ?? l.phone}</p>
                    <p className="text-xs text-muted-foreground truncate">{l.body}</p>
                  </div>
                  <Badge variant="outline" className="ml-2">{l.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4 space-y-1">
        <div className="flex items-center justify-between">{icon}</div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CONNECTION
// ─────────────────────────────────────────────────────────────────────────────
function ConnectionTab({ companyId, instance, onChange }: { companyId: string; instance: WhatsAppInstance | null; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testMsg, setTestMsg] = useState('Mensagem de teste do Agendaê 🚀');

  const status = instance?.status ?? 'disconnected';

  const handleConnect = async () => {
    setBusy(true);
    try { await connectInstance(companyId); toast.success('Gerando QR Code...'); onChange(); }
    catch (e) { toast.error('Erro ao conectar'); console.error(e); }
    finally { setBusy(false); }
  };
  const handleDisconnect = async () => {
    setBusy(true);
    try { await disconnectInstance(companyId); toast.success('Desconectado'); onChange(); }
    catch { toast.error('Erro ao desconectar'); }
    finally { setBusy(false); }
  };
  const handleSimulateConnected = async () => {
    setBusy(true);
    try { await setInstanceStatus(companyId, 'connected', '+5511999999999'); toast.success('Conectado (mock)'); onChange(); }
    catch { toast.error('Erro'); }
    finally { setBusy(false); }
  };
  const handleTest = async () => {
    if (!testPhone || !testMsg) return;
    try { await sendTest(companyId, testPhone, testMsg); toast.success('Mensagem de teste registrada'); onChange(); }
    catch { toast.error('Falha ao enviar teste'); }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Conexão WhatsApp</CardTitle>
            <CardDescription>Conecte seu número via Evolution API</CardDescription>
          </div>
          <Badge variant={STATUS_BADGE[status].variant}>{STATUS_BADGE[status].label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {status === 'disconnected' && (
          <div className="text-center py-10 space-y-4">
            <div className="h-20 w-20 rounded-full bg-muted mx-auto flex items-center justify-center">
              <WifiOff className="h-10 w-10 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">Nenhum número conectado</p>
              <p className="text-sm text-muted-foreground">Clique abaixo para conectar via QR Code</p>
            </div>
            <Button onClick={handleConnect} disabled={busy} size="lg" className="gap-2">
              <QrCode className="h-4 w-4" />Conectar WhatsApp
            </Button>
          </div>
        )}

        {status === 'connecting' && (
          <div className="text-center py-6 space-y-4">
            <p className="font-medium">Escaneie o QR Code com seu WhatsApp</p>
            {instance?.qr_code ? (
              <img src={instance.qr_code} alt="QR Code" className="mx-auto h-60 w-60 border rounded-lg" />
            ) : <Skeleton className="mx-auto h-60 w-60" />}
            <p className="text-xs text-muted-foreground">WhatsApp → Configurações → Aparelhos conectados → Conectar aparelho</p>
            <div className="flex justify-center gap-2">
              <Button variant="outline" onClick={handleDisconnect} disabled={busy}>Cancelar</Button>
              <Button variant="outline" onClick={handleSimulateConnected} disabled={busy}>Simular conexão (mock)</Button>
            </div>
          </div>
        )}

        {status === 'connected' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <InfoRow icon={<Smartphone className="h-4 w-4" />} label="Número" value={instance?.phone ?? '—'} />
              <InfoRow icon={<Clock className="h-4 w-4" />} label="Última atividade" value={instance?.last_seen_at ? format(new Date(instance.last_seen_at), 'dd/MM HH:mm') : '—'} />
            </div>
            <div className="space-y-3 border-t pt-4">
              <Label>Testar envio</Label>
              <div className="flex gap-2">
                <Input placeholder="Telefone com DDD" value={testPhone} onChange={e => setTestPhone(e.target.value)} />
                <Button onClick={handleTest} className="gap-2"><Send className="h-4 w-4" />Enviar</Button>
              </div>
              <Textarea value={testMsg} onChange={e => setTestMsg(e.target.value)} rows={2} />
            </div>
            <div className="flex gap-2 pt-4 border-t">
              <Button variant="outline" onClick={handleConnect} disabled={busy} className="gap-2"><RefreshCw className="h-4 w-4" />Reconectar</Button>
              <Button variant="destructive" onClick={handleDisconnect} disabled={busy} className="gap-2"><Power className="h-4 w-4" />Desconectar</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="p-3 rounded-lg bg-muted/40">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <p className="font-medium mt-1">{value}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTOMATIONS
// ─────────────────────────────────────────────────────────────────────────────
function AutomationsTab({ companyId, automations, templates, onChange }: { companyId: string; automations: WhatsAppAutomation[]; templates: WhatsAppTemplate[]; onChange: () => void }) {
  const [editing, setEditing] = useState<{ trigger: WhatsAppAutomationTrigger; name: string; existing?: WhatsAppAutomation } | null>(null);

  const findOrInit = (trigger: WhatsAppAutomationTrigger) =>
    automations.find(a => a.trigger === trigger);

  const handleToggle = async (def: typeof AUTOMATION_DEFINITIONS[0], enabled: boolean) => {
    const existing = findOrInit(def.trigger);
    try {
      if (existing) {
        await toggleAutomation(existing.id, enabled);
      } else {
        await upsertAutomation(companyId, {
          trigger: def.trigger, name: def.name, description: def.description,
          delay_minutes: def.defaultDelayMinutes, enabled,
        });
      }
      onChange();
    } catch (e) { toast.error('Erro ao atualizar'); console.error(e); }
  };

  return (
    <div className="space-y-3">
      {AUTOMATION_DEFINITIONS.map(def => {
        const existing = findOrInit(def.trigger);
        const enabled = existing?.enabled ?? false;
        return (
          <Card key={def.trigger} className={enabled ? 'border-primary/40' : ''}>
            <CardContent className="p-4 flex items-center justify-between gap-4">
              <button className="flex-1 text-left min-w-0" onClick={() => setEditing({ trigger: def.trigger, name: def.name, existing })}>
                <p className="font-medium">{def.name}</p>
                <p className="text-sm text-muted-foreground">{def.description}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">Atraso: {formatDelay(existing?.delay_minutes ?? def.defaultDelayMinutes)}</Badge>
                  {existing?.template_id && <Badge variant="secondary" className="text-xs">Template definido</Badge>}
                </div>
              </button>
              <Switch checked={enabled} onCheckedChange={(v) => handleToggle(def, v)} />
            </CardContent>
          </Card>
        );
      })}

      {editing && (
        <AutomationEditor
          companyId={companyId}
          trigger={editing.trigger}
          name={editing.name}
          existing={editing.existing}
          templates={templates}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); onChange(); }}
        />
      )}
    </div>
  );
}

function formatDelay(minutes: number): string {
  if (minutes === 0) return 'imediato';
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} h`;
  return `${Math.round(minutes / 1440)} dias`;
}

function AutomationEditor({ companyId, trigger, name, existing, templates, onClose, onSaved }: {
  companyId: string; trigger: WhatsAppAutomationTrigger; name: string;
  existing?: WhatsAppAutomation; templates: WhatsAppTemplate[];
  onClose: () => void; onSaved: () => void;
}) {
  const [enabled, setEnabled] = useState(existing?.enabled ?? false);
  const [delay, setDelay] = useState(existing?.delay_minutes ?? 0);
  const [windowStart, setWindowStart] = useState(existing?.send_window_start ?? '08:00');
  const [windowEnd, setWindowEnd] = useState(existing?.send_window_end ?? '20:00');
  const [dailyLimit, setDailyLimit] = useState(existing?.daily_limit ?? 100);
  const [templateId, setTemplateId] = useState<string>(existing?.template_id ?? '');
  const [excludeBlocked, setExcludeBlocked] = useState(existing?.exclude_blocked ?? true);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await upsertAutomation(companyId, {
        trigger, name, enabled, delay_minutes: Number(delay),
        send_window_start: windowStart, send_window_end: windowEnd,
        daily_limit: Number(dailyLimit), exclude_blocked: excludeBlocked,
        template_id: templateId || null,
      });
      toast.success('Automação salva');
      onSaved();
    } catch (e) { toast.error('Erro ao salvar'); console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{name}</DialogTitle>
          <DialogDescription>Configure quando e como esta automação dispara.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Ativada</Label>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Atraso (minutos)</Label>
              <Input type="number" min={0} value={delay} onChange={e => setDelay(Number(e.target.value))} />
            </div>
            <div>
              <Label>Limite diário</Label>
              <Input type="number" min={0} value={dailyLimit} onChange={e => setDailyLimit(Number(e.target.value))} />
            </div>
            <div>
              <Label>Janela início</Label>
              <Input type="time" value={windowStart} onChange={e => setWindowStart(e.target.value)} />
            </div>
            <div>
              <Label>Janela fim</Label>
              <Input type="time" value={windowEnd} onChange={e => setWindowEnd(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Template</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger><SelectValue placeholder="Selecionar template" /></SelectTrigger>
              <SelectContent>
                {templates.length === 0 && <SelectItem value="none" disabled>Nenhum template criado</SelectItem>}
                {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Label>Excluir clientes bloqueados</Label>
            <Switch checked={excludeBlocked} onCheckedChange={setExcludeBlocked} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────
function TemplatesTab({ companyId, templates, onChange }: { companyId: string; templates: WhatsAppTemplate[]; onChange: () => void }) {
  const [editing, setEditing] = useState<Partial<WhatsAppTemplate> | null>(null);

  const remove = async (id: string) => {
    if (!confirm('Excluir este template?')) return;
    try { await deleteTemplate(id); toast.success('Excluído'); onChange(); }
    catch { toast.error('Erro ao excluir'); }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setEditing({ name: '', body: '', category: 'general' })} className="gap-2">
          <Plus className="h-4 w-4" />Novo Template
        </Button>
      </div>
      {templates.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-muted-foreground">Nenhum template criado ainda.</CardContent></Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {templates.map(t => (
            <Card key={t.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{t.name}</p>
                    <Badge variant="outline" className="text-xs mt-1">{t.category}</Badge>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(t)}>Editar</Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(t.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-3 whitespace-pre-wrap">{t.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <TemplateEditor
          companyId={companyId}
          template={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); onChange(); }}
        />
      )}
    </div>
  );
}

function TemplateEditor({ companyId, template, onClose, onSaved }: {
  companyId: string; template: Partial<WhatsAppTemplate>; onClose: () => void; onSaved: () => void;
}) {
  const [name, setName] = useState(template.name ?? '');
  const [category, setCategory] = useState(template.category ?? 'general');
  const [body, setBody] = useState(template.body ?? '');
  const [saving, setSaving] = useState(false);

  const insertVar = (v: string) => setBody(b => b + v);

  const preview = body
    .replaceAll('{{nome}}', 'João Silva')
    .replaceAll('{{empresa}}', 'Sua Empresa')
    .replaceAll('{{servico}}', 'Corte de cabelo')
    .replaceAll('{{profissional}}', 'Carlos')
    .replaceAll('{{data}}', '15/05')
    .replaceAll('{{hora}}', '14:00')
    .replaceAll('{{link_agendamento}}', 'https://...')
    .replaceAll('{{pontos}}', '120')
    .replaceAll('{{cashback}}', 'R$ 25,00');

  const save = async () => {
    if (!name.trim() || !body.trim()) { toast.error('Nome e mensagem obrigatórios'); return; }
    setSaving(true);
    try {
      await saveTemplate(companyId, { id: template.id, name, category, body, variables: [] });
      toast.success('Template salvo');
      onSaved();
    } catch (e) { toast.error('Erro ao salvar'); console.error(e); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{template.id ? 'Editar template' : 'Novo template'}</DialogTitle>
        </DialogHeader>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Confirmação" />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">Geral</SelectItem>
                  <SelectItem value="appointment">Agendamento</SelectItem>
                  <SelectItem value="reminder">Lembrete</SelectItem>
                  <SelectItem value="review">Avaliação</SelectItem>
                  <SelectItem value="loyalty">Fidelidade</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Mensagem</Label>
              <Textarea value={body} onChange={e => setBody(e.target.value)} rows={8} placeholder="Olá {{nome}}..." />
            </div>
            <div>
              <Label className="text-xs">Variáveis disponíveis</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {TEMPLATE_VARIABLES.map(v => (
                  <Button key={v} variant="outline" size="sm" className="h-7 text-xs" onClick={() => insertVar(v)}>{v}</Button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Preview</Label>
            <div className="mt-1 p-4 rounded-lg bg-muted/40 text-sm whitespace-pre-wrap min-h-[200px]">
              {preview || <span className="text-muted-foreground">Digite a mensagem...</span>}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HISTORY
// ─────────────────────────────────────────────────────────────────────────────
function HistoryTab({ companyId, logs, onChange }: { companyId: string; logs: WhatsAppLog[]; onChange: () => void }) {
  const [filter, setFilter] = useState<'all' | 'today' | '7d' | '30d' | 'failed'>('all');
  const filtered = useMemo(() => {
    const now = new Date();
    return logs.filter(l => {
      if (filter === 'failed') return l.status === 'failed';
      if (filter === 'today') return l.created_at.startsWith(now.toISOString().slice(0, 10));
      if (filter === '7d') return new Date(l.created_at) >= subDays(now, 7);
      if (filter === '30d') return new Date(l.created_at) >= subDays(now, 30);
      return true;
    });
  }, [logs, filter]);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Histórico de mensagens</CardTitle>
          <div className="flex gap-1 flex-wrap">
            {(['all', 'today', '7d', '30d', 'failed'] as const).map(f => (
              <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => setFilter(f)}>
                {f === 'all' ? 'Todas' : f === 'today' ? 'Hoje' : f === '7d' ? '7 dias' : f === '30d' ? '30 dias' : 'Falhas'}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Nenhuma mensagem encontrada.</p>
        ) : (
          <ScrollArea className="h-[500px]">
            <div className="space-y-2">
              {filtered.map(l => (
                <div key={l.id} className="p-3 rounded-lg border space-y-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="font-medium text-sm truncate">{l.client_name ?? l.phone}</p>
                      <Badge variant="outline" className="text-xs">{l.message_type}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={l.status === 'failed' ? 'destructive' : l.status === 'delivered' || l.status === 'read' ? 'default' : 'secondary'} className="text-xs">{l.status}</Badge>
                      <span className="text-xs text-muted-foreground">{format(new Date(l.created_at), 'dd/MM HH:mm', { locale: ptBR })}</span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{l.body}</p>
                  {l.error_message && <p className="text-xs text-destructive">Erro: {l.error_message}</p>}
                  {l.source && <p className="text-xs text-muted-foreground">Origem: {l.source}</p>}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
