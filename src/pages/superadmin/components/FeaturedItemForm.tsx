import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Calendar as CalendarIcon, MapPin, Star, Building2, Users, Save, X } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface FeaturedItemFormProps {
  item?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

const FeaturedItemForm = ({ item, onSuccess, onCancel }: FeaturedItemFormProps) => {
  const isEditing = !!item;
  const [loading, setLoading] = useState(false);
  const [companies, setCompanies] = useState<any[]>([]);
  const [professionals, setProfessionals] = useState<any[]>([]);
  
  const [formData, setFormData] = useState<any>({
    item_type: item?.item_type || 'company',
    company_id: item?.company_id || null,
    professional_id: item?.professional_id || null,
    highlight_type: item?.highlight_type || 'featured_large',
    start_at: item?.start_at ? new Date(item.start_at).toISOString().slice(0, 16) : format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    end_at: item?.end_at ? new Date(item.end_at).toISOString().slice(0, 16) : format(new Date(new Date().setMonth(new Date().getMonth() + 1)), "yyyy-MM-dd'T'HH:mm"),
    priority: item?.priority || 100,
    rotation_weight: item?.rotation_weight || 1,
    status: item?.status || 'draft',
    country: item?.country || 'Brasil',
    state: item?.state || '',
    city: item?.city || '',
    neighborhood: item?.neighborhood || '',
    internal_notes: item?.internal_notes || '',
  });

  useEffect(() => {
    const fetchData = async () => {
      const [companiesRes, profilesRes] = await Promise.all([
        supabase.from('companies').select('id, name').order('name'),
        supabase.from('profiles').select('id, full_name').order('full_name')
      ]);
      
      if (companiesRes.data) setCompanies(companiesRes.data);
      if (profilesRes.data) setProfessionals(profilesRes.data);
    };
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.item_type === 'company' && !formData.company_id) {
      toast.error('Selecione uma empresa');
      return;
    }
    
    if (formData.item_type === 'professional' && !formData.professional_id) {
      toast.error('Selecione um profissional');
      return;
    }

    if (new Date(formData.end_at) <= new Date(formData.start_at)) {
      toast.error('A data de término deve ser posterior à data de início');
      return;
    }

    setLoading(true);
    try {
      const dataToSave = {
        ...formData,
        company_id: formData.item_type === 'company' ? formData.company_id : null,
        professional_id: formData.item_type === 'professional' ? formData.professional_id : null,
        priority: parseInt(formData.priority),
        rotation_weight: parseInt(formData.rotation_weight),
      };

      // Remove item_type for DB save if it doesn't exist in schema
      const { item_type, ...cleanData } = dataToSave;

      if (isEditing) {
        const { error } = await supabase
          .from('marketplace_featured_items')
          .update(cleanData)
          .eq('id', item.id);
        if (error) throw error;
        toast.success('Destaque atualizado com sucesso');
      } else {
        const { error } = await supabase
          .from('marketplace_featured_items')
          .insert([cleanData]);
        if (error) throw error;
        toast.success('Destaque criado com sucesso');
      }
      onSuccess();
    } catch (err: any) {
      toast.error(`Erro ao salvar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-6">
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="basic">Configuração</TabsTrigger>
          <TabsTrigger value="segmentation">Região</TabsTrigger>
          <TabsTrigger value="schedule">Período</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Item</Label>
              <Select 
                value={formData.item_type} 
                onValueChange={val => setFormData({...formData, item_type: val, company_id: null, professional_id: null})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="company">Empresa</SelectItem>
                  <SelectItem value="professional">Profissional</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{formData.item_type === 'company' ? 'Selecionar Empresa' : 'Selecionar Profissional'}</Label>
              <Select 
                value={(formData.item_type === 'company' ? formData.company_id : formData.professional_id) || 'null'} 
                onValueChange={val => setFormData({
                  ...formData, 
                  company_id: formData.item_type === 'company' ? val : null,
                  professional_id: formData.item_type === 'professional' ? val : null
                })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={`Selecione um(a) ${formData.item_type === 'company' ? 'empresa' : 'profissional'}`} />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="null">Selecione...</SelectItem>
                  {formData.item_type === 'company' 
                    ? companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)
                    : professionals.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)
                  }
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Tipo de Destaque</Label>
              <Select 
                value={formData.highlight_type} 
                onValueChange={val => setFormData({...formData, highlight_type: val})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="featured_large">Destaque Maior (Premium)</SelectItem>
                  <SelectItem value="featured_medium">Destaque Mediano (Seções)</SelectItem>
                  <SelectItem value="featured_logo">Destaque de Logos (Faixa)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select 
                value={formData.status} 
                onValueChange={val => setFormData({...formData, status: val})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="scheduled">Programado</SelectItem>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="paused">Pausado</SelectItem>
                  <SelectItem value="ended">Encerrado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Prioridade (Maior = Primeiro)</Label>
              <Input 
                type="number" 
                value={formData.priority} 
                onChange={e => setFormData({...formData, priority: e.target.value})} 
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Observações Internas</Label>
            <Textarea 
              value={formData.internal_notes} 
              onChange={e => setFormData({...formData, internal_notes: e.target.value})} 
              rows={3}
              placeholder="Notas sobre a venda ou motivo do destaque..."
            />
          </div>
        </TabsContent>

        <TabsContent value="segmentation" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>País</Label>
              <Input value={formData.country} onChange={e => setFormData({...formData, country: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label>Estado (UF)</Label>
              <Input value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})} placeholder="Ex: SP" />
            </div>
            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} placeholder="Ex: São Paulo" />
            </div>
            <div className="space-y-2">
              <Label>Bairro</Label>
              <Input value={formData.neighborhood} onChange={e => setFormData({...formData, neighborhood: e.target.value})} placeholder="Ex: Jardins" />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="schedule" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Início do Destaque</Label>
              <Input 
                type="datetime-local" 
                value={formData.start_at} 
                onChange={e => setFormData({...formData, start_at: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <Label>Término do Destaque</Label>
              <Input 
                type="datetime-local" 
                value={formData.end_at} 
                onChange={e => setFormData({...formData, end_at: e.target.value})} 
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={loading} className="gap-2">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          <Save className="h-4 w-4" />
          {isEditing ? 'Atualizar Destaque' : 'Salvar Destaque'}
        </Button>
      </div>
    </form>
  );
};

export default FeaturedItemForm;
