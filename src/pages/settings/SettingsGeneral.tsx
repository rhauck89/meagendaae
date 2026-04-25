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
import { Building2, Link2, Copy, AlertTriangle, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import SettingsBreadcrumb from '@/components/SettingsBreadcrumb';
import { resetOnboardingChecklist } from '@/components/OnboardingChecklist';
import { resetTutorialProgress } from '@/components/TutorialProgressWidget';

const SettingsGeneral = () => {
  const { companyId, user } = useAuth();
  const { refresh } = useRefreshData();
  const navigate = useNavigate();
  const [companyName, setCompanyName] = useState('');
  const [companyDescription, setCompanyDescription] = useState('');
  const [companyBusinessType, setCompanyBusinessType] = useState('barbershop');
  const [companySlug, setCompanySlug] = useState('');
  const [hasActiveProfessionals, setHasActiveProfessionals] = useState<boolean | null>(null);

  useEffect(() => {
    if (companyId) {
      fetchData();
      checkProfessionals();
    }
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

  const checkProfessionals = async () => {
    const { count } = await supabase
      .from('collaborators')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId!)
      .eq('active', true);
    setHasActiveProfessionals((count ?? 0) > 0);
  };

  const save = async () => {
    const { error } = await supabase.from('companies').update({
      name: companyName,
      description: companyDescription,
      business_type: companyBusinessType,
    } as any).eq('id', companyId!);
    if (error) {
      toast.error('Erro ao salvar configurações');
      return;
    }
    refresh('settings');
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
            {hasActiveProfessionals === false ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                      Você precisa cadastrar pelo menos um profissional
                    </p>
                    <p className="text-xs text-amber-700 dark:text-amber-400/80">
                      Para gerar o link de agendamento da sua empresa, é necessário ter ao menos um profissional ativo. Adicione um profissional para liberar sua agenda online.
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => navigate('/dashboard/team')}
                  className="gap-1.5"
                >
                  <Users className="h-4 w-4" /> Adicionar profissional
                </Button>
              </div>
            ) : (
              <>
                <p className="text-sm text-muted-foreground mb-2">Compartilhe este link com seus clientes:</p>
                <div className="flex items-center gap-2">
                  <Input value={bookingUrl} readOnly className="bg-muted" />
                  <Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(bookingUrl); toast.success('Link copiado!'); }}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      <Button onClick={save}>Salvar configurações gerais</Button>

      <Card className="border-dashed">
        <CardContent className="p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Tutoriais e primeiros passos</p>
            <p className="text-xs text-muted-foreground">Reexibir os guias de configuração no painel</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              resetOnboardingChecklist();
              resetTutorialProgress();
              toast.success('Tutoriais reativados! Volte ao painel para visualizá-los.');
            }}
          >
            Ver tutorial novamente
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default SettingsGeneral;
