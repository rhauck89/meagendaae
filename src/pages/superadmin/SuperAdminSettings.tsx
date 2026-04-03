import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Globe, Search, Upload, X, Loader2, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

const BUCKET = 'platform-assets';

const getPublicUrl = (path: string) => {
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
};

interface ImageUploadFieldProps {
  label: string;
  value: string;
  onChange: (url: string) => void;
  folder: string;
  accept?: string;
}

const ImageUploadField = ({ label, value, onChange, folder, accept = 'image/*' }: ImageUploadFieldProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error('Arquivo muito grande (máx. 2MB)');
      return;
    }

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

  const handleRemove = () => {
    onChange('');
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
          <Button type="button" variant="ghost" size="sm" onClick={handleRemove} className="gap-1 text-destructive hover:text-destructive">
            <X className="h-3.5 w-3.5" /> Remover
          </Button>
        )}
      </div>
      <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={handleUpload} />
      {value && (
        <div className="mt-2 rounded-lg border border-border bg-muted/30 p-2 inline-block">
          <img src={value} alt={label} className="max-h-20 max-w-[160px] rounded object-contain" />
        </div>
      )}
    </div>
  );
};

const SuperAdminSettings = () => {
  const [platformName, setPlatformName] = useState('');
  const [platformLogo, setPlatformLogo] = useState('');
  const [platformLogoLight, setPlatformLogoLight] = useState('');
  const [platformLogoDark, setPlatformLogoDark] = useState('');
  const [platformUrl, setPlatformUrl] = useState('');
  const [seoTitle, setSeoTitle] = useState('');
  const [seoDescription, setSeoDescription] = useState('');
  const [seoOgImage, setSeoOgImage] = useState('');
  const [seoFavicon, setSeoFavicon] = useState('');
  const [seoKeywords, setSeoKeywords] = useState('');
  const [pwaIcon192, setPwaIcon192] = useState('');
  const [pwaIcon512, setPwaIcon512] = useState('');
  const [splashLogo, setSplashLogo] = useState('');
  const [splashBgColor, setSplashBgColor] = useState('#0f2a5c');

  useEffect(() => {
    const fetchSettings = async () => {
      const { data } = await supabase.from('platform_settings').select('*').limit(1).single();
      if (data) {
        setPlatformName(data.system_name ?? '');
        setPlatformLogo(data.system_logo ?? '');
        setPlatformLogoLight((data as any).logo_light ?? '');
        setPlatformLogoDark((data as any).logo_dark ?? '');
        setPlatformUrl(data.system_url ?? '');
        setSeoTitle(data.site_title ?? '');
        setSeoDescription(data.meta_description ?? '');
        setSeoOgImage(data.og_image ?? '');
        setSeoFavicon(data.favicon_url ?? '');
        setSeoKeywords(data.default_keywords ?? '');
        setPwaIcon192((data as any).pwa_icon_192 ?? '');
        setPwaIcon512((data as any).pwa_icon_512 ?? '');
        setSplashLogo((data as any).splash_logo ?? '');
        setSplashBgColor((data as any).splash_background_color ?? '#0f2a5c');
      }
    };
    fetchSettings();
  }, []);

  const save = async () => {
    await supabase.from('platform_settings').update({
      system_name: platformName,
      system_logo: platformLogo || null,
      logo_light: platformLogoLight || null,
      logo_dark: platformLogoDark || null,
      system_url: platformUrl || null,
      site_title: seoTitle || null,
      meta_description: seoDescription || null,
      og_image: seoOgImage || null,
      favicon_url: seoFavicon || null,
      default_keywords: seoKeywords || null,
      pwa_icon_192: pwaIcon192 || null,
      pwa_icon_512: pwaIcon512 || null,
      splash_logo: splashLogo || null,
      splash_background_color: splashBgColor || '#0f2a5c',
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Nome do sistema</Label>
              <Input value={platformName} onChange={(e) => setPlatformName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">URL do site</Label>
              <Input value={platformUrl} onChange={(e) => setPlatformUrl(e.target.value)} placeholder="https://..." />
            </div>
          </div>
          <ImageUploadField
            label="Logo padrão"
            value={platformLogo}
            onChange={setPlatformLogo}
            folder="logo"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ImageUploadField
              label="Logo (fundo claro)"
              value={platformLogoDark}
              onChange={setPlatformLogoDark}
              folder="logo"
            />
            <ImageUploadField
              label="Logo (fundo escuro)"
              value={platformLogoLight}
              onChange={setPlatformLogoLight}
              folder="logo"
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            Use logos diferentes para garantir visibilidade em fundos claros e escuros. Se apenas uma for cadastrada, será usada em todos os contextos.
          </p>
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
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ImageUploadField
              label="Imagem OG"
              value={seoOgImage}
              onChange={setSeoOgImage}
              folder="og"
            />
            <ImageUploadField
              label="Favicon"
              value={seoFavicon}
              onChange={setSeoFavicon}
              folder="favicon"
              accept="image/png,image/x-icon,image/svg+xml"
            />
          </div>
          <Button size="sm" onClick={save}>Salvar SEO</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" /> Configurações do Aplicativo (PWA)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Icon 192 */}
          <div className="space-y-2">
            <ImageUploadField
              label="Ícone do aplicativo (Android / Desktop)"
              value={pwaIcon192}
              onChange={setPwaIcon192}
              folder="pwa"
              accept="image/png"
            />
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Ícone do aplicativo (192×192px) · Formato: PNG · Fundo sólido recomendado.<br />
              Será usado como ícone do app instalado no celular.
            </p>
          </div>

          {/* Icon 512 */}
          <div className="space-y-2">
            <ImageUploadField
              label="Ícone alta resolução (512x512)"
              value={pwaIcon512}
              onChange={setPwaIcon512}
              folder="pwa"
              accept="image/png"
            />
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Ícone alta resolução (512×512px) · Formato: PNG.<br />
              Usado para instalação do aplicativo em Android e Desktop.
            </p>
          </div>

          {/* Splash Logo */}
          <div className="space-y-2">
            <ImageUploadField
              label="Logo da Splash Screen"
              value={splashLogo}
              onChange={setSplashLogo}
              folder="pwa"
              accept="image/png"
            />
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Logo da tela de abertura do aplicativo · Formato: PNG · Tamanho recomendado: 512×512.<br />
              Preferencialmente fundo transparente. Essa imagem aparece no centro da tela ao abrir o aplicativo.
            </p>
          </div>

          {/* Splash Background Color */}
          <div className="space-y-1">
            <Label className="text-xs">Cor de fundo da Splash Screen</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={splashBgColor}
                onChange={(e) => setSplashBgColor(e.target.value)}
                className="h-9 w-12 rounded border border-border cursor-pointer"
              />
              <Input
                value={splashBgColor}
                onChange={(e) => setSplashBgColor(e.target.value)}
                className="max-w-[140px]"
                placeholder="#0f2a5c"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Cor de fundo da tela de abertura do aplicativo. Use a cor principal da marca.
            </p>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">Preview</Label>
            <div className="flex flex-col sm:flex-row gap-4">
              {/* App Icon Preview */}
              <div className="flex flex-col items-center gap-2">
                <p className="text-[10px] text-muted-foreground">Ícone do App</p>
                <div className="w-16 h-16 rounded-2xl border border-border bg-muted/30 flex items-center justify-center overflow-hidden shadow-sm">
                  {pwaIcon192 ? (
                    <img src={pwaIcon192} alt="App Icon" className="w-full h-full object-cover" />
                  ) : (
                    <Smartphone className="h-6 w-6 text-muted-foreground/50" />
                  )}
                </div>
              </div>

              {/* Splash Screen Preview */}
              <div className="flex flex-col items-center gap-2">
                <p className="text-[10px] text-muted-foreground">Splash Screen</p>
                <div
                  className="w-[120px] h-[200px] rounded-xl border border-border flex items-center justify-center overflow-hidden shadow-sm"
                  style={{ backgroundColor: splashBgColor }}
                >
                  {splashLogo ? (
                    <img src={splashLogo} alt="Splash Logo" className="max-h-12 max-w-[80px] object-contain" />
                  ) : (
                    <span className="text-white/60 text-[10px] text-center px-2">Logo aparecerá aqui</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <Button size="sm" onClick={save}>Salvar PWA</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SuperAdminSettings;
