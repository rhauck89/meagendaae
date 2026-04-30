import { useEffect, useState, useMemo } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, Clock, DollarSign, RefreshCw, Zap, Grid3X3, FolderPlus, Tag } from 'lucide-react';
import { toast } from 'sonner';

const Services = () => {
  const { companyId } = useAuth();
  const queryClient = useQueryClient();
  const { refresh } = useRefreshData();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [editingCat, setEditingCat] = useState<any | null>(null);
  const [form, setForm] = useState({ 
    name: '', 
    duration_minutes: '' as string | number, 
    price: '' as string | number, 
    recommended_return_days: '' as string | number, 
    booking_mode: 'company_default',
    category_id: '',
    global_category_id: ''
  });
  const [catForm, setCatForm] = useState({ name: '', global_category_id: '' });
  const [companyBookingMode, setCompanyBookingMode] = useState<string>('fixed_grid');
  const [saving, setSaving] = useState(false);
  const [catSaving, setCatSaving] = useState(false);

  useEffect(() => {
    if (companyId) {
      supabase.from('companies').select('booking_mode').eq('id', companyId).single().then(({ data }) => {
        if (data) setCompanyBookingMode((data as any).booking_mode ?? 'fixed_grid');
      });
    }
  }, [companyId]);

  const servicesQueryKey = ['services', companyId];
  const categoriesQueryKey = ['service_categories', companyId];

  const { data: globalCategories = [] } = useQuery({
    queryKey: ['service_categories_global'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_categories_global')
        .select('*')
        .order('name');
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: categories = [], refetch: refetchCategories } = useQuery({
    queryKey: categoriesQueryKey,
    enabled: Boolean(companyId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('service_categories')
        .select('*, global:service_categories_global(name)')
        .eq('company_id', companyId!)
        .order('name');

      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: services = [], refetch: refetchServices } = useQuery({
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

  const refreshAll = async () => {
    refresh('services');
    await Promise.all([refetchServices(), refetchCategories()]);
  };

  const resetForm = () => {
    setEditing(null);
    setForm({ 
      name: '', 
      duration_minutes: '', 
      price: '', 
      recommended_return_days: '', 
      booking_mode: 'company_default',
      category_id: categories?.[0]?.id || '',
      global_category_id: ''
    });
  };

  const getSmartSuggestion = (name: string) => {
    if (!name.trim() || !globalCategories?.length) return '';
    const normalized = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    // Exact match by slug or name
    let match = globalCategories.find((gc: any) => 
      normalized === gc.slug || normalized === gc.name.toLowerCase()
    );

    // Partial match (keyword)
    if (!match) {
      match = globalCategories
        .filter((gc: any) => gc.slug !== 'outros')
        .find((gc: any) => normalized.includes(gc.name.toLowerCase()));
    }

    const outrosId = globalCategories.find((gc: any) => gc.slug === 'outros')?.id || '';
    return match?.id || outrosId;
  };

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Nome é obrigatório');
    if (!companyId) return toast.error('Empresa não encontrada');

    setSaving(true);
    try {
      const serviceData = {
        company_id: companyId,
        name: form.name.trim(),
        duration_minutes: Number(form.duration_minutes) || 0,
        price: Number(form.price) || 0,
        recommended_return_days: form.recommended_return_days ? Number(form.recommended_return_days) : null,
        booking_mode: form.booking_mode,
        category_id: form.category_id || null,
        global_category_id: form.global_category_id || getSmartSuggestion(form.name),
      };

      if (editing) {
        const { error } = await supabase
          .from('services')
          .update(serviceData as any)
          .eq('id', editing.id)
          .eq('company_id', companyId);

        if (error) throw error;
        toast.success('Serviço atualizado');
      } else {
        const { error } = await supabase.from('services').insert(serviceData as any);
        if (error) throw error;
        toast.success('Serviço criado');
      }

      setDialogOpen(false);
      resetForm();
      await refreshAll();
    } catch (err: any) {
      console.error('[SERVICES] Error saving service:', err);
      toast.error(err.message || 'Erro ao salvar serviço');
    } finally {
      setSaving(false);
    }
  };


  const [catSaving, setCatSaving] = useState(false);

  const handleSaveCategory = async () => {
    if (!catForm.name.trim()) return toast.error('Nome é obrigatório');
    if (!companyId) return toast.error('Empresa não encontrada');

    setCatSaving(true);
    try {
      if (editingCat) {
        const { error } = await supabase
          .from('service_categories')
          .update({ 
            name: catForm.name.trim(),
            global_category_id: catForm.global_category_id || null
          })
          .eq('id', editingCat.id)
          .eq('company_id', companyId);

        if (error) throw error;
        toast.success('Categoria atualizada');
      } else {
        const { error } = await supabase.from('service_categories').insert({
          company_id: companyId,
          name: catForm.name.trim(),
          global_category_id: catForm.global_category_id || null,
        });
        if (error) throw error;
        toast.success('Categoria criada');
      }

      setCatDialogOpen(false);
      setEditingCat(null);
      setCatForm({ name: '', global_category_id: '' });
      await refreshAll();
    } catch (err: any) {
      console.error('[SERVICES] Error saving category:', err);
      toast.error(err.message || 'Erro ao salvar categoria');
    } finally {
      setCatSaving(false);
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

    await refreshAll();
  };

  const deleteService = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este serviço?')) return;
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
    await refreshAll();
  };

  const deleteCategory = async (id: string) => {
    const count = services.filter((s: any) => s.category_id === id).length;
    if (count > 0) {
      return toast.error(`Esta categoria possui ${count} serviços vinculados. Mova-os ou exclua-os primeiro.`);
    }
    
    if (!confirm('Tem certeza que deseja excluir esta categoria?')) return;

    const { error } = await supabase
      .from('service_categories')
      .delete()
      .eq('id', id)
      .eq('company_id', companyId!);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success('Categoria removida');
    await refreshAll();
  };

  const openEdit = (service: any) => {
    setEditing(service);
    setForm({
      name: service.name,
      duration_minutes: service.duration_minutes,
      price: Number(service.price),
      recommended_return_days: service.recommended_return_days || '',
      booking_mode: (service as any).booking_mode || 'company_default',
      category_id: service.category_id || '',
      global_category_id: service.global_category_id || '',
    });
    setDialogOpen(true);
  };

  const groupedServices = useMemo(() => {
    if (!Array.isArray(categories)) return [];
    return categories.map((cat: any) => ({
      ...cat,
      services: Array.isArray(services) ? services.filter((s: any) => s.category_id === cat.id) : []
    }));
  }, [categories, services]);

  const uncategorizedServices = useMemo(() => {
    if (!Array.isArray(services)) return [];
    return services.filter((s: any) => !s.category_id);
  }, [services]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold">Serviços</h2>
          <p className="text-sm text-muted-foreground">Gerencie as categorias e serviços do seu estabelecimento</p>
        </div>
        <div className="flex gap-2">
          <Dialog
            open={catDialogOpen}
            onOpenChange={(open) => {
              setCatDialogOpen(open);
              if (!open) { setEditingCat(null); setCatForm({ name: '', global_category_id: '' }); }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline">
                <FolderPlus className="mr-2 h-4 w-4" /> Nova Categoria
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingCat ? 'Editar Categoria' : 'Nova Categoria'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome da Categoria</Label>
                  <Input
                    value={catForm.name}
                    onChange={(e) => setCatForm({ ...catForm, name: e.target.value })}
                    placeholder="Ex: Cabelo, Barba, Unhas..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Vínculo Global (Marketplace)</Label>
                  <Select value={catForm.global_category_id} onValueChange={(v) => setCatForm({ ...catForm, global_category_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione categoria padrão" />
                    </SelectTrigger>
                    <SelectContent>
                      {globalCategories.map((gc: any) => (
                        <SelectItem key={gc.id} value={gc.id}>{gc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[10px] text-muted-foreground italic">Ajuda a organizar seus serviços no marketplace</p>
                </div>
                <Button onClick={handleSaveCategory} className="w-full" disabled={catSaving}>
                  {catSaving ? 'Salvando...' : editingCat ? 'Salvar' : 'Criar'}
                </Button>

              </div>
            </DialogContent>
          </Dialog>

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
                  <Label>Nome do Serviço</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => {
                      const newName = e.target.value;
                      const updates: any = { name: newName };
                      if (!form.global_category_id || form.global_category_id === (globalCategories.find((gc: any) => gc.slug === 'outros')?.id)) {
                        updates.global_category_id = getSmartSuggestion(newName);
                      }
                      setForm({ ...form, ...updates });
                    }}
                    placeholder="Ex: Corte masculino"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Categoria</Label>
                  <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione uma categoria" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat: any) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                      <SelectItem value="">Sem Categoria</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Vínculo Global (Obrigatório)</Label>
                  <Select value={form.global_category_id} onValueChange={(v) => setForm({ ...form, global_category_id: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Padrão para marketplace" />
                    </SelectTrigger>
                    <SelectContent>
                      {globalCategories.map((gc: any) => (
                        <SelectItem key={gc.id} value={gc.id}>{gc.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                <Button onClick={handleSave} className="w-full" disabled={saving}>
                  {saving ? 'Salvando...' : editing ? 'Salvar' : 'Criar'}
                </Button>

              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="space-y-12">
        {groupedServices.map((cat) => (
          <div key={cat.id} className="space-y-4">
            <div className="flex items-center justify-between border-b pb-2">
              <div className="flex items-center gap-2">
                <Tag className="h-5 w-5 text-primary" />
                <h3 className="text-xl font-semibold">{cat.name}</h3>
                {cat.global?.name && (
                  <Badge variant="outline" className="text-[10px] font-normal py-0">
                    {cat.global.name}
                  </Badge>
                )}
                <span className="text-sm text-muted-foreground">({cat.services.length})</span>
              </div>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => { setEditingCat(cat); setCatForm({ name: cat.name, global_category_id: cat.global_category_id || '' }); setCatDialogOpen(true); }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" className="text-destructive" onClick={() => deleteCategory(cat.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {cat.services.map((service: any) => (
                <ServiceCard 
                  key={service.id} 
                  service={service} 
                  onEdit={openEdit} 
                  onToggle={toggleActive} 
                  onDelete={deleteService} 
                />
              ))}
              {cat.services.length === 0 && (
                <div className="col-span-full py-6 text-center text-muted-foreground border-2 border-dashed rounded-lg">
                  <p>Nenhum serviço nesta categoria</p>
                </div>
              )}
            </div>
          </div>
        ))}

        {uncategorizedServices.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 border-b pb-2">
              <Tag className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-xl font-semibold">Sem Categoria</h3>
              <span className="text-sm text-muted-foreground">({uncategorizedServices.length})</span>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {uncategorizedServices.map((service: any) => (
                <ServiceCard 
                  key={service.id} 
                  service={service} 
                  onEdit={openEdit} 
                  onToggle={toggleActive} 
                  onDelete={deleteService} 
                />
              ))}
            </div>
          </div>
        )}

        {categories.length === 0 && services.length === 0 && (
          <div className="py-20 text-center text-muted-foreground">
            <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
              <Grid3X3 className="h-8 w-8" />
            </div>
            <p className="text-lg font-medium">Nenhum serviço ou categoria cadastrada</p>
            <p>Comece criando uma categoria ou seu primeiro serviço.</p>
          </div>
        )}
      </div>
    </div>
  );
};

const ServiceCard = ({ service, onEdit, onToggle, onDelete }: any) => (
  <Card className={!service.active ? 'opacity-50' : 'hover:shadow-md transition-shadow'}>
    <CardContent className="p-5">
      <div className="mb-3 flex items-start justify-between">
        <h3 className="text-lg font-semibold line-clamp-1">{service.name}</h3>
        <Switch checked={service.active} onCheckedChange={() => onToggle(service.id, service.active)} />
      </div>
      <div className="mb-4 flex flex-wrap gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="h-4 w-4" /> {service.duration_minutes} min
        </span>
        <span className="flex items-center gap-1">
          <DollarSign className="h-4 w-4" /> R$ {Number(service.price).toFixed(2)}
        </span>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={() => onEdit(service)}>
          <Pencil className="mr-1 h-3 w-3" /> Editar
        </Button>
        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => onDelete(service.id)}>
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      {service.global_category_id && (
        <div className="mt-3 text-[10px] text-muted-foreground flex items-center gap-1 opacity-70">
          <Zap className="h-2 w-2" /> Marketplace pronto
        </div>
      )}
    </CardContent>
  </Card>
);

export default Services;