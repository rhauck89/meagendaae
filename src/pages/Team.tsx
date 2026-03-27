import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Users, Percent } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

const Team = () => {
  const { companyId } = useAuth();
  const [collaborators, setCollaborators] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ email: '', full_name: '', type: 'commissioned' as const, commission: 10 });

  useEffect(() => {
    if (companyId) fetchTeam();
  }, [companyId]);

  const fetchTeam = async () => {
    const { data } = await supabase
      .from('collaborators')
      .select('*, profile:profiles(*)')
      .eq('company_id', companyId!)
      .order('created_at');
    if (data) setCollaborators(data);
  };

  const handleAdd = async () => {
    if (!form.email.trim() || !form.full_name.trim()) return toast.error('Preencha todos os campos');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return toast.error('Sessão expirada');

      const response = await supabase.functions.invoke('create-collaborator', {
        body: {
          email: form.email,
          full_name: form.full_name,
          collaborator_type: form.type,
          commission_percent: form.type === 'commissioned' ? form.commission : 0,
        },
      });

      if (response.error) throw new Error(response.error.message || 'Erro ao criar colaborador');
      const result = response.data;
      if (result?.error) throw new Error(result.error);

      toast.success('Colaborador adicionado');
      setDialogOpen(false);
      setForm({ email: '', full_name: '', type: 'commissioned', commission: 10 });
      fetchTeam();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-display font-bold">Equipe</h2>
          <p className="text-sm text-muted-foreground">Gerencie colaboradores do seu estabelecimento</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> Adicionar</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Novo Colaborador</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="partner">Sócio</SelectItem>
                    <SelectItem value="commissioned">Comissionado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.type === 'commissioned' && (
                <div className="space-y-2">
                  <Label>Comissão (%)</Label>
                  <Input type="number" value={form.commission} onChange={(e) => setForm({ ...form, commission: parseInt(e.target.value) || 0 })} />
                </div>
              )}
              <Button onClick={handleAdd} className="w-full">Adicionar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {collaborators.map((c) => (
          <Card key={c.id}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                {c.profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="flex-1">
                <p className="font-semibold">{c.profile?.full_name}</p>
                <p className="text-sm text-muted-foreground">{c.profile?.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {c.collaborator_type === 'partner' ? 'Sócio' : 'Comissionado'}
                </Badge>
                {c.collaborator_type === 'commissioned' && (
                  <Badge variant="secondary" className="flex items-center gap-1">
                    <Percent className="h-3 w-3" /> {c.commission_percent}%
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {collaborators.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-3 opacity-40" />
            <p>Nenhum colaborador cadastrado</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Team;
