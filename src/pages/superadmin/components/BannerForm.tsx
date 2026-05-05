import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Loader2, Upload, X, ImageIcon, Calendar as CalendarIcon, Link as LinkIcon, MapPin, Target, Settings, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const BUCKET = 'marketplace-assets';

interface BannerFormProps {
  banner?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

const BannerForm = ({ banner, onSuccess, onCancel }: BannerFormProps) => {
  const isEditing = !!banner;
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [companies, setCompanies] = useState<any[]>([]);
  
  const [formData, setFormData] = useState<any>({
    name: banner?.name || '',
    client_name: banner?.client_name || '',
    company_id: banner?.company_id || null,
    desktop_image_url: banner?.desktop_image_url || '',
    mobile_image_url: banner?.mobile_image_url || '',
    destination_link: banner?.destination_link || '',
    open_in_new_tab: banner?.open_in_new_tab ?? true,
    position: banner?.position || 'hero_secondary',
    country: banner?.country || 'Brasil',
    state: banner?.state || '',
    city: banner?.city || '',
    neighborhood: banner?.neighborhood || '',
    category: banner?.category || '',
    start_date: banner?.start_date ? new Date(banner.start_date).toISOString().slice(0, 16) : format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    end_date: banner?.end_date ? new Date(banner.end_date).toISOString().slice(0, 16) : format(new Date(new Date().setMonth(new Date().getMonth() + 1)), "yyyy-MM-dd'T'HH:mm"),
    sale_model: banner?.sale_model || 'fixed_period',
    limit_impressions: banner?.limit_impressions || null,
    limit_clicks: banner?.limit_clicks || null,
    priority: banner?.priority || 0,
    rotation_weight: banner?.rotation_weight || 1,
    status: banner?.status || 'draft',
    internal_notes: banner?.internal_notes || '',
  });

  useEffect(() => {
    const fetchCompanies = async () => {
      const { data } = await supabase.from('companies').select('id, name').order('name');
      if (data) setCompanies(data);
    };
    fetchCompanies();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(field);
    try {
      const ext = file.name.split('.').pop();
      const fileName = `banners/${Date.now()}_${field}.${ext}`;

      const { error } = await supabase.storage.from(BUCKET).upload(fileName, file, {
        cacheControl: '3600',
        upsert: true,
      });

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
      setFormData((prev: any) => ({ ...prev, [field]: publicUrl }));
      toast.success('Imagem enviada com sucesso');
    } catch (err: any) {
      toast.error(`Erro ao enviar: ${err.message}`);
    } finally {
      setUploading(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.desktop_image_url || !formData.start_date || !formData.end_date) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    if (new Date(formData.end_date) <= new Date(formData.start_date)) {
      toast.error('A data de término deve ser posterior à data de início');
      return;
    }

    setLoading(true);
    try {
      const dataToSave = {
        ...formData,
        company_id: formData.company_id === 'null' ? null : formData.company_id,
        limit_impressions: formData.limit_impressions ? parseInt(formData.limit_impressions) : null,
        limit_clicks: formData.limit_clicks ? parseInt(formData.limit_clicks) : null,
        priority: parseInt(formData.priority),
        rotation_weight: parseInt(formData.rotation_weight),
      };

      if (isEditing) {
        const { error } = await supabase
          .from('marketplace_banners')
          .update(dataToSave)
          .eq('id', banner.id);
        if (error) throw error;
        toast.success('Banner atualizado com sucesso');
      } else {
        const { error } = await supabase
          .from('marketplace_banners')
          .insert([dataToSave]);
        if (error) throw error;
        toast.success('Banner criado com sucesso');
      }
      onSuccess();
    } catch (err: any) {
      toast.error(`Erro ao salvar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-20">
      <Tabs defaultValue="basic" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="basic">Básico</TabsTrigger>
          <TabsTrigger value="media">Mídia</TabsTrigger>
          <TabsTrigger value="segmentation">Segmentação</TabsTrigger>
          <TabsTrigger value="commercial">Comercial</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Campanha *</Label>
              <Input 
                id="name" 
                value={formData.name} 
                onChange={e => setFormData({...formData, name: e.target.value})} 
                placeholder="Ex: Campanha Black Friday 2024"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="client_name">Anunciante / Cliente *</Label>
              <Input 
                id="client_name" 
                value={formData.client_name} 
                onChange={e => setFormData({...formData, client_name: e.target.value})} 
                placeholder="Nome da agência ou cliente"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_id">Empresa Vinculada (Opcional)</Label>
              <Select 
                value={formData.company_id || 'null'} 
                onValueChange={val => setFormData({...formData, company_id: val})}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma empresa" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="null">Nenhuma</SelectItem>
                  {companies.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
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
          </div>
          <div className="space-y-2">
            <Label htmlFor="internal_notes">Observações Internas</Label>
            <Textarea 
              id="internal_notes" 
              value={formData.internal_notes} 
              onChange={e => setFormData({...formData, internal_notes: e.target.value})} 
              rows={3}
            />
          </div>
        </TabsContent>

        <TabsContent value="media" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <Label>Imagem Desktop * (Recomendado: 1200x400)</Label>
              <div className="border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center gap-2 bg-muted/30 relative min-h-[160px]">
                {formData.desktop_image_url ? (
                  <>
                    <img src={formData.desktop_image_url} alt="Desktop Preview" className="max-w-full max-h-32 object-contain rounded" />
                    <Button 
                      type="button" 
                      variant="destructive" 
                      size="icon" 
                      className="absolute top-2 right-2 h-6 w-6"
                      onClick={() => setFormData({...formData, desktop_image_url: ''})}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="p-3 bg-primary/10 rounded-full">
                      <ImageIcon className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-xs text-muted-foreground">Clique para fazer upload</p>
                    <Input 
                      type="file" 
                      className="absolute inset-0 opacity-0 cursor-pointer" 
                      onChange={e => handleUpload(e, 'desktop_image_url')}
                      disabled={!!uploading}
                    />
                  </>
                )}
                {uploading === 'desktop_image_url' && (
                  <div className="absolute inset-0 bg-background/60 flex items-center justify-center rounded-lg">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <Label>Imagem Mobile (Opcional - Recomendado: 600x600)</Label>
              <div className="border-2 border-dashed rounded-lg p-4 flex flex-col items-center justify-center gap-2 bg-muted/30 relative min-h-[160px]">
                {formData.mobile_image_url ? (
                  <>
                    <img src={formData.mobile_image_url} alt="Mobile Preview" className="max-w-full max-h-32 object-contain rounded" />
                    <Button 
                      type="button" 
                      variant="destructive" 
                      size="icon" 
                      className="absolute top-2 right-2 h-6 w-6"
                      onClick={() => setFormData({...formData, mobile_image_url: ''})}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="p-3 bg-primary/10 rounded-full">
                      <ImageIcon className="h-6 w-6 text-primary" />
                    </div>
                    <p className="text-xs text-muted-foreground">Clique para fazer upload</p>
                    <Input 
                      type="file" 
                      className="absolute inset-0 opacity-0 cursor-pointer" 
                      onChange={e => handleUpload(e, 'mobile_image_url')}
                      disabled={!!uploading}
                    />
                  </>
                )}
                {uploading === 'mobile_image_url' && (
                  <div className="absolute inset-0 bg-background/60 flex items-center justify-center rounded-lg">
                    <Loader2 className="h-6 w-6 animate-spin" />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="destination_link">Link de Destino *</Label>
                <div className="flex gap-2">
                  <Input 
                    id="destination_link" 
                    value={formData.destination_link} 
                    onChange={e => setFormData({...formData, destination_link: e.target.value})} 
                    placeholder="https://..."
                  />
                  <Button type="button" variant="outline" size="icon" onClick={() => window.open(formData.destination_link, '_blank')} disabled={!formData.destination_link}>
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2 h-full pt-6">
                <Switch 
                  id="open_in_new_tab" 
                  checked={formData.open_in_new_tab} 
                  onCheckedChange={checked => setFormData({...formData, open_in_new_tab: checked})}
                />
                <Label htmlFor="open_in_new_tab">Abrir em nova aba</Label>
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="position">Posição do Banner</Label>
              <Select 
                value={formData.position} 
                onValueChange={val => setFormData({...formData, position: val})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hero_secondary">Hero Secundário</SelectItem>
                  <SelectItem value="sections">Banner entre Seções</SelectItem>
                  <SelectItem value="category">Banner de Categoria</SelectItem>
                  <SelectItem value="footer">Rodapé do Marketplace</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="segmentation" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="state">Estado (UF)</Label>
              <Input id="state" value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})} placeholder="Ex: SP" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">Cidade</Label>
              <Input id="city" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} placeholder="Ex: São Paulo" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="neighborhood">Bairro</Label>
              <Input id="neighborhood" value={formData.neighborhood} onChange={e => setFormData({...formData, neighborhood: e.target.value})} placeholder="Ex: Jardins" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <Input id="category" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} placeholder="Ex: barbearia" />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="commercial" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Início *</Label>
              <Input 
                id="start_date" 
                type="datetime-local" 
                value={formData.start_date} 
                onChange={e => setFormData({...formData, start_date: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">Término *</Label>
              <Input 
                id="end_date" 
                type="datetime-local" 
                value={formData.end_date} 
                onChange={e => setFormData({...formData, end_date: e.target.value})} 
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sale_model">Modelo Comercial</Label>
              <Select 
                value={formData.sale_model} 
                onValueChange={val => setFormData({...formData, sale_model: val})}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed_period">Período Fixo</SelectItem>
                  <SelectItem value="impressions">Por Impressões</SelectItem>
                  <SelectItem value="clicks">Por Cliques</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="priority">Prioridade (Maior = Primeiro)</Label>
              <Input 
                id="priority" 
                type="number" 
                value={formData.priority} 
                onChange={e => setFormData({...formData, priority: e.target.value})} 
              />
            </div>
            {formData.sale_model === 'impressions' && (
              <div className="space-y-2">
                <Label htmlFor="limit_impressions">Limite de Impressões</Label>
                <Input 
                  id="limit_impressions" 
                  type="number" 
                  value={formData.limit_impressions || ''} 
                  onChange={e => setFormData({...formData, limit_impressions: e.target.value})} 
                />
              </div>
            )}
            {formData.sale_model === 'clicks' && (
              <div className="space-y-2">
                <Label htmlFor="limit_clicks">Limite de Cliques</Label>
                <Input 
                  id="limit_clicks" 
                  type="number" 
                  value={formData.limit_clicks || ''} 
                  onChange={e => setFormData({...formData, limit_clicks: e.target.value})} 
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="rotation_weight">Peso na Rotação</Label>
              <Input 
                id="rotation_weight" 
                type="number" 
                value={formData.rotation_weight} 
                onChange={e => setFormData({...formData, rotation_weight: e.target.value})} 
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-3 pt-6 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>Cancelar</Button>
        <Button type="submit" disabled={loading} className="gap-2">
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {isEditing ? 'Atualizar Banner' : 'Criar Banner'}
        </Button>
      </div>
    </form>
  );
};

// Internal icon fix
const ExternalLink = ({ className }: any) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
  </svg>
);

export default BannerForm;
