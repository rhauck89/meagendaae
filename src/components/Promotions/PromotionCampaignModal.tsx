import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogBody } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Search, Users, Calendar, Filter, Check, AlertCircle, Loader2, MessageCircle, PartyPopper } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, isWithinInterval, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';

interface PromotionCampaignModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promotion: any;
  whatsappMessage: string;
}

interface Client {
  id: string;
  name: string;
  whatsapp: string;
  birth_date?: string | null;
  appointments_count?: number;
  has_opt_out?: boolean;
}

export function PromotionCampaignModal({
  open,
  onOpenChange,
  promotion,
  whatsappMessage
}: PromotionCampaignModalProps) {
  const { companyId, user, roles } = useAuth();
  const [loading, setLoading] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'customers' | 'prospects' | 'birthday'>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmSpam, setConfirmSpam] = useState(false);
  const [creating, setCreating] = useState(false);
  const [success, setSuccess] = useState(false);
  const [lastCampaignCount, setLastCampaignCount] = useState(0);

  const isAdmin = roles.some(r => ['super_admin', 'professional', 'collaborator'].includes(r));

  useEffect(() => {
    if (open && companyId) {
      fetchClients();
    }
  }, [open, companyId, filter]);

  const fetchClients = async () => {
    setLoading(true);
    try {
      // 1. Fetch Opt-outs
      const { data: optOuts } = await supabase
        .from('promotional_opt_outs')
        .select('whatsapp')
        .eq('company_id', companyId);
      
      const optOutSet = new Set(optOuts?.map(o => o.whatsapp) || []);

      // 2. Fetch Clients with basic data
      let query = supabase
        .from('clients')
        .select(`
          id, 
          name, 
          whatsapp, 
          birth_date
        `)
        .eq('company_id', companyId);

      const { data: clientsData, error: clientsError } = await query;
      if (clientsError) throw clientsError;

      // 3. Fetch Appointment counts to distinguish customers vs prospects
      // Also filter by professional if not admin
      const { data: apptsData } = await supabase
        .from('appointments')
        .select('client_id, professional_id')
        .eq('company_id', companyId);

      const clientApptCounts: Record<string, number> = {};
      const professionalClientIds = new Set<string>();

      apptsData?.forEach(a => {
        clientApptCounts[a.client_id] = (clientApptCounts[a.client_id] || 0) + 1;
        if (a.professional_id === user?.id) {
          professionalClientIds.add(a.client_id);
        }
      });

      let processedClients: Client[] = (clientsData || []).map(c => ({
        ...c,
        appointments_count: clientApptCounts[c.id] || 0,
        has_opt_out: optOutSet.has(c.whatsapp)
      }));

      // Filter by professional permissions
      // Note: In this system, 'professional' role often means they only see their own stuff unless they are owners.
      // We assume if they have 'professional' but aren't the company owner/main admin, they only see their clients.
      // However, check roles. If they have 'super_admin' or they are the main profile, they see all.
      if (!isAdmin) {
        processedClients = processedClients.filter(c => professionalClientIds.has(c.id));
      }

      // Apply Filters
      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);

      if (filter === 'customers') {
        processedClients = processedClients.filter(c => (c.appointments_count || 0) > 0);
      } else if (filter === 'prospects') {
        processedClients = processedClients.filter(c => (c.appointments_count || 0) === 0);
      } else if (filter === 'birthday') {
        processedClients = processedClients.filter(c => {
          if (!c.birth_date) return false;
          try {
            const bday = parseISO(c.birth_date);
            return bday.getMonth() === now.getMonth();
          } catch {
            return false;
          }
        });
      }

      setClients(processedClients);
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast.error('Erro ao carregar clientes');
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = useMemo(() => {
    return clients.filter(c => 
      c.name.toLowerCase().includes(search.toLowerCase()) || 
      c.whatsapp.includes(search)
    );
  }, [clients, search]);

  const handleToggleSelect = (id: string, hasOptOut?: boolean) => {
    if (hasOptOut) return;
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleSelectAll = () => {
    const selectable = filteredClients.filter(c => !c.has_opt_out);
    if (selectedIds.size === selectable.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectable.map(c => c.id)));
    }
  };

  const handleCreateCampaign = async () => {
    if (selectedIds.size === 0) {
      toast.error('Selecione pelo menos um cliente');
      return;
    }

    if (selectedIds.size > 20 && !confirmSpam) {
      toast.error('Confirme que os clientes podem receber comunicações');
      return;
    }

    setCreating(true);
    try {
      // 1. Create Campaign
      const { data: campaign, error: campaignError } = await supabase
        .from('promotion_campaigns')
        .insert({
          company_id: companyId,
          promotion_id: promotion.id,
          professional_id: user?.id,
          title: promotion.title,
          message_body: whatsappMessage,
          status: 'pending',
          total_clients: selectedIds.size
        })
        .select()
        .single();

      if (campaignError) throw campaignError;

      // 2. Create Logs (Bulk Insert)
      const selectedClients = clients.filter(c => selectedIds.has(c.id));
      const logs = selectedClients.map(c => ({
        campaign_id: campaign.id,
        company_id: companyId,
        client_id: c.id,
        whatsapp: c.whatsapp,
        status: 'pending'
      }));

      const { error: logsError } = await supabase
        .from('promotion_campaign_logs')
        .insert(logs);

      if (logsError) throw logsError;

      toast.success('Campanha preparada com sucesso!', {
        description: 'O envio automático será ativado na próxima etapa.'
      });
      onOpenChange(false);
    } catch (error) {
      console.error('Error creating campaign:', error);
      toast.error('Erro ao preparar campanha');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[95vh] flex flex-col p-0">
        <DialogHeader className="p-4 border-b">
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-emerald-500" />
            Campanha de WhatsApp
          </DialogTitle>
        </DialogHeader>

        <DialogBody className="flex-1 overflow-hidden flex flex-col p-0">
          <div className="grid grid-cols-1 md:grid-cols-2 h-full">
            {/* Left Column: Client Selection */}
            <div className="flex flex-col border-r p-4 space-y-4 overflow-hidden">
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar por nome ou WhatsApp..." 
                    className="pl-9"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button 
                    variant={filter === 'all' ? 'default' : 'outline'} 
                    size="sm" 
                    className="h-8 text-xs"
                    onClick={() => setFilter('all')}
                  >
                    Todos
                  </Button>
                  <Button 
                    variant={filter === 'customers' ? 'default' : 'outline'} 
                    size="sm" 
                    className="h-8 text-xs"
                    onClick={() => setFilter('customers')}
                  >
                    Já agendaram
                  </Button>
                  <Button 
                    variant={filter === 'prospects' ? 'default' : 'outline'} 
                    size="sm" 
                    className="h-8 text-xs"
                    onClick={() => setFilter('prospects')}
                  >
                    Nunca agendaram
                  </Button>
                  <Button 
                    variant={filter === 'birthday' ? 'default' : 'outline'} 
                    size="sm" 
                    className="h-8 text-xs"
                    onClick={() => setFilter('birthday')}
                  >
                    Aniversariantes
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between py-2 border-b">
                <div className="flex items-center gap-2">
                  <Checkbox 
                    id="select-all" 
                    checked={filteredClients.length > 0 && selectedIds.size === filteredClients.filter(c => !c.has_opt_out).length}
                    onCheckedChange={handleSelectAll}
                  />
                  <label htmlFor="select-all" className="text-xs font-medium cursor-pointer">
                    Selecionar todos visíveis
                  </label>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {selectedIds.size} selecionados
                </span>
              </div>

              <ScrollArea className="flex-1 pr-4">
                {loading ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredClients.length === 0 ? (
                  <div className="text-center py-10 space-y-2">
                    <Users className="h-10 w-10 text-muted-foreground/20 mx-auto" />
                    <p className="text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredClients.map((client) => (
                      <div 
                        key={client.id}
                        className={cn(
                          "flex items-center gap-3 p-2 rounded-lg transition-colors border border-transparent",
                          client.has_opt_out ? "opacity-50 cursor-not-allowed bg-muted/30" : "hover:bg-muted/50 cursor-pointer",
                          selectedIds.has(client.id) && "bg-primary/5 border-primary/20"
                        )}
                        onClick={() => handleToggleSelect(client.id, client.has_opt_out)}
                      >
                        <Checkbox 
                          checked={selectedIds.has(client.id)} 
                          disabled={client.has_opt_out}
                          onCheckedChange={() => handleToggleSelect(client.id, client.has_opt_out)}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{client.name}</p>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span>{client.whatsapp}</span>
                            {client.appointments_count! > 0 && (
                              <Badge variant="secondary" className="px-1 h-3 text-[8px]">Cliente</Badge>
                            )}
                          </div>
                        </div>
                        {client.has_opt_out && (
                          <Badge variant="outline" className="text-[8px] border-red-200 text-red-500 whitespace-nowrap">Opt-out</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Right Column: Preview & Confirmation */}
            <div className="flex flex-col p-4 bg-muted/20 space-y-4">
              <div className="space-y-2">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Prévia da Mensagem</h4>
                <div className="relative">
                  <div className="absolute top-2 right-2 bg-emerald-500 text-white p-1 rounded-full shadow-lg">
                    <Check className="h-3 w-3" />
                  </div>
                  <Textarea 
                    value={whatsappMessage} 
                    readOnly 
                    className="min-h-[300px] text-sm bg-white resize-none shadow-sm leading-relaxed"
                  />
                </div>
              </div>

              {selectedIds.size > 20 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
                  <div className="flex items-center gap-2 text-amber-800">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-xs font-bold">Aviso: Segmento grande</span>
                  </div>
                  <p className="text-[10px] text-amber-700 leading-tight">
                    Você selecionou {selectedIds.size} clientes. Para evitar bloqueios, o sistema enviará as mensagens com intervalos aleatórios.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <Checkbox 
                      id="confirm-spam" 
                      checked={confirmSpam}
                      onCheckedChange={(checked) => setConfirmSpam(checked as boolean)}
                    />
                    <label htmlFor="confirm-spam" className="text-[10px] font-medium text-amber-900 leading-tight cursor-pointer">
                      Confirmo que estes clientes podem receber comunicações promocionais.
                    </label>
                  </div>
                </div>
              )}

              <div className="mt-auto space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Total de destinatários:</span>
                  <span className="font-bold">{selectedIds.size}</span>
                </div>
                <Button 
                  className="w-full gap-2 h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                  disabled={selectedIds.size === 0 || creating || (selectedIds.size > 20 && !confirmSpam)}
                  onClick={handleCreateCampaign}
                >
                  {creating ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      Preparando...
                    </>
                  ) : (
                    <>
                      <Check className="h-5 w-5" />
                      Confirmar Campanha
                    </>
                  )}
                </Button>
                <p className="text-[10px] text-center text-muted-foreground">
                  A campanha será registrada e enviada em fila.
                </p>
              </div>
            </div>
          </div>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
