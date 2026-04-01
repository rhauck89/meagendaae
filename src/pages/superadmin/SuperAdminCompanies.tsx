import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const statusColors: Record<string, string> = {
  active: 'bg-success/10 text-success',
  trial: 'bg-warning/10 text-warning',
  inactive: 'bg-muted text-muted-foreground',
  blocked: 'bg-destructive/10 text-destructive',
};

const SuperAdminCompanies = () => {
  const [companies, setCompanies] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchCompanies = async () => {
    const { data } = await supabase
      .from('companies')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setCompanies(data);
    setLoading(false);
  };

  useEffect(() => { fetchCompanies(); }, []);

  const toggleBlock = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'blocked' ? 'active' : 'blocked';
    await supabase.from('companies').update({ subscription_status: newStatus as any }).eq('id', id);
    toast.success(newStatus === 'blocked' ? 'Empresa bloqueada' : 'Empresa desbloqueada');
    fetchCompanies();
  };

  const filtered = companies.filter(c =>
    c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.slug?.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="flex items-center justify-center py-12"><p className="text-muted-foreground">Carregando...</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar empresa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Badge variant="outline">{filtered.length} empresas</Badge>
      </div>

      <div className="space-y-3">
        {filtered.map((c) => (
          <Card key={c.id}>
            <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="font-semibold">{c.name}</p>
                <p className="text-sm text-muted-foreground">
                  /{c.slug} · {c.business_type} · Criada em {format(new Date(c.created_at), 'dd/MM/yyyy')}
                </p>
                {c.phone && <p className="text-xs text-muted-foreground mt-1">📞 {c.phone}</p>}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={statusColors[c.subscription_status] || ''}>
                  {c.subscription_status}
                </Badge>
                <Button
                  variant={c.subscription_status === 'blocked' ? 'default' : 'destructive'}
                  size="sm"
                  onClick={() => toggleBlock(c.id, c.subscription_status)}
                >
                  {c.subscription_status === 'blocked' ? 'Desbloquear' : 'Bloquear'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default SuperAdminCompanies;
