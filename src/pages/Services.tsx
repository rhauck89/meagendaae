import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Plus, Pencil, Trash2, Clock, DollarSign } from 'lucide-react';
import { toast } from 'sonner';

const Services = () => {
  const { companyId } = useAuth();
  const [services, setServices] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ name: '', duration_minutes: 30, price: 0 });

  useEffect(() => {
    if (companyId) fetchServices();
  }, [companyId]);

  const fetchServices = async () => {
    const { data } = await supabase
      .from('services')
      .select('*')
      .eq('company_id', companyId!)
      .order('name');
    if (data) setServices(data);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Nome é obrigatório');
    try {
      if (editing) {
        await supabase
          .from('services')
          .update({ name: form.name, duration_minutes: form.duration_minutes, price: form.price })
          .eq('id', editing.id);
        toast.success('Serviço atualizado');
      } else {
        await supabase.from('services').insert({
          company_id: companyId!,
          name: form.name,
          duration_minutes: form.duration_minutes,
          price: form.price,
        });
        toast.success('Serviço criado');
      }
      setDialogOpen(false);
      setEditing(null);
      setForm({ name: '', duration_minutes: 30, price: 0 });
      fetchServices();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from('services').update({ active: !active }).eq('id', id);
    fetchServices();
  };

  const deleteService = async (id: string) => {
    await supabase.from('services').delete().eq('id', id);
    toast.success('Serviço removido');
    fetchServices();
  };

  const openEdit = (service: any) => {
    setEditing(service);
    setForm({ name: service.name, duration_minutes: service.duration_minutes, price: Number(service.price) });
    setDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-display font-bold">Serviços</h2>
          <p className="text-sm text-muted-foreground">Gerencie os serviços do seu estabelecimento</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditing(null); setForm({ name: '', duration_minutes: 30, price: 0 }); } }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" /> Novo Serviço
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? 'Editar Serviço' : 'Novo Serviço'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Corte masculino" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Duração (min)</Label>
                  <Input type="number" value={form.duration_minutes} onChange={(e) => setForm({ ...form, duration_minutes: parseInt(e.target.value) || 0 })} />
                </div>
                <div className="space-y-2">
                  <Label>Preço (R$)</Label>
                  <Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
              <Button onClick={handleSave} className="w-full">
                {editing ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {services.map((service) => (
          <Card key={service.id} className={!service.active ? 'opacity-50' : ''}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-lg">{service.name}</h3>
                <Switch checked={service.active} onCheckedChange={() => toggleActive(service.id, service.active)} />
              </div>
              <div className="flex gap-4 text-sm text-muted-foreground mb-4">
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" /> {service.duration_minutes} min
                </span>
                <span className="flex items-center gap-1">
                  <DollarSign className="h-4 w-4" /> R$ {Number(service.price).toFixed(2)}
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(service)}>
                  <Pencil className="h-3 w-3 mr-1" /> Editar
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteService(service.id)}>
                  <Trash2 className="h-3 w-3 mr-1" /> Excluir
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {services.length === 0 && (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            <p>Nenhum serviço cadastrado ainda</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Services;
