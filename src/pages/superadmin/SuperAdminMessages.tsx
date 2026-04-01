import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Megaphone, Trash2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const SuperAdminMessages = () => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [type, setType] = useState('info');
  const [targetPlan, setTargetPlan] = useState<string>('all');
  const [targetBusinessType, setTargetBusinessType] = useState('all');
  const [sendWhatsapp, setSendWhatsapp] = useState(false);
  const [sendDashboard, setSendDashboard] = useState(true);

  const { data: messages, isLoading } = useQuery({
    queryKey: ['platform-messages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('platform_messages')
        .select('*, plans(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: plans } = useQuery({
    queryKey: ['plans-list'],
    queryFn: async () => {
      const { data, error } = await supabase.from('plans').select('id, name').eq('active', true).order('sort_order');
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('platform_messages').insert({
        title,
        content,
        type,
        target_plan: targetPlan === 'all' ? null : targetPlan,
        target_business_type: targetBusinessType,
        send_whatsapp: sendWhatsapp,
        send_dashboard_notification: sendDashboard,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-messages'] });
      toast.success('Mensagem criada com sucesso!');
      resetForm();
    },
    onError: () => toast.error('Erro ao criar mensagem'),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from('platform_messages').update({ active }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['platform-messages'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('platform_messages').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['platform-messages'] });
      toast.success('Mensagem removida');
    },
  });

  const resetForm = () => {
    setTitle(''); setContent(''); setType('info'); setTargetPlan('all');
    setTargetBusinessType('all'); setSendWhatsapp(false); setSendDashboard(true); setOpen(false);
  };

  const typeColors: Record<string, string> = {
    info: 'bg-primary/10 text-primary',
    warning: 'bg-yellow-500/10 text-yellow-600',
    promotion: 'bg-green-500/10 text-green-600',
    update: 'bg-blue-500/10 text-blue-600',
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold">Mensagens da Plataforma</h1>
          <p className="text-muted-foreground">Envie comunicados para empresas da plataforma</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Nova Mensagem</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Nova Mensagem</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Título</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título da mensagem" />
              </div>
              <div>
                <Label>Conteúdo</Label>
                <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Conteúdo da mensagem" rows={4} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Tipo</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="info">Informação</SelectItem>
                      <SelectItem value="warning">Aviso</SelectItem>
                      <SelectItem value="promotion">Promoção</SelectItem>
                      <SelectItem value="update">Atualização</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Categoria de Negócio</Label>
                  <Select value={targetBusinessType} onValueChange={setTargetBusinessType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="barbershop">Barbearias</SelectItem>
                      <SelectItem value="esthetic">Estéticas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Plano Alvo</Label>
                <Select value={targetPlan} onValueChange={setTargetPlan}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os planos</SelectItem>
                    {plans?.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label>Notificação no Dashboard</Label>
                <Switch checked={sendDashboard} onCheckedChange={setSendDashboard} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Enviar via WhatsApp (Webhook)</Label>
                <Switch checked={sendWhatsapp} onCheckedChange={setSendWhatsapp} />
              </div>
              <Button className="w-full" onClick={() => createMutation.mutate()} disabled={!title || !content || createMutation.isPending}>
                {createMutation.isPending ? 'Criando...' : 'Criar Mensagem'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5" /> Mensagens</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Carregando...</p>
          ) : !messages?.length ? (
            <p className="text-center text-muted-foreground py-8">Nenhuma mensagem criada</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Alvo</TableHead>
                  <TableHead>Canais</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {messages.map((msg: any) => (
                  <TableRow key={msg.id} className={!msg.active ? 'opacity-50' : ''}>
                    <TableCell className="font-medium">{msg.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={typeColors[msg.type] || ''}>
                        {msg.type === 'info' ? 'Info' : msg.type === 'warning' ? 'Aviso' : msg.type === 'promotion' ? 'Promoção' : 'Atualização'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {msg.target_business_type === 'all' ? 'Todos' : msg.target_business_type === 'barbershop' ? 'Barbearias' : 'Estéticas'}
                        {msg.plans?.name && <span className="text-muted-foreground ml-1">· {msg.plans.name}</span>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {msg.send_dashboard_notification && <Badge variant="secondary" className="text-xs">Dashboard</Badge>}
                        {msg.send_whatsapp && <Badge variant="secondary" className="text-xs">WhatsApp</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{format(new Date(msg.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => toggleMutation.mutate({ id: msg.id, active: !msg.active })}>
                          {msg.active ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => deleteMutation.mutate(msg.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SuperAdminMessages;
