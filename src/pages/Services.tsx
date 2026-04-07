import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useRefreshData } from '@/hooks/useRefreshData';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Trash2, Clock, DollarSign, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

const Services = () => {
  const { companyId } = useAuth();
  const queryClient = useQueryClient();
  const { refresh } = useRefreshData();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ name: '', duration_minutes: '' as string | number, price: '' as string | number, recommended_return_days: '' as string | number, booking_mode: 'company_default' });
  const [companyBookingMode, setCompanyBookingMode] = useState<string>('fixed_grid');

  useEffect(() => {
    if (companyId) {
      supabase.from('companies').select('booking_mode').eq('id', companyId).single().then(({ data }) => {
        if (data) setCompanyBookingMode((data as any).booking_mode ?? 'fixed_grid');
      });
    }
  }, [companyId]);

  const servicesQueryKey = ['services', companyId];

  const { data: services = [], refetch } = useQuery({
    queryKey: servicesQueryKey,
    enabled: Boolean(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('company_id', companyId!)
        .order('name');

      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (companyId) {
      refetch();
    }
  }, [companyId, refetch]);

  const refreshServices = async () => {
    refresh('services');
    await refetch();
  };

  const resetForm = () => {
    setEditing(null);
    setForm({ name: '', duration_minutes: '', price: '', recommended_return_days: '' });
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Nome é obrigatório');
    if (!companyId) return toast.error('Empresa não encontrada');

    try {
      if (editing) {
        const { error } = await supabase
          .from('services')
          .update({
            name: form.name.trim(),
            duration_minutes: Number(form.duration_minutes) || 0,
            price: Number(form.price) || 0,
            recommended_return_days: form.recommended_return_days ? Number(form.recommended_return_days) : null,
          } as any)
          .eq('id', editing.id)
          .eq('company_id', companyId);

        if (error) throw error;
        toast.success('Serviço atualizado');
      } else {
        const { error } = await supabase.from('services').insert({
          company_id: companyId,
          name: form.name.trim(),
          duration_minutes: Number(form.duration_minutes) || 0,
          price: Number(form.price) || 0,
          recommended_return_days: form.recommended_return_days ? Number(form.recommended_return_days) : null,
        } as any);

        if (error) throw error;
        toast.success('Serviço criado');
      }

      setDialogOpen(false);
      resetForm();
      await refreshServices();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar serviço');
    }
  };

  const toggleActive = async (id: string, active: boolean) => {
    const { error } = await supabase
      .from('services')
      .update({ active: !active })
      .eq('id', id)
      .eq('company_id', companyId!);

    if (error) {
      toast.error(error.message);
      return;
    }

    await refreshServices();
  };

  const deleteService = async (id: string) => {
    const { error } = await supabase
      .from('services')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId!);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success('Serviço removido');
    await refreshServices();
  };

  const openEdit = (service: any) => {
    setEditing(service);
    setForm({
      name: service.name,
      duration_minutes: service.duration_minutes,
      price: Number(service.price),
      recommended_return_days: service.recommended_return_days || '',
    });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-display font-bold">Serviços</h2>
          <p className="text-sm text-muted-foreground">Gerencie os serviços do seu estabelecimento</p>
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
              <Plus className="mr-2 h-4 w-4" /> Novo Serviço
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar Serviço' : 'Novo Serviço'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Corte masculino"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Duração (min)</Label>
                   <Input
                    type="number"
                    value={form.duration_minutes}
                    onChange={(e) => setForm({ ...form, duration_minutes: e.target.value })}
                    placeholder="Ex: 40"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Preço (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="Ex: 45.00"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Lembrete automático de retorno (dias)</Label>
                <Input
                  type="number"
                  value={form.recommended_return_days}
                  onChange={(e) => setForm({ ...form, recommended_return_days: e.target.value })}
                  placeholder="Ex: 20 dias"
                />
                <p className="text-xs text-muted-foreground">
                  Após esse número de dias do atendimento, o sistema enviará automaticamente um lembrete ao cliente sugerindo um novo agendamento.
                </p>
                <p className="text-xs text-muted-foreground/70 italic">
                  Exemplo: Se o cliente cortar o cabelo hoje e o retorno estiver definido como 25 dias, o sistema enviará automaticamente um lembrete em 25 dias convidando o cliente a agendar novamente. Deixe vazio para não enviar lembrete.
                </p>
              </div>
              <Button onClick={handleSave} className="w-full">
                {editing ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {services.map((service) => (
          <Card key={service.id} className={!service.active ? 'opacity-50' : ''}>
            <CardContent className="p-5">
              <div className="mb-3 flex items-start justify-between">
                <h3 className="text-lg font-semibold">{service.name}</h3>
                <Switch checked={service.active} onCheckedChange={() => toggleActive(service.id, service.active)} />
              </div>
              <div className="mb-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" /> {service.duration_minutes} min
                </span>
                <span className="flex items-center gap-1">
                  <DollarSign className="h-4 w-4" /> R$ {Number(service.price).toFixed(2)}
                </span>
                {(service as any).recommended_return_days && (
                  <span className="flex items-center gap-1">
                    <RefreshCw className="h-4 w-4" /> Lembrete automático: {(service as any).recommended_return_days} dias
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(service)}>
                  <Pencil className="mr-1 h-3 w-3" /> Editar
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteService(service.id)}>
                  <Trash2 className="mr-1 h-3 w-3" /> Excluir
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {services.length === 0 && (
          <div className="col-span-full py-12 text-center text-muted-foreground">
            <p>Nenhum serviço cadastrado ainda</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Services;
