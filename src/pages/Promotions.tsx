import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { format, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Plus, MessageCircle, Send, Users, Tag, Megaphone, Copy, Eye } from 'lucide-react';
import { formatWhatsApp, displayWhatsApp } from '@/lib/whatsapp';

interface Promotion {
  id: string;
  title: string;
  description: string | null;
  start_date: string;
  end_date: string;
  start_time: string | null;
  end_time: string | null;
  max_slots: number;
  used_slots: number;
  client_filter: string;
  client_filter_value: number | null;
  professional_filter: string;
  professional_ids: string[] | null;
  message_template: string | null;
  status: string;
  created_at: string;
}

interface ClientRow {
  id: string;
  name: string;
  whatsapp: string | null;
  last_visit?: string | null;
  total_spent?: number;
  birth_date?: string | null;
}

const MESSAGE_TAGS = [
  { tag: '{{cliente_nome}}', label: 'Nome do Cliente' },
  { tag: '{{cliente_aniversario}}', label: 'Aniversário' },
  { tag: '{{empresa_nome}}', label: 'Nome da Empresa' },
  { tag: '{{link_promocao}}', label: 'Link da Promoção' },
];

const DEFAULT_TEMPLATE = `Olá {{cliente_nome}}! 👋

Temos uma promoção especial para você na *{{empresa_nome}}*! 🎉

Acesse o link para agendar:
{{link_promocao}}

Te esperamos! 🙏`;

export default function Promotions() {
  const { companyId } = useAuth();
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPromotion, setSelectedPromotion] = useState<Promotion | null>(null);
  const [clientsDialogOpen, setClientsDialogOpen] = useState(false);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [maxSlots, setMaxSlots] = useState('10');
  const [clientFilter, setClientFilter] = useState('all');
  const [clientFilterValue, setClientFilterValue] = useState('30');
  const [professionalFilter, setProfessionalFilter] = useState('all');
  const [selectedProfessionalIds, setSelectedProfessionalIds] = useState<string[]>([]);
  const [messageTemplate, setMessageTemplate] = useState(DEFAULT_TEMPLATE);

  // Data for filters
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [filteredClients, setFilteredClients] = useState<ClientRow[]>([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [companyName, setCompanyName] = useState('');

  useEffect(() => {
    if (companyId) {
      fetchPromotions();
      fetchProfessionals();
      fetchCompanyName();
    }
  }, [companyId]);

  const fetchCompanyName = async () => {
    const { data } = await supabase.from('companies').select('name').eq('id', companyId!).single();
    if (data) setCompanyName(data.name);
  };

  const fetchPromotions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('promotions')
      .select('*')
      .eq('company_id', companyId!)
      .order('created_at', { ascending: false });

    if (!error && data) setPromotions(data as unknown as Promotion[]);
    setLoading(false);
  };

  const fetchProfessionals = async () => {
    const { data } = await supabase
      .from('collaborators')
      .select('profile_id, profiles!collaborators_profile_id_fkey(id, full_name, avatar_url)')
      .eq('company_id', companyId!)
      .eq('active', true);
    if (data) setProfessionals(data);
  };

  const fetchFilteredClients = async (promotion: Promotion) => {
    setClientsLoading(true);
    setSelectedPromotion(promotion);

    let query = supabase
      .from('clients')
      .select('id, name, whatsapp, birth_date, created_at')
      .eq('company_id', companyId!);

    const { data: clients } = await query;
    if (!clients) {
      setClientsLoading(false);
      return;
    }

    // Fetch appointment stats for each client
    const { data: appointments } = await supabase
      .from('appointments')
      .select('client_id, total_price, start_time, status')
      .eq('company_id', companyId!)
      .in('status', ['completed', 'confirmed']);

    const clientStats = new Map<string, { totalSpent: number; lastVisit: string | null }>();
    appointments?.forEach(apt => {
      if (!apt.client_id) return;
      const current = clientStats.get(apt.client_id) || { totalSpent: 0, lastVisit: null };
      current.totalSpent += Number(apt.total_price) || 0;
      if (!current.lastVisit || apt.start_time > current.lastVisit) {
        current.lastVisit = apt.start_time;
      }
      clientStats.set(apt.client_id, current);
    });

    let result: ClientRow[] = clients.map(c => {
      const stats = clientStats.get(c.id);
      return {
        id: c.id,
        name: c.name,
        whatsapp: c.whatsapp,
        birth_date: c.birth_date,
        last_visit: stats?.lastVisit || null,
        total_spent: stats?.totalSpent || 0,
      };
    });

    // Apply filters
    const filter = promotion.client_filter;
    const filterVal = promotion.client_filter_value;

    if (filter === 'birthday_month') {
      const currentMonth = new Date().getMonth() + 1;
      result = result.filter(c => {
        if (!c.birth_date) return false;
        const month = parseInt(c.birth_date.split('-')[1], 10);
        return month === currentMonth;
      });
    } else if (filter === 'top_spending') {
      result.sort((a, b) => (b.total_spent || 0) - (a.total_spent || 0));
      result = result.slice(0, filterVal || 20);
    } else if (filter === 'inactive') {
      const days = filterVal || 30;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      result = result.filter(c => {
        if (!c.last_visit) return true;
        return new Date(c.last_visit) < cutoff;
      });
    } else if (filter === 'new_clients') {
      const days = filterVal || 30;
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      result = result.filter(c => {
        const firstVisit = clients.find(cl => cl.id === c.id)?.created_at;
        return firstVisit && new Date(firstVisit) >= cutoff;
      });
    }

    setFilteredClients(result);
    setClientsLoading(false);
    setClientsDialogOpen(true);
  };

  const handleCreate = async () => {
    if (!title || !startDate || !endDate) {
      toast({ title: 'Preencha todos os campos obrigatórios', variant: 'destructive' });
      return;
    }

    const { error } = await supabase.from('promotions').insert({
      company_id: companyId!,
      title,
      description: description || null,
      start_date: startDate,
      end_date: endDate,
      start_time: startTime || null,
      end_time: endTime || null,
      max_slots: parseInt(maxSlots) || 0,
      client_filter: clientFilter,
      client_filter_value: ['inactive', 'new_clients', 'top_spending'].includes(clientFilter)
        ? parseInt(clientFilterValue) || null
        : null,
      professional_filter: professionalFilter,
      professional_ids: professionalFilter === 'selected' ? selectedProfessionalIds : null,
      message_template: messageTemplate,
      status: 'active',
    } as any);

    if (error) {
      toast({ title: 'Erro ao criar promoção', description: error.message, variant: 'destructive' });
      return;
    }

    toast({ title: 'Promoção criada com sucesso!' });
    setDialogOpen(false);
    resetForm();
    fetchPromotions();
  };

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setStartDate('');
    setEndDate('');
    setStartTime('');
    setEndTime('');
    setMaxSlots('10');
    setClientFilter('all');
    setClientFilterValue('30');
    setProfessionalFilter('all');
    setSelectedProfessionalIds([]);
    setMessageTemplate(DEFAULT_TEMPLATE);
  };

  const toggleStatus = async (promo: Promotion) => {
    const newStatus = promo.status === 'active' ? 'paused' : 'active';
    await supabase.from('promotions').update({ status: newStatus } as any).eq('id', promo.id);
    fetchPromotions();
  };

  const buildWhatsAppLink = (client: ClientRow, promotion: Promotion) => {
    if (!client.whatsapp) return '';
    const number = formatWhatsApp(client.whatsapp);
    const promoLink = `${window.location.origin}/barbearia/${companyName.toLowerCase().replace(/\s+/g, '-')}`;

    let msg = promotion.message_template || DEFAULT_TEMPLATE;
    msg = msg.replace(/\{\{cliente_nome\}\}/g, client.name);
    msg = msg.replace(/\{\{cliente_aniversario\}\}/g, client.birth_date ? format(parseISO(client.birth_date), 'dd/MM') : '');
    msg = msg.replace(/\{\{empresa_nome\}\}/g, companyName);
    msg = msg.replace(/\{\{link_promocao\}\}/g, promoLink);

    return `https://wa.me/${number}?text=${encodeURIComponent(msg)}`;
  };

  const insertTag = (tag: string) => {
    setMessageTemplate(prev => prev + tag);
  };

  const getFilterLabel = (filter: string) => {
    const labels: Record<string, string> = {
      all: 'Todos os clientes',
      birthday_month: 'Aniversariantes do mês',
      top_spending: 'Maiores gastos',
      inactive: 'Clientes inativos',
      new_clients: 'Clientes novos',
    };
    return labels[filter] || filter;
  };

  const remainingSlots = (p: Promotion) => p.max_slots > 0 ? p.max_slots - p.used_slots : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold">Promoções</h2>
          <p className="text-muted-foreground">Crie campanhas promocionais e envie via WhatsApp</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Promoção
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Criar Promoção</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Title */}
              <div>
                <Label>Título *</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Semana do Corte" />
              </div>

              {/* Description */}
              <div>
                <Label>Descrição</Label>
                <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalhes da promoção" />
              </div>

              {/* Dates */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Data Início *</Label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </div>
                <div>
                  <Label>Data Fim *</Label>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                </div>
              </div>

              {/* Times */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Horário Início</Label>
                  <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
                </div>
                <div>
                  <Label>Horário Fim</Label>
                  <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
                </div>
              </div>

              {/* Max slots */}
              <div>
                <Label>Vagas máximas</Label>
                <Input type="number" value={maxSlots} onChange={e => setMaxSlots(e.target.value)} min="0" />
                <p className="text-xs text-muted-foreground mt-1">0 = ilimitado</p>
              </div>

              {/* Professional filter */}
              <div>
                <Label>Profissionais participantes</Label>
                <Select value={professionalFilter} onValueChange={setProfessionalFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os profissionais</SelectItem>
                    <SelectItem value="selected">Selecionar profissionais</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {professionalFilter === 'selected' && (
                <div className="space-y-2 pl-2">
                  {professionals.map((p: any) => (
                    <label key={p.profile_id} className="flex items-center gap-2 cursor-pointer">
                      <Checkbox
                        checked={selectedProfessionalIds.includes(p.profile_id)}
                        onCheckedChange={(checked) => {
                          setSelectedProfessionalIds(prev =>
                            checked
                              ? [...prev, p.profile_id]
                              : prev.filter(id => id !== p.profile_id)
                          );
                        }}
                      />
                      <span className="text-sm">{p.profiles?.full_name}</span>
                    </label>
                  ))}
                </div>
              )}

              {/* Client filter */}
              <div>
                <Label>Filtro de clientes</Label>
                <Select value={clientFilter} onValueChange={setClientFilter}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os clientes</SelectItem>
                    <SelectItem value="birthday_month">Aniversariantes do mês</SelectItem>
                    <SelectItem value="top_spending">Maiores gastos</SelectItem>
                    <SelectItem value="inactive">Clientes inativos</SelectItem>
                    <SelectItem value="new_clients">Clientes novos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {['inactive', 'new_clients'].includes(clientFilter) && (
                <div>
                  <Label>{clientFilter === 'inactive' ? 'Dias sem visita' : 'Novos nos últimos X dias'}</Label>
                  <Input type="number" value={clientFilterValue} onChange={e => setClientFilterValue(e.target.value)} />
                </div>
              )}

              {clientFilter === 'top_spending' && (
                <div>
                  <Label>Quantidade de clientes</Label>
                  <Input type="number" value={clientFilterValue} onChange={e => setClientFilterValue(e.target.value)} />
                </div>
              )}

              {/* Message template */}
              <div>
                <Label>Mensagem WhatsApp</Label>
                <div className="flex flex-wrap gap-1 mb-2">
                  {MESSAGE_TAGS.map(t => (
                    <Button
                      key={t.tag}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => insertTag(t.tag)}
                      className="text-xs"
                    >
                      <Tag className="h-3 w-3 mr-1" />
                      {t.label}
                    </Button>
                  ))}
                </div>
                <Textarea
                  value={messageTemplate}
                  onChange={e => setMessageTemplate(e.target.value)}
                  rows={8}
                  className="font-mono text-sm"
                />
              </div>

              <Button onClick={handleCreate} className="w-full">
                <Megaphone className="h-4 w-4 mr-2" />
                Criar Promoção
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Promotions list */}
      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : promotions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Megaphone className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhuma promoção</h3>
            <p className="text-muted-foreground">Crie sua primeira promoção para engajar seus clientes.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {promotions.map(promo => {
            const remaining = remainingSlots(promo);
            const isExpired = new Date(promo.end_date) < new Date();
            const isActive = promo.status === 'active' && !isExpired;

            return (
              <Card key={promo.id} className={!isActive ? 'opacity-70' : ''}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{promo.title}</CardTitle>
                    <div className="flex gap-1">
                      {isActive && <Badge className="bg-green-600 text-white">Ativa</Badge>}
                      {promo.status === 'paused' && <Badge variant="secondary">Pausada</Badge>}
                      {isExpired && <Badge variant="outline">Expirada</Badge>}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {promo.description && (
                    <p className="text-sm text-muted-foreground">{promo.description}</p>
                  )}

                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>📅 {format(parseISO(promo.start_date), 'dd/MM/yyyy')} - {format(parseISO(promo.end_date), 'dd/MM/yyyy')}</span>
                    {promo.start_time && promo.end_time && (
                      <span>⏰ {promo.start_time.slice(0, 5)} - {promo.end_time.slice(0, 5)}</span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">
                      <Users className="h-3 w-3 mr-1" />
                      {getFilterLabel(promo.client_filter)}
                    </Badge>
                    {remaining !== null && (
                      <Badge variant={remaining <= 5 ? 'destructive' : 'outline'}>
                        {remaining <= 0 ? 'Esgotado' : remaining <= 5 ? `Últimas ${remaining} vagas` : `${remaining} vagas`}
                      </Badge>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleStatus(promo)}
                    >
                      {promo.status === 'active' ? 'Pausar' : 'Ativar'}
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => fetchFilteredClients(promo)}
                      disabled={!isActive}
                    >
                      <Send className="h-3 w-3 mr-1" />
                      Enviar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Client list dialog */}
      <Dialog open={clientsDialogOpen} onOpenChange={setClientsDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Clientes - {selectedPromotion?.title}
            </DialogTitle>
          </DialogHeader>

          {clientsLoading ? (
            <p className="text-muted-foreground py-4">Carregando clientes...</p>
          ) : filteredClients.length === 0 ? (
            <p className="text-muted-foreground py-4">Nenhum cliente encontrado com os filtros aplicados.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{filteredClients.length} cliente(s) encontrado(s)</p>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted">
                    <tr>
                      <th className="text-left p-3 font-medium">Nome</th>
                      <th className="text-left p-3 font-medium">WhatsApp</th>
                      <th className="text-left p-3 font-medium">Última Visita</th>
                      <th className="text-right p-3 font-medium">Total Gasto</th>
                      <th className="text-right p-3 font-medium">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClients.map(client => (
                      <tr key={client.id} className="border-t">
                        <td className="p-3">{client.name}</td>
                        <td className="p-3 text-muted-foreground">
                          {client.whatsapp ? displayWhatsApp(client.whatsapp) : '-'}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {client.last_visit
                            ? format(parseISO(client.last_visit), 'dd/MM/yyyy')
                            : '-'}
                        </td>
                        <td className="p-3 text-right">
                          R$ {(client.total_spent || 0).toFixed(2)}
                        </td>
                        <td className="p-3 text-right">
                          {client.whatsapp && selectedPromotion ? (
                            <a
                              href={buildWhatsAppLink(client, selectedPromotion)}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <Button size="sm" variant="outline" className="text-green-600">
                                <MessageCircle className="h-3 w-3 mr-1" />
                                WhatsApp
                              </Button>
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">Sem WhatsApp</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
