import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Navigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { calculateAvailableSlots, type BusinessHours, type BusinessException, type ExistingAppointment, type BlockedTime } from '@/lib/availability-engine';
import { Bug, Database, Users, Clock, Link2, ShieldAlert, Zap } from 'lucide-react';

const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const DebugAgenda = () => {
  const { user, loading: authLoading } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [services, setServices] = useState<any[]>([]);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [spLinks, setSpLinks] = useState<any[]>([]);
  const [businessHours, setBusinessHours] = useState<any[]>([]);
  const [profHours, setProfHours] = useState<any[]>([]);
  const [blockedTimes, setBlockedTimes] = useState<any[]>([]);
  const [bufferMinutes, setBufferMinutes] = useState(0);
  const [exceptions, setExceptions] = useState<BusinessException[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Slot test
  const [testProfId, setTestProfId] = useState<string>('');
  const [testDate, setTestDate] = useState<Date | undefined>(new Date());
  const [testDuration, setTestDuration] = useState(30);
  const [generatedSlots, setGeneratedSlots] = useState<string[]>([]);
  const [slotLog, setSlotLog] = useState<string>('');

  useEffect(() => {
    if (user) loadAll();
  }, [user]);

  const loadAll = async () => {
    setError(null);
    try {
      // Get company
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user!.id)
        .single();

      if (!profile?.company_id) {
        setError('Nenhuma empresa encontrada para este usuário.');
        setLoaded(true);
        return;
      }
      const cid = profile.company_id;
      setCompanyId(cid);

      const [svcRes, profRes, spRes, bhRes, phRes, btRes, compRes, exRes] = await Promise.all([
        supabase.from('services').select('*').eq('company_id', cid),
        supabase.from('collaborators').select('id, profile_id, slug, active, collaborator_type, profiles!collaborators_profile_id_fkey(full_name)').eq('company_id', cid),
        supabase.from('service_professionals').select('*').eq('company_id', cid),
        supabase.from('business_hours').select('*').eq('company_id', cid).order('day_of_week'),
        supabase.from('professional_working_hours').select('*').eq('company_id', cid).order('professional_id').order('day_of_week'),
        supabase.from('blocked_times').select('*').eq('company_id', cid).order('block_date'),
        supabase.from('companies').select('buffer_minutes').eq('id', cid).single(),
        supabase.from('business_exceptions').select('*').eq('company_id', cid),
      ]);

      setServices(svcRes.data || []);
      setProfessionals((profRes.data || []).map((c: any) => ({
        ...c,
        name: c.profiles?.full_name || 'N/A',
      })));
      setSpLinks(spRes.data || []);
      setBusinessHours(bhRes.data || []);
      setProfHours(phRes.data || []);
      setBlockedTimes(btRes.data || []);
      setBufferMinutes((compRes.data as any)?.buffer_minutes || 0);
      setExceptions((exRes.data || []) as BusinessException[]);
    } catch (err: any) {
      setError(err.message);
    }
    setLoaded(true);
  };

  const handleGenerateSlots = () => {
    if (!testProfId || !testDate) return;

    const dateStr = format(testDate, 'yyyy-MM-dd');
    const profSpecificHours = profHours.filter((h: any) => h.professional_id === testProfId);
    const profBlockedTimes = blockedTimes.filter((bt: any) => bt.professional_id === testProfId && bt.block_date === dateStr);

    const slots = calculateAvailableSlots({
      date: testDate,
      totalDuration: testDuration,
      businessHours: businessHours as BusinessHours[],
      exceptions,
      existingAppointments: [],
      slotInterval: 15,
      bufferMinutes,
      professionalHours: profSpecificHours.length > 0 ? (profSpecificHours as BusinessHours[]) : undefined,
      blockedTimes: profBlockedTimes as BlockedTime[],
      professionalId: testProfId,
    });

    setGeneratedSlots(slots);
    setSlotLog(JSON.stringify({
      date: dateStr,
      professional_id: testProfId,
      duration: testDuration,
      buffer: bufferMinutes,
      businessHoursCount: businessHours.length,
      profHoursCount: profSpecificHours.length,
      usingProfHours: profSpecificHours.length > 0,
      blockedCount: profBlockedTimes.length,
      slotsGenerated: slots.length,
    }, null, 2));
  };

  if (authLoading) return <div className="min-h-screen flex items-center justify-center"><p>Carregando...</p></div>;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-destructive/10 rounded-lg flex items-center justify-center">
            <Bug className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Debug Agenda</h1>
            <p className="text-sm text-muted-foreground">Painel de diagnóstico de disponibilidade</p>
          </div>
          <Button variant="outline" size="sm" className="ml-auto" onClick={loadAll}>Recarregar</Button>
        </div>

        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-4">
              <p className="text-destructive flex items-center gap-2"><ShieldAlert className="h-4 w-4" /> {error}</p>
            </CardContent>
          </Card>
        )}

        {loaded && !error && (
          <>
            {/* Summary badges */}
            <div className="flex flex-wrap gap-3">
              <Badge variant="outline" className="text-sm px-3 py-1.5 gap-1.5">
                <Database className="h-3.5 w-3.5" /> Serviços: {services.length}
              </Badge>
              <Badge variant="outline" className="text-sm px-3 py-1.5 gap-1.5">
                <Users className="h-3.5 w-3.5" /> Profissionais: {professionals.length}
              </Badge>
              <Badge variant="outline" className="text-sm px-3 py-1.5 gap-1.5">
                <Link2 className="h-3.5 w-3.5" /> Vínculos: {spLinks.length}
              </Badge>
              <Badge variant="outline" className="text-sm px-3 py-1.5 gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Horários empresa: {businessHours.length}
              </Badge>
              <Badge variant="outline" className="text-sm px-3 py-1.5 gap-1.5">
                <Clock className="h-3.5 w-3.5" /> Horários profissionais: {profHours.length}
              </Badge>
              <Badge variant="outline" className="text-sm px-3 py-1.5 gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5" /> Bloqueios: {blockedTimes.length}
              </Badge>
              <Badge variant="outline" className="text-sm px-3 py-1.5 gap-1.5">
                Buffer: {bufferMinutes}min
              </Badge>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {/* Services */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Serviços ({services.length})</CardTitle></CardHeader>
                <CardContent>
                  {services.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum serviço cadastrado</p> : (
                    <div className="space-y-1 text-sm">
                      {services.map((s: any) => (
                        <div key={s.id} className="flex justify-between items-center py-1 border-b border-border/50 last:border-0">
                          <span className="font-medium">{s.name}</span>
                          <span className="text-muted-foreground">{s.duration_minutes}min · R$ {Number(s.price).toFixed(2)} {!s.active && <Badge variant="secondary" className="ml-1 text-xs">Inativo</Badge>}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Professionals */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Profissionais ({professionals.length})</CardTitle></CardHeader>
                <CardContent>
                  {professionals.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum profissional cadastrado</p> : (
                    <div className="space-y-1 text-sm">
                      {professionals.map((p: any) => (
                        <div key={p.id} className="flex justify-between items-center py-1 border-b border-border/50 last:border-0">
                          <span className="font-medium">{p.name}</span>
                          <span className="text-muted-foreground text-xs font-mono">
                            {p.slug || 'sem slug'} · {p.active ? '✅' : '❌'} · {p.collaborator_type}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Service ↔ Professional links */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Vínculos Serviço ↔ Profissional ({spLinks.length})</CardTitle></CardHeader>
                <CardContent>
                  {spLinks.length === 0 ? (
                    <p className="text-sm text-destructive font-medium">⚠️ Nenhum vínculo encontrado — profissionais não aparecerão na booking page</p>
                  ) : (
                    <div className="space-y-1 text-xs font-mono">
                      {spLinks.map((sp: any) => {
                        const svc = services.find((s: any) => s.id === sp.service_id);
                        const prof = professionals.find((p: any) => p.profile_id === sp.professional_id);
                        return (
                          <div key={sp.id} className="flex justify-between py-1 border-b border-border/50 last:border-0">
                            <span>{svc?.name || sp.service_id.slice(0, 8)}</span>
                            <span>→ {prof?.name || sp.professional_id.slice(0, 8)}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Business hours */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Horários da Empresa ({businessHours.length})</CardTitle></CardHeader>
                <CardContent>
                  {businessHours.length === 0 ? (
                    <p className="text-sm text-destructive font-medium">⚠️ Sem horários de funcionamento — nenhum slot será gerado</p>
                  ) : (
                    <div className="space-y-1 text-sm">
                      {businessHours.map((h: any) => (
                        <div key={h.id} className="flex justify-between py-1 border-b border-border/50 last:border-0">
                          <span className="font-medium">{dayNames[h.day_of_week]}</span>
                          <span className="text-muted-foreground">
                            {h.is_closed ? <Badge variant="secondary">Fechado</Badge> : `${h.open_time} - ${h.close_time}`}
                            {h.lunch_start && !h.is_closed && <span className="ml-2 text-xs">(pausa {h.lunch_start}-{h.lunch_end})</span>}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Professional working hours */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Horários dos Profissionais ({profHours.length})</CardTitle></CardHeader>
                <CardContent>
                  {profHours.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum horário personalizado — será usado o horário da empresa (fallback)</p>
                  ) : (
                    <div className="space-y-1 text-xs font-mono">
                      {profHours.map((h: any) => {
                        const prof = professionals.find((p: any) => p.profile_id === h.professional_id);
                        return (
                          <div key={h.id} className="flex justify-between py-1 border-b border-border/50 last:border-0">
                            <span>{prof?.name || h.professional_id.slice(0, 8)} · {dayNames[h.day_of_week]}</span>
                            <span>{h.is_closed ? 'Fechado' : `${h.open_time}-${h.close_time}`}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Blocked times */}
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Bloqueios ({blockedTimes.length})</CardTitle></CardHeader>
                <CardContent>
                  {blockedTimes.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum bloqueio registrado</p>
                  ) : (
                    <div className="space-y-1 text-xs font-mono">
                      {blockedTimes.map((bt: any) => (
                        <div key={bt.id} className="flex justify-between py-1 border-b border-border/50 last:border-0">
                          <span>{bt.block_date} {bt.start_time}-{bt.end_time}</span>
                          <span className="text-muted-foreground">{bt.reason || '—'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Slot calculation preview */}
            <Card className="border-primary/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" /> Simulador de Disponibilidade
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Profissional</label>
                    <Select value={testProfId} onValueChange={setTestProfId}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {professionals.map((p: any) => (
                          <SelectItem key={p.profile_id} value={p.profile_id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Duração (min)</label>
                    <Select value={String(testDuration)} onValueChange={(v) => setTestDuration(Number(v))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {[15, 30, 45, 60, 90, 120].map((d) => (
                          <SelectItem key={d} value={String(d)}>{d} min</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Data</label>
                    <Calendar
                      mode="single"
                      selected={testDate}
                      onSelect={setTestDate}
                      locale={ptBR}
                      className="rounded-md border"
                    />
                  </div>
                </div>

                <Button onClick={handleGenerateSlots} disabled={!testProfId || !testDate}>
                  <Zap className="h-4 w-4 mr-2" /> Gerar disponibilidade
                </Button>

                {generatedSlots.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-primary">
                      ✅ {generatedSlots.length} slots disponíveis
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {generatedSlots.map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {generatedSlots.length === 0 && slotLog && (
                  <p className="text-sm text-destructive font-medium">⚠️ Nenhum slot gerado</p>
                )}

                {slotLog && (
                  <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-48 font-mono">{slotLog}</pre>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
};

export default DebugAgenda;
