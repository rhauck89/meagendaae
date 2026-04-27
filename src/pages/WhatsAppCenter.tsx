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
import { handleError } from '@/lib/error-handler';
import {
  MessageSquare, Wifi, WifiOff, QrCode, RefreshCw, Send, Plus, Trash2, Power,
  CheckCircle2, AlertCircle, Clock, TrendingUp, Users, Star, FileText, History,
  Smartphone, Sparkles, Inbox, MessageCircle, Loader2,
} from 'lucide-react';
import {
  getInstance, connectInstance, disconnectInstance, setInstanceStatus, sendTest, getStatus, getQrCode,
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
  pending: { label: 'Pendente', variant: 'outline' },
  connected: { label: 'Conectado', variant: 'default' },
  closed: { label: 'Fechado', variant: 'destructive' },
  error: { label: 'Erro', variant: 'destructive' },
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pendente',
  sent: 'Enviada',
  delivered: 'Entregue',
  read: 'Lida',
  failed: 'Falhou',
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
      handleError(e, { area: 'whatsapp.center.load', onRetry: reload });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, [companyId]);

  if (!companyId) {
    return (
      <div className="p-4 md:p-6">
        <Card>
          <CardContent className="py-16 flex flex-col items-center text-center gap-3">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
              <MessageSquare className="h-7 w-7 text-muted-foreground" />
            </div>
            <div>
              <p className="font-medium">Selecione uma empresa</p>
              <p className="text-sm text-muted-foreground">Escolha um estabelecimento para acessar o WhatsApp Center.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <MessageSquare className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">WhatsApp Center</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Conexão, automações e mensagens — tudo em um só lugar
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        {/* Mobile: scroll horizontal; Desktop: grid */}
        <div className="-mx-3 sm:mx-0 overflow-x-auto">
          <TabsList className="inline-flex w-max md:w-full md:grid md:grid-cols-5 h-auto px-3 sm:px-0">
            <TabsTrigger value="overview" className="gap-2 whitespace-nowrap">
              <TrendingUp className="h-4 w-4" /><span className="hidden xs:inline sm:inline">Visão Geral</span><span className="xs:hidden sm:hidden">Geral</span>
            </TabsTrigger>
            <TabsTrigger value="connection" className="gap-2 whitespace-nowrap">
              <Wifi className="h-4 w-4" />Conexão
            </TabsTrigger>
            <TabsTrigger value="automations" className="gap-2 whitespace-nowrap">
              <RefreshCw className="h-4 w-4" />Automações
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2 whitespace-nowrap">
              <FileText className="h-4 w-4" />Templates
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2 whitespace-nowrap">
              <History className="h-4 w-4" />Histórico
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview"><OverviewTab loading={loading} instance={instance} logs={logs} metrics={metrics} /></TabsContent>
        <TabsContent value="connection"><ConnectionTab companyId={companyId} instance={instance} loading={loading} onChange={reload} /></TabsContent>
        <TabsContent value="automations"><AutomationsTab companyId={companyId} automations={automations} templates={templates} loading={loading} onChange={reload} /></TabsContent>
        <TabsContent value="templates"><TemplatesTab companyId={companyId} templates={templates} loading={loading} onChange={reload} /></TabsContent>
        <TabsContent value="history"><HistoryTab companyId={companyId} logs={logs} loading={loading} onChange={reload} /></TabsContent>
      </Tabs>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Generic empty state
// ─────────────────────────────────────────────────────────────────────────────
function EmptyState({ icon, title, description, action }: {
  icon: React.ReactNode; title: string; description: string; action?: React.ReactNode;
}) {
  return (
    <div className="py-12 px-4 flex flex-col items-center text-center gap-3">
      <div className="h-16 w-16 rounded-full bg-muted/60 flex items-center justify-center text-muted-foreground">
        {icon}
      </div>
      <div className="max-w-sm">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
      {action}
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
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 md:h-28 rounded-lg" />)}
        </div>
        <Skeleton className="h-48 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  const statusInfo = STATUS_BADGE[instance?.status ?? 'disconnected'];
  const isConnected = instance?.status === 'connected';

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        <StatCard
          icon={isConnected ? <CheckCircle2 className="h-5 w-5 text-primary" /> : <AlertCircle className="h-5 w-5 text-muted-foreground" />}
          label="Status"
          value={statusInfo.label}
        />
        <StatCard icon={<Send className="h-5 w-5 text-primary" />} label="Enviadas hoje" value={sentToday.toString()} />
        <StatCard icon={<TrendingUp className="h-5 w-5 text-primary" />} label="Este mês" value={sentMonth.toString()} />
        <StatCard icon={<CheckCircle2 className="h-5 w-5 text-primary" />} label="Taxa de entrega" value={`${replyRate}%`} />
        <StatCard icon={<Users className="h-5 w-5 text-primary" />} label="Reativados" value="0" />
        <StatCard icon={<Star className="h-5 w-5 text-primary" />} label="Avaliações" value="0" />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Mensagens — últimos 30 dias</CardTitle>
          <CardDescription className="text-xs">Volume diário de envios</CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <EmptyState
              icon={<TrendingUp className="h-7 w-7" />}
              title="Sem dados ainda"
              description="As mensagens enviadas aparecerão neste gráfico ao longo dos próximos dias."
            />
          ) : (
            <div className="flex items-end gap-[2px] sm:gap-1 h-32 md:h-40">
              {chartData.map(({ date, count }) => (
                <div key={date} className="flex-1 flex flex-col items-center gap-1 group" title={`${format(new Date(date), 'dd/MM')}: ${count} mensagem(ns)`}>
                  <div
                    className="w-full bg-primary/20 group-hover:bg-primary/50 transition-colors rounded-t"
                    style={{ height: `${(count / maxCount) * 100}%`, minHeight: '2px' }}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Últimas mensagens</CardTitle>
          <CardDescription className="text-xs">As 5 mensagens mais recentes</CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <EmptyState
              icon={<Inbox className="h-7 w-7" />}
              title="Nenhuma mensagem enviada ainda"
              description="Conecte seu WhatsApp e ative as automações para começar a enviar mensagens."
            />
          ) : (
            <div className="space-y-2">
              {logs.slice(0, 5).map(l => (
                <div key={l.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{l.client_name ?? l.phone}</p>
                    <p className="text-xs text-muted-foreground truncate">{l.body}</p>
                  </div>
                  <Badge variant="outline" className="ml-2 shrink-0 text-xs">{STATUS_LABEL[l.status] ?? l.status}</Badge>
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
      <CardContent className="p-3 md:p-4 space-y-1">
        <div className="flex items-center justify-between">{icon}</div>
        <p className="text-[11px] sm:text-xs text-muted-foreground leading-tight">{label}</p>
        <p className="text-lg sm:text-xl font-bold truncate">{value}</p>
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CONNECTION
// ─────────────────────────────────────────────────────────────────────────────
function ConnectionTab({ companyId, instance, loading, onChange }: { companyId: string; instance: WhatsAppInstance | null; loading: boolean; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testMsg, setTestMsg] = useState('Mensagem de teste do Agendaê 🚀');
  const [qrTimeout, setQrTimeout] = useState(false);

  const status = instance?.status ?? 'disconnected';

  // Polling for status
  useEffect(() => {
    if (!companyId || status === 'disconnected' || status === 'connected' || status === 'error') return;

    let timeoutId: NodeJS.Timeout;
    if (status === 'connecting' || status === 'pending') {
      // Set a 60-second timeout to show retry if QR doesn't appear
      timeoutId = setTimeout(() => {
        if (!instance?.qr_code) setQrTimeout(true);
      }, 60000);
    }

    const interval = setInterval(async () => {
      try {
        const res = await getStatus(companyId);
        // If status changed to connected or disconnected, refresh parent
        if (res.mappedStatus !== status) {
          onChange();
        }
        // If we have no QR and we are connecting, try to fetch it
        if (res.mappedStatus === 'connecting' && !instance?.qr_code) {
           await getQrCode(companyId);
           onChange();
        }
      } catch (e) {
        console.error('Error polling WhatsApp status:', e);
      }
    }, 5000);

    return () => {
      clearInterval(interval);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [status, companyId, instance?.qr_code]);

  const handleConnect = async () => {
    if (busy) return;
    setBusy(true);
    setQrTimeout(false);
    try { 
      // Step 1: Create instance in Evolution API and Save to DB
      // The Edge Function already handles destroying old instance if action='create'
      console.log('Step 1: Creating instance...');
      await connectInstance(companyId); 
      
      // Step 2: Immediate UI refresh to show "Generating QR..."
      onChange();
      
      // Step 3: Fetch the actual QR code base64
      console.log('Step 2: Fetching QR code...');
      toast.info('Iniciando conexão...', { description: 'Gerando QR Code oficial Evolution API.' }); 
      
      // Small delay to allow Evolution to be ready
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      try {
        await getQrCode(companyId);
        toast.success('QR Code gerado!', { description: 'Escaneie agora para conectar.' });
      } catch (qrError) {
        console.warn('QR Code fetch failed initially, polling will handle it:', qrError);
      }
      
      onChange(); 
    }
    catch (e) { 
      console.error('Connection flow failed:', e);
      handleError(e, { area: 'whatsapp.connect' }); 
    }
    finally { setBusy(false); }
  };

  const handleReconnect = async () => {
    if (busy) return;
    const confirmed = confirm('Deseja realmente reconectar? Isso irá derrubar a conexão atual e gerar um novo QR Code.');
    if (!confirmed) return;
    
    setBusy(true);
    setQrTimeout(false);
    try {
      toast.info('Reiniciando instância...', { description: 'Isso pode levar alguns segundos.' });
      // Calling connectInstance handles cleanup + fresh creation in Edge Function
      await connectInstance(companyId);
      onChange();
      
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 4000));
      await getQrCode(companyId);
      toast.success('Nova instância pronta', { description: 'Escaneie o novo QR Code.' });
      onChange();
    } catch (e) {
      handleError(e, { area: 'whatsapp.reconnect' });
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    try { await disconnectInstance(companyId); toast.success('WhatsApp desconectado'); onChange(); }
    catch (e) { handleError(e, { area: 'whatsapp.disconnect' }); }
    finally { setBusy(false); }
  };

  const handleTest = async () => {
    if (!testPhone.trim()) { toast.error('Informe um telefone para testar'); return; }
    if (!testMsg.trim()) { toast.error('Digite uma mensagem'); return; }
    setBusy(true);
    try { await sendTest(companyId, testPhone, testMsg); toast.success('Mensagem de teste registrada', { description: 'Verifique o histórico para acompanhar a entrega.' }); onChange(); }
    catch (e) { handleError(e, { area: 'whatsapp.sendTest' }); }
    finally { setBusy(false); }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-10" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="min-w-0">
            <CardTitle>Conexão WhatsApp</CardTitle>
            <CardDescription>Conecte seu número escaneando o QR Code</CardDescription>
          </div>
          <Badge variant={STATUS_BADGE[status].variant} className="self-start sm:self-auto">{STATUS_BADGE[status].label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {status === 'disconnected' && (
          <EmptyState
            icon={<WifiOff className="h-7 w-7" />}
            title="Nenhum número conectado"
            description="Conecte um número de WhatsApp para enviar mensagens automáticas para seus clientes."
            action={
              <Button onClick={handleConnect} disabled={busy} size="lg" className="gap-2 mt-2">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}
                Conectar WhatsApp
              </Button>
            }
          />
        )}

        {(status === 'connecting' || status === 'pending') && (
          <div className="text-center py-6 space-y-4">
            <p className="font-medium">
              {!instance?.qr_code ? 'Gerando QR Code...' : 'Escaneie o QR Code com seu WhatsApp'}
            </p>
            {instance?.qr_code ? (
              <img src={instance.qr_code} alt="QR Code de conexão" className="mx-auto h-48 w-48 sm:h-60 sm:w-60 border rounded-lg shadow-sm" />
            ) : (
              <div className="mx-auto h-48 w-48 sm:h-60 sm:w-60 border rounded-lg flex flex-col items-center justify-center gap-2 bg-muted/30">
                {qrTimeout ? (
                  <div className="px-4 text-center space-y-3">
                    <AlertCircle className="h-8 w-8 mx-auto text-destructive" />
                    <p className="text-xs text-muted-foreground">Demorando mais que o esperado...</p>
                    <Button variant="outline" size="sm" onClick={handleConnect} disabled={busy}>
                      Tentar novamente
                    </Button>
                  </div>
                ) : (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Isso pode levar até 30 segundos</p>
                  </>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground px-2">
              Abra o WhatsApp → Configurações → Aparelhos conectados → Conectar aparelho
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-2">
              <Button variant="outline" onClick={handleDisconnect} disabled={busy}>Cancelar</Button>
              {instance?.qr_code && (
                <Button variant="ghost" onClick={handleConnect} disabled={busy} size="sm">
                  Novo QR Code
                </Button>
              )}
            </div>
          </div>
        )}

        {status === 'error' && (
          <EmptyState
            icon={<AlertCircle className="h-7 w-7 text-destructive" />}
            title="Erro na conexão"
            description="Não conseguimos manter a conexão ativa. Tente reconectar abaixo."
            action={
              <Button onClick={handleConnect} disabled={busy} className="gap-2 mt-2">
                <RefreshCw className="h-4 w-4" />Reconectar agora
              </Button>
            }
          />
        )}

        {status === 'connected' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <InfoRow icon={<Users className="h-4 w-4" />} label="Nome do perfil" value={instance?.profile_name ?? '—'} />
              <InfoRow icon={<Smartphone className="h-4 w-4" />} label="Número conectado" value={instance?.phone ?? '—'} />
              <InfoRow
                icon={<Clock className="h-4 w-4" />}
                label="Última atividade"
                value={instance?.last_seen_at ? format(new Date(instance.last_seen_at), "dd/MM 'às' HH:mm", { locale: ptBR }) : '—'}
              />
            </div>
            <div className="space-y-3 border-t pt-4">
              <div>
                <Label className="text-sm font-medium">Testar envio</Label>
                <p className="text-xs text-muted-foreground mt-0.5">Envie uma mensagem para validar a conexão</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="Telefone com DDD (ex.: 11999998888)"
                  value={testPhone}
                  onChange={e => setTestPhone(e.target.value)}
                  inputMode="tel"
                  className="flex-1"
                />
                <Button onClick={handleTest} disabled={busy} className="gap-2 sm:w-auto">
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Enviar teste
                </Button>
              </div>
              <Textarea value={testMsg} onChange={e => setTestMsg(e.target.value)} rows={2} placeholder="Sua mensagem..." />
            </div>
            <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t">
              <Button variant="outline" onClick={handleReconnect} disabled={busy} className="gap-2">
                <RefreshCw className="h-4 w-4" />Reconectar
              </Button>
              <Button variant="destructive" onClick={handleDisconnect} disabled={busy} className="gap-2">
                <Power className="h-4 w-4" />Desconectar
              </Button>
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
      <p className="font-medium mt-1 truncate">{value}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTOMATIONS
// ─────────────────────────────────────────────────────────────────────────────
function AutomationsTab({ companyId, automations, templates, loading, onChange }: { companyId: string; automations: WhatsAppAutomation[]; templates: WhatsAppTemplate[]; loading: boolean; onChange: () => void }) {
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
      toast.success(enabled ? 'Automação ativada' : 'Automação desativada');
      onChange();
    } catch (e) { handleError(e, { area: 'whatsapp.automation.toggle' }); }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground px-1">
        Ative as mensagens que serão enviadas automaticamente para seus clientes em momentos-chave.
      </p>
      {AUTOMATION_DEFINITIONS.map(def => {
        const existing = findOrInit(def.trigger);
        const enabled = existing?.enabled ?? false;
        return (
          <Card key={def.trigger} className={enabled ? 'border-primary/40' : ''}>
            <CardContent className="p-4 flex items-start sm:items-center justify-between gap-3 sm:gap-4">
              <button
                className="flex-1 text-left min-w-0"
                onClick={() => setEditing({ trigger: def.trigger, name: def.name, existing })}
              >
                <p className="font-medium">{def.name}</p>
                <p className="text-sm text-muted-foreground">{def.description}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge variant="outline" className="text-xs">Atraso: {formatDelay(existing?.delay_minutes ?? def.defaultDelayMinutes)}</Badge>
                  {existing?.template_id
                    ? <Badge variant="secondary" className="text-xs">Template definido</Badge>
                    : <Badge variant="outline" className="text-xs text-muted-foreground">Sem template</Badge>}
                </div>
              </button>
              <Switch checked={enabled} onCheckedChange={(v) => handleToggle(def, v)} className="shrink-0 mt-1 sm:mt-0" />
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
    } catch (e) { handleError(e, { area: 'whatsapp.automation.save' }); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{name}</DialogTitle>
          <DialogDescription>Configure quando e como esta automação dispara para seus clientes.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label>Ativada</Label>
              <p className="text-xs text-muted-foreground">Ligue para começar a enviar</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Atraso (minutos)</Label>
              <Input type="number" min={0} value={delay} onChange={e => setDelay(Number(e.target.value))} inputMode="numeric" />
            </div>
            <div>
              <Label>Limite diário</Label>
              <Input type="number" min={0} value={dailyLimit} onChange={e => setDailyLimit(Number(e.target.value))} inputMode="numeric" />
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
            <Label>Template da mensagem</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger><SelectValue placeholder="Selecionar template" /></SelectTrigger>
              <SelectContent>
                {templates.length === 0 && <SelectItem value="none" disabled>Nenhum template criado — crie na aba Templates</SelectItem>}
                {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Excluir clientes bloqueados</Label>
              <p className="text-xs text-muted-foreground">Não envia para quem você bloqueou</p>
            </div>
            <Switch checked={excludeBlocked} onCheckedChange={setExcludeBlocked} />
          </div>
        </div>
        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">Cancelar</Button>
          <Button onClick={save} disabled={saving} className="w-full sm:w-auto gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATES
// ─────────────────────────────────────────────────────────────────────────────
function TemplatesTab({ companyId, templates, loading, onChange }: { companyId: string; templates: WhatsAppTemplate[]; loading: boolean; onChange: () => void }) {
  const [editing, setEditing] = useState<Partial<WhatsAppTemplate> | null>(null);

  const remove = async (id: string) => {
    if (!confirm('Excluir este template? Esta ação não pode ser desfeita.')) return;
    try { await deleteTemplate(id); toast.success('Template excluído'); onChange(); }
    catch (e) { handleError(e, { area: 'whatsapp.template.delete' }); }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-40 ml-auto" />
        <div className="grid sm:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Crie modelos reutilizáveis com variáveis dinâmicas como nome, serviço e horário.
        </p>
        <Button onClick={() => setEditing({ name: '', body: '', category: 'general' })} className="gap-2 w-full sm:w-auto">
          <Plus className="h-4 w-4" />Novo Template
        </Button>
      </div>
      {templates.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <EmptyState
              icon={<MessageCircle className="h-7 w-7" />}
              title="Nenhum template criado"
              description="Crie seu primeiro template para padronizar as mensagens das suas automações."
              action={
                <Button onClick={() => setEditing({ name: '', body: '', category: 'general' })} className="gap-2 mt-2">
                  <Plus className="h-4 w-4" />Criar primeiro template
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {templates.map(t => (
            <Card key={t.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{t.name}</p>
                    <Badge variant="outline" className="text-xs mt-1">{t.category}</Badge>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(t)}>Editar</Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(t.id)} aria-label="Excluir template">
                      <Trash2 className="h-4 w-4" />
                    </Button>
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
    .replace(/\{\{nome\}\}/g, 'João Silva')
    .replace(/\{\{empresa\}\}/g, 'Sua Empresa')
    .replace(/\{\{servico\}\}/g, 'Corte de cabelo')
    .replace(/\{\{profissional\}\}/g, 'Carlos')
    .replace(/\{\{data\}\}/g, '15/05')
    .replace(/\{\{hora\}\}/g, '14:00')
    .replace(/\{\{link_agendamento\}\}/g, 'https://...')
    .replace(/\{\{pontos\}\}/g, '120')
    .replace(/\{\{cashback\}\}/g, 'R$ 25,00');

  const save = async () => {
    if (!name.trim()) { toast.error('Dê um nome ao template'); return; }
    if (!body.trim()) { toast.error('Escreva a mensagem do template'); return; }
    setSaving(true);
    try {
      await saveTemplate(companyId, { id: template.id, name, category, body, variables: [] });
      toast.success('Template salvo');
      onSaved();
    } catch (e) { handleError(e, { area: 'whatsapp.template.save' }); }
    finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template.id ? 'Editar template' : 'Novo template'}</DialogTitle>
          <DialogDescription>Use variáveis para personalizar automaticamente cada mensagem.</DialogDescription>
        </DialogHeader>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="Ex.: Confirmação de agendamento" />
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
              <Textarea value={body} onChange={e => setBody(e.target.value)} rows={8} placeholder="Olá {{nome}}, seu horário para {{servico}} está confirmado em {{data}} às {{hora}}." />
            </div>
            <div>
              <Label className="text-xs">Variáveis disponíveis (clique para inserir)</Label>
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
              {preview || <span className="text-muted-foreground">Digite a mensagem para visualizar o preview...</span>}
            </div>
          </div>
        </div>
        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">Cancelar</Button>
          <Button onClick={save} disabled={saving} className="w-full sm:w-auto gap-2">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HISTORY
// ─────────────────────────────────────────────────────────────────────────────
function HistoryTab({ companyId, logs, loading, onChange }: { companyId: string; logs: WhatsAppLog[]; loading: boolean; onChange: () => void }) {
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

  if (loading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-3">
          <div>
            <CardTitle className="text-base">Histórico de mensagens</CardTitle>
            <CardDescription className="text-xs">Acompanhe o status de entrega de cada envio</CardDescription>
          </div>
          <div className="-mx-1 overflow-x-auto">
            <div className="flex gap-1 px-1 w-max">
              {(['all', 'today', '7d', '30d', 'failed'] as const).map(f => (
                <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} onClick={() => setFilter(f)} className="whitespace-nowrap">
                  {f === 'all' ? 'Todas' : f === 'today' ? 'Hoje' : f === '7d' ? '7 dias' : f === '30d' ? '30 dias' : 'Falhas'}
                </Button>
              ))}
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {filtered.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-7 w-7" />}
            title={filter === 'all' ? 'Nenhuma mensagem ainda' : 'Nada por aqui'}
            description={
              filter === 'failed'
                ? 'Boa notícia! Nenhuma mensagem falhou neste período.'
                : 'Não encontramos mensagens para este filtro. Tente ampliar o período.'
            }
          />
        ) : (
          <ScrollArea className="h-[420px] sm:h-[500px]">
            <div className="space-y-2 pr-3">
              {filtered.map(l => (
                <div key={l.id} className="p-3 rounded-lg border space-y-1">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="font-medium text-sm truncate">{l.client_name ?? l.phone}</p>
                      <Badge variant="outline" className="text-xs">{l.message_type}</Badge>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge
                        variant={l.status === 'failed' ? 'destructive' : l.status === 'delivered' || l.status === 'read' ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {STATUS_LABEL[l.status] ?? l.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(l.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                      </span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">{l.body}</p>
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
