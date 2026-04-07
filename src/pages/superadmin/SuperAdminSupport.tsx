import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Send, Filter, Paperclip, Eye, Download, FileText, Film, Search, ChevronLeft, ChevronRight, Loader2, Building2, User, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Ticket {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  priority: string;
  created_at: string;
  company_id: string;
  user_id: string;
  protocol_number?: string;
  company?: { name: string } | null;
  profile?: { full_name: string; email: string } | null;
}

interface Message {
  id: string;
  message: string;
  is_admin: boolean;
  created_at: string;
}

interface Attachment {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number;
  ticket_id: string;
}

const PAGE_SIZE = 20;

const statusOptions = [
  { value: 'all', label: 'Todos' },
  { value: 'open', label: 'Aberto' },
  { value: 'in_progress', label: 'Em andamento' },
  { value: 'answered', label: 'Respondido' },
  { value: 'resolved', label: 'Resolvido' },
  { value: 'closed', label: 'Fechado' },
];

const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  open: { label: 'Aberto', variant: 'destructive' },
  in_progress: { label: 'Em andamento', variant: 'default' },
  answered: { label: 'Respondido', variant: 'secondary' },
  resolved: { label: 'Resolvido', variant: 'outline' },
  closed: { label: 'Fechado', variant: 'outline' },
};

const categoryMap: Record<string, string> = {
  general: 'Geral',
  billing: 'Cobrança',
  technical: 'Técnico',
  feature: 'Funcionalidade',
  bug: 'Bug',
};

const priorityMap: Record<string, { label: string; bg: string; text: string }> = {
  low: { label: 'Baixa', bg: 'bg-blue-100', text: 'text-blue-700' },
  medium: { label: 'Média', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  high: { label: 'Alta', bg: 'bg-orange-100', text: 'text-orange-700' },
  urgent: { label: 'Urgente', bg: 'bg-red-100', text: 'text-red-700' },
};

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return `image/${ext === 'jpg' ? 'jpeg' : ext}`;
  if (['mp4', 'mov', 'webm'].includes(ext)) return `video/${ext}`;
  if (ext === 'pdf') return 'application/pdf';
  return 'application/octet-stream';
}

function isImage(type: string) {
  return /^image\/(jpeg|jpg|png|gif|webp)$/i.test(type);
}

function isVideo(type: string) {
  return /^video\//i.test(type);
}

const SuperAdminSupport = () => {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCompany, setFilterCompany] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(0);

  const [viewTicket, setViewTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<string>('');
  const [companyDetail, setCompanyDetail] = useState<{ company: any; profile: any } | null>(null);
  // All companies map for search
  const [allCompaniesMap, setAllCompaniesMap] = useState<Map<string, string>>(new Map());

  const fetchTickets = async () => {
    setLoading(true);

    // First get total count with filters
    let countQuery = supabase
      .from('support_tickets')
      .select('*', { count: 'exact', head: true });

    if (filterStatus !== 'all') countQuery = countQuery.eq('status', filterStatus);
    if (filterCompany !== 'all') countQuery = countQuery.eq('company_id', filterCompany);
    if (filterCategory !== 'all') countQuery = countQuery.eq('category', filterCategory);

    // Fetch data with pagination
    let query = supabase
      .from('support_tickets')
      .select('*')
      .order('created_at', { ascending: false })
      .range(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE - 1);

    if (filterStatus !== 'all') query = query.eq('status', filterStatus);
    if (filterCompany !== 'all') query = query.eq('company_id', filterCompany);
    if (filterCategory !== 'all') query = query.eq('category', filterCategory);

    const [countResult, dataResult] = await Promise.all([countQuery, query]);
    
    const data = dataResult.data;
    const count = countResult.count || 0;

    if (!data) { setLoading(false); return; }

    // Enrich with company and profile data
    const companyIds = [...new Set(data.map((t: any) => t.company_id).filter(Boolean))];
    const userIds = [...new Set(data.map((t: any) => t.user_id).filter(Boolean))];

    const [compsResult, profilesResult] = await Promise.all([
      companyIds.length > 0
        ? supabase.from('companies').select('id, name').in('id', companyIds)
        : Promise.resolve({ data: [] }),
      userIds.length > 0
        ? supabase.from('profiles').select('user_id, full_name, email').in('user_id', userIds)
        : Promise.resolve({ data: [] }),
    ]);

    const compMap = new Map((compsResult.data || []).map((c: any) => [c.id, c.name]));
    const profMap = new Map((profilesResult.data || []).map((p: any) => [p.user_id, p]));

    // Update global companies map
    const newMap = new Map(allCompaniesMap);
    (compsResult.data || []).forEach((c: any) => newMap.set(c.id, c.name));
    setAllCompaniesMap(newMap);

    const enriched = data.map((t: any) => ({
      ...t,
      company: compMap.has(t.company_id) ? { name: compMap.get(t.company_id)! } : null,
      profile: profMap.has(t.user_id) ? profMap.get(t.user_id) : null,
    }));

    setTickets(enriched);
    setTotalCount(count);
    setLoading(false);
  };

  const fetchCompanies = async () => {
    const { data } = await supabase.from('companies').select('id, name').order('name');
    if (data) setCompanies(data);
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
    setAttachments((data as Attachment[]) || []);
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  useEffect(() => {
    setCurrentPage(0);
  }, [filterStatus, filterCompany, filterCategory, searchQuery]);

  useEffect(() => {
    fetchTickets();
  }, [filterStatus, filterCompany, filterCategory, currentPage]);

  // Client-side search filtering
  const filteredTickets = useMemo(() => {
    if (!searchQuery.trim()) return tickets;
    const q = searchQuery.toLowerCase();
    return tickets.filter(t =>
      (t.protocol_number || '').toLowerCase().includes(q) ||
      t.title.toLowerCase().includes(q) ||
      (t.company?.name || '').toLowerCase().includes(q) ||
      (t.profile?.full_name || '').toLowerCase().includes(q)
    );
  }, [tickets, searchQuery]);

  const openTicket = (t: Ticket) => {
    setViewTicket(t);
    fetchMessages(t.id);
    fetchAttachments(t.id);
  };

  const fetchCompanyDetail = async (companyId: string, userId: string) => {
    const [compRes, profRes] = await Promise.all([
      companyId ? supabase.from('companies').select('id, name, created_at, plan_id, subscription_status').eq('id', companyId).maybeSingle() : Promise.resolve({ data: null }),
      userId ? supabase.from('profiles').select('full_name, email, role, user_id').eq('user_id', userId).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    
    let planName = null;
    if (compRes.data?.plan_id) {
      const { data: plan } = await supabase.from('plans').select('name').eq('id', compRes.data.plan_id).maybeSingle();
      planName = plan?.name;
    }

    setCompanyDetail({
      company: compRes.data ? { ...compRes.data, plan_name: planName } : null,
      profile: profRes.data,
    });
  };

  const openPreview = (att: Attachment) => {
    setPreviewUrl(att.file_url);
    setPreviewType(getFileType(att.file_name));
  };

  const sendAdminMessage = async () => {
    if (!newMessage.trim() || !viewTicket) return;
    setSending(true);
    await supabase.from('support_messages').insert({
      ticket_id: viewTicket.id,
      user_id: user!.id,
      message: newMessage,
      is_admin: true,
    } as any);

    await supabase.from('support_tickets').update({ status: 'answered', updated_at: new Date().toISOString() } as any).eq('id', viewTicket.id);
    setViewTicket(prev => prev ? { ...prev, status: 'answered' } : null);

    setNewMessage('');
    fetchMessages(viewTicket.id);
    setSending(false);
  };

  const updateTicketStatus = async (ticketId: string, newStatus: string) => {
    await supabase.from('support_tickets').update({ status: newStatus, updated_at: new Date().toISOString() } as any).eq('id', ticketId);
    setViewTicket(prev => prev ? { ...prev, status: newStatus } : null);
    fetchTickets();
    toast.success('Status atualizado');
  };

  const stats = useMemo(() => ({
    open: tickets.filter(t => t.status === 'open').length,
    in_progress: tickets.filter(t => t.status === 'in_progress').length,
    answered: tickets.filter(t => t.status === 'answered').length,
    total: totalCount,
  }), [tickets, totalCount]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const rangeStart = currentPage * PAGE_SIZE + 1;
  const rangeEnd = Math.min((currentPage + 1) * PAGE_SIZE, totalCount);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-display font-semibold">🎫 Suporte</h2>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Total</p><p className="text-2xl font-display font-bold">{stats.total}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Abertos</p><p className="text-2xl font-display font-bold text-destructive">{stats.open}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Em andamento</p><p className="text-2xl font-display font-bold text-primary">{stats.in_progress}</p></CardContent></Card>
        <Card><CardContent className="p-4 text-center"><p className="text-xs text-muted-foreground">Respondidos</p><p className="text-2xl font-display font-bold text-success">{stats.answered}</p></CardContent></Card>
      </div>

      {/* Search + Filters */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por protocolo, título, empresa ou usuário..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              {statusOptions.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterCompany} onValueChange={setFilterCompany}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Empresa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as empresas</SelectItem>
              {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {Object.entries(categoryMap).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        {searchQuery.trim() ? `${filteredTickets.length} tickets encontrados` : `${totalCount} tickets encontrados`}
      </p>

      {/* Tickets Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12 gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <p className="text-muted-foreground text-sm">Carregando tickets...</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Protocolo</TableHead>
                    <TableHead>Título</TableHead>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Data</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTickets.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum ticket encontrado</TableCell></TableRow>
                  ) : filteredTickets.map(t => {
                    const s = statusMap[t.status] || statusMap.open;
                    return (
                      <TableRow key={t.id} className="cursor-pointer" onClick={() => openTicket(t)}>
                        <TableCell className="text-xs font-mono text-muted-foreground">{t.protocol_number || '—'}</TableCell>
                        <TableCell className="font-medium text-sm max-w-[180px] truncate">{t.title}</TableCell>
                        <TableCell>
                          {t.company?.name ? (
                            <button
                              className="text-sm text-primary hover:underline font-medium text-left"
                              onClick={(e) => {
                                e.stopPropagation();
                                setCompanyDetail({ company: t.company, profile: t.profile });
                                // Fetch full company details
                                fetchCompanyDetail(t.company_id, t.user_id);
                              }}
                            >
                              {t.company.name}
                            </button>
                          ) : (
                            <span className="text-sm text-muted-foreground">Sistema</span>
                          )}
                        </TableCell>
                        <TableCell><Badge variant="outline" className="text-xs">{categoryMap[t.category] || t.category}</Badge></TableCell>
                        <TableCell><span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${priorityMap[t.priority]?.bg || ''} ${priorityMap[t.priority]?.text || ''}`}>{priorityMap[t.priority]?.label || t.priority}</span></TableCell>
                        <TableCell><Badge variant={s.variant} className="text-xs">{s.label}</Badge></TableCell>
                        <TableCell className="hidden md:table-cell text-xs text-muted-foreground">{format(new Date(t.created_at), 'dd/MM/yyyy HH:mm')}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm"><MessageSquare className="h-4 w-4" /></Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>

          {/* Pagination */}
          {!loading && totalPages > 1 && !searchQuery.trim() && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <p className="text-xs text-muted-foreground">
                Mostrando {rangeStart}–{rangeEnd} de {totalCount} tickets
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 0}
                  onClick={() => setCurrentPage(p => p - 1)}
                  className="h-8 px-2 text-xs"
                >
                  <ChevronLeft className="h-3.5 w-3.5 mr-1" />
                  Anterior
                </Button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i;
                  } else if (currentPage < 3) {
                    pageNum = i;
                  } else if (currentPage > totalPages - 4) {
                    pageNum = totalPages - 5 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={pageNum === currentPage ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className="h-8 w-8 p-0 text-xs"
                    >
                      {pageNum + 1}
                    </Button>
                  );
                })}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage >= totalPages - 1}
                  onClick={() => setCurrentPage(p => p + 1)}
                  className="h-8 px-2 text-xs"
                >
                  Próximo
                  <ChevronRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Ticket Detail Dialog */}
      <Dialog open={!!viewTicket} onOpenChange={() => setViewTicket(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
          <DialogHeader>
            {viewTicket?.protocol_number && (
              <p className="text-xs font-mono text-muted-foreground">{viewTicket.protocol_number}</p>
            )}
            <DialogTitle className="text-base">{viewTicket?.title}</DialogTitle>
            <div className="flex flex-wrap gap-2 mt-1">
              {viewTicket && <Badge variant={statusMap[viewTicket.status]?.variant || 'outline'} className="text-xs">{statusMap[viewTicket.status]?.label}</Badge>}
              {viewTicket && <Badge variant="outline" className="text-xs">{categoryMap[viewTicket.category] || viewTicket.category}</Badge>}
              {viewTicket && <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${priorityMap[viewTicket.priority]?.bg || ''} ${priorityMap[viewTicket.priority]?.text || ''}`}>{priorityMap[viewTicket.priority]?.label || viewTicket.priority}</span>}
              {viewTicket && <span className="text-xs text-muted-foreground">• {viewTicket.company?.name || 'Sistema'}</span>}
            </div>
          </DialogHeader>

          {viewTicket && (
            <p className="text-sm text-muted-foreground border-b pb-3">{viewTicket.description}</p>
          )}

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="border-b pb-3 space-y-2">
              <p className="text-xs font-semibold flex items-center gap-1"><Paperclip className="h-3 w-3" /> Anexos</p>
              <div className="space-y-2">
                {attachments.map(att => {
                  const url = att.file_url;
                  const fileType = getFileType(att.file_name);
                  return (
                    <div key={att.id} className="flex items-center gap-3 p-2 rounded-md bg-muted/50">
                      {isImage(fileType) ? (
                        <img
                          src={url}
                          alt={att.file_name}
                          className="w-16 h-16 rounded object-cover cursor-pointer border"
                          onClick={() => openPreview(att)}
                        />
                      ) : isVideo(fileType) ? (
                        <div className="w-16 h-16 rounded bg-muted flex items-center justify-center cursor-pointer border" onClick={() => openPreview(att)}>
                          <Film className="h-6 w-6 text-muted-foreground" />
                        </div>
                      ) : (
                        <div className="w-16 h-16 rounded bg-muted flex items-center justify-center border">
                          <FileText className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate max-w-[180px]" title={att.file_name}>{att.file_name}</p>
                        <p className="text-xs text-muted-foreground">{formatFileSize(att.file_size)}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openPreview(att)} title="Visualizar">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <a href={url} download={att.file_name} target="_blank" rel="noopener noreferrer">
                          <Button variant="ghost" size="icon" className="h-7 w-7" title="Baixar">
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </a>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Status change */}
          {viewTicket && (
            <div className="flex items-center gap-2 border-b pb-3">
              <span className="text-xs text-muted-foreground">Alterar status:</span>
              <Select value={viewTicket.status} onValueChange={v => updateTicketStatus(viewTicket.id, v)}>
                <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statusOptions.filter(s => s.value !== 'all').map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          <ScrollArea className="flex-1 min-h-0 max-h-[250px] pr-2">
            <div className="space-y-3 py-2">
              {messages.map(m => (
                <div key={m.id} className={`flex ${m.is_admin ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] rounded-lg p-3 text-sm ${m.is_admin ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                    {m.is_admin && <p className="text-xs font-semibold mb-1 opacity-70">Admin</p>}
                    <p className="whitespace-pre-wrap">{m.message}</p>
                    <p className={`text-xs mt-1 ${m.is_admin ? 'opacity-70' : 'text-muted-foreground'}`}>
                      {format(new Date(m.created_at), 'dd/MM HH:mm')}
                    </p>
                  </div>
                </div>
              ))}
              {messages.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">Nenhuma mensagem</p>}
            </div>
          </ScrollArea>

          <div className="flex gap-2 pt-2 border-t">
            <Input
              placeholder="Responder..."
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendAdminMessage()}
              className="flex-1"
            />
            <Button size="icon" onClick={sendAdminMessage} disabled={sending || !newMessage.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog open={!!previewUrl} onOpenChange={() => { setPreviewUrl(null); setPreviewType(''); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] p-2">
          <DialogHeader className="sr-only">
            <DialogTitle>Visualizar anexo</DialogTitle>
          </DialogHeader>
          {previewUrl && isImage(previewType) && (
            <img src={previewUrl} alt="Preview" className="w-full max-h-[80vh] object-contain rounded" />
          )}
          {previewUrl && isVideo(previewType) && (
            <video src={previewUrl} controls className="w-full max-h-[80vh] rounded" />
          )}
          {previewUrl && !isImage(previewType) && !isVideo(previewType) && (
            <iframe src={previewUrl} className="w-full h-[75vh] rounded border-0" />
          )}
        </DialogContent>
      </Dialog>

      {/* Company Detail Modal */}
      <Dialog open={!!companyDetail} onOpenChange={() => setCompanyDetail(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-primary" />
              Detalhes
            </DialogTitle>
          </DialogHeader>
          {companyDetail && (
            <div className="space-y-4">
              {companyDetail.company ? (
                <div className="space-y-2 border rounded-lg p-4 bg-muted/30">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    Empresa
                  </h4>
                  <p className="text-base font-medium">{companyDetail.company.name}</p>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Plano</p>
                      <p className="font-medium">{companyDetail.company.plan_name || 'Sem plano'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Status</p>
                      <Badge variant="outline" className="text-xs capitalize">{companyDetail.company.subscription_status || 'trial'}</Badge>
                    </div>
                    <div className="col-span-2">
                      <p className="text-muted-foreground text-xs">Criada em</p>
                      <p className="font-medium">{companyDetail.company.created_at ? format(new Date(companyDetail.company.created_at), 'dd/MM/yyyy') : '—'}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Nenhuma empresa vinculada (Sistema)</p>
              )}

              {companyDetail.profile && (
                <div className="space-y-2 border rounded-lg p-4 bg-muted/30">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    Usuário que abriu o ticket
                  </h4>
                  <p className="text-base font-medium">{companyDetail.profile.full_name}</p>
                  <p className="text-sm text-muted-foreground">{companyDetail.profile.email || '—'}</p>
                  <Badge variant="secondary" className="text-xs capitalize">{companyDetail.profile.role || 'Usuário'}</Badge>
                </div>
              )}

              <Button variant="outline" className="w-full" onClick={() => setCompanyDetail(null)}>
                Fechar
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SuperAdminSupport;
