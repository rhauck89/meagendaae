import { useEffect, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, MessageSquare, Paperclip, Send, X, FileText, Image, Film, Download, CheckCircle, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Ticket {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  protocol_number: string | null;
  created_at: string;
}

interface Message {
  id: string;
  message: string;
  is_admin: boolean;
  created_at: string;
}

interface Attachment {
  id: string;
  file_url: string;
  file_name: string;
  file_size: number;
  created_at: string;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf', 'video/mp4', 'video/quicktime', 'video/webm'];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

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

function getFileIcon(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'webp'].includes(ext || '')) return <Image className="h-4 w-4" />;
  if (['mp4', 'mov', 'webm'].includes(ext || '')) return <Film className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const Support = () => {
  const { user, companyId } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [createdProtocol, setCreatedProtocol] = useState('');
  const [createdTicketId, setCreatedTicketId] = useState('');
  const [viewTicket, setViewTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);

  // Create form state
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'general',
    priority: 'medium',
  });
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const fetchAttachments = async (ticketId: string) => {
    const { data } = await supabase
      .from('support_attachments')
      .select('*')
      .eq('ticket_id', ticketId)
      .order('created_at', { ascending: true });
    if (data) setAttachments(data as Attachment[]);
  };

  useEffect(() => {
    if (user) fetchTickets();
  }, [user]);

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `Arquivo inválido: ${file.name}. Formatos permitidos: JPG, PNG, PDF, MP4, MOV, WEBM.`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `Arquivo "${file.name}" muito grande. Tamanho máximo: 20MB.`;
    }
    return null;
  };

  const handlePendingFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const errors: string[] = [];
    const valid: File[] = [];

    for (const file of files) {
      const err = validateFile(file);
      if (err) errors.push(err);
      else valid.push(file);
    }

    if (errors.length > 0) toast.error(errors[0]);
    setPendingFiles(prev => [...prev, ...valid]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFilesForTicket = async (ticketId: string, files: File[]) => {
    for (const file of files) {
      const path = `${user!.id}/${ticketId}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from('support-attachments').upload(path, file);
      if (uploadError) continue;
      const { data: urlData } = supabase.storage.from('support-attachments').getPublicUrl(path);
      await supabase.from('support_attachments').insert({
        ticket_id: ticketId,
        file_url: urlData.publicUrl,
        file_name: file.name,
        file_size: file.size,
      } as any);
    }
  };

  const handleCreate = async () => {
    if (!form.title.trim() || !form.description.trim()) {
      toast.error('Preencha título e descrição');
      return;
    }
    setCreating(true);
    const { data, error } = await supabase.from('support_tickets').insert({
      company_id: companyId,
      user_id: user!.id,
      title: form.title.trim(),
      description: form.description.trim(),
      category: form.category,
      priority: form.priority,
    } as any).select('id, protocol_number').single();

    if (error || !data) {
      toast.error('Erro ao criar ticket');
      setCreating(false);
      return;
    }

    // Upload pending files
    if (pendingFiles.length > 0) {
      await uploadFilesForTicket((data as any).id, pendingFiles);
    }

    setCreateOpen(false);
    setForm({ title: '', description: '', category: 'general', priority: 'medium' });
    setPendingFiles([]);
    setCreatedProtocol((data as any).protocol_number || '');
    setCreatedTicketId((data as any).id);
    setConfirmOpen(true);
    setCreating(false);
    fetchTickets();
  };

  const openTicket = (t: Ticket) => {
    setViewTicket(t);
    fetchMessages(t.id);
    fetchAttachments(t.id);
  };

  const openCreatedTicket = () => {
    setConfirmOpen(false);
    const t = tickets.find(tk => tk.id === createdTicketId);
    if (t) openTicket(t);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !viewTicket) return;
    setSending(true);
    await supabase.from('support_messages').insert({
      ticket_id: viewTicket.id,
      user_id: user!.id,
      message: newMessage.trim(),
      is_admin: false,
    } as any);
    setNewMessage('');
    fetchMessages(viewTicket.id);
    setSending(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !viewTicket) return;
    const err = validateFile(file);
    if (err) { toast.error(err); return; }

    setUploading(true);
    const path = `${user!.id}/${viewTicket.id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from('support-attachments').upload(path, file);
    if (uploadError) {
      toast.error('Erro no upload');
      setUploading(false);
      return;
    }
    const { data: urlData } = supabase.storage.from('support-attachments').getPublicUrl(path);

    await supabase.from('support_attachments').insert({
      ticket_id: viewTicket.id,
      file_url: urlData.publicUrl,
      file_name: file.name,
      file_size: file.size,
    } as any);

    await supabase.from('support_messages').insert({
      ticket_id: viewTicket.id,
      user_id: user!.id,
      message: `📎 Anexo: ${file.name}`,
      is_admin: false,
    } as any);

    fetchMessages(viewTicket.id);
    fetchAttachments(viewTicket.id);
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
                  <TableHead>Protocolo</TableHead>
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
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum ticket</TableCell></TableRow>
                ) : tickets.map(t => {
                  const s = statusMap[t.status] || statusMap.open;
                  return (
                    <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openTicket(t)}>
                      <TableCell className="text-xs font-mono text-primary">{t.protocol_number || '—'}</TableCell>
                      <TableCell className="font-medium text-sm max-w-[200px] truncate">{t.title}</TableCell>
                      <TableCell><Badge variant="outline" className="text-xs">{categoryMap[t.category] || t.category}</Badge></TableCell>
                      <TableCell className="text-xs">{priorityMap[t.priority] || t.priority}</TableCell>
                      <TableCell><Badge variant={s.variant} className="text-xs">{s.label}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{format(new Date(t.created_at), 'dd/MM/yyyy')}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openTicket(t); }}>
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
                  <div className="min-w-0">
                    <p className="text-xs font-mono text-primary mb-1">{t.protocol_number || '—'}</p>
                    <p className="font-medium text-sm break-words">{t.title}</p>
                  </div>
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
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Novo Ticket de Suporte</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Título</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Resuma o problema" maxLength={200} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Descrição</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={4} placeholder="Descreva detalhadamente..." maxLength={2000} />
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

            {/* File upload */}
            <div className="space-y-2">
              <Label className="text-xs">Anexar arquivo (opcional)</Label>
              <div
                className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">Clique para selecionar ou arraste arquivos aqui</p>
                <p className="text-xs text-muted-foreground mt-1">JPG, PNG, PDF, MP4, MOV, WEBM · Máx 20MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".jpg,.jpeg,.png,.pdf,.mp4,.mov,.webm"
                  multiple
                  onChange={handlePendingFiles}
                />
              </div>
              {pendingFiles.length > 0 && (
                <div className="space-y-1 overflow-hidden">
                  {pendingFiles.map((file, i) => (
                    <div key={i} className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-2 text-sm min-w-0">
                      <span className="shrink-0">{getFileIcon(file.name)}</span>
                      <span className="truncate text-xs min-w-0 max-w-[220px]" title={file.name}>{file.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{formatFileSize(file.size)}</span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removePendingFile(i)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? 'Criando...' : 'Criar Ticket'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Modal */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm text-center">
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <CheckCircle className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Ticket criado com sucesso 🎉</h3>
              <p className="text-sm text-muted-foreground mt-2">Seu ticket foi registrado em nosso sistema de suporte.</p>
            </div>
            {createdProtocol && (
              <div className="bg-muted rounded-lg px-4 py-3 w-full">
                <p className="text-xs text-muted-foreground">Número do protocolo</p>
                <p className="text-lg font-mono font-bold text-primary">{createdProtocol}</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground">Nossa equipe analisará sua solicitação em breve. Acompanhe o andamento na área de Suporte.</p>
            <div className="flex gap-2 w-full">
              <Button variant="outline" className="flex-1" onClick={() => setConfirmOpen(false)}>Fechar</Button>
              <Button className="flex-1" onClick={openCreatedTicket}>Ver Ticket</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* View Ticket Dialog */}
      <Dialog open={!!viewTicket} onOpenChange={() => setViewTicket(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center gap-2">
              {viewTicket?.protocol_number && (
                <span className="text-xs font-mono text-primary">{viewTicket.protocol_number}</span>
              )}
            </div>
            <DialogTitle className="text-base">{viewTicket?.title}</DialogTitle>
            <div className="flex gap-2 mt-1">
              {viewTicket && <Badge variant={statusMap[viewTicket.status]?.variant || 'outline'} className="text-xs">{statusMap[viewTicket.status]?.label}</Badge>}
              {viewTicket && <Badge variant="outline" className="text-xs">{categoryMap[viewTicket.category] || viewTicket.category}</Badge>}
              {viewTicket && <span className="text-xs text-muted-foreground">{priorityMap[viewTicket.priority]}</span>}
            </div>
          </DialogHeader>

          {viewTicket && (
            <p className="text-sm text-muted-foreground border-b pb-3">{viewTicket.description}</p>
          )}

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="border-b pb-3">
              <p className="text-xs font-medium mb-2">📎 Anexos</p>
              <div className="space-y-1">
                {attachments.map(att => (
                  <div key={att.id} className="flex items-center gap-2 bg-muted/50 rounded-md px-3 py-2">
                    {getFileIcon(att.file_name)}
                    <span className="flex-1 truncate text-xs">{att.file_name}</span>
                    <span className="text-xs text-muted-foreground">{formatFileSize(att.file_size)}</span>
                    <a href={att.file_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <Eye className="h-3 w-3" />
                      </Button>
                    </a>
                    <a href={att.file_url} download={att.file_name}>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <Download className="h-3 w-3" />
                      </Button>
                    </a>
                  </div>
                ))}
              </div>
            </div>
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
                <input type="file" className="hidden" accept=".jpg,.jpeg,.png,.pdf,.mp4,.mov,.webm" onChange={handleFileUpload} />
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
