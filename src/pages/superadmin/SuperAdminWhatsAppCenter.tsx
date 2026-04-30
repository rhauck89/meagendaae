import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  MessageSquare, Wifi, Send, Plus, Trash2, RefreshCw, 
  CheckCircle2, AlertCircle, TrendingUp, History, 
  FileText, Zap, Loader2, Smartphone
} from 'lucide-react';
import { 
  getPlatformSettings, connectPlatformInstance, disconnectPlatformInstance,
  sendPlatformTest, listPlatformTemplates, savePlatformTemplate,
  listPlatformAutomations, togglePlatformAutomation, listPlatformLogs,
  getPlatformQrCode, getPlatformStatus,
  type PlatformWhatsAppSettings, type PlatformWhatsAppTemplate,
  type PlatformWhatsAppAutomation, type PlatformWhatsAppLog
} from '@/integrations/whatsapp/platformService';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

export default function SuperAdminWhatsAppCenter() {
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<PlatformWhatsAppSettings | null>(null);
  const [templates, setTemplates] = useState<PlatformWhatsAppTemplate[]>([]);
  const [automations, setAutomations] = useState<PlatformWhatsAppAutomation[]>([]);
  const [logs, setLogs] = useState<PlatformWhatsAppLog[]>([]);

  const reload = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [s, t, a, l] = await Promise.all([
        getPlatformSettings(),
        listPlatformTemplates(),
        listPlatformAutomations(),
        listPlatformLogs(),
      ]);
      setSettings(s);
      setTemplates(t);
      setAutomations(a);
      setLogs(l);
    } catch (e) {
      console.error('[SUPER_ADMIN_WHATSAPP] Reload error:', e);
      toast.error('Erro ao carregar dados do WhatsApp Center');
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { reload(); }, [reload]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
          <MessageSquare className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">WhatsApp Center Platform</h1>
          <p className="text-muted-foreground">Comunicação central da Agendaê para empresas e administradores</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 h-auto">
          <TabsTrigger value="overview" className="gap-2"><TrendingUp className="h-4 w-4" />Visão Geral</TabsTrigger>
          <TabsTrigger value="connection" className="gap-2"><Wifi className="h-4 w-4" />Conexão</TabsTrigger>
          <TabsTrigger value="automations" className="gap-2"><Zap className="h-4 w-4" />Automações</TabsTrigger>
          <TabsTrigger value="templates" className="gap-2"><FileText className="h-4 w-4" />Templates</TabsTrigger>
          <TabsTrigger value="history" className="gap-2"><History className="h-4 w-4" />Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <OverviewTab settings={settings} logs={logs} loading={loading} />
        </TabsContent>
        <TabsContent value="connection">
          <ConnectionTab settings={settings} loading={loading} onReload={() => reload(true)} />
        </TabsContent>
        <TabsContent value="automations">
          <AutomationsTab automations={automations} templates={templates} loading={loading} onReload={() => reload(true)} />
        </TabsContent>
        <TabsContent value="templates">
          <TemplatesTab templates={templates} loading={loading} onReload={() => reload(true)} />
        </TabsContent>
        <TabsContent value="history">
          <HistoryTab logs={logs} loading={loading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewTab({ settings, logs, loading }: { settings: any, logs: any[], loading: boolean }) {
  if (loading) return <div className="grid grid-cols-3 gap-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}</div>;

  const sentToday = logs.filter(l => l.created_at.startsWith(new Date().toISOString().slice(0, 10))).length;
  const status = settings?.status || 'disconnected';

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Status da Conexão</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className={`h-3 w-3 rounded-full ${status === 'connected' ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-2xl font-bold capitalize">{status === 'connected' ? 'Conectado' : 'Desconectado'}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Enviadas Hoje</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{sentToday}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Mensagens (Mês)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{logs.length}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Últimos Envios</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma mensagem enviada ainda.</p>
          ) : (
            <div className="space-y-4">
              {logs.slice(0, 5).map(log => (
                <div key={log.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                  <div>
                    <p className="font-medium">{log.recipient_phone}</p>
                    <p className="text-sm text-muted-foreground truncate max-w-md">{log.message}</p>
                  </div>
                  <div className="text-right">
                    <Badge variant={log.status === 'sent' ? 'default' : 'destructive'}>{log.status}</Badge>
                    <p className="text-xs text-muted-foreground mt-1">{format(new Date(log.created_at), 'dd/MM HH:mm')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ConnectionTab({ settings, loading, onReload }: { settings: any, loading: boolean, onReload: () => void }) {
  const [instanceName, setInstanceName] = useState(settings?.instance_name || 'AgendaePlatform');
  const [apiUrl, setApiUrl] = useState(settings?.api_url || '');
  const [apiKey, setApiKey] = useState(settings?.api_key || '');
  const [busy, setBusy] = useState(false);
  const [testPhone, setTestPhone] = useState('');

  const handleConnect = async () => {
    if (!apiUrl || !apiKey) return toast.error('Preencha a URL e a API Key');
    setBusy(true);
    try {
      await connectPlatformInstance(instanceName, apiUrl, apiKey);
      toast.success('Instância configurada com sucesso');
      onReload();
    } catch (e) {
      toast.error('Erro ao conectar instância');
    } finally {
      setBusy(false);
    }
  };

  const handleDisconnect = async () => {
    setBusy(true);
    try {
      await disconnectPlatformInstance();
      toast.success('Instância desconectada');
      onReload();
    } catch (e) {
      toast.error('Erro ao desconectar');
    } finally {
      setBusy(false);
    }
  };

  const handleTest = async () => {
    if (!testPhone) return toast.error('Informe um telefone');
    setBusy(true);
    try {
      await sendPlatformTest(testPhone, 'Mensagem de teste da Plataforma Agendaê! 🚀');
      toast.success('Mensagem enviada');
      onReload();
    } catch (e) {
      toast.error('Erro ao enviar teste');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Configuração Evolution API</CardTitle>
          <CardDescription>Conecte a instância central da plataforma</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nome da Instância</Label>
            <Input value={instanceName} onChange={e => setInstanceName(e.target.value)} placeholder="ex: AgendaePlatform" />
          </div>
          <div className="space-y-2">
            <Label>API URL</Label>
            <Input value={apiUrl} onChange={e => setApiUrl(e.target.value)} placeholder="https://api.meuevolution.com" />
          </div>
          <div className="space-y-2">
            <Label>API Key (Global/Instance)</Label>
            <Input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="SUA_CHAVE_AQUI" />
          </div>
        </CardContent>
        <CardFooter className="flex justify-between border-t p-6">
          {settings?.status === 'connected' ? (
            <Button variant="destructive" onClick={handleDisconnect} disabled={busy}>
              {busy ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Desconectar
            </Button>
          ) : (
            <Button onClick={handleConnect} disabled={busy} className="w-full">
              {busy ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Wifi className="mr-2 h-4 w-4" />}
              Conectar Instância
            </Button>
          )}
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status e Teste</CardTitle>
          <CardDescription>Verifique se a plataforma consegue enviar mensagens</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/50 border">
            <Smartphone className="h-8 w-8 text-primary" />
            <div>
              <p className="text-sm font-medium">Número Conectado</p>
              <p className="text-lg font-bold">{settings?.connected_phone || '---'}</p>
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t">
            <Label>Telefone para Teste (com DDI/DDD)</Label>
            <div className="flex gap-2">
              <Input value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="5511999999999" />
              <Button onClick={handleTest} disabled={busy || settings?.status !== 'connected'}>
                {busy ? <Loader2 className="animate-spin h-4 w-4" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function AutomationsTab({ automations, templates, loading, onReload }: { automations: any[], templates: any[], loading: boolean, onReload: () => void }) {
  const PLATFORM_AUTOMATIONS = [
    { type: 'company_welcome', name: 'Boas-vindas Empresa', description: 'Enviado após o cadastro da empresa.' },
    { type: 'trial_expiring', name: 'Trial Expirando', description: 'Aviso 2 dias antes do fim do teste.' },
    { type: 'trial_expired', name: 'Trial Expirado', description: 'Aviso no dia que o teste acaba.' },
    { type: 'subscription_activated', name: 'Assinatura Ativa', description: 'Boas-vindas após confirmação de pagamento.' },
  ];

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await togglePlatformAutomation(id, enabled);
      toast.success('Automação atualizada');
      onReload();
    } catch (e) {
      toast.error('Erro ao atualizar');
    }
  };

  if (loading) return <Skeleton className="h-64" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Automações de Plataforma</CardTitle>
        <CardDescription>Mensagens automáticas para donos de estabelecimentos</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {PLATFORM_AUTOMATIONS.map(def => {
            const auto = automations.find(a => a.type === def.type);
            const template = templates.find(t => t.id === auto?.template_id);
            return (
              <div key={def.type} className="flex items-center justify-between p-4 rounded-lg border">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-bold">{def.name}</p>
                    <Badge variant="outline" className="text-[10px]">{def.type}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{def.description}</p>
                  <p className="text-xs text-primary">{template ? `Template: ${template.name}` : 'Sem template configurado'}</p>
                </div>
                <Switch 
                  checked={auto?.enabled || false} 
                  disabled={!auto || !auto.template_id}
                  onCheckedChange={(v) => handleToggle(auto.id, v)}
                />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function TemplatesTab({ templates, loading, onReload }: { templates: any[], loading: boolean, onReload: () => void }) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const payload = {
      id: editing?.id,
      name: formData.get('name') as string,
      type: formData.get('type') as string,
      content: formData.get('content') as string,
    };
    
    try {
      await savePlatformTemplate(payload);
      toast.success('Template salvo');
      setDialogOpen(false);
      onReload();
    } catch (e) {
      toast.error('Erro ao salvar template');
    }
  };

  if (loading) return <Skeleton className="h-64" />;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => { setEditing(null); setDialogOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Novo Template
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map(t => (
          <Card key={t.id} className="flex flex-col">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <CardTitle className="text-sm font-bold">{t.name}</CardTitle>
                <Badge variant="secondary">{t.type}</Badge>
              </div>
            </CardHeader>
            <CardContent className="flex-1">
              <p className="text-sm text-muted-foreground line-clamp-4 whitespace-pre-wrap">{t.content}</p>
            </CardContent>
            <CardFooter className="border-t pt-3 flex justify-between">
              <span className="text-[10px] text-muted-foreground">{format(new Date(t.created_at), 'dd/MM/yyyy')}</span>
              <Button variant="ghost" size="sm" onClick={() => { setEditing(t); setDialogOpen(true); }}>Editar</Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar Template' : 'Novo Template'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input name="name" defaultValue={editing?.name} required placeholder="ex: Boas vindas" />
                </div>
                <div className="space-y-2">
                  <Label>Tipo/Chave</Label>
                  <Input name="type" defaultValue={editing?.type} required placeholder="ex: company_welcome" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Conteúdo da Mensagem</Label>
                <Textarea 
                  name="content" 
                  defaultValue={editing?.content} 
                  required 
                  className="min-h-[200px]" 
                  placeholder="Olá {{nome}}, seja bem-vindo à Agendaê!" 
                />
                <p className="text-[10px] text-muted-foreground">Variáveis: {'{{nome}}, {{empresa}}, {{plano}}, {{data}}, {{dias_teste}}'}</p>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
              <Button type="submit">Salvar Template</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HistoryTab({ logs, loading }: { logs: any[], loading: boolean }) {
  if (loading) return <Skeleton className="h-64" />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de Envios</CardTitle>
        <CardDescription>Mensagens enviadas pela plataforma</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {logs.map(log => (
            <div key={log.id} className="flex items-center justify-between p-3 rounded-lg border text-sm">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{log.recipient_phone}</span>
                  <Badge variant="outline" className="text-[10px]">{log.type}</Badge>
                </div>
                <p className="text-muted-foreground">{log.message}</p>
                {log.error && <p className="text-xs text-destructive">{log.error}</p>}
              </div>
              <div className="text-right shrink-0 ml-4">
                <Badge variant={log.status === 'sent' ? 'default' : 'destructive'}>{log.status}</Badge>
                <p className="text-[10px] text-muted-foreground mt-1">{format(new Date(log.created_at), "dd/MM HH:mm", { locale: ptBR })}</p>
              </div>
            </div>
          ))}
          {logs.length === 0 && <p className="text-center py-8 text-muted-foreground">Nenhum registro encontrado.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function CardFooter({ children, className }: any) {
  return <div className={`flex items-center p-6 pt-0 ${className}`}>{children}</div>;
}
