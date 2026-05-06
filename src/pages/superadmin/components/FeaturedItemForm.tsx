import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Calendar as CalendarIcon, MapPin, Star, Building2, Users, Save, X, Navigation as NavIcon } from 'lucide-react';
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
  const [states, setStates] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  
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
    state_id: item?.state_id || null,
    city_id: item?.city_id || null,
    neighborhood: item?.neighborhood || '',
    internal_notes: item?.internal_notes || '',
    latitude: item?.latitude || '',
    longitude: item?.longitude || '',
    radius_km: item?.radius_km || '',
  });

  useEffect(() => {
    const fetchData = async () => {
      const { data: companiesData } = await supabase.from('companies').select('id, name').order('name');
      const { data: statesData } = await supabase.from('states').select('id, uf, name').order('name');
      
      if (companiesData) setCompanies(companiesData);
      if (statesData) setStates(statesData);

      if (item?.state_id) {
        fetchCities(item.state_id);
      }

      if (item?.item_type === 'professional' && item?.company_id) {
        fetchProfessionals(item.company_id);
      }
    };
    fetchData();
  }, [item]);

  const fetchCities = async (stateId: string) => {
    const { data, error } = await supabase
      .from('cities')
      .select('id, name')
      .eq('state_id', stateId)
      .order('name');
    
    if (data) setCities(data);
  };

  const fetchProfessionals = async (companyId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('company_id', companyId)
      .order('full_name');
    
    if (data) setProfessionals(data);
  };

  const handleStateChange = (stateId: string) => {
    setFormData({ ...formData, state_id: stateId === 'null' ? null : stateId, city_id: null });
    if (stateId !== 'null') {
      fetchCities(stateId);
    } else {
      setCities([]);
    }
  };

  const handleCompanyChange = (companyId: string) => {
    const id = companyId === 'null' ? null : companyId;
    setFormData({ ...formData, company_id: id, professional_id: null });
    if (id && formData.item_type === 'professional') {
      fetchProfessionals(id);
    } else {
      setProfessionals([]);
    }
  };

  const isFormValid = 
    formData.company_id && 
    (formData.item_type === 'company' || formData.professional_id) &&
    formData.start_at && 
    formData.end_at &&
    formData.highlight_type;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.company_id) {
      toast.error('Selecione uma empresa vinculada');
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
        item_type: formData.item_type,
        company_id: formData.company_id,
        professional_id: formData.item_type === 'professional' ? formData.professional_id : null,
        highlight_type: formData.highlight_type,
        start_at: formData.start_at,
        end_at: formData.end_at,
        start_date: formData.start_at, // Sincroniza com o campo obrigatório legado/DB
        end_date: formData.end_at,     // Sincroniza com o campo obrigatório legado/DB
        priority: parseInt(formData.priority) || 0,
        rotation_weight: parseInt(formData.rotation_weight) || 1,
        status: formData.status,
        country: formData.country,
        state_id: formData.state_id,
        city_id: formData.city_id,
        neighborhood: formData.neighborhood,
        internal_notes: formData.internal_notes,
        latitude: formData.latitude ? parseFloat(formData.latitude) : null,
        longitude: formData.longitude ? parseFloat(formData.longitude) : null,
        radius_km: formData.radius_km ? parseFloat(formData.radius_km) : null,
      };

      if (isEditing) {
        const { error } = await supabase
          .from('marketplace_featured_items')
          .update(dataToSave)
          .eq('id', item.id);
        if (error) throw error;
        toast.success('Destaque atualizado com sucesso');
      } else {
        const { error } = await supabase
          .from('marketplace_featured_items')
          .insert([dataToSave]);
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
                onValueChange={val => setFormData({...formData, item_type: val, professional_id: null})}
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
              <Label>Empresa Vinculada</Label>
              <Select 
                value={formData.company_id || 'null'} 
                onValueChange={handleCompanyChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a empresa" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="null">Selecione...</SelectItem>
                  {companies.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {formData.item_type === 'professional' && (
              <div className="space-y-2">
                <Label>Selecionar Profissional</Label>
                <Select 
                  value={formData.professional_id || 'null'} 
                  onValueChange={val => setFormData({...formData, professional_id: val === 'null' ? null : val})}
                  disabled={!formData.company_id}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={!formData.company_id ? "Selecione a empresa primeiro" : "Selecione o profissional"} />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    <SelectItem value="null">Selecione...</SelectItem>
                    {professionals.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

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
              <Label>Estado (Brasil)</Label>
              <Select 
                value={formData.state_id || 'null'} 
                onValueChange={handleStateChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o estado" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="null">Nacional (Todos)</SelectItem>
                  {states.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.uf})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Cidade</Label>
              <Select 
                value={formData.city_id || 'null'} 
                onValueChange={val => setFormData({...formData, city_id: val === 'null' ? null : val})}
                disabled={!formData.state_id}
              >
                <SelectTrigger>
                  <SelectValue placeholder={!formData.state_id ? "Selecione o estado primeiro" : "Selecione a cidade"} />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="null">Todas as cidades</SelectItem>
                  {cities.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Bairro (Campo Livre)</Label>
              <Input value={formData.neighborhood} onChange={e => setFormData({...formData, neighborhood: e.target.value})} placeholder="Ex: Jardins" />
            </div>

            <div className="col-span-1 md:col-span-2 border-t pt-4 mt-2">
              <h4 className="text-sm font-medium flex items-center gap-2 mb-4">
                <NavIcon className="h-4 w-4" />
                Geolocalização (Opcional - Segmentação por Raio)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Latitude</Label>
                  <Input 
                    type="number" 
                    step="any" 
                    value={formData.latitude} 
                    onChange={e => setFormData({...formData, latitude: e.target.value})} 
                    placeholder="-23.5505"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Longitude</Label>
                  <Input 
                    type="number" 
                    step="any" 
                    value={formData.longitude} 
                    onChange={e => setFormData({...formData, longitude: e.target.value})} 
                    placeholder="-46.6333"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Raio (km)</Label>
                  <Input 
                    type="number" 
                    value={formData.radius_km} 
                    onChange={e => setFormData({...formData, radius_km: e.target.value})} 
                    placeholder="50"
                  />
                </div>
              </div>
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
        <Button type="submit" disabled={loading || !isFormValid} className="gap-2">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          <Save className="h-4 w-4" />
          {isEditing ? 'Atualizar Destaque' : 'Salvar Destaque'}
        </Button>
      </div>
    </form>
  );
};

export default FeaturedItemForm;
