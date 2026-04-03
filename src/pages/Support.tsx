import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, MessageSquare, Paperclip, Send, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Ticket {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  created_at: string;
}

interface Message {
  id: string;
  message: string;
  is_admin: boolean;
  created_at: string;
}

const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  open: { label: 'Aberto', variant: 'destructive' },
  in_progress: { label: 'Em andamento', variant: 'default' },
  answered: { label: 'Respondido', variant: 'secondary' },
  resolved: { label: 'Resolvido', variant: 'outline' },
  closed: { label: 'Fechado', variant: 'outline' },
};

const priorityMap: Record<string, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  urgent: 'Urgente',
};

const categoryMap: Record<string, string> = {
  general: 'Geral',
  billing: 'Cobrança',
  technical: 'Técnico',
  feature: 'Funcionalidade',
  bug: 'Bug',
};

const Support = () => {
  const { user, companyId } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [viewTicket, setViewTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'general',
    priority: 'medium',
  });

  const fetchTickets = async () => {
    const { data } = await supabase
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setTickets(data as Ticket[]);
    setLoading(false);
  };

  const fetchMessages = async (ticketId: string) => {
    const { data } = await supabase
      .from('support_messages')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    if (data) setMessages(data as Message[]);
  };

  useEffect(() => {
    if (user) fetchTickets();
  }, [user]);

  const handleCreate = async () => {
    if (!form.title.trim() || !form.description.trim()) {
      toast.error('Preencha título e descrição');
      return;
    }
    const { error } = await supabase.from('support_tickets').insert({
      company_id: companyId,
      user_id: user!.id,
      title: form.title,
      description: form.description,
      category: form.category,
      priority: form.priority,
    } as any);
    if (error) {
      toast.error('Erro ao criar ticket');
      return;
    }
    toast.success('Ticket criado com sucesso');
    setCreateOpen(false);
    setForm({ title: '', description: '', category: 'general', priority: 'medium' });
    fetchTickets();
  };

  const openTicket = (t: Ticket) => {
    setViewTicket(t);
    fetchMessages(t.id);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !viewTicket) return;
    setSending(true);
    await supabase.from('support_messages').insert({
      ticket_id: viewTicket.id,
      user_id: user!.id,
      message: newMessage,
      is_admin: false,
    } as any);
    setNewMessage('');
    fetchMessages(viewTicket.id);
    setSending(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !viewTicket) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Arquivo muito grande (máx 5MB)');
      return;
    }
    setUploading(true);
    const path = `${user!.id}/${viewTicket.id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from('support-attachments').upload(path, file);
    if (uploadError) {
      toast.error('Erro no upload');
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from('support-attachments').getPublicUrl(path);

    // Save attachment record
    await supabase.from('support_attachments').insert({
      ticket_id: viewTicket.id,
      file_url: urlData.publicUrl,
      file_name: file.name,
      file_size: file.size,
    } as any);

    // Send as message
    await supabase.from('support_messages').insert({
      ticket_id: viewTicket.id,
      user_id: user!.id,
      message: `📎 Anexo: ${file.name}`,
      is_admin: false,
    } as any);

    fetchMessages(viewTicket.id);
    setUploading(false);
    toast.success('Arquivo enviado');
  };

  if (loading) return <div className="flex items-center justify-center py-12"><p className="text-muted-foreground">Carregando...</p></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-display font-bold">🎫 Suporte</h2>
          <p className="text-sm text-muted-foreground">Abra e acompanhe seus tickets de suporte</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Novo Ticket
        </Button>
      </div>

      {/* Desktop table */}
      <Card className="hidden md:block">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="w-[80px]">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tickets.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum ticket</TableCell></TableRow>
                ) : tickets.map(t => {
                  const s = statusMap[t.status] || statusMap.open;
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium text-sm max-w-[200px] truncate">{t.title}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{categoryMap[t.category] || t.category}</Badge></TableCell>
                      <TableCell className="text-xs">{priorityMap[t.priority] || t.priority}</TableCell>
                      <TableCell><Badge variant={s.variant} className="text-xs">{s.label}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(t.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => openTicket(t)}>
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {tickets.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum ticket</CardContent></Card>
        ) : tickets.map(t => {
          const s = statusMap[t.status] || statusMap.open;
          return (
            <Card key={t.id} className="cursor-pointer" onClick={() => openTicket(t)}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-sm break-words">{t.title}</p>
                  <Badge variant={s.variant} className="text-xs shrink-0">{s.label}</Badge>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline">{categoryMap[t.category] || t.category}</Badge>
                  <span className="text-muted-foreground">{priorityMap[t.priority] || t.priority}</span>
                  <span className="text-muted-foreground">{format(new Date(t.created_at), 'dd/MM/yyyy')}</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Novo Ticket de Suporte</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Título</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Resuma o problema" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descrição</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={4} placeholder="Descreva detalhadamente..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Categoria</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoryMap).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Prioridade</Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(priorityMap).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate}>Criar Ticket</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Ticket Dialog */}
      <Dialog open={!!viewTicket} onOpenChange={() => setViewTicket(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-base">{viewTicket?.title}</DialogTitle>
            <div className="flex gap-2 mt-1">
              {viewTicket && <Badge variant={statusMap[viewTicket.status]?.variant || 'outline'} className="text-xs">{statusMap[viewTicket.status]?.label}</Badge>}
              {viewTicket && <Badge variant="outline" className="text-xs">{categoryMap[viewTicket.category] || viewTicket.category}</Badge>}
            </div>
          </DialogHeader>

          {viewTicket && (
            <p className="text-sm text-muted-foreground border-b pb-3">{viewTicket.description}</p>
          )}

          <ScrollArea className="flex-1 min-h-0 max-h-[300px] pr-2">
            <div className="space-y-3 py-2">
              {messages.map(m => (
                <div key={m.id} className={`flex ${m.is_admin ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[80%] rounded-lg p-3 text-sm ${m.is_admin ? 'bg-muted' : 'bg-primary text-primary-foreground'}`}>
                    {m.is_admin && <p className="text-xs font-semibold mb-1 opacity-70">Suporte</p>}
                    <p className="whitespace-pre-wrap">{m.message}</p>
                    <p className={`text-xs mt-1 ${m.is_admin ? 'text-muted-foreground' : 'opacity-70'}`}>
                      {format(new Date(m.created_at), 'dd/MM HH:mm')}
                    </p>
                  </div>
                </div>
              ))}
              {messages.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">Nenhuma mensagem ainda</p>}
            </div>
          </ScrollArea>

          {viewTicket?.status !== 'closed' && (
            <div className="flex gap-2 pt-2 border-t">
              <Input
                placeholder="Digite sua mensagem..."
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                className="flex-1"
              />
              <label>
                <input type="file" className="hidden" accept="image/*,.pdf,.zip" onChange={handleFileUpload} />
                <Button variant="outline" size="icon" asChild disabled={uploading}>
                  <span><Paperclip className="h-4 w-4" /></span>
                </Button>
              </label>
              <Button size="icon" onClick={sendMessage} disabled={sending || !newMessage.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Support;
