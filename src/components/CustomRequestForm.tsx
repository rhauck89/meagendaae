import { useState, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Clock, Send, CheckCircle2, MessageCircle } from 'lucide-react';
import { formatWhatsApp } from '@/lib/whatsapp';

function applyWhatsAppMask(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

interface CustomRequestFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  services: Array<{ id: string; name: string }>;
  professionals?: Array<{ id: string; full_name: string }>;
  themeColors?: {
    accent: string;
    card: string;
    border: string;
    text: string;
    textSec: string;
    bg: string;
  };
}

function buildWhatsAppUrl(professionalWhatsApp: string, data: {
  clientName: string;
  serviceName: string;
  requestedDate: string;
  requestedTime: string;
  message: string | null;
}): string {
  const dateParts = data.requestedDate.split('-');
  const formattedDate = dateParts.length === 3
    ? `${dateParts[2]}/${dateParts[1]}/${dateParts[0]}`
    : data.requestedDate;

  let text = `Olá! Acabei de solicitar um horário personalizado pelo Me Agenda Aê.\n\nNome: ${data.clientName}\nServiço: ${data.serviceName}\nData desejada: ${formattedDate}\nHorário desejado: ${data.requestedTime}`;

  if (data.message) {
    text += `\n\nMensagem:\n${data.message}`;
  }

  return `https://wa.me/${professionalWhatsApp}?text=${encodeURIComponent(text)}`;
}

export function CustomRequestForm({ open, onOpenChange, companyId, services, professionals, themeColors }: CustomRequestFormProps) {
  const T = themeColors || { accent: 'hsl(var(--primary))', card: 'hsl(var(--card))', border: 'hsl(var(--border))', text: 'hsl(var(--foreground))', textSec: 'hsl(var(--muted-foreground))', bg: 'hsl(var(--background))' };

  const [form, setForm] = useState({
    client_name: '',
    client_whatsapp: '',
    service_id: '',
    professional_id: '',
    requested_date: '',
    requested_time: '',
    message: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [whatsAppUrl, setWhatsAppUrl] = useState<string | null>(null);

  const handleWhatsAppChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const masked = applyWhatsAppMask(e.target.value);
    setForm(prev => ({ ...prev, client_whatsapp: masked }));
  }, []);

  // Auto-open WhatsApp after submission
  useEffect(() => {
    if (submitted && whatsAppUrl) {
      const timer = setTimeout(() => {
        window.open(whatsAppUrl, '_blank');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [submitted, whatsAppUrl]);

  const openWhatsApp = () => {
    if (whatsAppUrl) {
      window.open(whatsAppUrl, '_blank');
    }
  };

  const handleSubmit = async () => {
    if (!form.client_name.trim()) return toast.error('Informe seu nome');
    const rawDigits = form.client_whatsapp.replace(/\D/g, '');
    if (rawDigits.length !== 11) return toast.error('Digite um WhatsApp válido');
    if (!form.service_id) return toast.error('Selecione um serviço');
    if (!form.requested_date) return toast.error('Selecione uma data');
    if (!form.requested_time) return toast.error('Informe o horário desejado');

    setSubmitting(true);
    try {
      const { error } = await supabase.from('appointment_requests' as any).insert({
        company_id: companyId,
        service_id: form.service_id,
        professional_id: form.professional_id || null,
        client_name: form.client_name.trim(),
        client_whatsapp: formatWhatsApp(form.client_whatsapp),
        requested_date: form.requested_date,
        requested_time: form.requested_time,
        message: form.message.trim() || null,
        created_at: new Date().toISOString(),
        status: 'pending',
      });

      if (error) throw error;

      // Build WhatsApp URL using company whatsapp (accessible to anon users)
      const serviceName = services.find(s => s.id === form.service_id)?.name || '';

      try {
        const { data: companyData } = await supabase
          .from('public_company' as any)
          .select('whatsapp')
          .eq('id', companyId)
          .maybeSingle();

        const whatsappNumber = (companyData as any)?.whatsapp;
        if (whatsappNumber) {
          const normalizedPhone = formatWhatsApp(whatsappNumber);
          const url = buildWhatsAppUrl(normalizedPhone, {
            clientName: form.client_name.trim(),
            serviceName,
            requestedDate: form.requested_date,
            requestedTime: form.requested_time,
            message: form.message.trim() || null,
          });
          setWhatsAppUrl(url);
        }
      } catch {
        // Silently fail - WhatsApp is optional
      }

      setSubmitted(true);
      toast.success('Solicitação enviada com sucesso! O profissional irá avaliar sua disponibilidade.');
    } catch (err) {
      console.error('Error submitting custom request:', err);
      toast.error('Erro ao enviar solicitação. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    if (submitted) {
      setSubmitted(false);
      setWhatsAppUrl(null);
      setForm({ client_name: '', client_whatsapp: '', service_id: '', professional_id: '', requested_date: '', requested_time: '', message: '' });
    }
  };

  if (submitted) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-md">
          <div className="flex flex-col items-center text-center py-6 space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-xl font-bold">Solicitação enviada!</h3>
            <p className="text-sm text-muted-foreground">
              Sua solicitação de horário personalizado foi enviada com sucesso.
              O profissional irá analisar e responder pelo WhatsApp.
            </p>
            {whatsAppUrl && (
              <Button
                onClick={openWhatsApp}
                variant="outline"
                className="w-full gap-2"
              >
                <MessageCircle className="h-4 w-4" />
                Avisar pelo WhatsApp novamente
              </Button>
            )}
            <Button onClick={handleClose} className="w-full">Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Solicitar horário personalizado
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            Não encontrou o horário ideal? Solicite um horário personalizado e o profissional irá avaliar sua disponibilidade.
          </p>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Nome *</Label>
            <Input
              value={form.client_name}
              onChange={(e) => setForm({ ...form, client_name: e.target.value })}
              placeholder="Seu nome completo"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">WhatsApp *</Label>
            <Input
              value={form.client_whatsapp}
              onChange={handleWhatsAppChange}
              placeholder="(00) 00000-0000"
              maxLength={15}
              inputMode="numeric"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Serviço *</Label>
            <Select value={form.service_id} onValueChange={(v) => setForm({ ...form, service_id: v })}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o serviço" />
              </SelectTrigger>
              <SelectContent>
                {services.map((svc) => (
                  <SelectItem key={svc.id} value={svc.id}>{svc.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {professionals && professionals.length > 1 && (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Profissional (opcional)</Label>
              <Select value={form.professional_id} onValueChange={(v) => setForm({ ...form, professional_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Qualquer profissional" />
                </SelectTrigger>
                <SelectContent>
                  {professionals.map((prof) => (
                    <SelectItem key={prof.id} value={prof.id}>{prof.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Data desejada *</Label>
              <Input
                type="date"
                value={form.requested_date}
                onChange={(e) => setForm({ ...form, requested_date: e.target.value })}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Horário desejado *</Label>
              <Input
                type="time"
                value={form.requested_time}
                onChange={(e) => setForm({ ...form, requested_time: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Mensagem (opcional)</Label>
            <Textarea
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Observações ou preferências..."
              rows={3}
              maxLength={500}
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full gap-2"
          >
            <Send className="h-4 w-4" />
            {submitting ? 'Enviando...' : 'Enviar solicitação'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
