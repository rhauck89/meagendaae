import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
  DialogBody,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Search } from 'lucide-react';

const planSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório'),
  description: z.string().optional(),
  price_monthly: z.coerce.number().min(0, 'Valor inválido'),
  price_yearly: z.coerce.number().optional().nullable(),
  type: z.enum(['limited', 'unlimited']),
  usage_limit: z.coerce.number().optional().nullable(),
  usage_count_mode: z.enum(['service', 'appointment']).default('service'),
  included_services: z.array(z.string()).min(1, 'Selecione pelo menos um serviço'),
  valid_days: z.array(z.number()).default([]),
  valid_start_time: z.string().optional().nullable(),
  valid_end_time: z.string().optional().nullable(),
  observations: z.string().optional(),
  is_active: z.boolean().default(true),
});

type PlanFormValues = z.infer<typeof planSchema>;

interface PlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  plan?: any;
  onSuccess: () => void;
}

export function PlanDialog({
  open,
  onOpenChange,
  companyId,
  plan,
  onSuccess,
}: PlanDialogProps) {
  const [loading, setLoading] = useState(false);
  const [services, setServices] = useState<any[]>([]);
  const [serviceSearch, setServiceSearch] = useState('');
  const [fetchingServices, setFetchingServices] = useState(false);

  const form = useForm<PlanFormValues>({
    resolver: zodResolver(planSchema),
    defaultValues: {
      name: '',
      description: '',
      price_monthly: 0,
      price_yearly: null,
      type: 'limited',
      usage_limit: 4,
      usage_count_mode: 'service',
      included_services: [],
      valid_days: [],
      valid_start_time: '',
      valid_end_time: '',
      observations: '',
      is_active: true,
    },
  });

  useEffect(() => {
    if (open) {
      fetchServices();
      if (plan) {
        form.reset({
          name: plan.name,
          description: plan.description || '',
          price_monthly: Number(plan.price_monthly),
          price_yearly: plan.price_yearly ? Number(plan.price_yearly) : null,
          type: plan.type as 'limited' | 'unlimited',
          usage_limit: plan.usage_limit,
          usage_count_mode: plan.usage_count_mode === 'day' ? 'appointment' : (plan.usage_count_mode as any) || 'service',
          included_services: plan.included_services || [],
          valid_days: plan.valid_days || [],
          valid_start_time: plan.valid_start_time || '',
          valid_end_time: plan.valid_end_time || '',
          observations: plan.observations || '',
          is_active: plan.is_active,
        });
      } else {
        form.reset({
          name: '',
          description: '',
          price_monthly: 0,
          price_yearly: null,
          type: 'limited',
          usage_limit: 4,
          usage_count_mode: 'service',
          included_services: [],
          valid_days: [],
          valid_start_time: '',
          valid_end_time: '',
          observations: '',
          is_active: true,
        });
      }
    }
  }, [open, plan, form]);

  const fetchServices = async () => {
    setFetchingServices(true);
    try {
      const { data, error } = await supabase
        .from('services')
        .select('id, name, price')
        .eq('company_id', companyId)
        .eq('active', true)
        .order('name');

      if (error) throw error;
      setServices(data || []);
    } catch (error: any) {
      console.error('Error fetching services:', error);
      toast.error('Erro ao buscar serviços');
    } finally {
      setFetchingServices(false);
    }
  };

  const onSubmit = async (values: PlanFormValues) => {
    setLoading(true);
    try {
      const payload = {
        name: values.name,
        description: values.description,
        price_monthly: values.price_monthly,
        price_yearly: values.price_yearly,
        type: values.type,
        usage_limit: values.type === 'unlimited' ? null : values.usage_limit,
        usage_count_mode: values.usage_count_mode,
        included_services: values.included_services,
        valid_days: values.valid_days,
        valid_start_time: values.valid_start_time || null,
        valid_end_time: values.valid_end_time || null,
        observations: values.observations,
        is_active: values.is_active,
        company_id: companyId,
      };

      if (plan?.id) {
        const { error } = await supabase
          .from('subscription_plans')
          .update(payload)
          .eq('id', plan.id);
        if (error) throw error;
        toast.success('Plano atualizado com sucesso!');
      } else {
        const { error } = await supabase
          .from('subscription_plans')
          .insert(payload);
        if (error) throw error;
        toast.success('Plano criado com sucesso!');
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving plan:', error);
      toast.error(error.message || 'Erro ao salvar plano');
    } finally {
      setLoading(false);
    }
  };

  const filteredServices = services.filter((s) =>
    s.name.toLowerCase().includes(serviceSearch.toLowerCase())
  );

  const planType = form.watch('type');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{plan ? 'Editar Plano' : 'Novo Plano'}</DialogTitle>
          <DialogDescription>
            Configure os detalhes do plano de assinatura para seus clientes.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <DialogBody className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome do Plano</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: Black Mensal" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de Plano</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="limited">Limitado (por usos)</SelectItem>
                        <SelectItem value="unlimited">Ilimitado</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
              <FormField
                control={form.control}
                name="price_monthly"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="h-5 flex items-center">Valor Mensal (R$)</FormLabel>
                    <FormControl>
                      <Input type="number" step="0.01" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="price_yearly"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="h-5 flex items-center">Valor Anual (R$)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Opcional"
                        value={field.value || ''}
                        onChange={(e) =>
                          field.onChange(e.target.value ? Number(e.target.value) : null)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {planType === 'limited' ? (
                <FormField
                  control={form.control}
                  name="usage_limit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="h-5 flex items-center">Usos por Mês</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              ) : (
                <div className="hidden md:block" />
              )}
            </div>

            <FormField
              control={form.control}
              name="included_services"
              render={() => (
                <FormItem>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <FormLabel>Serviços Incluídos</FormLabel>
                    <div className="flex items-center gap-2">
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 text-xs text-primary hover:text-primary hover:bg-primary/10"
                        onClick={() => {
                          const allIds = services.map(s => s.id);
                          form.setValue('included_services', allIds, { shouldValidate: true });
                        }}
                      >
                        Selecionar todos
                      </Button>
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          form.setValue('included_services', [], { shouldValidate: true });
                        }}
                      >
                        Limpar seleção
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Buscar serviços..."
                        value={serviceSearch}
                        onChange={(e) => setServiceSearch(e.target.value)}
                        className="pl-10 h-9"
                      />
                    </div>
                    <ScrollArea className="h-[200px] border rounded-md p-2">
                      {fetchingServices ? (
                        <div className="flex items-center justify-center h-full">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                          {filteredServices.map((service) => (
                            <FormField
                              key={service.id}
                              control={form.control}
                              name="included_services"
                              render={({ field }) => (
                                <FormItem
                                  key={service.id}
                                  className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-2 hover:bg-muted/50 cursor-pointer"
                                >
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(service.id)}
                                      onCheckedChange={(checked) => {
                                        return checked
                                          ? field.onChange([...field.value, service.id])
                                          : field.onChange(
                                              field.value?.filter(
                                                (value) => value !== service.id
                                              )
                                            );
                                      }}
                                    />
                                  </FormControl>
                                  <div className="space-y-1 leading-none">
                                    <FormLabel className="text-sm font-normal cursor-pointer">
                                      {service.name}
                                    </FormLabel>
                                    <p className="text-xs text-muted-foreground">
                                      R$ {Number(service.price).toFixed(2)}
                                    </p>
                                  </div>
                                </FormItem>
                              )}
                            />
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />

            <div className="space-y-4 border rounded-md p-4 bg-muted/20">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                ⚙️ Regras de Uso e Consumo
              </h3>
              
              <FormField
                control={form.control}
                name="usage_count_mode"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Como consumir créditos</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o modo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="service">
                          <div className="flex flex-col">
                            <span>Por serviço</span>
                            <span className="text-xs text-muted-foreground font-normal">Cada serviço consome 1 crédito. Ex: Corte + Barba = 2 créditos.</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="appointment">
                          <div className="flex flex-col">
                            <span>Por agendamento</span>
                            <span className="text-xs text-muted-foreground font-normal">O atendimento inteiro consome 1 crédito, mesmo com vários serviços.</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      Define como o saldo de usos será descontado do cliente.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-3">
                <FormLabel>Dias da semana permitidos</FormLabel>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: 1, label: 'Segunda' },
                    { id: 2, label: 'Terça' },
                    { id: 3, label: 'Quarta' },
                    { id: 4, label: 'Quinta' },
                    { id: 5, label: 'Sexta' },
                    { id: 6, label: 'Sábado' },
                    { id: 0, label: 'Domingo' },
                  ].map((day) => (
                    <FormField
                      key={day.id}
                      control={form.control}
                      name="valid_days"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-start space-x-2 space-y-0">
                          <FormControl>
                            <Checkbox
                              checked={field.value?.includes(day.id)}
                              onCheckedChange={(checked) => {
                                return checked
                                  ? field.onChange([...(field.value || []), day.id])
                                  : field.onChange(
                                      field.value?.filter((value) => value !== day.id)
                                    );
                              }}
                            />
                          </FormControl>
                          <FormLabel className="text-xs font-normal cursor-pointer">
                            {day.label}
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                  ))}
                </div>
                <FormDescription className="text-xs">
                  Se nenhum dia for selecionado, o plano será válido todos os dias.
                </FormDescription>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="valid_start_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Horário inicial permitido</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="valid_end_time"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Horário final permitido</FormLabel>
                      <FormControl>
                        <Input type="time" {...field} value={field.value || ''} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              {(() => {
                const days = form.watch('valid_days');
                const start = form.watch('valid_start_time');
                const end = form.watch('valid_end_time');
                const mode = form.watch('usage_count_mode');
                
                const dayLabels = [
                  { id: 1, label: 'segunda' },
                  { id: 2, label: 'terça' },
                  { id: 3, label: 'quarta' },
                  { id: 4, label: 'quinta' },
                  { id: 5, label: 'sexta' },
                  { id: 6, label: 'sábado' },
                  { id: 0, label: 'domingo' },
                ];
                
                const selectedDayLabels = dayLabels
                  .filter(d => days?.includes(d.id))
                  .map(d => d.label);
                  
                let summary = "";
                if (selectedDayLabels.length === 0) {
                  summary = "Válido todos os dias";
                } else if (selectedDayLabels.length === 7) {
                  summary = "Válido todos os dias";
                } else {
                  summary = `Válido ${selectedDayLabels.join(', ')}`;
                }
                
                if (start && end) {
                  summary += `, das ${start} às ${end}`;
                } else if (start) {
                  summary += `, a partir das ${start}`;
                } else if (end) {
                  summary += `, até as ${end}`;
                } else {
                  summary += ", qualquer horário";
                }
                
                const modeLabel = mode === 'service' ? 'por serviço' : 'por agendamento';
                summary += `. Consumo ${modeLabel}.`;
                
                return (
                  <p className="text-xs font-medium text-primary bg-primary/5 p-2 rounded border border-primary/10">
                    💡 Resumo: {summary}
                  </p>
                );
              })()}
            </div>

            <FormField
              control={form.control}
              name="observations"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações / Regras Adicionais</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Ex: Válido apenas de terça a quinta."
                      className="resize-none"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Plano Ativo</FormLabel>
                    <FormDescription>
                      Planos inativos não podem ser vinculados a novos assinantes.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
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
