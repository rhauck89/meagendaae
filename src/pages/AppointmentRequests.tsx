import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Clock, Check, X, MessageCircle, ArrowRight, Inbox } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { displayWhatsApp, formatWhatsApp } from '@/lib/whatsapp';

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800' },
  accepted: { label: 'Aceito', color: 'bg-green-100 text-green-800' },
  suggested: { label: 'Sugerido', color: 'bg-blue-100 text-blue-800' },
  rejected: { label: 'Recusado', color: 'bg-red-100 text-red-800' },
};

const AppointmentRequests = () => {
  const { companyId, profile } = useAuth();
  const { isAdmin, profileId } = useUserRole();
  const [requests, setRequests] = useState<any[]>([]);
  const [services, setServices] = useState<Record<string, string>>({});
  const [professionals, setProfessionals] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Dialog states
  const [suggestDialogOpen, setSuggestDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [suggestedDate, setSuggestedDate] = useState('');
  const [suggestedTime, setSuggestedTime] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (companyId) {
      fetchRequests();
      fetchServices();
      fetchProfessionals();
    }
  }, [companyId]);

  const fetchRequests = async () => {
    setLoading(true);
    let query = supabase
      .from('appointment_requests' as any)
      .select('*')
      .eq('company_id', companyId!)
      .order('created_at', { ascending: false });
    
    // Professionals only see their own requests
    if (!isAdmin && profileId) {
      query = query.eq('professional_id', profileId);
    }
    
    const { data } = await query;
    if (data) setRequests(data as any[]);
    setLoading(false);
  };

  const fetchServices = async () => {
    const { data } = await supabase.from('services').select('id, name').eq('company_id', companyId!);
    if (data) {
      const map: Record<string, string> = {};
      data.forEach((s) => { map[s.id] = s.name; });
      setServices(map);
    }
  };

  const fetchProfessionals = async () => {
    const { data } = await supabase
      .from('collaborators')
      .select('profile_id, profiles!collaborators_profile_id_fkey(full_name)')
      .eq('company_id', companyId!)
      .eq('active', true);
    if (data) {
      const map: Record<string, string> = {};
      data.forEach((c: any) => { map[c.profile_id] = c.profiles?.full_name || 'Profissional'; });
      setProfessionals(map);
    }
  };

  const handleAccept = async (request: any) => {
    setProcessing(true);
    try {
      // 1. Get service duration to calculate end_time
      let durationMinutes = 30; // default
      let servicePrice = 0;
      if (request.service_id) {
        const { data: svcData } = await supabase
          .from('services')
          .select('duration_minutes, price')
          .eq('id', request.service_id)
          .maybeSingle();
        if (svcData) {
          durationMinutes = svcData.duration_minutes || 30;
          servicePrice = svcData.price || 0;
        }
      }

      // 2. Build start_time and end_time timestamps
      const startTime = new Date(`${request.requested_date}T${request.requested_time}`);
      const endTime = new Date(startTime.getTime() + durationMinutes * 60 * 1000);

      // 3. Create appointment
      const { data: apptData, error: apptError } = await supabase
        .from('appointments')
        .insert({
          company_id: companyId!,
          professional_id: request.professional_id || Object.keys(professionals)[0],
          client_name: request.client_name,
          client_whatsapp: request.client_whatsapp,
          start_time: startTime.toISOString(),
          end_time: endTime.toISOString(),
          total_price: servicePrice,
          status: 'confirmed' as any,
          notes: request.message || null,
        })
        .select('id')
        .single();

      if (apptError) throw apptError;

      // 3b. Link service to appointment via appointment_services
      if (request.service_id && apptData?.id) {
        await supabase.from('appointment_services').insert({
          appointment_id: apptData.id,
          service_id: request.service_id,
          price: servicePrice,
          duration_minutes: durationMinutes,
        });
      }

      // 4. Update request status
      await supabase
        .from('appointment_requests' as any)
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', request.id);

      toast.success('Solicitação aceita e agendamento criado!');

      // 5. Open WhatsApp to notify client
      const message = `Olá ${request.client_name}! Seu horário solicitado para ${format(new Date(request.requested_date + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR })} às ${request.requested_time.slice(0, 5)} foi *aceito*. Estamos aguardando você!`;
      const whatsappUrl = `https://wa.me/${formatWhatsApp(request.client_whatsapp)}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');

      fetchRequests();
    } catch (err) {
      console.error('Error accepting request:', err);
      toast.error('Erro ao aceitar solicitação');
    } finally {
      setProcessing(false);
    }
  };

  const handleSuggest = async () => {
    if (!suggestedDate || !suggestedTime) return toast.error('Preencha data e horário sugeridos');
    setProcessing(true);
    try {
      await supabase
        .from('appointment_requests' as any)
        .update({
          status: 'suggested',
          suggested_date: suggestedDate,
          suggested_time: suggestedTime,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedRequest.id);

      const message = `Olá ${selectedRequest.client_name}! Não temos disponibilidade no horário solicitado, mas gostaríamos de sugerir: *${format(new Date(suggestedDate + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR })} às ${suggestedTime}*. Pode ser?`;
      const whatsappUrl = `https://wa.me/${formatWhatsApp(selectedRequest.client_whatsapp)}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');

      toast.success('Sugestão enviada');
      setSuggestDialogOpen(false);
      setSuggestedDate('');
      setSuggestedTime('');
      fetchRequests();
    } catch {
      toast.error('Erro ao sugerir horário');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    setProcessing(true);
    try {
      await supabase
        .from('appointment_requests' as any)
        .update({
          status: 'rejected',
          rejection_reason: rejectionReason || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedRequest.id);

      const message = `Olá ${selectedRequest.client_name}! Infelizmente não conseguimos atender sua solicitação de horário.${rejectionReason ? ` Motivo: ${rejectionReason}` : ''} Por favor, tente agendar em outro horário pelo nosso link.`;
      const whatsappUrl = `https://wa.me/${formatWhatsApp(selectedRequest.client_whatsapp)}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');

      toast.success('Solicitação recusada');
      setRejectDialogOpen(false);
      setRejectionReason('');
      fetchRequests();
    } catch {
      toast.error('Erro ao recusar solicitação');
    } finally {
      setProcessing(false);
    }
  };

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-display font-bold flex items-center gap-2">
          <Inbox className="h-5 w-5" />
          Solicitações de Horário
          {pendingCount > 0 && (
            <Badge variant="destructive" className="ml-2">{pendingCount} pendente{pendingCount > 1 ? 's' : ''}</Badge>
          )}
        </h2>
        <p className="text-sm text-muted-foreground">Gerencie solicitações de horários personalizados dos clientes</p>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Carregando...</div>
      ) : requests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12 text-center">
            <Inbox className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">Nenhuma solicitação de horário recebida</p>
            <p className="text-xs text-muted-foreground mt-1">Quando clientes solicitarem horários personalizados, elas aparecerão aqui.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => {
            const status = statusLabels[req.status] || statusLabels.pending;
            return (
              <Card key={req.id}>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">{req.client_name}</span>
                        <Badge className={`text-xs ${status.color}`}>{status.label}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span>{displayWhatsApp(req.client_whatsapp)}</span>
                        <span>•</span>
                        <span>{services[req.service_id] || 'Serviço'}</span>
                        {req.professional_id && professionals[req.professional_id] && (
                          <>
                            <span>•</span>
                            <span>{professionals[req.professional_id]}</span>
                          </>
                        )}
                        {isAdmin && req.professional_id && req.professional_id !== profileId && (
                          <Badge variant="secondary" className="text-[10px] ml-1">Visualização</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="font-medium">
                          {format(new Date(req.requested_date + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR })} às {req.requested_time?.slice(0, 5)}
                        </span>
                      </div>
                      {req.message && (
                        <p className="text-xs text-muted-foreground italic mt-1">"{req.message}"</p>
                      )}
                      {req.status === 'suggested' && req.suggested_date && (
                        <div className="flex items-center gap-1 text-xs text-blue-600 mt-1">
                          <ArrowRight className="h-3 w-3" />
                          Sugerido: {format(new Date(req.suggested_date + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR })} às {req.suggested_time?.slice(0, 5)}
                        </div>
                      )}
                    </div>

                    {req.status === 'pending' && (!isAdmin || !req.professional_id || req.professional_id === profileId) && (
                      <div className="flex items-center gap-2 shrink-0">
                        <Button size="sm" variant="outline" className="gap-1 text-green-700 border-green-200 hover:bg-green-50" onClick={() => handleAccept(req)} disabled={processing}>
                          <Check className="h-3.5 w-3.5" /> Aceitar
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1 text-blue-700 border-blue-200 hover:bg-blue-50" onClick={() => { setSelectedRequest(req); setSuggestDialogOpen(true); }} disabled={processing}>
                          <MessageCircle className="h-3.5 w-3.5" /> Sugerir
                        </Button>
                        <Button size="sm" variant="outline" className="gap-1 text-red-700 border-red-200 hover:bg-red-50" onClick={() => { setSelectedRequest(req); setRejectDialogOpen(true); }} disabled={processing}>
                          <X className="h-3.5 w-3.5" /> Recusar
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Suggest Dialog */}
      <Dialog open={suggestDialogOpen} onOpenChange={setSuggestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sugerir outro horário</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Sugira uma data e horário alternativos para {selectedRequest?.client_name}.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Data sugerida</Label>
                <Input type="date" value={suggestedDate} onChange={(e) => setSuggestedDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Horário sugerido</Label>
                <Input type="time" value={suggestedTime} onChange={(e) => setSuggestedTime(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuggestDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSuggest} disabled={processing}>
              {processing ? 'Enviando...' : 'Enviar sugestão'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Recusar solicitação</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Informe o motivo da recusa (opcional). Uma mensagem será enviada ao cliente via WhatsApp.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs">Motivo (opcional)</Label>
              <Textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Ex: Agenda lotada nesse dia..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleReject} disabled={processing}>
              {processing ? 'Recusando...' : 'Confirmar recusa'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AppointmentRequests;
