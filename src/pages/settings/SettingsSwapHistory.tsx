import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeftRight, Search, Calendar as CalendarIcon, User } from 'lucide-react';
import { format, parseISO, subDays, startOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import SettingsBreadcrumb from '@/components/SettingsBreadcrumb';

const RANGES = [
  { value: '7', label: 'Últimos 7 dias' },
  { value: '30', label: 'Últimos 30 dias' },
  { value: '90', label: 'Últimos 90 dias' },
  { value: 'all', label: 'Todo período' },
];

const SettingsSwapHistory = () => {
  const { companyId } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [range, setRange] = useState('30');
  const [profMap, setProfMap] = useState<Record<string, string>>({});
  const [userMap, setUserMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (companyId) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, range]);

  const fetchData = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      let query = supabase
        .from('appointments_swap_logs' as any)
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(200);

      if (range !== 'all') {
        const days = parseInt(range, 10);
        query = query.gte('created_at', startOfDay(subDays(new Date(), days)).toISOString());
      }

      const { data, error } = await query;
      if (error) {
        console.error('[SwapHistory] error', error);
        return;
      }
      const list = (data as any[]) || [];
      setRows(list);

      // Resolve professional names + swapper names
      const profIds = new Set<string>();
      const userIds = new Set<string>();
      list.forEach((r) => {
        profIds.add(r.old_professional_a);
        profIds.add(r.old_professional_b);
        profIds.add(r.new_professional_a);
        profIds.add(r.new_professional_b);
        if (r.swapped_by) userIds.add(r.swapped_by);
      });

      if (profIds.size > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', Array.from(profIds));
        const map: Record<string, string> = {};
        (profs || []).forEach((p: any) => { map[p.id] = p.full_name; });
        setProfMap(map);
      }
      if (userIds.size > 0) {
        const { data: users } = await supabase
          .from('profiles')
          .select('user_id, full_name')
          .in('user_id', Array.from(userIds));
        const map: Record<string, string> = {};
        (users || []).forEach((u: any) => { map[u.user_id] = u.full_name; });
        setUserMap(map);
      }
    } finally {
      setLoading(false);
    }
  };

  const filtered = rows.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      (r.client_a_name || '').toLowerCase().includes(q) ||
      (r.client_b_name || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      <SettingsBreadcrumb current="Histórico de Trocas" />
      <div>
        <h2 className="text-xl font-display font-bold flex items-center gap-2">
          <ArrowLeftRight className="h-5 w-5 text-primary" /> Histórico de Trocas
        </h2>
        <p className="text-sm text-muted-foreground">Auditoria de todas as trocas de horário entre agendamentos</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-[1fr_200px] gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Buscar por cliente"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {RANGES.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="text-center text-muted-foreground py-12 text-sm">Carregando…</p>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 px-4">
              <ArrowLeftRight className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
              <p className="font-semibold">Nenhuma troca registrada</p>
              <p className="text-sm text-muted-foreground">Use o botão "Trocar horário" em qualquer agendamento da agenda.</p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((r) => {
                const oldA = parseISO(r.old_start_a);
                const newA = parseISO(r.new_start_a);
                const oldB = parseISO(r.old_start_b);
                const newB = parseISO(r.new_start_b);
                const profChanged = r.old_professional_a !== r.new_professional_a;
                return (
                  <div key={r.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <Badge variant="outline" className="bg-primary/5 text-primary border-primary/30 gap-1">
                        <ArrowLeftRight className="h-3 w-3" /> Troca realizada
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(parseISO(r.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        {r.swapped_by && userMap[r.swapped_by] && ` · por ${userMap[r.swapped_by]}`}
                      </span>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3 text-sm">
                      <div className="rounded-lg bg-muted/40 p-3">
                        <p className="font-semibold">{r.client_a_name || 'Cliente A'}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          <span className="line-through">{format(oldA, "dd/MM HH:mm")}</span>
                          {' → '}
                          <span className="text-foreground font-semibold">{format(newA, "dd/MM HH:mm")}</span>
                        </p>
                        {profChanged && (
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
                            <User className="h-3 w-3" /> {profMap[r.old_professional_a] || '?'} → {profMap[r.new_professional_a] || '?'}
                          </p>
                        )}
                      </div>
                      <div className="rounded-lg bg-muted/40 p-3">
                        <p className="font-semibold">{r.client_b_name || 'Cliente B'}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          <span className="line-through">{format(oldB, "dd/MM HH:mm")}</span>
                          {' → '}
                          <span className="text-foreground font-semibold">{format(newB, "dd/MM HH:mm")}</span>
                        </p>
                        {profChanged && (
                          <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
                            <User className="h-3 w-3" /> {profMap[r.old_professional_b] || '?'} → {profMap[r.new_professional_b] || '?'}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsSwapHistory;
