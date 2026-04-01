import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Globe, Plus, Trash2, RefreshCw, CheckCircle2, AlertCircle, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface DomainRecord {
  id: string;
  domain: string;
  verified: boolean;
  ssl_status: string;
  created_at: string;
}

interface DomainSettingsProps {
  companyId: string;
  companySlug?: string;
}

const DomainSettings = ({ companyId, companySlug }: DomainSettingsProps) => {
  const [domains, setDomains] = useState<DomainRecord[]>([]);
  const [newDomain, setNewDomain] = useState('');
  const [adding, setAdding] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);

  useEffect(() => {
    fetchDomains();
  }, [companyId]);

  const fetchDomains = async () => {
    const { data } = await supabase
      .from('company_domains' as any)
      .select('*')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false });
    if (data) setDomains(data as any);
  };

  const addDomain = async () => {
    const domain = newDomain.trim().toLowerCase();
    if (!domain) return toast.error('Digite um domínio');

    // Basic domain validation
    const domainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/;
    if (!domainRegex.test(domain)) {
      return toast.error('Domínio inválido. Ex: minhabarbearia.com.br');
    }

    setAdding(true);
    const { error } = await supabase
      .from('company_domains' as any)
      .insert({ company_id: companyId, domain } as any);

    if (error) {
      if (error.code === '23505') {
        toast.error('Este domínio já está em uso');
      } else {
        toast.error('Erro ao adicionar domínio');
      }
    } else {
      toast.success('Domínio adicionado! Configure o DNS para verificar.');
      setNewDomain('');
      fetchDomains();
    }
    setAdding(false);
  };

  const verifyDomain = async (domainId: string) => {
    setVerifying(domainId);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-domain`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ domain_id: domainId }),
        }
      );

      const result = await response.json();
      if (result.verified) {
        toast.success(result.message);
      } else {
        toast.info(result.message);
      }
      fetchDomains();
    } catch {
      toast.error('Erro ao verificar domínio');
    }
    setVerifying(null);
  };

  const deleteDomain = async (domainId: string) => {
    await supabase.from('company_domains' as any).delete().eq('id', domainId);
    toast.success('Domínio removido');
    fetchDomains();
  };

  const cnameTarget = 'app.agendapro.com';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" /> Domínio Personalizado
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-xs text-muted-foreground">
          Configure um domínio personalizado para sua página de agendamento. Seus clientes poderão acessar diretamente pelo seu domínio.
        </p>

        {/* DNS Instructions */}
        <div className="p-4 rounded-xl bg-muted/50 border space-y-2">
          <p className="text-sm font-medium">Instruções de configuração DNS</p>
          <p className="text-xs text-muted-foreground">
            No painel do seu provedor de domínio, crie um registro CNAME apontando para:
          </p>
          <div className="flex items-center gap-2">
            <code className="text-xs bg-background px-3 py-1.5 rounded-lg border font-mono flex-1">
              CNAME → {cnameTarget}
            </code>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                navigator.clipboard.writeText(cnameTarget);
                toast.success('Copiado!');
              }}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            A propagação DNS pode levar até 48 horas. Após configurar, clique em "Verificar" para confirmar.
          </p>
        </div>

        {/* Add domain */}
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Seu domínio</Label>
            <Input
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder="minhabarbearia.com.br"
              onKeyDown={(e) => e.key === 'Enter' && addDomain()}
            />
          </div>
          <Button onClick={addDomain} disabled={adding} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
        </div>

        {/* Domain list */}
        {domains.length > 0 && (
          <div className="space-y-2">
            {domains.map((d) => (
              <div
                key={d.id}
                className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border"
              >
                <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{d.domain}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {d.verified ? (
                      <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 text-[10px] py-0">
                        <CheckCircle2 className="h-3 w-3 mr-0.5" /> Verificado
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 text-[10px] py-0">
                        <AlertCircle className="h-3 w-3 mr-0.5" /> Pendente
                      </Badge>
                    )}
                    {d.verified && (
                      <Badge variant="outline" className="text-[10px] py-0">
                        SSL: {d.ssl_status}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => verifyDomain(d.id)}
                    disabled={verifying === d.id}
                  >
                    <RefreshCw className={`h-4 w-4 ${verifying === d.id ? 'animate-spin' : ''}`} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive"
                    onClick={() => deleteDomain(d.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DomainSettings;
