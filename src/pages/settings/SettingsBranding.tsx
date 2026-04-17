import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Palette, RotateCcw, Sparkles } from 'lucide-react';
import SettingsBreadcrumb from '@/components/SettingsBreadcrumb';
import { ThemeSelector } from '@/components/ThemeSelector';
import { findVariationById } from '@/lib/theme-catalog';
import { PlanFeatureGate } from '@/components/PlanFeatureGate';

const SettingsBranding = () => {
  const { companyId } = useAuth();
  const [brandPrimaryColor, setBrandPrimaryColor] = useState('#6D28D9');
  const [brandSecondaryColor, setBrandSecondaryColor] = useState('#F59E0B');
  const [brandBackgroundColor, setBrandBackgroundColor] = useState('#0B132B');
  const [themeStyleId, setThemeStyleId] = useState<string | null>(null);
  const [themeSelectorOpen, setThemeSelectorOpen] = useState(false);

  useEffect(() => {
    if (companyId) fetchData();
  }, [companyId]);

  const fetchData = async () => {
    const { data } = await supabase
      .from('company_settings')
      .select('primary_color, secondary_color, background_color, theme_style')
      .eq('company_id', companyId!)
      .single();
    if (data) {
      setBrandPrimaryColor((data as any).primary_color || '#6D28D9');
      setBrandSecondaryColor((data as any).secondary_color || '#F59E0B');
      setBrandBackgroundColor((data as any).background_color || '#0B132B');
      setThemeStyleId((data as any).theme_style || null);
    }
  };

  const save = async (overrides?: { primary_color?: string; secondary_color?: string; background_color?: string; theme_style?: string | null }) => {
    const payload = {
      primary_color: overrides?.primary_color ?? brandPrimaryColor,
      secondary_color: overrides?.secondary_color ?? brandSecondaryColor,
      background_color: overrides?.background_color ?? brandBackgroundColor,
      theme_style: overrides?.theme_style !== undefined ? overrides.theme_style : themeStyleId,
    } as any;
    await supabase.from('company_settings').update(payload).eq('company_id', companyId!);
    toast.success('Cores da marca salvas!');
  };

  const currentTheme = findVariationById(themeStyleId);

  return (
    <div className="space-y-6">
      <SettingsBreadcrumb current="Branding" />
      <div>
        <h2 className="text-xl font-display font-bold">Branding</h2>
        <p className="text-sm text-muted-foreground">Personalize as cores das suas páginas públicas</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" /> Tema visual pronto
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Use uma paleta pronta criada para seu estilo de negócio, ou personalize manualmente abaixo.
          </p>
          {currentTheme ? (
            <div
              className="rounded-xl border-2 border-primary p-4 space-y-3"
              style={{ background: currentTheme.background_color }}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold" style={{ color: currentTheme.primary_color }}>
                  Tema atual: {currentTheme.name}
                </span>
              </div>
              <div className="flex gap-2">
                <div className="px-3 py-2 rounded-lg text-xs font-semibold text-white flex-1 text-center" style={{ background: currentTheme.primary_color }}>
                  Primário
                </div>
                <div className="px-3 py-2 rounded-lg text-xs font-semibold text-white flex-1 text-center" style={{ background: currentTheme.secondary_color }}>
                  Secundário
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">Nenhum tema pronto selecionado.</p>
          )}
          <Button onClick={() => setThemeSelectorOpen(true)} variant="default" className="w-full sm:w-auto">
            <Sparkles className="h-4 w-4 mr-1" />
            {currentTheme ? 'Trocar tema visual' : 'Escolher tema visual'}
          </Button>
        </CardContent>
      </Card>

      <PlanFeatureGate
        feature="custom_branding"
        upgradePrompt={{
          title: 'Personalize suas cores no plano profissional',
          description: 'Edite cores primária, secundária e de fundo para combinar com a identidade visual da sua marca.',
        }}
      >
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Palette className="h-5 w-5" /> Cores da Marca</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'Cor primária', value: brandPrimaryColor, set: setBrandPrimaryColor, desc: 'Botões, links, destaques' },
                { label: 'Cor secundária', value: brandSecondaryColor, set: setBrandSecondaryColor, desc: 'Hover, acentos' },
                { label: 'Cor de fundo', value: brandBackgroundColor, set: setBrandBackgroundColor, desc: 'Fundo das páginas públicas' },
              ].map(({ label, value, set, desc }) => (
                <div key={label} className="space-y-2">
                  <Label className="text-xs">{label}</Label>
                  <div className="flex items-center gap-2">
                    <input type="color" value={value} onChange={(e) => { set(e.target.value); setThemeStyleId(null); }} className="w-10 h-10 rounded-lg border cursor-pointer" style={{ padding: 0 }} />
                    <Input value={value} onChange={(e) => { set(e.target.value); setThemeStyleId(null); }} className="font-mono text-xs" maxLength={7} />
                  </div>
                  <p className="text-[10px] text-muted-foreground">{desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 p-4 rounded-xl border" style={{ background: brandBackgroundColor }}>
              <p className="text-xs font-semibold mb-2" style={{ color: brandPrimaryColor }}>Prévia das cores</p>
              <div className="flex gap-2">
                <button className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: brandPrimaryColor, color: '#FFFFFF' }}>Botão primário</button>
                <button className="px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: brandSecondaryColor, color: '#FFFFFF' }}>Botão secundário</button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={() => save()} variant="outline" className="flex-1 sm:flex-none">Salvar cores</Button>
              <Button onClick={() => { setBrandPrimaryColor('#7C3AED'); setBrandSecondaryColor('#111827'); setBrandBackgroundColor('#0B132B'); setThemeStyleId(null); }} variant="ghost" className="flex-1 sm:flex-none text-muted-foreground">
                <RotateCcw className="h-4 w-4 mr-1" /> Restaurar padrão
              </Button>
            </div>
          </CardContent>
        </Card>
      </PlanFeatureGate>

      <ThemeSelector
        open={themeSelectorOpen}
        onOpenChange={setThemeSelectorOpen}
        initialVariationId={themeStyleId}
        onSelect={async (variation) => {
          setBrandPrimaryColor(variation.primary_color);
          setBrandSecondaryColor(variation.secondary_color);
          setBrandBackgroundColor(variation.background_color);
          setThemeStyleId(variation.id);
          await save({
            primary_color: variation.primary_color,
            secondary_color: variation.secondary_color,
            background_color: variation.background_color,
            theme_style: variation.id,
          });
        }}
      />
    </div>
  );
};

export default SettingsBranding;
