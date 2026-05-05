import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  LayoutDashboard, 
  Building2,
  Users,
  Image as ImageIcon, 
  Megaphone, 
  Star, 
  BarChart3, 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  Calendar, 
  MapPin, 
  Layers,
  Upload,
  X,
  Loader2,
  Trash2,
  Edit,
  ExternalLink,
  Save
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import BannerForm from './components/BannerForm';

const BUCKET = 'marketplace-assets';

const SuperAdminMarketplace = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  
  // Data States
  const [homeSettings, setHomeSettings] = useState<any>(null);
  const [banners, setBanners] = useState<any[]>([]);
  const [featuredItems, setFeaturedItems] = useState<any[]>([]);
  const [stats, setStats] = useState({
    activeBanners: 0,
    scheduledBanners: 0,
    monthlyClicks: 0,
    monthlyImpressions: 0,
    featuredCompanies: 0
  });

  // UI States
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedBanner, setSelectedBanner] = useState<any>(null);
  const [filters, setFilters] = useState({
    status: 'all',
    position: 'all'
  });
  const [searchTerm, setSearchTerm] = useState('');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [homeRes, bannersRes, featuredRes] = await Promise.all([
        supabase.from('marketplace_home_settings').select('*').single(),
        supabase.from('marketplace_banners').select('*').order('created_at', { ascending: false }),
        supabase.from('marketplace_featured_items').select('*, companies(name, logo_url), profiles(full_name, avatar_url)').order('created_at', { ascending: false })
      ]);

      if (homeRes.data) setHomeSettings(homeRes.data);
      if (bannersRes.data) {
        setBanners(bannersRes.data);
        const now = new Date();
        setStats(prev => ({
          ...prev,
          activeBanners: bannersRes.data.filter(b => b.status === 'active').length,
          scheduledBanners: bannersRes.data.filter(b => b.status === 'scheduled').length
        }));
      }
      if (featuredRes.data) {
        setFeaturedItems(featuredRes.data);
        setStats(prev => ({
          ...prev,
          featuredCompanies: featuredRes.data.filter(f => f.status === 'active').length
        }));
      }
    } catch (error) {
      console.error('Error fetching marketplace data:', error);
      toast.error('Erro ao carregar dados do marketplace');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  const handleSaveHomeSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('marketplace_home_settings')
        .update(homeSettings)
        .eq('id', homeSettings.id);
      
      if (error) throw error;
      toast.success('Configurações da Home salvas com sucesso');
    } catch (error: any) {
      toast.error(`Erro ao salvar: ${error.message}`);
    }
  };

  const handleDeleteBanner = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este banner?')) return;
    
    try {
      // Usar soft delete
      const { error } = await supabase
        .from('marketplace_banners')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;
      toast.success('Banner excluído com sucesso');
      fetchAll();
    } catch (error: any) {
      toast.error(`Erro ao excluir: ${error.message}`);
    }
  };

  const handleDuplicateBanner = async (banner: any) => {
    try {
      const { id, created_at, updated_at, deleted_at, current_clicks, current_impressions, ...rest } = banner;
      const { error } = await supabase
        .from('marketplace_banners')
        .insert([{
          ...rest,
          name: `Cópia de ${banner.name}`,
          status: 'draft'
        }]);
      
      if (error) throw error;
      toast.success('Banner duplicado como rascunho');
      fetchAll();
    } catch (error: any) {
      toast.error(`Erro ao duplicar: ${error.message}`);
    }
  };

  const getPublicUrl = (path: string) => {
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl;
  };

  const ImageUploadField = ({ label, value, onChange, folder, accept = 'image/*' }: any) => {
    const inputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploading(true);
      try {
        const ext = file.name.split('.').pop();
        const fileName = `${folder}/${Date.now()}.${ext}`;

        const { error } = await supabase.storage.from(BUCKET).upload(fileName, file, {
          cacheControl: '3600',
          upsert: true,
        });

        if (error) throw error;

        const publicUrl = getPublicUrl(fileName);
        onChange(publicUrl);
        toast.success(`${label} enviado com sucesso`);
      } catch (err: any) {
        toast.error(`Erro ao enviar: ${err.message}`);
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = '';
      }
    };

    return (
      <div className="space-y-2">
        <Label className="text-xs">{label}</Label>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="gap-1.5"
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {uploading ? 'Enviando...' : 'Upload'}
          </Button>
          {value && (
            <Button type="button" variant="ghost" size="sm" onClick={() => onChange('')} className="gap-1 text-destructive hover:text-destructive">
              <X className="h-3.5 w-3.5" /> Remover
            </Button>
          )}
        </div>
        <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleUpload} />
        {value && (
          <div className="mt-2 rounded-lg border border-border bg-muted/30 p-2 inline-block">
            <img src={value} alt={label} className="max-h-20 max-w-[240px] rounded object-contain" />
          </div>
        )}
      </div>
    );
  };

  if (loading && !homeSettings) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold">Marketplace</h2>
          <p className="text-muted-foreground">Gestão avançada de conteúdo, banners e destaques.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => window.open('/', '_blank')}>
            <ExternalLink className="h-4 w-4 mr-2" /> Ver Marketplace
          </Button>
          <Button size="sm" onClick={fetchAll}>
            Atualizar Dados
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-muted/50 p-1 w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview" className="gap-2"><LayoutDashboard className="h-4 w-4" /> Visão Geral</TabsTrigger>
          <TabsTrigger value="home" className="gap-2"><ImageIcon className="h-4 w-4" /> Conteúdo Home</TabsTrigger>
          <TabsTrigger value="banners" className="gap-2"><Megaphone className="h-4 w-4" /> Banners</TabsTrigger>
          <TabsTrigger value="featured" className="gap-2"><Star className="h-4 w-4" /> Destaques</TabsTrigger>
          <TabsTrigger value="reports" className="gap-2"><BarChart3 className="h-4 w-4" /> Relatórios</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-primary/10 rounded-lg"><Megaphone className="h-6 w-6 text-primary" /></div>
                  <div>
                    <p className="text-sm text-muted-foreground">Banners Ativos</p>
                    <p className="text-2xl font-bold">{stats.activeBanners}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-warning/10 rounded-lg"><Calendar className="h-6 w-6 text-warning" /></div>
                  <div>
                    <p className="text-sm text-muted-foreground">Programados</p>
                    <p className="text-2xl font-bold">{stats.scheduledBanners}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-success/10 rounded-lg"><Star className="h-6 w-6 text-success" /></div>
                  <div>
                    <p className="text-sm text-muted-foreground">Destaques Ativos</p>
                    <p className="text-2xl font-bold">{stats.featuredCompanies}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="p-2 bg-accent/10 rounded-lg"><BarChart3 className="h-6 w-6 text-accent-foreground" /></div>
                  <div>
                    <p className="text-sm text-muted-foreground">Cliques no Mês</p>
                    <p className="text-2xl font-bold">{stats.monthlyClicks}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Próximos Banners a Expirar</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Banner</TableHead>
                      <TableHead>Expira em</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {banners.filter(b => b.status === 'active').slice(0, 5).map(b => (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium">{b.name}</TableCell>
                        <TableCell>{format(new Date(b.end_date), 'dd/MM/yyyy')}</TableCell>
                        <TableCell><Badge variant="outline" className="bg-success/10 text-success border-success/20">Ativo</Badge></TableCell>
                      </TableRow>
                    ))}
                    {banners.filter(b => b.status === 'active').length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-4 text-muted-foreground text-sm">Nenhum banner ativo expirando em breve.</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Destaques Manuais</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {featuredItems.slice(0, 5).map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                          {item.item_type === 'company' ? <Building2 className="h-5 w-5" /> : <Users className="h-5 w-5" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{item.companies?.name || item.profiles?.full_name || 'Desconhecido'}</p>
                          <p className="text-xs text-muted-foreground">{item.position} · {item.city || 'Todas cidades'}</p>
                        </div>
                      </div>
                      <Badge variant={item.status === 'active' ? 'default' : 'secondary'}>{item.status}</Badge>
                    </div>
                  ))}
                  {featuredItems.length === 0 && (
                    <p className="text-center py-4 text-muted-foreground text-sm">Nenhum destaque manual cadastrado.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="home" className="space-y-6">
          <form onSubmit={handleSaveHomeSettings} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Seção Hero</CardTitle>
                <CardDescription>Configure a primeira impressão do marketplace.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="hero_badge">Badge de Destaque</Label>
                    <Input id="hero_badge" value={homeSettings?.hero_badge || ''} onChange={e => setHomeSettings({...homeSettings, hero_badge: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hero_title">Título Principal</Label>
                    <Input id="hero_title" value={homeSettings?.hero_title || ''} onChange={e => setHomeSettings({...homeSettings, hero_title: e.target.value})} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="hero_subtitle">Subtítulo</Label>
                    <Input id="hero_subtitle" value={homeSettings?.hero_subtitle || ''} onChange={e => setHomeSettings({...homeSettings, hero_subtitle: e.target.value})} />
                  </div>
                </div>
                <ImageUploadField 
                  label="Imagem do Hero" 
                  value={homeSettings?.hero_image_url} 
                  onChange={(url: string) => setHomeSettings({...homeSettings, hero_image_url: url})} 
                  folder="hero"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Chamada para Profissionais</CardTitle>
                <CardDescription>Configure a seção de CTA final para atrair novos parceiros.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="cta_title">Título CTA</Label>
                    <Input id="cta_title" value={homeSettings?.cta_professional_title || ''} onChange={e => setHomeSettings({...homeSettings, cta_professional_title: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cta_button">Texto do Botão</Label>
                    <Input id="cta_button" value={homeSettings?.cta_professional_button_text || ''} onChange={e => setHomeSettings({...homeSettings, cta_professional_button_text: e.target.value})} />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="cta_subtitle">Subtítulo CTA</Label>
                    <Input id="cta_subtitle" value={homeSettings?.cta_professional_subtitle || ''} onChange={e => setHomeSettings({...homeSettings, cta_professional_subtitle: e.target.value})} />
                  </div>
                </div>
                <ImageUploadField 
                  label="Imagem do CTA Profissional" 
                  value={homeSettings?.cta_professional_image_url} 
                  onChange={(url: string) => setHomeSettings({...homeSettings, cta_professional_image_url: url})} 
                  folder="cta"
                />
              </CardContent>
              <CardFooter className="border-t p-6">
                <Button type="submit" className="gap-2">
                  <Save className="h-4 w-4" /> Salvar Configurações da Home
                </Button>
              </CardFooter>
            </Card>
          </form>
        </TabsContent>

        <TabsContent value="banners" className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h3 className="text-lg font-semibold">Gestão de Anúncios</h3>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="gap-2" onClick={() => { setFilters({ status: 'all', position: 'all' }); setSearchTerm(''); }}>
                <X className="h-4 w-4" /> Limpar
              </Button>
              <Button size="sm" className="gap-2" onClick={() => { setSelectedBanner(null); setIsDialogOpen(true); }}>
                <Plus className="h-4 w-4" /> Novo Banner
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-muted/30 p-4 rounded-lg">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase">Status</Label>
              <Select value={filters.status} onValueChange={v => setFilters({...filters, status: v})}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Status</SelectItem>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="paused">Pausado</SelectItem>
                  <SelectItem value="scheduled">Programado</SelectItem>
                  <SelectItem value="ended">Encerrado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase">Posição</Label>
              <Select value={filters.position} onValueChange={v => setFilters({...filters, position: v})}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas Posições</SelectItem>
                  <SelectItem value="hero_secondary">Hero Secundário</SelectItem>
                  <SelectItem value="sections">Banner entre Seções</SelectItem>
                  <SelectItem value="category">Banner de Categoria</SelectItem>
                  <SelectItem value="footer">Rodapé</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-[10px] uppercase">Pesquisar</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Nome do banner ou anunciante..." 
                  className="pl-9 h-9" 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>
          
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Anúncio</TableHead>
                    <TableHead>Posição</TableHead>
                    <TableHead>Região/Categoria</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Performance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {banners
                    .filter(b => !b.deleted_at)
                    .filter(b => filters.status === 'all' || b.status === filters.status)
                    .filter(b => filters.position === 'all' || b.position === filters.position)
                    .filter(b => !searchTerm || 
                      b.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                      (b.client_name && b.client_name.toLowerCase().includes(searchTerm.toLowerCase()))
                    )
                    .map(b => (
                    <TableRow key={b.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <img src={b.desktop_image_url} className="h-10 w-16 object-cover rounded border" />
                          <div>
                            <p className="font-medium text-sm">{b.name}</p>
                            <p className="text-xs text-muted-foreground">{b.client_name || 'Anunciante direto'}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="capitalize text-sm">{b.position.replace('_', ' ')}</TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="text-xs flex items-center gap-1"><MapPin className="h-3 w-3" /> {b.city || 'Geral'}, {b.state || 'Brasil'}</span>
                          <span className="text-xs flex items-center gap-1"><Layers className="h-3 w-3" /> {b.category || 'Todas'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        {format(new Date(b.start_date), 'dd/MM')} - {format(new Date(b.end_date), 'dd/MM/yy')}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-muted-foreground">{b.current_impressions} imps</span>
                          <span className="text-[10px] text-muted-foreground">{b.current_clicks} cliques</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={b.status === 'active' ? 'default' : b.status === 'draft' ? 'outline' : 'secondary'} className="text-[10px] h-5 capitalize">
                          {b.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedBanner(b); setIsDialogOpen(true); }}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDuplicateBanner(b)}><Plus className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteBanner(b.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {banners.filter(b => !b.deleted_at).length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Nenhum banner cadastrado.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{selectedBanner ? 'Editar Banner' : 'Novo Banner'}</DialogTitle>
              </DialogHeader>
              <BannerForm 
                banner={selectedBanner} 
                onSuccess={() => { setIsDialogOpen(false); fetchAll(); }} 
                onCancel={() => setIsDialogOpen(false)} 
              />
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="featured" className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Destaques Manuais</h3>
            <Button size="sm" className="gap-2" onClick={() => toast.info('Busca e seleção em breve na Fase 2')}>
              <Plus className="h-4 w-4" /> Destacar Empresa/Profissional
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Posição</TableHead>
                    <TableHead>Região</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {featuredItems.map(item => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-muted overflow-hidden flex items-center justify-center">
                            {(item.companies?.logo_url || item.profiles?.avatar_url) ? (
                              <img src={item.companies?.logo_url || item.profiles?.avatar_url} className="w-full h-full object-cover" />
                            ) : (
                              <Building2 className="h-4 w-4 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{item.companies?.name || item.profiles?.full_name}</p>
                            <p className="text-[10px] text-muted-foreground uppercase">{item.item_type}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{item.position}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {item.city || 'Toda plataforma'}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{item.priority}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={item.status === 'active' ? 'default' : 'secondary'} className="text-[10px] h-5">{item.status}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive"><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {featuredItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">Nenhum destaque manual ativo.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Performance de Anúncios</CardTitle>
              <CardDescription>Métricas em tempo real de cliques e impressões.</CardDescription>
            </CardHeader>
            <CardContent className="py-20 text-center">
              <div className="max-w-md mx-auto space-y-4">
                <BarChart3 className="h-12 w-12 text-muted-foreground/30 mx-auto" />
                <h4 className="font-medium text-lg">Módulo de Relatórios em Desenvolvimento</h4>
                <p className="text-sm text-muted-foreground">Na Fase 2, você terá acesso a gráficos detalhados de CTR, mapas de calor por região e exportação completa para CSV.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};



export default SuperAdminMarketplace;
