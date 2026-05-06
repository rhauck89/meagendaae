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
  Save,
  AlertTriangle,
  Clock,
  CheckCircle2,
  TrendingUp,
  AlertCircle,
  Navigation as NavIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { format, differenceInDays, addDays } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import BannerForm from './components/BannerForm';
import FeaturedItemForm from './components/FeaturedItemForm';
import ReportsTab from './components/ReportsTab';

const BUCKET = 'marketplace-assets';

const Progress = ({ value, label }: { value: number; label: string }) => (
  <div className="space-y-1 w-full max-w-[100px]">
    <div className="flex justify-between text-[10px] text-muted-foreground uppercase font-medium">
      <span>{label}</span>
      <span>{Math.min(100, Math.round(value))}%</span>
    </div>
    <div className="h-1 w-full bg-muted rounded-full overflow-hidden">
      <div 
        className={`h-full transition-all ${value >= 100 ? 'bg-destructive' : value >= 80 ? 'bg-orange-500' : 'bg-primary'}`} 
        style={{ width: `${Math.min(100, value)}%` }} 
      />
    </div>
  </div>
);

const getUsageBadge = (banner: any) => {
  if (banner.status !== 'active' && banner.status !== 'ended') return null;
  
  const now = new Date();
  const endDate = new Date(banner.end_date);
  const daysLeft = differenceInDays(endDate, now);

  if (banner.status === 'active' && daysLeft >= 0 && daysLeft <= 3) {
    return <Badge variant="outline" className="bg-amber-50 text-amber-600 border-amber-200 text-[10px] h-5">Expira em breve</Badge>;
  }

  if (banner.sale_model === 'impressions' && banner.limit_impressions) {
    const usage = (banner.current_impressions / banner.limit_impressions) * 100;
    if (usage >= 100) return <Badge variant="destructive" className="text-[10px] h-5">Limite atingido</Badge>;
    if (usage >= 80) return <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200 text-[10px] h-5">Perto do limite</Badge>;
  }

  if (banner.sale_model === 'clicks' && banner.limit_clicks) {
    const usage = (banner.current_clicks / banner.limit_clicks) * 100;
    if (usage >= 100) return <Badge variant="destructive" className="text-[10px] h-5">Limite atingido</Badge>;
    if (usage >= 80) return <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-200 text-[10px] h-5">Perto do limite</Badge>;
  }

  return null;
};

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
  const [isFeaturedDialogOpen, setIsFeaturedDialogOpen] = useState(false);
  const [selectedBanner, setSelectedBanner] = useState<any>(null);
  const [selectedFeaturedItem, setSelectedFeaturedItem] = useState<any>(null);
  const [filters, setFilters] = useState({
    status: 'all',
    position: 'all'
  });
  const [featuredFilters, setFeaturedFilters] = useState({
    status: 'all',
    type: 'all'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [featuredSearchTerm, setFeaturedSearchTerm] = useState('');

  const fetchAll = async () => {
    setLoading(true);
    try {
      // Sincronizar status antes de buscar
      await Promise.all([
        supabase.rpc('sync_marketplace_banner_statuses'),
        supabase.rpc('sync_marketplace_featured_statuses')
      ]);

      const [homeRes, bannersRes, featuredRes] = await Promise.all([
        supabase.from('marketplace_home_settings').select('*').single(),
        supabase.from('marketplace_banners')
          .select('*, states(uf, name), cities(name)')
          .order('created_at', { ascending: false }),
        supabase.from('marketplace_featured_items').select('*, companies(name, logo_url), profiles(full_name, avatar_url), states(uf, name), cities(name)').order('priority', { ascending: false })
      ]);

      if (homeRes.data) setHomeSettings(homeRes.data);
      if (bannersRes.data) {
        setBanners(bannersRes.data);
        const monthlyImpressions = bannersRes.data.reduce((sum, b) => sum + (b.current_impressions || 0), 0);
        const monthlyClicks = bannersRes.data.reduce((sum, b) => sum + (b.current_clicks || 0), 0);

        setStats(prev => ({
          ...prev,
          activeBanners: bannersRes.data.filter(b => b.status === 'active' && !b.deleted_at).length,
          scheduledBanners: bannersRes.data.filter(b => b.status === 'scheduled' && !b.deleted_at).length,
          monthlyImpressions,
          monthlyClicks
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

  const handleDeleteFeaturedItem = async (id: string) => {
    if (!confirm('Tem certeza que deseja remover este destaque?')) return;
    
    try {
      const { error } = await supabase
        .from('marketplace_featured_items')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast.success('Destaque removido com sucesso');
      fetchAll();
    } catch (error: any) {
      toast.error(`Erro ao remover: ${error.message}`);
    }
  };

  const handleToggleFeaturedStatus = async (item: any) => {
    const newStatus = item.status === 'active' ? 'paused' : 'active';
    try {
      const { error } = await supabase
        .from('marketplace_featured_items')
        .update({ status: newStatus })
        .eq('id', item.id);
      
      if (error) throw error;
      toast.success(`Destaque ${newStatus === 'active' ? 'ativado' : 'pausado'} com sucesso`);
      fetchAll();
    } catch (error: any) {
      toast.error(`Erro ao alterar status: ${error.message}`);
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

  const getBannerAlerts = () => {
    const alerts: any[] = [];
    const now = new Date();

    banners.filter(b => !b.deleted_at).forEach(b => {
      // Expirando em breve (3 dias)
      if (b.status === 'active') {
        const endDate = new Date(b.end_date);
        const daysLeft = differenceInDays(endDate, now);
        if (daysLeft >= 0 && daysLeft <= 3) {
          alerts.push({
            id: `exp-${b.id}`,
            type: 'warning',
            title: 'Expira em breve',
            message: `O banner "${b.name}" expira em ${daysLeft === 0 ? 'hoje' : daysLeft === 1 ? '1 dia' : daysLeft + ' dias'}.`,
            icon: Clock
          });
        }

        // Limite de impressões (80%+)
        if (b.sale_model === 'impressions' && b.limit_impressions) {
          const usage = (b.current_impressions / b.limit_impressions) * 100;
          if (usage >= 80 && usage < 100) {
            alerts.push({
              id: `lim-imp-${b.id}`,
              type: 'info',
              title: 'Perto do limite de impressões',
              message: `O banner "${b.name}" atingiu ${Math.round(usage)}% do limite de impressões.`,
              icon: TrendingUp
            });
          }
        }

        // Limite de cliques (80%+)
        if (b.sale_model === 'clicks' && b.limit_clicks) {
          const usage = (b.current_clicks / b.limit_clicks) * 100;
          if (usage >= 80 && usage < 100) {
            alerts.push({
              id: `lim-clk-${b.id}`,
              type: 'info',
              title: 'Perto do limite de cliques',
              message: `O banner "${b.name}" atingiu ${Math.round(usage)}% do limite de cliques.`,
              icon: TrendingUp
            });
          }
        }
      }

      // Encerrados recentemente (últimos 2 dias)
      if (b.status === 'ended') {
        const updatedAt = new Date(b.updated_at);
        const daysSinceEnd = differenceInDays(now, updatedAt);
        if (daysSinceEnd <= 2) {
          alerts.push({
            id: `end-${b.id}`,
            type: 'muted',
            title: 'Encerrado recentemente',
            message: `O banner "${b.name}" foi finalizado automaticamente.`,
            icon: CheckCircle2
          });
        }
      }
    });

    return alerts;
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

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-warning" /> 
                    Alertas Operacionais
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {getBannerAlerts().map((alert) => (
                      <div key={alert.id} className={`flex gap-3 p-3 rounded-lg border ${
                        alert.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' :
                        alert.type === 'info' ? 'bg-blue-50 border-blue-200 text-blue-800' :
                        'bg-muted/50 border-border text-muted-foreground'
                      }`}>
                        <alert.icon className="h-5 w-5 shrink-0" />
                        <div className="space-y-1">
                          <p className="text-sm font-semibold leading-none">{alert.title}</p>
                          <p className="text-sm opacity-90">{alert.message}</p>
                        </div>
                      </div>
                    ))}
                    {getBannerAlerts().length === 0 && (
                      <div className="text-center py-8 text-muted-foreground italic text-sm">
                        Nenhum alerta operacional no momento.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

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
                      {banners.filter(b => b.status === 'active' && !b.deleted_at).sort((a,b) => new Date(a.end_date).getTime() - new Date(b.end_date).getTime()).slice(0, 5).map(b => (
                        <TableRow key={b.id}>
                          <TableCell className="font-medium text-sm">{b.name}</TableCell>
                          <TableCell className="text-sm">{format(new Date(b.end_date), 'dd/MM/yyyy')}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-[10px] uppercase font-bold">Ativo</Badge>
                              {getUsageBadge(b)}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {banners.filter(b => b.status === 'active' && !b.deleted_at).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-4 text-muted-foreground text-sm">Nenhum banner ativo expirando em breve.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            <Card className="h-fit">
              <CardHeader>
                <CardTitle className="text-lg">Destaques Manuais</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {featuredItems.slice(0, 5).map(item => (
                    <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center overflow-hidden">
                          {item.companies?.logo_url ? (
                            <img src={item.companies.logo_url} className="w-full h-full object-cover" />
                          ) : item.item_type === 'company' ? <Building2 className="h-5 w-5" /> : <Users className="h-5 w-5" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium leading-tight">{item.companies?.name || item.profiles?.full_name || 'Desconhecido'}</p>
                          <p className="text-[10px] text-muted-foreground uppercase mt-0.5">{item.position.replace('_', ' ')}</p>
                        </div>
                      </div>
                      <Badge variant={item.status === 'active' ? 'default' : 'secondary'} className="text-[10px] uppercase font-bold">{item.status}</Badge>
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
                          <span className="text-xs flex items-center gap-1 font-medium">
                            <MapPin className="h-3 w-3" /> 
                            {(() => {
                              if (b.radius_km) return `Raio ${b.radius_km}km`;
                              if (b.cities?.name) return `${b.cities.name}/${b.states?.uf || ''}`;
                              if (b.states?.uf) return b.states.uf;
                              // Fallback para banners antigos (texto livre)
                              if (b.city) return `${b.city}/${b.state || ''}`;
                              if (b.state) return b.state;
                              return 'Brasil (Nacional)';
                            })()}
                          </span>
                          {b.neighborhood && (
                            <span className="text-[10px] text-muted-foreground ml-4">Bairro: {b.neighborhood}</span>
                          )}
                          <span className="text-xs flex items-center gap-1">
                            <Layers className="h-3 w-3" /> {b.category || 'Todas as categorias'}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex flex-col gap-0.5">
                          <span>{format(new Date(b.start_date), 'dd/MM')} - {format(new Date(b.end_date), 'dd/MM/yy')}</span>
                          {b.status === 'active' && differenceInDays(new Date(b.end_date), new Date()) <= 3 && (
                            <span className="text-[10px] text-amber-600 font-medium flex items-center gap-1">
                              <Clock className="h-2 w-2" /> Expira em breve
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-2 min-w-[120px]">
                          {b.sale_model === 'impressions' && b.limit_impressions && (
                            <Progress 
                              value={(b.current_impressions / b.limit_impressions) * 100} 
                              label={`${b.current_impressions}/${b.limit_impressions} imps`} 
                            />
                          )}
                          {b.sale_model === 'clicks' && b.limit_clicks && (
                            <Progress 
                              value={(b.current_clicks / b.limit_clicks) * 100} 
                              label={`${b.current_clicks}/${b.limit_clicks} cliques`} 
                            />
                          )}
                          {b.sale_model === 'fixed_period' && (
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] text-muted-foreground font-medium uppercase">Performance</span>
                              <div className="flex gap-2 text-[10px]">
                                <span title="Impressões">{b.current_impressions} i</span>
                                <span title="Cliques">{b.current_clicks} c</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 items-start">
                          <Badge 
                            variant={b.status === 'active' ? 'default' : b.status === 'ended' ? 'secondary' : 'outline'} 
                            className={`text-[10px] h-5 capitalize font-bold ${
                              b.status === 'active' ? 'bg-success hover:bg-success text-white' : 
                              b.status === 'ended' ? 'bg-muted text-muted-foreground' : ''
                            }`}
                          >
                            {b.status === 'ended' ? 'Encerrado' : b.status}
                          </Badge>
                          {getUsageBadge(b)}
                        </div>
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
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h3 className="text-lg font-semibold">Destaques Manuais</h3>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" className="gap-2" onClick={() => { setFeaturedFilters({ status: 'all', type: 'all' }); setFeaturedSearchTerm(''); }}>
                <X className="h-4 w-4" /> Limpar
              </Button>
              <Button size="sm" className="gap-2" onClick={() => { setSelectedFeaturedItem(null); setIsFeaturedDialogOpen(true); }}>
                <Plus className="h-4 w-4" /> Destacar Empresa/Profissional
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-muted/30 p-4 rounded-lg">
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-bold">Status</Label>
              <Select value={featuredFilters.status} onValueChange={v => setFeaturedFilters({...featuredFilters, status: v})}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Status</SelectItem>
                  <SelectItem value="active">Ativo</SelectItem>
                  <SelectItem value="scheduled">Programado</SelectItem>
                  <SelectItem value="paused">Pausado</SelectItem>
                  <SelectItem value="ended">Encerrado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] uppercase font-bold">Tipo de Destaque</Label>
              <Select value={featuredFilters.type} onValueChange={v => setFeaturedFilters({...featuredFilters, type: v})}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Tipos</SelectItem>
                  <SelectItem value="featured_large">Destaque Maior</SelectItem>
                  <SelectItem value="featured_medium">Destaque Mediano</SelectItem>
                  <SelectItem value="featured_logo">Destaque de Logos</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 md:col-span-2">
              <Label className="text-[10px] uppercase font-bold">Pesquisar</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Nome da empresa ou profissional..." 
                  className="pl-9 h-9" 
                  value={featuredSearchTerm}
                  onChange={(e) => setFeaturedSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>Tipo Destaque</TableHead>
                    <TableHead>Região</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead className="text-center">Prioridade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {featuredItems
                    .filter(f => featuredFilters.status === 'all' || f.status === featuredFilters.status)
                    .filter(f => featuredFilters.type === 'all' || f.highlight_type === featuredFilters.type)
                    .filter(f => !featuredSearchTerm || 
                      (f.companies?.name && f.companies.name.toLowerCase().includes(featuredSearchTerm.toLowerCase())) ||
                      (f.profiles?.full_name && f.profiles.full_name.toLowerCase().includes(featuredSearchTerm.toLowerCase()))
                    )
                    .map(f => (
                    <TableRow key={f.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center overflow-hidden border">
                            {f.profiles?.avatar_url ? (
                              <img src={f.profiles.avatar_url} className="w-full h-full object-cover" />
                            ) : f.companies?.logo_url ? (
                              <img src={f.companies.logo_url} className="w-full h-full object-cover" />
                            ) : (
                              f.professional_id ? <Users className="h-5 w-5 text-muted-foreground" /> : <Building2 className="h-5 w-5 text-muted-foreground" />
                            )}
                          </div>
                          <div>
                            <div className="flex flex-col">
                              <span className="font-medium text-sm">
                                {f.profiles?.full_name || f.companies?.name || 'Desconhecido'}
                              </span>
                              {f.professional_id && f.companies?.name && (
                                <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                  <Building2 className="h-2 w-2" /> {f.companies.name}
                                </span>
                              )}
                            </div>
                            <Badge variant="outline" className="text-[9px] h-4 uppercase font-bold py-0 mt-1">
                              {f.professional_id ? 'Profissional' : 'Empresa'}
                            </Badge>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px] h-5 capitalize">
                          {f.highlight_type ? f.highlight_type.replace('featured_', '').replace('_', ' ') : 'Padrao'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-0.5 text-xs">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" /> 
                            {f.cities?.name || f.city || 'Geral'}, {f.states?.uf || f.state || 'BR'}
                          </span>
                          {f.neighborhood && (
                            <span className="text-[10px] text-muted-foreground pl-4">{f.neighborhood}</span>
                          )}
                          {f.radius_km && (
                            <span className="text-[10px] text-primary flex items-center gap-1 pl-4">
                              <NavIcon className="h-2 w-2" /> Raio {f.radius_km}km
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex flex-col gap-0.5">
                          <span>{f.start_at ? format(new Date(f.start_at), 'dd/MM/yy') : 'Imediato'}</span>
                          <span className="text-muted-foreground">até {f.end_at ? format(new Date(f.end_at), 'dd/MM/yy') : 'Permanente'}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="text-sm font-bold bg-muted px-2 py-0.5 rounded">{f.priority}</span>
                      </TableCell>
                      <TableCell>
                        <Badge 
                          variant={f.status === 'active' ? 'default' : f.status === 'ended' ? 'secondary' : 'outline'} 
                          className={`text-[10px] h-5 capitalize font-bold ${
                            f.status === 'active' ? 'bg-success hover:bg-success text-white' : ''
                          }`}
                        >
                          {f.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSelectedFeaturedItem(f); setIsFeaturedDialogOpen(true); }}><Edit className="h-4 w-4" /></Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className={`h-8 w-8 ${f.status === 'active' ? 'text-amber-500' : 'text-success'}`} 
                            onClick={() => handleToggleFeaturedStatus(f)}
                          >
                            <Clock className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteFeaturedItem(f.id)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {featuredItems.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">Nenhum destaque cadastrado.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Dialog open={isFeaturedDialogOpen} onOpenChange={setIsFeaturedDialogOpen}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{selectedFeaturedItem ? 'Editar Destaque' : 'Novo Destaque Manual'}</DialogTitle>
              </DialogHeader>
              <FeaturedItemForm 
                item={selectedFeaturedItem} 
                onSuccess={() => { setIsFeaturedDialogOpen(false); fetchAll(); }} 
                onCancel={() => setIsFeaturedDialogOpen(false)} 
              />
            </DialogContent>
          </Dialog>
        </TabsContent>
        
        <TabsContent value="reports">
          <ReportsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SuperAdminMarketplace;
