import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Scissors, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface CompanySetupProps {
  onComplete: () => void;
}

const CompanySetup = ({ onComplete }: CompanySetupProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [businessType, setBusinessType] = useState<'barbershop' | 'esthetic'>('barbershop');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !companyName.trim()) return;
    setLoading(true);

    try {
      const slug = companyName
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

      const { data: company, error: companyError } = await supabase
        .from('companies')
        .insert({
          name: companyName.trim(),
          slug,
          owner_id: user.id,
          business_type: businessType,
        })
        .select()
        .single();

      if (companyError) throw companyError;

      await supabase
        .from('profiles')
        .update({ company_id: company.id })
        .eq('user_id', user.id);

      // Check if role already exists
      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', user.id)
        .eq('role', 'professional')
        .maybeSingle();

      if (!existingRole) {
        await supabase.from('user_roles').insert({
          user_id: user.id,
          company_id: company.id,
          role: 'professional' as const,
        });
      }

      // Create default business hours
      const defaultHours = Array.from({ length: 7 }, (_, i) => ({
        company_id: company.id,
        day_of_week: i,
        open_time: '09:00',
        lunch_start: '12:00',
        lunch_end: '13:00',
        close_time: '18:00',
        is_closed: i === 0,
      }));
      await supabase.from('business_hours').insert(defaultHours);

      toast.success('Empresa criada com sucesso!');
      onComplete();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao criar empresa');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl border-0">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-14 h-14 bg-primary rounded-2xl flex items-center justify-center">
            <Scissors className="h-7 w-7 text-primary-foreground" />
          </div>
          <div>
            <CardTitle className="text-2xl font-display">Configure seu negócio</CardTitle>
            <CardDescription>
              Para continuar, crie seu estabelecimento
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Nome do estabelecimento</Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                required
                placeholder="Ex: Barbearia do João"
              />
            </div>
            <div className="space-y-2">
              <Label>Tipo de negócio</Label>
              <Select value={businessType} onValueChange={(v) => setBusinessType(v as 'barbershop' | 'esthetic')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="barbershop">
                    <div className="flex items-center gap-2">
                      <Scissors className="h-4 w-4" /> Barbearia
                    </div>
                  </SelectItem>
                  <SelectItem value="esthetic">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4" /> Estética
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Criando...' : 'Criar Estabelecimento'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CompanySetup;
