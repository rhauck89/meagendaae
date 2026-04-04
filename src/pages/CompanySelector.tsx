import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Building2, ChevronRight, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { PlatformFooter } from '@/components/PlatformFooter';

interface UserCompany {
  company_id: string;
  company_name: string;
  company_slug: string;
  company_logo: string | null;
  role: string;
}

const roleLabels: Record<string, string> = {
  professional: 'Profissional',
  collaborator: 'Colaborador',
  admin: 'Administrador',
  super_admin: 'Super Admin',
};

const CompanySelector = () => {
  const navigate = useNavigate();
  const { user, signOut, refreshProfile } = useAuth();
  const [companies, setCompanies] = useState<UserCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/auth', { replace: true });
      return;
    }
    fetchCompanies();
  }, [user]);

  const fetchCompanies = async () => {
    const { data, error } = await supabase.rpc('get_user_companies');
    if (error) {
      console.error('Error fetching companies:', error);
      toast.error('Erro ao carregar empresas');
      setLoading(false);
      return;
    }
    
    if (!data || data.length === 0) {
      // No companies, go to dashboard (onboarding)
      navigate('/dashboard', { replace: true });
      return;
    }

    if (data.length === 1) {
      // Single company, auto-select
      await selectCompany(data[0].company_id);
      return;
    }

    setCompanies(data as UserCompany[]);
    setLoading(false);
  };

  const selectCompany = async (companyId: string) => {
    setSwitching(companyId);
    try {
      const { error } = await supabase.rpc('switch_active_company', { _company_id: companyId });
      if (error) throw error;
      await refreshProfile();
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      console.error('Error switching company:', err);
      toast.error('Erro ao selecionar empresa');
      setSwitching(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl border-0 rounded-2xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl font-display">Escolha a empresa</CardTitle>
          <CardDescription>
            Você possui acesso a múltiplas empresas. Selecione qual deseja acessar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {companies.map((company) => (
            <button
              key={company.company_id}
              onClick={() => selectCompany(company.company_id)}
              disabled={switching !== null}
              className="w-full flex items-center gap-3 p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-accent/50 transition-all text-left disabled:opacity-50"
            >
              {company.company_logo ? (
                <img
                  src={company.company_logo}
                  alt={company.company_name}
                  className="w-10 h-10 rounded-lg object-cover shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{company.company_name}</p>
                <p className="text-xs text-muted-foreground">
                  {roleLabels[company.role] || company.role}
                </p>
              </div>
              {switching === company.company_id ? (
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
              ) : (
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              )}
            </button>
          ))}

          <div className="pt-2">
            <Button variant="ghost" className="w-full text-muted-foreground" onClick={signOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sair
            </Button>
          </div>
        </CardContent>
      </Card>
      <PlatformFooter className="mt-6" />
    </div>
  );
};

export default CompanySelector;
