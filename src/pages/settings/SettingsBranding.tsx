import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Palette, RotateCcw } from 'lucide-react';
import SettingsBreadcrumb from '@/components/SettingsBreadcrumb';

const SettingsBranding = () => {
  const { companyId } = useAuth();
  const [brandPrimaryColor, setBrandPrimaryColor] = useState('#6D28D9');
  const [brandSecondaryColor, setBrandSecondaryColor] = useState('#F59E0B');
  const [brandBackgroundColor, setBrandBackgroundColor] = useState('#0B132B');

  useEffect(() => {
    if (companyId) fetchData();
  }, [companyId]);

  const fetchData = async () => {
    const { data } = await supabase.from('company_settings').select('primary_color, secondary_color, background_color').eq('company_id', companyId!).single();
    if (data) {
      setBrandPrimaryColor((data as any).primary_color || '#6D28D9');
      setBrandSecondaryColor((data as any).secondary_color || '#F59E0B');
      setBrandBackgroundColor((data as any).background_color || '#0B132B');
    }
  };

  const save = async () => {
    await supabase.from('company_settings').update({
      primary_color: brandPrimaryColor, secondary_color: brandSecondaryColor, background_color: brandBackgroundColor,
    } as any).eq('company_id', companyId!);
    toast.success('Cores da marca salvas!');
  };

  return (
    <div className="space-y-6">
      <SettingsBreadcrumb current="Branding" />
      <div>
        <h2 className="text-xl font-display font-bold">Branding</h2>
        <p className="text-sm text-muted-foreground">Personalize as cores das suas páginas públicas</p>
      </div>

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
                  <input type="color" value={value} onChange={(e) => set(e.target.value)} className="w-10 h-10 rounded-lg border cursor-pointer" style={{ padding: 0 }} />
                  <Input value={value} onChange={(e) => set(e.target.value)} className="font-mono text-xs" maxLength={7} />
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
            <Button onClick={save} variant="outline" className="flex-1 sm:flex-none">Salvar cores</Button>
            <Button onClick={() => { setBrandPrimaryColor('#7C3AED'); setBrandSecondaryColor('#111827'); setBrandBackgroundColor('#0B132B'); }} variant="ghost" className="flex-1 sm:flex-none text-muted-foreground">
              <RotateCcw className="h-4 w-4 mr-1" /> Restaurar padrão
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsBranding;
