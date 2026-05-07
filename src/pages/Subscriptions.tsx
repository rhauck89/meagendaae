import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Plus, Users, CreditCard, LayoutDashboard, Settings } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { PlansTab } from '@/components/subscriptions/PlansTab';

const Subscriptions = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const { companyId } = useAuth();


  return (
    <div className="space-y-6 max-w-7xl mx-auto p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-display font-bold tracking-tight">Assinaturas</h2>
          <p className="text-muted-foreground">Gerencie seus planos e clientes recorrentes.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button className="gap-2">
            <Plus className="h-4 w-4" /> Novo Plano
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
        <TabsList className="grid grid-cols-4 w-full md:w-[600px] h-12 p-1 bg-muted/50">
          <TabsTrigger value="dashboard" className="gap-2 h-10 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="plans" className="gap-2 h-10 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Settings className="h-4 w-4" /> Planos
          </TabsTrigger>
          <TabsTrigger value="subscribers" className="gap-2 h-10 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Users className="h-4 w-4" /> Assinantes
          </TabsTrigger>
          <TabsTrigger value="charges" className="gap-2 h-10 data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <CreditCard className="h-4 w-4" /> Cobranças
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6 focus-visible:outline-none">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-none shadow-sm bg-primary/5">
              <CardContent className="p-6">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Assinantes Ativos</p>
                <h3 className="text-3xl font-bold">0</h3>
                <p className="text-xs text-muted-foreground mt-2">+0 este mês</p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm">
              <CardContent className="p-6">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Faturamento Mensal (MRR)</p>
                <h3 className="text-3xl font-bold text-primary">R$ 0,00</h3>
                <p className="text-xs text-muted-foreground mt-2">Receita recorrente estimada</p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm">
              <CardContent className="p-6">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Cobranças Pendentes</p>
                <h3 className="text-3xl font-bold text-destructive">0</h3>
                <p className="text-xs text-muted-foreground mt-2">Aguardando pagamento</p>
              </CardContent>
            </Card>
            <Card className="border-none shadow-sm">
              <CardContent className="p-6">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-2">Churn Rate</p>
                <h3 className="text-3xl font-bold">0%</h3>
                <p className="text-xs text-muted-foreground mt-2">Cancelamentos nos últimos 30 dias</p>
              </CardContent>
            </Card>
          </div>
          
          <Card className="border-none shadow-sm bg-muted/10">
            <CardHeader>
              <CardTitle className="text-lg">Próximos Vencimentos</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma cobrança próxima do vencimento.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans" className="focus-visible:outline-none">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <p className="col-span-full text-center py-12 text-muted-foreground bg-muted/20 rounded-xl border border-dashed">
              Nenhum plano cadastrado. Comece criando o seu primeiro plano.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="subscribers" className="focus-visible:outline-none">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <div className="p-6 border-b bg-muted/10">
                <h3 className="font-semibold">Lista de Assinantes</h3>
                <p className="text-sm text-muted-foreground">Visualize e gerencie as assinaturas dos seus clientes.</p>
              </div>
              <p className="text-sm text-muted-foreground py-20 text-center">Nenhum assinante cadastrado.</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="charges" className="focus-visible:outline-none">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardContent className="p-0">
              <div className="p-6 border-b bg-muted/10">
                <h3 className="font-semibold">Histórico de Cobranças</h3>
                <p className="text-sm text-muted-foreground">Acompanhe todos os pagamentos recorrentes.</p>
              </div>
              <p className="text-sm text-muted-foreground py-20 text-center">Nenhuma cobrança gerada.</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Subscriptions;
