import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogBody, DialogFooter, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeftRight, Calendar as CalendarIcon, Clock, Search, AlertTriangle, Check, MessageCircle, User, Loader2 } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { openWhatsApp } from '@/lib/whatsapp';

interface SwapAppointmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The appointment the user clicked "Trocar horário" on */
  source: any | null;
  /** Called after a successful swap so the parent can refresh */
  onSwapped?: () => void;
}

const SWAPPABLE_STATUSES = ['pending', 'confirmed'] as const;

export function SwapAppointmentDialog({ open, onOpenChange, source, onSwapped }: SwapAppointmentDialogProps) {
  const { companyId } = useAuth();
  const { isAdmin, profileId } = useUserRole();
  const [search, setSearch] = useState('');
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [companyName, setCompanyName] = useState('');

  useEffect(() => {
    if (!open) {
      setSearch('');
      setSelected(null);
      setCandidates([]);
    }
  }, [open]);

  useEffect(() => {
    if (open && source && companyId) {
      fetchCandidates();
      fetchCompanyName();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, source, companyId]);

  const fetchCompanyName = async () => {
    if (!companyId) return;
    const { data } = await supabase.from('companies').select('name').eq('id', companyId).maybeSingle();
    setCompanyName((data as any)?.name || '');
  };

  const fetchCandidates = async () => {
    if (!source || !companyId) return;
    setLoading(true);
    try {
      const nowIso = new Date().toISOString();
      let query = supabase
        .from('appointments')
        .select(`
          id, start_time, end_time, status, professional_id, total_price,
          client_name, client_whatsapp, promotion_id,
          professional:profiles!appointments_professional_id_fkey(full_name),
          appointment_services(duration_minutes, service:services(name))
        `)
        .eq('company_id', companyId)
        .in('status', SWAPPABLE_STATUSES)
        .gte('start_time', nowIso)
        .neq('id', source.id)
        .order('start_time', { ascending: true })
        .limit(50);

      // Collaborator-only: restrict to own appointments
      if (!isAdmin && profileId) {
        query = query.eq('professional_id', profileId);
      }

      const { data, error } = await query;
      if (error) {
        console.error('[SwapDialog] fetch error', error);
        toast.error('Erro ao carregar agendamentos');
        return;
      }

      const valid = (data || []).filter((a: any) => !a.promotion_id);

      // Fetch ALL active appointments for both involved professionals to validate compatibility
      const profIds = Array.from(new Set([source.professional_id, ...valid.map((c: any) => c.professional_id)]));
      const { data: allActive } = await supabase
        .from('appointments')
        .select('id, professional_id, start_time, end_time, status')
        .eq('company_id', companyId)
        .in('status', ['pending', 'confirmed', 'in_progress'])
        .in('professional_id', profIds)
        .gte('end_time', nowIso);

      const others = (allActive || []) as any[];
      const sourceStartMs = new Date(source.start_time).getTime();
      const sourceEndMs = new Date(source.end_time).getTime();
      const sourceDur = sourceEndMs - sourceStartMs;

      const annotated = valid.map((c: any) => {
        const cStart = new Date(c.start_time).getTime();
        const cEnd = new Date(c.end_time).getTime();
        const cDur = cEnd - cStart;

        // After swap: source goes into c's slot (start=cStart, end=cStart+sourceDur, prof=c.prof)
        // c goes into source's slot (start=sourceStart, end=sourceStart+cDur, prof=source.prof)
        const newAStart = cStart, newAEnd = cStart + sourceDur, newAProf = c.professional_id;
        const newBStart = sourceStartMs, newBEnd = sourceStartMs + cDur, newBProf = source.professional_id;

        const conflicts = others.some((o) => {
          if (o.id === source.id || o.id === c.id) return false;
          const oStart = new Date(o.start_time).getTime();
          const oEnd = new Date(o.end_time).getTime();
          if (o.professional_id === newAProf && oStart < newAEnd && oEnd > newAStart) return true;
          if (o.professional_id === newBProf && oStart < newBEnd && oEnd > newBStart) return true;
          return false;
        });

        return { ...c, _compatible: !conflicts };
      });

      setCandidates(annotated);
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((a) => {
      const name = (a.client_name || '').toLowerCase();
      const prof = (a.professional?.full_name || '').toLowerCase();
      const dateStr = format(parseISO(a.start_time), "dd/MM HH:mm");
      return name.includes(q) || prof.includes(q) || dateStr.includes(q);
    });
  }, [candidates, search]);

  // Compute preview times following the same logic as the RPC
  const preview = useMemo(() => {
    if (!source || !selected) return null;
    const aStart = new Date(source.start_time);
    const aEnd = new Date(source.end_time);
    const bStart = new Date(selected.start_time);
    const bEnd = new Date(selected.end_time);
    const aDur = aEnd.getTime() - aStart.getTime();
    const bDur = bEnd.getTime() - bStart.getTime();
    return {
      newA: { start: new Date(bStart.getTime()), end: new Date(bStart.getTime() + aDur), profId: selected.professional_id, profName: selected.professional?.full_name },
      newB: { start: new Date(aStart.getTime()), end: new Date(aStart.getTime() + bDur), profId: source.professional_id, profName: source.professional?.full_name },
    };
  }, [source, selected]);

  const handleConfirm = async () => {
    if (!source || !selected) return;
    setSubmitting(true);
    try {
      const { data, error } = await supabase.rpc('swap_appointments' as any, {
        p_appointment_a: source.id,
        p_appointment_b: selected.id,
        p_reason: null,
      });

      if (error) {
        toast.error(error.message || 'Erro ao trocar horários');
        return;
      }

      toast.success('Horários trocados com sucesso!');
      onSwapped?.();
      // Offer to open WhatsApp for both clients (one at a time)
      offerWhatsApp(source, preview!.newA);
      offerWhatsApp(selected, preview!.newB);
      onOpenChange(false);
    } catch (err: any) {
      console.error('[SwapDialog] swap error', err);
      toast.error(err?.message || 'Erro ao trocar horários');
    } finally {
      setSubmitting(false);
    }
  };

  const offerWhatsApp = (apt: any, newTimes: { start: Date }) => {
    if (!apt.client_whatsapp) return;
    const dateStr = format(newTimes.start, "dd/MM/yyyy", { locale: ptBR });
    const timeStr = format(newTimes.start, "HH:mm");
    const greeting = apt.client_name ? `Olá ${apt.client_name.split(' ')[0]} 👋` : 'Olá 👋';
    const message = [
      greeting,
      '',
      'Seu horário foi atualizado com sucesso.',
      '',
      `📅 Nova data: ${dateStr}`,
      `⏰ Novo horário: ${timeStr}`,
      companyName ? `📍 ${companyName}` : '',
      '',
      'Qualquer dúvida estamos à disposição!',
    ].filter(Boolean).join('\n');
    // Defer slightly so popups don't fight the toast/close animation
    setTimeout(() => openWhatsApp(apt.client_whatsapp, message), 200);
  };

  if (!source) return null;

  const sourceStart = parseISO(source.start_time);
  const sourceEnd = parseISO(source.end_time);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5 text-primary" />
            Trocar horário
          </DialogTitle>
          <DialogDescription>
            Selecione outro agendamento para trocar de horário com este.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          {/* Source appointment summary */}
          <div className="rounded-lg border bg-muted/40 p-3">
            <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Trocar horário de</p>
            <p className="font-display font-bold">{source.client_name || 'Cliente'}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-1">
              <span className="flex items-center gap-1"><CalendarIcon className="h-3.5 w-3.5" />{format(sourceStart, "dd 'de' MMMM", { locale: ptBR })}</span>
              <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{format(sourceStart, 'HH:mm')} – {format(sourceEnd, 'HH:mm')}</span>
              <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{source.professional?.full_name || 'Profissional'}</span>
            </div>
          </div>

          {/* Search */}
          <div className="space-y-2">
            <Label htmlFor="swap-search" className="text-sm">Buscar agendamento</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                id="swap-search"
                placeholder="Nome, profissional ou data (ex: 20/04)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Candidates list */}
          <div>
            <Label className="text-sm">Próximos agendamentos</Label>
            <ScrollArea className="h-[280px] mt-2 rounded-lg border">
              {loading ? (
                <div className="flex items-center justify-center h-[280px] text-muted-foreground gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[280px] text-center text-muted-foreground p-4">
                  <CalendarIcon className="h-10 w-10 opacity-30 mb-2" />
                  <p className="text-sm">Nenhum agendamento disponível para troca.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {filtered.map((apt) => {
                    const start = parseISO(apt.start_time);
                    const end = parseISO(apt.end_time);
                    const isSelected = selected?.id === apt.id;
                    return (
                      <button
                        key={apt.id}
                        type="button"
                        onClick={() => setSelected(apt)}
                        className={cn(
                          'w-full text-left px-3 py-3 hover:bg-muted/50 transition-colors flex items-start gap-3',
                          isSelected && 'bg-primary/5 hover:bg-primary/10'
                        )}
                      >
                        <div className={cn(
                          'mt-0.5 h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center',
                          isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                        )}>
                          {isSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <p className="font-semibold text-sm truncate">{apt.client_name || 'Cliente'}</p>
                            <Badge variant="outline" className="text-[10px]">
                              {format(start, "dd/MM", { locale: ptBR })} {format(start, 'HH:mm')}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {apt.professional?.full_name || 'Profissional'} · {format(start, 'HH:mm')}–{format(end, 'HH:mm')}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Preview */}
          {preview && selected && (
            <div className="rounded-lg border-2 border-primary/30 bg-primary/5 p-3 space-y-2">
              <p className="text-xs uppercase tracking-wide text-primary font-bold flex items-center gap-1">
                <ArrowLeftRight className="h-3.5 w-3.5" /> Prévia da troca
              </p>
              <div className="grid sm:grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="font-semibold">{source.client_name || 'A'}</p>
                  <p className="text-muted-foreground text-xs">
                    {format(sourceStart, 'dd/MM HH:mm')} → <span className="text-foreground font-semibold">{format(preview.newA.start, 'dd/MM HH:mm')}</span>
                  </p>
                  {preview.newA.profId !== source.professional_id && (
                    <p className="text-[11px] text-amber-600 mt-0.5">Novo prof: {preview.newA.profName}</p>
                  )}
                </div>
                <div>
                  <p className="font-semibold">{selected.client_name || 'B'}</p>
                  <p className="text-muted-foreground text-xs">
                    {format(parseISO(selected.start_time), 'dd/MM HH:mm')} → <span className="text-foreground font-semibold">{format(preview.newB.start, 'dd/MM HH:mm')}</span>
                  </p>
                  {preview.newB.profId !== selected.professional_id && (
                    <p className="text-[11px] text-amber-600 mt-0.5">Novo prof: {preview.newB.profName}</p>
                  )}
                </div>
              </div>
              {(source.client_whatsapp || selected.client_whatsapp) && (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1 pt-1 border-t border-primary/10">
                  <MessageCircle className="h-3 w-3" /> Após confirmar, o WhatsApp abrirá para avisar cada cliente.
                </p>
              )}
            </div>
          )}

          {!selected && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Selecione um agendamento acima para visualizar a prévia.
            </p>
          )}
        </DialogBody>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!selected || submitting}>
            {submitting ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Trocando…</> : <><ArrowLeftRight className="h-4 w-4 mr-1" /> Confirmar troca</>}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SwapAppointmentDialog;
