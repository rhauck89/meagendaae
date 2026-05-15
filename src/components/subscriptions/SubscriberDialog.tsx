import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Search, User } from 'lucide-react';
import { format } from 'date-fns';

const subscriptionSchema = z.object({
  client_id: z.string().min(1, 'Cliente é obrigatório'),
  plan_id: z.string().min(1, 'Plano é obrigatório'),
  billing_cycle: z.enum(['monthly', 'yearly']),
  start_date: z.string().min(1, 'Data de início é obrigatória'),
  end_date: z.string().optional().nullable(),
  billing_day: z.coerce.number().min(1).max(31),
  grace_period_days: z.coerce.number().min(0),
  status: z.enum(['active', 'suspended', 'cancelled', 'expired', 'past_due']),
});

type SubscriptionFormValues = z.infer<typeof subscriptionSchema>;

interface SubscriberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  subscription?: any;
  onSuccess: () => void;
}

export function SubscriberDialog({ open, onOpenChange, companyId, subscription, onSuccess }: SubscriberDialogProps) {
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);
  const [clientSearch, setClientSearch] = useState('');
  const [clients, setClients] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [searchingClients, setSearchingClients] = useState(false);

  const form = useForm<SubscriptionFormValues>({
    resolver: zodResolver(subscriptionSchema),
    defaultValues: {
      client_id: '',
      plan_id: '',
      billing_cycle: 'monthly',
      start_date: format(new Date(), 'yyyy-MM-dd'),
      end_date: null,
      billing_day: new Date().getDate(),
      grace_period_days: 0,
      status: 'active',
    },
  });

  useEffect(() => {
    if (!open) return;
    void fetchPlans();
    if (subscription) {
      setSelectedClient(subscription.clients);
      form.reset({
        client_id: subscription.client_id,
        plan_id: subscription.plan_id,
        billing_cycle: subscription.billing_cycle as 'monthly' | 'yearly',
        start_date: subscription.start_date,
        end_date: subscription.end_date,
        billing_day: subscription.billing_day,
        grace_period_days: subscription.grace_period_days || 0,
        status: subscription.status as any,
      });
    } else {
      setSelectedClient(null);
      setClientSearch('');
      form.reset({
        client_id: '',
        plan_id: '',
        billing_cycle: 'monthly',
        start_date: format(new Date(), 'yyyy-MM-dd'),
        end_date: null,
        billing_day: new Date().getDate(),
        grace_period_days: 0,
        status: 'active',
      });
    }
  }, [open, subscription?.id]);

  const fetchPlans = async () => {
    const { data } = await supabase
      .from('subscription_plans')
      .select('id, name, price_monthly, type, usage_limit, limit_period, quantity_available, subscribers:client_subscriptions(count)')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .order('name');

    setPlans((data || []).filter((plan: any) => {
      if (!plan.quantity_available) return true;
      const current = plan.subscribers?.[0]?.count || 0;
      return current < Number(plan.quantity_available);
    }));
  };

  const searchClients = async (query: string) => {
    setClientSearch(query);
    if (query.length < 2) {
      setClients([]);
      return;
    }
    setSearchingClients(true);
    try {
      const { data } = await supabase
        .from('clients')
        .select('id, name, whatsapp')
        .eq('company_id', companyId)
        .ilike('name', `%${query}%`)
        .order('name')
        .limit(8);
      setClients(data || []);
    } finally {
      setSearchingClients(false);
    }
  };

  const onSubmit = async (values: SubscriptionFormValues) => {
    setLoading(true);
    try {
      const payload = {
        client_id: values.client_id,
        plan_id: values.plan_id,
        professional_id: null,
        professional_commission: 0,
        billing_cycle: values.billing_cycle,
        start_date: values.start_date,
        end_date: values.end_date || null,
        billing_day: values.billing_day,
        grace_period_days: values.grace_period_days,
        status: values.status,
        company_id: companyId,
      };

      let subscriptionId = subscription?.id;
      if (subscriptionId) {
        const { error } = await supabase.from('client_subscriptions').update(payload as any).eq('id', subscriptionId);
        if (error) throw error;
        toast.success('Assinatura atualizada com sucesso!');
      } else {
        const { data, error } = await supabase.from('client_subscriptions').insert(payload as any).select('id').single();
        if (error) throw error;
        subscriptionId = data.id;

        const selectedPlan = plans.find((plan) => plan.id === values.plan_id);
        await supabase.from('subscription_charges').insert({
          company_id: companyId,
          subscription_id: subscriptionId,
          due_date: values.start_date,
          amount: Number(selectedPlan?.price_monthly || 0),
          status: 'pending',
        });

        toast.success('Assinante cadastrado com sucesso!');
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving subscriber:', error);
      toast.error(error.message || 'Erro ao salvar assinante');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{subscription ? 'Editar Assinatura' : 'Novo Assinante'}</DialogTitle>
          <DialogDescription>Vincule um cliente a um plano. Profissionais e comissões são definidos no próprio plano.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {!subscription && (
              <div className="space-y-2">
                <FormLabel>Buscar Cliente</FormLabel>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Nome do cliente..." value={clientSearch} onChange={(e) => searchClients(e.target.value)} className="pl-10" />
                </div>
                {searchingClients && <p className="text-xs text-muted-foreground">Buscando...</p>}
                {clients.length > 0 && !selectedClient && (
                  <div className="border rounded-md mt-1 divide-y max-h-[180px] overflow-y-auto shadow-sm">
                    {clients.map((client) => (
                      <div
                        key={client.id}
                        className="p-2 hover:bg-muted cursor-pointer flex justify-between items-center"
                        onClick={() => {
                          setSelectedClient(client);
                          form.setValue('client_id', client.id, { shouldValidate: true });
                          setClients([]);
                        }}
                      >
                        <div className="flex flex-col">
                          <span className="text-sm font-medium">{client.name}</span>
                          <span className="text-xs text-muted-foreground">{client.whatsapp}</span>
                        </div>
                        <Button size="sm" variant="ghost" type="button">Selecionar</Button>
                      </div>
                    ))}
                  </div>
                )}
                {selectedClient && (
                  <div className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{selectedClient.name}</p>
                        <p className="text-xs text-muted-foreground">{selectedClient.whatsapp}</p>
                      </div>
                    </div>
                    <Button type="button" variant="ghost" size="sm" onClick={() => {
                      setSelectedClient(null);
                      form.setValue('client_id', '', { shouldValidate: true });
                    }}>
                      Alterar
                    </Button>
                  </div>
                )}
                <FormMessage>{form.formState.errors.client_id?.message}</FormMessage>
              </div>
            )}

            <FormField control={form.control} name="plan_id" render={({ field }) => (
              <FormItem>
                <FormLabel>Plano</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Selecione o plano" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {plans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name} - R$ {Number(plan.price_monthly).toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField control={form.control} name="billing_cycle" render={({ field }) => (
                <FormItem>
                  <FormLabel>Recorrência</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="monthly">Mensal</SelectItem>
                      <SelectItem value="yearly">Anual</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
              <FormField control={form.control} name="billing_day" render={({ field }) => (
                <FormItem>
                  <FormLabel>Dia de Cobrança</FormLabel>
                  <FormControl><Input type="number" min="1" max="31" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="grace_period_days" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tolerância (dias)</FormLabel>
                  <FormControl><Input type="number" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField control={form.control} name="start_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Início</FormLabel>
                  <FormControl><Input type="date" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="end_date" render={({ field }) => (
                <FormItem>
                  <FormLabel>Término (opcional)</FormLabel>
                  <FormControl><Input type="date" {...field} value={field.value || ''} /></FormControl>
                </FormItem>
              )} />
              <FormField control={form.control} name="status" render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="suspended">Suspenso</SelectItem>
                      <SelectItem value="cancelled">Cancelado</SelectItem>
                      <SelectItem value="past_due">Em atraso</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {subscription ? 'Salvar Alterações' : 'Cadastrar Assinante'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
