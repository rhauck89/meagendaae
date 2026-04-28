import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { toast } from 'sonner';
import { Clock, Check, X, MessageCircle, ArrowRight, Inbox, DollarSign, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { displayWhatsApp, openWhatsApp } from '@/lib/whatsapp';
import { sendAppointmentCreatedWebhook } from '@/lib/automations';

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
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [successDialogOpen, setSuccessDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [suggestedDate, setSuggestedDate] = useState('');
  const [suggestedTime, setSuggestedTime] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [processing, setProcessing] = useState(false);

  // Fee states
  const [feeType, setFeeType] = useState<'none' | '10' | '20' | '30' | 'fixed'>('none');
  const [fixedFeeValue, setFixedFeeValue] = useState('0');
  const [serviceInfo, setServiceInfo] = useState<{ price: number; duration: number; payment_method?: string } | null>(null);

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

  const handleAcceptClick = async (request: any) => {
    setSelectedRequest(request);
    setProcessing(true);
    
    // Check if requested date is Sunday
    try {
      const date = new Date(request.requested_date + 'T12:00:00');
      if (date.getDay() === 0) { // 0 is Sunday
        setFeeType('20');
      } else {
        setFeeType('none');
      }
    } catch (e) {
      setFeeType('none');
    }

    setFixedFeeValue('0');
    
    try {
      if (request.service_id) {
        const { data: svcData } = await supabase
          .from('services')
          .select('duration_minutes, price')
          .eq('id', request.service_id)
          .maybeSingle();
        
        // Also get default payment method from company if needed
        const { data: companyData } = await supabase
          .from('companies')
          .select('id, name')
          .eq('id', companyId!)
          .maybeSingle();

        if (svcData) {
          setServiceInfo({
            price: svcData.price || 0,
            duration: svcData.duration_minutes || 30,
            payment_method: 'Cartão ou Pix (no local)' // Standard default
          });
        }
      } else {
        setServiceInfo({ price: 0, duration: 30, payment_method: 'A combinar' });
      }
      setAcceptDialogOpen(true);
    } catch (err) {
      console.error('Error fetching service info:', err);
      toast.error('Erro ao buscar informações do serviço');
    } finally {
      setProcessing(false);
    }
  };

  const calculateExtraFee = () => {
    if (!serviceInfo) return 0;
    if (feeType === 'none') return 0;
    if (feeType === '10') return serviceInfo.price * 0.1;
    if (feeType === '20') return serviceInfo.price * 0.2;
    if (feeType === '30') return serviceInfo.price * 0.3;
    if (feeType === 'fixed') return parseFloat(fixedFeeValue) || 0;
    return 0;
  };

  const handleConfirmAccept = async () => {
    if (!selectedRequest || !serviceInfo) return;
    setProcessing(true);
    try {
      const extraFee = calculateExtraFee();
      const finalPrice = serviceInfo.price + extraFee;
      const startTime = new Date(`${selectedRequest.requested_date}T${selectedRequest.requested_time}`);
      const endTime = new Date(startTime.getTime() + serviceInfo.duration * 60 * 1000);

      const normalizedPhone = selectedRequest.client_whatsapp.replace(/\D/g, '');

      // 1. Garantir Client Global (Upsert com prioridade para user_id se existisse, mas aqui usamos o whatsapp)
      // Como estamos no painel admin aceitando uma solicitação, o "user" logado é o admin, não o cliente.
      // Buscamos se já existe um global_client com este whatsapp.
      const { data: globalClient, error: globalError } = await supabase
        .from('clients_global')
        .upsert({
          whatsapp: normalizedPhone,
          name: selectedRequest.client_name,
        }, { onConflict: 'whatsapp' })
        .select()
        .single();

      if (globalError || !globalClient) {
        console.error("ERRO AO GERAR CLIENT GLOBAL:", globalError);
        throw new Error("Erro ao vincular perfil global do cliente");
      }

      console.log("GLOBAL CLIENT:", globalClient);

      // 2. Garantir Client Local (Upsert)
      const { data: localClient, error: localError } = await supabase
        .from('clients' as any)
        .upsert({
          company_id: companyId!,
          global_client_id: globalClient.id,
          user_id: globalClient.user_id, // Se o global já tiver user_id vinculado
          name: selectedRequest.client_name,
          whatsapp: selectedRequest.client_whatsapp,
          updated_at: new Date().toISOString()
        }, { onConflict: 'company_id, whatsapp' })
        .select()
        .single();

      if (localError || !localClient) {
        console.error("ERRO AO GERAR CLIENT LOCAL:", localError);
        throw new Error("Erro ao vincular cliente à empresa");
      }

      console.log("LOCAL CLIENT:", localClient);

      // 3. Criar agendamento com IDs garantidos
      const insertData = {
        company_id: companyId!,
        client_id: localClient.id,
        user_id: globalClient.user_id,
        professional_id: selectedRequest.professional_id || Object.keys(professionals)[0],
        client_name: selectedRequest.client_name,
        client_whatsapp: selectedRequest.client_whatsapp,
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        total_price: finalPrice,
        original_price: finalPrice,
        extra_fee: extraFee,
        extra_fee_type: feeType,
        extra_fee_value: feeType === 'fixed' ? parseFloat(fixedFeeValue) : (feeType === 'none' ? 0 : parseInt(feeType)),
        final_price: finalPrice,
        special_schedule: true,
        status: 'confirmed' as any,
        notes: selectedRequest.message || null,
      };

      console.log("INSERT DATA:", insertData);

      const { data: apptData, error: apptError } = await supabase
        .from('appointments')
        .insert(insertData)
        .select('id')
        .single();

      if (apptError) {
        console.error("ERRO AO SALVAR AGENDAMENTO:", apptError);
        throw apptError;
      }

      // 4. Link service
      if (selectedRequest.service_id && apptData?.id) {
        await supabase.from('appointment_services').insert({
          appointment_id: apptData.id,
          service_id: selectedRequest.service_id,
          price: serviceInfo.price,
          duration_minutes: serviceInfo.duration,
        });
      }

      // 5. Update request status
      await supabase
        .from('appointment_requests' as any)
        .update({ status: 'accepted', updated_at: new Date().toISOString() })
        .eq('id', selectedRequest.id);

      setAcceptDialogOpen(false);
      setSuccessDialogOpen(true);
      fetchRequests();
    } catch (err: any) {
      console.error('Error accepting request:', err);
      toast.error(`Erro ao aceitar solicitação: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setProcessing(false);
    }
  };

  const getWhatsAppMessage = () => {
    if (!selectedRequest) return "";
    const dateStr = format(new Date(selectedRequest.requested_date + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR });
    const timeStr = selectedRequest.requested_time.slice(0, 5);
    const extraFee = calculateExtraFee();
    
    let message = `Olá ${selectedRequest.client_name}! Seu horário solicitado para ${dateStr} às ${timeStr} foi *aceito*. `;
    if (extraFee > 0) {
      message += `Como é um horário especial, haverá uma taxa adicional de R$ ${extraFee.toFixed(2)}. `;
    }
    message += `Estamos aguardando você!`;
    return message;
  };

  const handleNotifyWhatsApp = () => {
    if (!selectedRequest) return;
    const message = getWhatsAppMessage();
    const url = `https://wa.me/${selectedRequest.client_whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const handleCopyMessage = () => {
    const message = getWhatsAppMessage();
    navigator.clipboard.writeText(message);
    toast.success('Mensagem copiada para a área de transferência!');
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
      openWhatsApp(selectedRequest.client_whatsapp, { source: 'appointment-requests', message });

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
      openWhatsApp(selectedRequest.client_whatsapp, { source: 'appointment-requests', message });

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
                        <Button size="sm" variant="outline" className="gap-1 text-green-700 border-green-200 hover:bg-green-50" onClick={() => handleAcceptClick(req)} disabled={processing}>
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
      {/* Accept Confirmation Dialog */}
      <Dialog open={acceptDialogOpen} onOpenChange={setAcceptDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-600" />
              Confirmar Aceite
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 py-4">
            <div className="bg-muted/30 p-4 rounded-lg space-y-2 border">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Cliente:</span>
                <span className="font-semibold">{selectedRequest?.client_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Data/Hora:</span>
                <span className="font-semibold">
                  {selectedRequest && format(new Date(selectedRequest.requested_date + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR })} às {selectedRequest?.requested_time.slice(0, 5)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Serviço:</span>
                <span className="font-semibold">{services[selectedRequest?.service_id] || 'Serviço'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Duração:</span>
                <span className="font-semibold">{serviceInfo?.duration} min</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Pagamento:</span>
                <span className="font-semibold">{serviceInfo?.payment_method}</span>
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-sm font-bold flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Cobrar taxa extra por horário especial?
              </Label>
              
              <RadioGroup value={feeType} onValueChange={(val: any) => setFeeType(val)} className="grid grid-cols-2 gap-2">
                <div className="flex items-center space-x-2 border rounded-md p-2 hover:bg-accent cursor-pointer">
                  <RadioGroupItem value="none" id="fee-none" />
                  <Label htmlFor="fee-none" className="cursor-pointer">Sem taxa</Label>
                </div>
                <div className="flex items-center space-x-2 border rounded-md p-2 hover:bg-accent cursor-pointer">
                  <RadioGroupItem value="10" id="fee-10" />
                  <Label htmlFor="fee-10" className="cursor-pointer">+10%</Label>
                </div>
                <div className="flex items-center space-x-2 border rounded-md p-2 hover:bg-accent cursor-pointer">
                  <RadioGroupItem value="20" id="fee-20" />
                  <Label htmlFor="fee-20" className="cursor-pointer">+20%</Label>
                </div>
                <div className="flex items-center space-x-2 border rounded-md p-2 hover:bg-accent cursor-pointer">
                  <RadioGroupItem value="30" id="fee-30" />
                  <Label htmlFor="fee-30" className="cursor-pointer">+30%</Label>
                </div>
                <div className="flex items-center space-x-2 border rounded-md p-2 hover:bg-accent cursor-pointer col-span-2">
                  <RadioGroupItem value="fixed" id="fee-fixed" />
                  <Label htmlFor="fee-fixed" className="flex-1 cursor-pointer">Valor fixo R$</Label>
                  {feeType === 'fixed' && (
                    <Input 
                      type="number" 
                      className="w-24 h-8 ml-2" 
                      value={fixedFeeValue} 
                      onChange={(e) => setFixedFeeValue(e.target.value)}
                      placeholder="0.00"
                    />
                  )}
                </div>
              </RadioGroup>
            </div>

            {serviceInfo && (
              <div className="bg-primary/5 p-4 rounded-lg border border-primary/10 space-y-1">
                <p className="text-xs font-bold uppercase tracking-wider text-primary/70">Preview de Valores</p>
                <div className="flex justify-between text-sm">
                  <span>Serviço:</span>
                  <span>R$ {serviceInfo.price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm text-green-600 font-medium">
                  <span>Taxa extra (+):</span>
                  <span>R$ {calculateExtraFee().toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-base font-bold pt-1 border-t border-primary/10">
                  <span>Total:</span>
                  <span>R$ {(serviceInfo.price + calculateExtraFee()).toFixed(2)}</span>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAcceptDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleConfirmAccept} disabled={processing} className="bg-green-600 hover:bg-green-700">
              {processing ? 'Processando...' : 'Confirmar e Agendar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={successDialogOpen} onOpenChange={setSuccessDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <div className="flex flex-col items-center text-center py-6 space-y-4">
            <div className="h-16 w-16 bg-green-100 rounded-full flex items-center justify-center mb-2">
              <Check className="h-10 w-10 text-green-600" />
            </div>
            <DialogHeader>
              <DialogTitle className="text-xl">✅ Solicitação aceita com sucesso</DialogTitle>
            </DialogHeader>
            
            <div className="bg-muted/30 p-4 rounded-lg w-full space-y-2 border">
              <p className="text-sm flex justify-between"><span className="text-muted-foreground">Cliente:</span> <span className="font-semibold">{selectedRequest?.client_name}</span></p>
              <p className="text-sm flex justify-between">
                <span className="text-muted-foreground">Data:</span> <span className="font-semibold">{selectedRequest && format(new Date(selectedRequest.requested_date + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR })}</span>
              </p>
              <p className="text-sm flex justify-between"><span className="text-muted-foreground">Hora:</span> <span className="font-semibold">{selectedRequest?.requested_time.slice(0, 5)}</span></p>
            </div>

            <div className="w-full pt-4 space-y-2">
              <Button 
                onClick={handleNotifyWhatsApp} 
                className="w-full gap-2 bg-[#25D366] hover:bg-[#128C7E] text-white"
              >
                <MessageCircle className="h-5 w-5" />
                Avisar no WhatsApp
                <ExternalLink className="h-4 w-4 ml-auto opacity-50" />
              </Button>
              <div className="grid grid-cols-2 gap-2 w-full">
                <Button 
                  variant="outline" 
                  onClick={handleCopyMessage} 
                  className="gap-2"
                >
                  Copiar mensagem
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setSuccessDialogOpen(false)} 
                >
                  Apenas fechar
                </Button>
              </div>
            </div>
          </div>
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
