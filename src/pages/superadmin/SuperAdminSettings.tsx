import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Globe, Search } from 'lucide-react';
import { toast } from 'sonner';

const SuperAdminSettings = () => {
  const [platformName, setPlatformName] = useState('');
  const [platformLogo, setPlatformLogo] = useState('');
  const [platformUrl, setPlatformUrl] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [seoOgImage, setSeoOgImage] = useState('');
  const [seoFavicon, setSeoFavicon] = useState('');
  const [seoKeywords, setSeoKeywords] = useState('');

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase.from('platform_settings').select('*').limit(1).single();
      if (data) {
        setPlatformName(data.system_name ?? '');
        setPlatformLogo(data.system_logo ?? '');
        setPlatformUrl(data.system_url ?? '');
        setSeoTitle(data.site_title ?? '');
        setSeoDescription(data.meta_description ?? '');
        setSeoOgImage(data.og_image ?? '');
        setSeoFavicon(data.favicon_url ?? '');
        setSeoKeywords(data.default_keywords ?? '');
      }
    };
    fetch();
  }, []);

  const save = async () => {
    await supabase.from('platform_settings').update({
      system_name: platformName,
      system_logo: platformLogo || null,
      system_url: platformUrl || null,
      site_title: seoTitle || null,
      meta_description: seoDescription || null,
      og_image: seoOgImage || null,
      favicon_url: seoFavicon || null,
      default_keywords: seoKeywords || null,
    } as any).neq('id', '00000000-0000-0000-0000-000000000000');
    toast.success('Configurações salvas');
  };

  return (
    <div className="space-y-6">
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
          <Button size="sm" onClick={save}>Salvar</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" /> SEO da Plataforma
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Título do site</Label>
              <Input value={seoTitle} onChange={(e) => setSeoTitle(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Palavras-chave</Label>
              <Input value={seoKeywords} onChange={(e) => setSeoKeywords(e.target.value)} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Meta descrição</Label>
              <Input value={seoDescription} onChange={(e) => setSeoDescription(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">URL da imagem OG</Label>
              <Input value={seoOgImage} onChange={(e) => setSeoOgImage(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">URL do favicon</Label>
              <Input value={seoFavicon} onChange={(e) => setSeoFavicon(e.target.value)} />
            </div>
          </div>
          <Button size="sm" onClick={save}>Salvar SEO</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SuperAdminSettings;
