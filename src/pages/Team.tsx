import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus, Users, Percent, DollarSign, Settings } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import ProfessionalPanel from '@/components/ProfessionalPanel';

const Team = () => {
  const { companyId } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedCollaborator, setSelectedCollaborator] = useState<any>(null);
  const [form, setForm] = useState({
    name: '',
    email: '',
    collaborator_type: 'commissioned' as 'partner' | 'commissioned',
    payment_type: 'percentage' as 'percentage' | 'fixed' | 'none',
    commission_value: 10,
  });

  const teamQueryKey = ['collaborators', companyId];

  const { data: collaborators = [], refetch } = useQuery({
    queryKey: teamQueryKey,
    enabled: Boolean(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('collaborators')
        .select('*, profile:profiles(*)')
        .eq('company_id', companyId!)
        .order('created_at');

      if (error) throw error;
      return data ?? [];
    },
  });

  const resetForm = () => {
    setForm({
      name: '',
      email: '',
      collaborator_type: 'commissioned',
      payment_type: 'percentage',
      commission_value: 10,
    });
  };

  const refreshTeam = async () => {
    await queryClient.invalidateQueries({ queryKey: teamQueryKey });
    await refetch();
  };

  const handleAdd = async () => {
    if (!form.email.trim() || !form.name.trim()) {
      return toast.error('Preencha todos os campos');
    }

    if (!companyId) {
      return toast.error('Empresa não encontrada');
    }

    try {
      const response = await supabase.functions.invoke('create-collaborator', {
        body: {
          name: form.name.trim(),
          email: form.email.trim(),
          company_id: companyId,
          collaborator_type: form.collaborator_type,
          payment_type: form.payment_type,
          commission_value: form.payment_type === 'none' ? 0 : form.commission_value,
          role: 'collaborator',
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Erro ao criar colaborador');
      }

      if (!response.data?.success) {
        throw new Error(response.data?.error || 'Erro ao criar colaborador');
      }

      toast.success('Colaborador adicionado');
      setDialogOpen(false);
      resetForm();
      await refreshTeam();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar colaborador');
    }
  };

  const paymentLabel = (type: string, value: number) => {
    if (type === 'percentage') return `${value}%`;
    if (type === 'fixed') return `R$ ${Number(value).toFixed(2)}/serviço`;
    return 'Sem comissão';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-display font-bold">Equipe</h2>
          <p className="text-sm text-muted-foreground">Gerencie colaboradores do seu estabelecimento</p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Adicionar
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo Colaborador</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select value={form.collaborator_type} onValueChange={(value) => setForm({ ...form, collaborator_type: value as 'partner' | 'commissioned' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="partner">Sócio</SelectItem>
                    <SelectItem value="commissioned">Comissionado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Forma de pagamento</Label>
                <Select value={form.payment_type} onValueChange={(value) => setForm({ ...form, payment_type: value as 'percentage' | 'fixed' | 'none' })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percentage">Percentual</SelectItem>
                    <SelectItem value="fixed">Valor fixo</SelectItem>
                    <SelectItem value="none">Sem comissão</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.payment_type === 'percentage' && (
                <div className="space-y-2">
                  <Label>Comissão (%)</Label>
                  <Input
                    type="number"
                    value={form.commission_value}
                    onChange={(e) => setForm({ ...form, commission_value: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              )}
              {form.payment_type === 'fixed' && (
                <div className="space-y-2">
                  <Label>Valor por serviço</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.commission_value}
                    onChange={(e) => setForm({ ...form, commission_value: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              )}
              <Button onClick={handleAdd} className="w-full">Adicionar</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {collaborators.map((collaborator) => (
          <Card key={collaborator.id}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 font-bold text-primary">
                {collaborator.profile?.full_name?.charAt(0)?.toUpperCase() || '?'}
              </div>
              <div className="flex-1">
                <p className="font-semibold">{collaborator.profile?.full_name}</p>
                <p className="text-sm text-muted-foreground">{collaborator.profile?.email}</p>
                {(collaborator as any).slug && (
                  <p className="text-xs text-muted-foreground">/{(collaborator as any).slug}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {collaborator.collaborator_type === 'partner' ? 'Sócio' : 'Comissionado'}
                </Badge>
                <Badge variant="secondary" className="flex items-center gap-1">
                  {collaborator.commission_type === 'percentage' && <><Percent className="h-3 w-3" /> {paymentLabel(collaborator.commission_type, collaborator.commission_value)}</>}
                  {collaborator.commission_type === 'fixed' && <><DollarSign className="h-3 w-3" /> {paymentLabel(collaborator.commission_type, collaborator.commission_value)}</>}
                  {collaborator.commission_type === 'none' && paymentLabel(collaborator.commission_type, collaborator.commission_value)}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => { setSelectedCollaborator(collaborator); setPanelOpen(true); }}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {collaborators.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground">
            <Users className="mx-auto mb-3 h-12 w-12 opacity-40" />
            <p>Nenhum colaborador cadastrado</p>
          </div>
        )}
      </div>

      {selectedCollaborator && (
        <ProfessionalPanel
          collaborator={selectedCollaborator}
          open={panelOpen}
          onOpenChange={setPanelOpen}
          onUpdated={refreshTeam}
        />
      )}
    </div>
  );
};

export default Team;
