import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRefreshData } from '@/hooks/useRefreshData';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Building2, Link2, Copy } from 'lucide-react';
import SettingsBreadcrumb from '@/components/SettingsBreadcrumb';

const SettingsGeneral = () => {
  const { companyId } = useAuth();
  const [companyName, setCompanyName] = useState('');
  const [companyDescription, setCompanyDescription] = useState('');
  const [companyBusinessType, setCompanyBusinessType] = useState('barbershop');
  const [companySlug, setCompanySlug] = useState('');

  useEffect(() => {
    if (companyId) fetchData();
  }, [companyId]);

  const fetchData = async () => {
    const { data } = await supabase.from('companies').select('*').eq('id', companyId!).single();
    if (data) {
      setCompanyName(data.name ?? '');
      setCompanyDescription((data as any).description ?? '');
      setCompanyBusinessType((data as any).business_type ?? 'barbershop');
      setCompanySlug((data as any).slug ?? '');
    }
  };

  const save = async () => {
    await supabase.from('companies').update({
      name: companyName,
      description: companyDescription,
      business_type: companyBusinessType,
    } as any).eq('id', companyId!);
    toast.success('Configurações gerais salvas');
  };

  const bookingUrl = companySlug
    ? `${window.location.origin}/${companyBusinessType === 'esthetic' ? 'estetica' : 'barbearia'}/${companySlug}`
    : '';

  return (
    <div className="space-y-6">
      <SettingsBreadcrumb current="Geral" />
      <div>
        <h2 className="text-xl font-display font-bold">Configurações Gerais</h2>
        <p className="text-sm text-muted-foreground">Informações básicas da sua empresa</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Building2 className="h-5 w-5" /> Informações Básicas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Nome da empresa</Label>
            <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Categoria do Negócio</Label>
            <Select value={companyBusinessType} onValueChange={setCompanyBusinessType}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="barbershop">Barbearia</SelectItem>
                <SelectItem value="esthetic">Estética</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Descrição</Label>
            <Textarea value={companyDescription} onChange={(e) => setCompanyDescription(e.target.value)} placeholder="Descreva sua empresa..." rows={3} />
          </div>
        </CardContent>
      </Card>

      {companySlug && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Link2 className="h-5 w-5" /> Link de Agendamento</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-2">Compartilhe este link com seus clientes:</p>
            <div className="flex items-center gap-2">
              <Input value={bookingUrl} readOnly className="bg-muted" />
              <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(bookingUrl); toast.success('Link copiado!'); }}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Button onClick={save}>Salvar configurações gerais</Button>
    </div>
  );
};

export default SettingsGeneral;
