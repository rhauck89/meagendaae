import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Search } from 'lucide-react';

const planSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  price_monthly: z.coerce.number().min(0, 'Valor inválido'),
  plan_model: z.enum(['unlimited', 'limited_appointment', 'limited_service']),
  limit_period: z.enum(['weekly', 'monthly']).default('monthly'),
  usage_limit: z.coerce.number().optional().nullable(),
  professional_ids: z.array(z.string()).min(1, 'Selecione pelo menos um profissional').default([]),
  included_services: z.array(z.string()).min(1, 'Selecione pelo menos um serviço'),
  valid_days: z.array(z.number()).default([]),
  valid_start_time: z.string().optional().nullable(),
  valid_end_time: z.string().optional().nullable(),
  commission_timing: z.enum(['none', 'appointment_completion', 'plan_billing']).default('none'),
  commission_type: z.enum(['none', 'percentage', 'fixed']).default('none'),
  commission_value: z.coerce.number().optional().nullable(),
  quantity_available: z.coerce.number().optional().nullable(),
  observations: z.string().optional(),
  is_active: z.boolean().default(true),
}).superRefine((value, ctx) => {
  if (value.plan_model !== 'unlimited' && (!value.usage_limit || value.usage_limit <= 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['usage_limit'],
      message: 'Informe o limite do plano',
    });
  }

  if (value.commission_timing !== 'none') {
    if (value.commission_type === 'none') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['commission_type'],
        message: 'Escolha o tipo de comissao',
      });
    }

    if (!value.commission_value || value.commission_value <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['commission_value'],
        message: 'Informe o valor da comissao',
      });
    }
  }
});

type PlanFormValues = z.infer<typeof planSchema>;

interface PlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  plan?: any;
  onSuccess: () => void;
}

const dayOptions = [
  { id: 1, label: 'Segunda' },
  { id: 2, label: 'Terça-feira' },
  { id: 3, label: 'Quarta' },
  { id: 4, label: 'Quinta' },
  { id: 5, label: 'Sexta' },
  { id: 6, label: 'Sábado' },
  { id: 0, label: 'Domingo' },
];

const dayLabelMap: Record<number, string> = {
  0: 'domingo',
  1: 'segunda',
  2: 'terça-feira',
  3: 'quarta',
  4: 'quinta',
  5: 'sexta',
  6: 'sábado',
};

const toPlanModel = (plan: any): PlanFormValues['plan_model'] => {
  if (plan?.type === 'unlimited') return 'unlimited';
  return plan?.usage_count_mode === 'appointment' ? 'limited_appointment' : 'limited_service';
};

export function PlanDialog({ open, onOpenChange, companyId, plan, onSuccess }: PlanDialogProps) {
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<any[]>([]);
  const [professionals, setProfessionals] = useState<any[]>([]);
  const [serviceSearch, setServiceSearch] = useState('');
  const [professionalSearch, setProfessionalSearch] = useState('');
  const [fetching, setFetching] = useState(false);
  const [hasManualEdit, setHasManualEdit] = useState(false);

  const form = useForm<PlanFormValues>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      name: '',
      price_monthly: 0,
      plan_model: 'limited_service',
      limit_period: 'monthly',
      usage_limit: 4,
      professional_ids: [],
      included_services: [],
      valid_days: [],
      valid_start_time: '',
      valid_end_time: '',
      commission_timing: 'none',
      commission_type: 'none',
      commission_value: null,
      quantity_available: null,
      observations: '',
      is_active: true,
    },
  });

  const planModel = form.watch('plan_model');
  const commissionTiming = form.watch('commission_timing');
  const commissionType = form.watch('commission_type');

  const loadResources = async () => {
    setFetching(true);
    try {
      const [servicesRes, professionalsRes, planProfessionalsRes] = await Promise.all([
        supabase
          .from('services')
          .select('id, name, price')
          .eq('company_id', companyId)
          .eq('active', true)
          .order('name'),
        supabase
          .from('collaborators')
          .select('profile_id, profile:profiles(full_name, email)')
          .eq('company_id', companyId)
          .eq('is_service_provider', true)
          .eq('active', true)
          .order('created_at'),
        plan?.id
          ? supabase
              .from('subscription_plan_professionals')
              .select('professional_id')
              .eq('plan_id', plan.id)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (servicesRes.error) throw servicesRes.error;
      if (professionalsRes.error) throw professionalsRes.error;
      if (planProfessionalsRes.error) throw planProfessionalsRes.error;

      const planProfessionalIds = (planProfessionalsRes.data || []).map((row: any) => row.professional_id);
      setServices(servicesRes.data || []);
      setProfessionals(professionalsRes.data || []);

      if (plan) {
        form.reset({
          name: plan.name || '',
          price_monthly: Number(plan.price_monthly || 0),
          plan_model: toPlanModel(plan),
          limit_period: plan.limit_period || 'monthly',
          usage_limit: plan.usage_limit || null,
          professional_ids: planProfessionalIds,
          included_services: plan.included_services || [],
          valid_days: plan.valid_days || [],
          valid_start_time: plan.valid_start_time || '',
          valid_end_time: plan.valid_end_time || '',
          commission_timing: plan.commission_timing || 'none',
          commission_type: plan.plan_commission_type || plan.commission_type || 'none',
          commission_value: plan.plan_commission_value ?? plan.commission_value ?? null,
          quantity_available: plan.quantity_available ?? null,
          observations: plan.observations || '',
          is_active: plan.is_active ?? true,
        });
      } else {
        form.reset({
          name: '',
          price_monthly: 0,
          plan_model: 'limited_service',
          limit_period: 'monthly',
          usage_limit: 4,
          professional_ids: [],
          included_services: [],
          valid_days: [],
          valid_start_time: '',
          valid_end_time: '',
          commission_timing: 'none',
          commission_type: 'none',
          commission_value: null,
          quantity_available: null,
          observations: '',
          is_active: true,
        });
      }
      setHasManualEdit(false);
    } catch (error: any) {
      console.error('Error loading subscription plan form:', error);
      toast.error('Erro ao carregar dados do plano');
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    if (open) void loadResources();
  }, [open, plan?.id]);

  const buildAutomaticRules = (value: Partial<PlanFormValues>) => {
    const serviceNames = services
      .filter((service) => (value.included_services || []).includes(service.id))
      .map((service) => service.name);
    const professionalNames = professionals
      .filter((professional) => (value.professional_ids || []).includes(professional.profile_id))
      .map((professional) => professional.profile?.full_name)
      .filter(Boolean);

    const lines: string[] = [];
    lines.push(`Plano: ${value.name || 'Novo plano'}`);
    lines.push(`Valor: R$ ${Number(value.price_monthly || 0).toFixed(2)} por mês`);
    lines.push('');

    if (value.plan_model === 'unlimited') {
      lines.push('Tipo de plano: ilimitado dentro dos serviços, profissionais, dias e horários permitidos.');
    } else {
      const modeText = value.plan_model === 'limited_appointment'
        ? 'limitado por agendamento: cada atendimento consome 1 crédito, mesmo com vários serviços.'
        : 'limitado por serviço: cada serviço incluso consome 1 crédito.';
      lines.push(`Tipo de plano: ${modeText}`);
      lines.push(`Limite: ${value.usage_limit || 0} uso(s) por ${value.limit_period === 'weekly' ? 'semana' : 'mês'}.`);
    }

    lines.push('');
    lines.push('Profissionais que atendem este plano:');
    lines.push(...(professionalNames.length ? professionalNames.map((name) => `- ${name}`) : ['- Nenhum profissional selecionado']));

    lines.push('');
    lines.push('Serviços inclusos:');
    lines.push(...(serviceNames.length ? serviceNames.map((name) => `- ${name}`) : ['- Nenhum serviço selecionado']));

    const days = value.valid_days || [];
    lines.push('');
    lines.push('Dias permitidos:');
    lines.push(days.length ? days.map((day) => dayLabelMap[day]).join(', ') : 'Todos os dias.');

    lines.push('');
    lines.push('Horários permitidos:');
    if (value.valid_start_time || value.valid_end_time) {
      lines.push(`${value.valid_start_time ? `A partir de ${value.valid_start_time}` : ''}${value.valid_start_time && value.valid_end_time ? ' ' : ''}${value.valid_end_time ? `até ${value.valid_end_time}` : ''}.`);
    } else {
      lines.push('Qualquer horário disponível na agenda.');
    }

    lines.push('');
    if (value.commission_timing === 'none' || value.commission_type === 'none') {
      lines.push('Comissão: sem comissão.');
    } else {
      const when = value.commission_timing === 'appointment_completion'
        ? 'no atendimento, para o profissional que finalizou o serviço'
        : 'no faturamento do plano, dividida entre os profissionais participantes';
      const amount = value.commission_type === 'percentage'
        ? `${Number(value.commission_value || 0)}% do valor do plano`
        : `R$ ${Number(value.commission_value || 0).toFixed(2)}`;
      lines.push(`Comissão: ${amount}, lançada ${when}.`);
    }

    if (value.quantity_available) {
      lines.push('');
      lines.push(`Quantidade disponível: ${value.quantity_available} assinatura(s).`);
    }

    return lines.join('\n');
  };

  useEffect(() => {
    if (!open) return;
    const subscription = form.watch((value, { name }) => {
      if (name === 'observations') {
        setHasManualEdit(true);
        return;
      }
      if (!hasManualEdit) {
        form.setValue('observations', buildAutomaticRules(value), { shouldDirty: true });
      }
    });
    return () => subscription.unsubscribe();
  }, [open, form, services, professionals, hasManualEdit]);

  useEffect(() => {
    if (commissionTiming === 'none') {
      form.setValue('commission_type', 'none');
      form.setValue('commission_value', null);
    }
  }, [commissionTiming, form]);

  useEffect(() => {
    if (commissionType === 'none') form.setValue('commission_value', null);
  }, [commissionType, form]);

  const filteredServices = useMemo(
    () => services.filter((service) => service.name.toLowerCase().includes(serviceSearch.toLowerCase())),
    [services, serviceSearch],
  );

  const filteredProfessionals = useMemo(() => {
    const query = professionalSearch.toLowerCase();
    return professionals.filter((professional) =>
      professional.profile?.full_name?.toLowerCase().includes(query) ||
      professional.profile?.email?.toLowerCase().includes(query)
    );
  }, [professionals, professionalSearch]);

  const onSubmit = async (values: PlanFormValues) => {
    setLoading(true);
    try {
      const isUnlimited = values.plan_model === 'unlimited';
      const payload = {
        company_id: companyId,
        name: values.name,
        description: values.observations,
        price_monthly: values.price_monthly,
        price_yearly: null,
        type: isUnlimited ? 'unlimited' : 'limited',
        usage_count_mode: isUnlimited ? 'service' : (values.plan_model === 'limited_appointment' ? 'appointment' : 'service'),
        limit_period: isUnlimited ? null : values.limit_period,
        usage_limit: isUnlimited ? null : values.usage_limit,
        included_services: values.included_services,
        valid_days: values.valid_days,
        valid_start_time: values.valid_start_time || null,
        valid_end_time: values.valid_end_time || null,
        commission_timing: values.commission_timing,
        plan_commission_type: values.commission_timing === 'none' ? 'none' : values.commission_type,
        plan_commission_value: values.commission_timing === 'none' || values.commission_type === 'none' ? 0 : Number(values.commission_value || 0),
        quantity_available: values.quantity_available || null,
        observations: values.observations,
        is_active: values.is_active,
        all_professionals: false,
      };

      let planId = plan?.id;
      if (planId) {
        const { error } = await supabase.from('subscription_plans').update(payload as any).eq('id', planId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('subscription_plans').insert(payload as any).select('id').single();
        if (error) throw error;
        planId = data.id;
      }

      await supabase.from('subscription_plan_professionals').delete().eq('plan_id', planId);
      if (values.professional_ids.length > 0) {
        const rows = values.professional_ids.map((professionalId) => ({
          company_id: companyId,
          plan_id: planId,
          professional_id: professionalId,
        }));
        const { error } = await supabase.from('subscription_plan_professionals').insert(rows as any);
        if (error) throw error;
      }

      toast.success(plan ? 'Plano atualizado com sucesso!' : 'Plano criado com sucesso!');
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving plan:', error);
      toast.error(error.message || 'Erro ao salvar plano');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl h-[100dvh] sm:h-auto sm:max-h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle>{plan ? 'Editar Plano' : 'Novo Plano'}</DialogTitle>
          <DialogDescription>Configure as regras comerciais, agenda e comissão deste plano.</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <DialogBody className="flex-1 overflow-y-auto space-y-6 custom-scrollbar px-6 py-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Plano</FormLabel>
                    <FormControl><Input placeholder="Ex: Barba mensal" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="price_monthly" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor do plano (R$)</FormLabel>
                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="plan_model" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de plano</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="unlimited">Ilimitado</SelectItem>
                        <SelectItem value="limited_appointment">Limitado com agendamento</SelectItem>
                        <SelectItem value="limited_service">Limitado por serviço</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                {planModel !== 'unlimited' && (
                  <>
                    <FormField control={form.control} name="limit_period" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de limite</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="weekly">Semanal</SelectItem>
                            <SelectItem value="monthly">Mensal</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )} />

                    <FormField control={form.control} name="usage_limit" render={({ field }) => (
                      <FormItem>
                        <FormLabel>Limite</FormLabel>
                        <FormControl><Input type="number" min="1" {...field} value={field.value || ''} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )} />
                  </>
                )}
              </div>

              <FormField control={form.control} name="professional_ids" render={({ field }) => (
                <FormItem>
                  <FormLabel>Profissionais que atendem o plano</FormLabel>
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input className="pl-10" placeholder="Buscar profissional..." value={professionalSearch} onChange={(e) => setProfessionalSearch(e.target.value)} />
                    </div>
                    <ScrollArea className="h-[150px] rounded-md border p-2">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {filteredProfessionals.map((professional) => (
                          <label key={professional.profile_id} className="flex items-start gap-3 rounded-md border p-3 hover:bg-muted/40">
                            <Checkbox
                              checked={field.value.includes(professional.profile_id)}
                              onCheckedChange={(checked) => {
                                field.onChange(checked
                                  ? [...field.value, professional.profile_id]
                                  : field.value.filter((id) => id !== professional.profile_id));
                              }}
                            />
                            <span className="text-sm">
                              {professional.profile?.full_name}
                              <span className="block text-xs text-muted-foreground">{professional.profile?.email}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </ScrollArea>
                    <FormDescription>Somente estes profissionais poderão atender clientes deste plano.</FormDescription>
                    <FormMessage />
                  </div>
                </FormItem>
              )} />

              <FormField control={form.control} name="included_services" render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between gap-2">
                    <FormLabel>Serviços inclusos</FormLabel>
                    <div className="flex gap-2">
                      <Button type="button" variant="ghost" size="sm" onClick={() => field.onChange(services.map((service) => service.id))}>Selecionar todos</Button>
                      <Button type="button" variant="ghost" size="sm" onClick={() => field.onChange([])}>Limpar</Button>
                    </div>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input className="pl-10" placeholder="Buscar serviços..." value={serviceSearch} onChange={(e) => setServiceSearch(e.target.value)} />
                  </div>
                  <ScrollArea className="h-[190px] rounded-md border p-2">
                    {fetching ? (
                      <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {filteredServices.map((service) => (
                          <label key={service.id} className="flex items-start gap-3 rounded-md border p-3 hover:bg-muted/40">
                            <Checkbox
                              checked={field.value.includes(service.id)}
                              onCheckedChange={(checked) => {
                                field.onChange(checked
                                  ? [...field.value, service.id]
                                  : field.value.filter((id) => id !== service.id));
                              }}
                            />
                            <span className="text-sm">
                              {service.name}
                              <span className="block text-xs text-muted-foreground">R$ {Number(service.price).toFixed(2)}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="space-y-4 rounded-md border bg-muted/20 p-4">
                <FormField control={form.control} name="valid_days" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Dias da semana permitidos</FormLabel>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {dayOptions.map((day) => (
                        <label key={day.id} className="flex items-center gap-2 text-sm">
                          <Checkbox
                            checked={field.value.includes(day.id)}
                            onCheckedChange={(checked) => {
                              field.onChange(checked
                                ? [...field.value, day.id]
                                : field.value.filter((id) => id !== day.id));
                            }}
                          />
                          {day.label}
                        </label>
                      ))}
                    </div>
                    <FormDescription>Se nenhum dia for selecionado, o plano será válido todos os dias.</FormDescription>
                  </FormItem>
                )} />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField control={form.control} name="valid_start_time" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Horário inicial permitido</FormLabel>
                      <FormControl><Input type="time" {...field} value={field.value || ''} /></FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="valid_end_time" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Horário final permitido</FormLabel>
                      <FormControl><Input type="time" {...field} value={field.value || ''} /></FormControl>
                    </FormItem>
                  )} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <FormField control={form.control} name="commission_timing" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Comissionar como</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="none">Sem comissão</SelectItem>
                        <SelectItem value="appointment_completion">No atendimento</SelectItem>
                        <SelectItem value="plan_billing">No faturamento do plano</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />

                <FormField control={form.control} name="commission_type" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Comissão</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={commissionTiming === 'none'}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="none">Sem comissão</SelectItem>
                        <SelectItem value="percentage">Percentual valor do plano</SelectItem>
                        <SelectItem value="fixed">Valor fixo</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )} />

                <FormField control={form.control} name="commission_value" render={({ field }) => (
                  <FormItem>
                    <FormLabel>{commissionType === 'fixed' ? 'Valor da comissão (R$)' : 'Percentual da comissão (%)'}</FormLabel>
                    <FormControl><Input type="number" step="0.01" disabled={commissionTiming === 'none' || commissionType === 'none'} {...field} value={field.value || ''} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="quantity_available" render={({ field }) => (
                <FormItem>
                  <FormLabel>Quantidade disponível</FormLabel>
                  <FormControl><Input type="number" min="0" placeholder="Vazio = ilimitado" {...field} value={field.value || ''} /></FormControl>
                  <FormDescription>Se ficar vazio, o plano poderá ser vendido sem limite de quantidade.</FormDescription>
                </FormItem>
              )} />

              <FormField control={form.control} name="observations" render={({ field }) => (
                <FormItem>
                  <div className="flex items-center justify-between">
                    <FormLabel>Observações / Regras Adicionais</FormLabel>
                    <Button type="button" variant="ghost" size="sm" onClick={() => {
                      setHasManualEdit(false);
                      form.setValue('observations', buildAutomaticRules(form.getValues()), { shouldDirty: true });
                    }}>
                      Atualizar regras automaticamente
                    </Button>
                  </div>
                  <FormControl><Textarea className="min-h-[190px] resize-none text-xs" {...field} /></FormControl>
                </FormItem>
              )} />

              <FormField control={form.control} name="is_active" render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <FormLabel className="text-base">Plano Ativo</FormLabel>
                    <FormDescription>Planos inativos não podem ser vinculados a novos assinantes.</FormDescription>
                  </div>
                  <FormControl><Checkbox checked={field.value} onCheckedChange={field.onChange} /></FormControl>
                </FormItem>
              )} />
            </DialogBody>

            <DialogFooter className="px-6 py-4 border-t shrink-0">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
              <Button type="submit" disabled={loading || fetching}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {plan ? 'Atualizar Plano' : 'Criar Plano'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
