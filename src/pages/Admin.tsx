import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Building2, DollarSign, Users, ShieldCheck, Globe, Search } from 'lucide-react';
import { toast } from 'sonner';

const statusColors: Record<string, string> = {
  active: 'bg-success/10 text-success',
  trial: 'bg-warning/10 text-warning',
  inactive: 'bg-muted text-muted-foreground',
  blocked: 'bg-destructive/10 text-destructive',
};

const Admin = () => {
  const { roles } = useAuth();
  const [companies, setCompanies] = useState<any[]>([]);
  const [platformName, setPlatformName] = useState('');
  const [platformLogo, setPlatformLogo] = useState('');
  const [platformUrl, setPlatformUrl] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [seoOgImage, setSeoOgImage] = useState('');
  const [seoFavicon, setSeoFavicon] = useState('');
  const [seoKeywords, setSeoKeywords] = useState('');

  useEffect(() => {
    fetchCompanies();
    fetchPlatformSettings();
  }, []);

  const fetchCompanies = async () => {
    const { data } = await supabase
      .from('companies')
      .select('*')
      .order('created_at', { ascending: false });
    if (data) setCompanies(data);
  };

  const fetchPlatformSettings = async () => {
    const { data } = await supabase.from('platform_settings' as any).select('*').limit(1).single();
    if (data) {
      setPlatformName((data as any).system_name ?? '');
      setPlatformLogo((data as any).system_logo ?? '');
      setPlatformUrl((data as any).system_url ?? '');
      setSeoTitle((data as any).site_title ?? '');
      setSeoDescription((data as any).meta_description ?? '');
      setSeoOgImage((data as any).og_image ?? '');
      setSeoFavicon((data as any).favicon_url ?? '');
      setSeoKeywords((data as any).default_keywords ?? '');
    }
  };

  const savePlatformSettings = async () => {
    await supabase.from('platform_settings' as any).update({
      system_name: platformName,
      system_logo: platformLogo || null,
      system_url: platformUrl || null,
      site_title: seoTitle || null,
      meta_description: seoDescription || null,
      og_image: seoOgImage || null,
      favicon_url: seoFavicon || null,
      default_keywords: seoKeywords || null,
    } as any).neq('id', '00000000-0000-0000-0000-000000000000');
    toast.success('Configurações da plataforma salvas');
  };

  const toggleBlock = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'blocked' ? 'active' : 'blocked';
    await supabase.from('companies').update({ subscription_status: newStatus as any }).eq('id', id);
    fetchCompanies();
  };

  if (!roles.includes('super_admin')) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Acesso não autorizado</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <ShieldCheck className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-display font-bold">Painel Super Admin</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <Building2 className="h-8 w-8 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Empresas</p>
                <p className="text-2xl font-display font-bold">{companies.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <Users className="h-8 w-8 text-accent" />
              <div>
                <p className="text-sm text-muted-foreground">Ativas</p>
                <p className="text-2xl font-display font-bold">
                  {companies.filter((c) => c.subscription_status === 'active' || c.subscription_status === 'trial').length}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <DollarSign className="h-8 w-8 text-success" />
              <div>
                <p className="text-sm text-muted-foreground">Bloqueadas</p>
                <p className="text-2xl font-display font-bold">
                  {companies.filter((c) => c.subscription_status === 'blocked').length}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Platform Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5" /> Configurações da Plataforma
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Nome do sistema</Label>
                <Input value={platformName} onChange={(e) => setPlatformName(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">URL do logo</Label>
                <Input value={platformLogo} onChange={(e) => setPlatformLogo(e.target.value)} placeholder="https://..." />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">URL do site</Label>
                <Input value={platformUrl} onChange={(e) => setPlatformUrl(e.target.value)} placeholder="https://..." />
              </div>
            </div>
            <Button size="sm" onClick={savePlatformSettings}>Salvar</Button>
            <p className="text-xs text-muted-foreground">
              Exibido como "Agendamento online por {platformName || '...'}" nas páginas públicas.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Empresas Cadastradas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {companies.map((c) => (
                <div key={c.id} className="flex items-center gap-4 p-4 rounded-xl bg-muted/50">
                  <div className="flex-1">
                    <p className="font-semibold">{c.name}</p>
                    <p className="text-sm text-muted-foreground">/{c.slug}</p>
                  </div>
                  <Badge variant="outline" className={statusColors[c.subscription_status]}>
                    {c.subscription_status}
                  </Badge>
                  <Button
                    variant={c.subscription_status === 'blocked' ? 'default' : 'destructive'}
                    size="sm"
                    onClick={() => toggleBlock(c.id, c.subscription_status)}
                  >
                    {c.subscription_status === 'blocked' ? 'Desbloquear' : 'Bloquear'}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Admin;
