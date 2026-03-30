import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, CalendarPlus, Users } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

const Waitlist = () => {
  const { companyId } = useAuth();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    fetchEntries();
  }, [companyId]);

  const fetchEntries = async () => {
    setLoading(true);
    // Fetch from waiting_list (auth-based entries)
    const { data: wlData } = await supabase
      .from('waiting_list')
      .select(`
        *,
        client:profiles!waiting_list_client_id_fkey(full_name, whatsapp),
        professional:profiles!waiting_list_professional_id_fkey(full_name)
      `)
      .eq('company_id', companyId!)
      .eq('status', 'waiting')
      .order('created_at', { ascending: true });
    
    // Fetch from waitlist (public entries without auth)
    const { data: wData } = await supabase
      .from('waitlist')
      .select('*')
      .eq('company_id', companyId!)
      .eq('notified', false)
      .order('created_at', { ascending: true });

    // Normalize both into a common shape
    const fromWl = (wlData || []).map((e: any) => ({
      id: e.id,
      client_name: e.client?.full_name || 'Cliente',
      client_whatsapp: e.client?.whatsapp || null,
      service_ids: e.service_ids,
      professional_name: e.professional?.full_name || null,
      desired_date: e.desired_date,
      created_at: e.created_at,
      source: 'waiting_list' as const,
    }));
    const fromW = (wData || []).map((e: any) => ({
      id: e.id,
      client_name: e.client_name || 'Cliente',
      client_whatsapp: e.client_whatsapp || null,
      service_ids: e.service_ids,
      professional_name: null,
      desired_date: e.desired_date,
      created_at: e.created_at,
      source: 'waitlist' as const,
    }));
    setEntries([...fromWl, ...fromW].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()));
    setLoading(false);
  };

  const fetchServiceNames = async (serviceIds: string[]) => {
    if (!serviceIds || serviceIds.length === 0) return '';
    const { data } = await supabase
      .from('services')
      .select('name')
      .in('id', serviceIds);
    return data?.map(s => s.name).join(', ') || '';
  };

  const [serviceNamesMap, setServiceNamesMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (entries.length === 0) return;
    const allIds = [...new Set(entries.flatMap(e => e.service_ids || []))];
    if (allIds.length === 0) return;
    supabase
      .from('services')
      .select('id, name')
      .in('id', allIds)
      .then(({ data }) => {
        const map: Record<string, string> = {};
        data?.forEach(s => { map[s.id] = s.name; });
        setServiceNamesMap(map);
      });
  }, [entries]);

  const getServiceNames = (ids: string[]) => {
    if (!ids) return '—';
    return ids.map(id => serviceNamesMap[id] || '').filter(Boolean).join(', ') || '—';
  };

  const handleBook = (entry: any) => {
    // Navigate to dashboard with pre-filled info — staff can book from there
    toast.info(`Redirecione para agendar ${entry.client?.full_name || 'Cliente'}`);
    // For now navigate to dashboard; a future enhancement could open a booking modal
    navigate('/dashboard');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold flex items-center gap-2">
          <Users className="h-6 w-6" /> Lista de Espera
        </h1>
        <Badge variant="outline" className="text-sm">
          {entries.length} aguardando
        </Badge>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>Nenhum cliente na lista de espera</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {entries.map((entry, idx) => (
            <Card key={entry.id}>
              <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <div className="w-10 h-10 rounded-full bg-warning/10 flex items-center justify-center text-warning font-bold text-sm">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">{entry.client_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {getServiceNames(entry.service_ids)}
                    </p>
                    {entry.professional_name && (
                      <p className="text-xs text-muted-foreground">
                        Preferência: {entry.professional_name}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      📅 {format(parseISO(entry.desired_date), "dd 'de' MMM", { locale: ptBR })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Entrou {format(parseISO(entry.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <Button size="sm" onClick={() => handleBook(entry)}>
                    <CalendarPlus className="h-4 w-4 mr-1" />
                    Agendar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Waitlist;