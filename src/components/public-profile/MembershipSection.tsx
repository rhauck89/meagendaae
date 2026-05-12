import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Crown, Check, ChevronRight, Info, Calendar, Scissors } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface MembershipSectionProps {
  companyId: string;
}

export const MembershipSection = ({ companyId }: MembershipSectionProps) => {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);

  useEffect(() => {
    if (!companyId) return;

    const fetchPlans = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('subscription_plans')
          .select('*')
          .eq('company_id', companyId)
          .eq('is_active', true)
          .order('price_monthly', { ascending: true });

        if (error) throw error;
        setPlans(data || []);
      } catch (error) {
        console.error('Error fetching subscription plans:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, [companyId]);

  if (loading || plans.length === 0) return null;

  return (
    <section className="w-full space-y-6">
      <div className="flex items-center gap-3 px-2">
        <div className="w-1.5 h-6 bg-primary rounded-full" />
        <h2 className="text-xl font-bold text-white tracking-tight uppercase italic">
          Assinaturas <span className="text-primary">Disponíveis</span>
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 px-2">
        {plans.map((plan) => (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="group relative bg-[#1A1A1A] border border-white/5 rounded-2xl p-5 hover:border-primary/30 transition-all duration-300"
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20">
                <Crown className="w-3 h-3 text-primary" />
                <span className="text-[10px] font-bold text-primary uppercase tracking-wider">Assinatura</span>
              </div>
              <div className="text-right">
                <div className="flex items-baseline justify-end gap-1">
                  <span className="text-xs font-medium text-white/40">R$</span>
                  <span className="text-2xl font-black text-white">{plan.price_monthly}</span>
                  <span className="text-xs font-medium text-white/40">/mês</span>
                </div>
                {plan.price_yearly && (
                  <p className="text-[10px] text-primary font-medium">Ou R$ {plan.price_yearly}/ano</p>
                )}
              </div>
            </div>

            <h3 className="text-lg font-bold text-white mb-2 group-hover:text-primary transition-colors">
              {plan.name}
            </h3>

            <div className="space-y-2 mb-6">
              <div className="flex items-center gap-2 text-white/60">
                <Check className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-medium">Limite: {plan.usage_limit} usos</span>
              </div>
              {plan.description && (
                <p className="text-xs text-white/40 line-clamp-2">{plan.description}</p>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedPlan(plan)}
              className="w-full bg-white/5 border-white/10 hover:bg-primary hover:text-black hover:border-primary text-white/70 text-[11px] font-bold uppercase tracking-wider h-10 rounded-xl transition-all"
            >
              Ver detalhes
            </Button>
          </motion.div>
        ))}
      </div>

      <Dialog open={!!selectedPlan} onOpenChange={() => setSelectedPlan(null)}>
        <DialogContent className="bg-[#121212] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black italic uppercase flex items-center gap-3">
              <Crown className="w-6 h-6 text-primary" />
              {selectedPlan?.name}
            </DialogTitle>
            <DialogDescription className="text-white/60">
              Detalhes e regras do plano de assinatura
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Mensal</p>
                <p className="text-xl font-black text-primary">R$ {selectedPlan?.price_monthly}</p>
              </div>
              {selectedPlan?.price_yearly && (
                <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                  <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Anual</p>
                  <p className="text-xl font-black text-primary">R$ {selectedPlan?.price_yearly}</p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                <Check className="w-3 h-3" />
                O que está incluso
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-primary/60" />
                    <span className="text-sm font-medium">Limite de uso</span>
                  </div>
                  <span className="text-sm font-black">{selectedPlan?.usage_limit} utilizações</span>
                </div>
                {selectedPlan?.description && (
                  <div className="p-3 rounded-xl bg-white/5 border border-white/5">
                    <p className="text-sm text-white/70 leading-relaxed">{selectedPlan.description}</p>
                  </div>
                )}
              </div>
            </div>

            {selectedPlan?.observations && (
              <div className="space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-widest text-white/40 flex items-center gap-2">
                  <Info className="w-3 h-3" />
                  Regras e Observações
                </h4>
                <div className="p-4 rounded-2xl bg-primary/5 border border-primary/10">
                  <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
                    {selectedPlan.observations}
                  </p>
                </div>
              </div>
            )}
            
            <div className="pt-2">
              <p className="text-[10px] text-center text-white/20 uppercase tracking-[0.2em]">
                Assinatura renovada automaticamente a cada ciclo
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
};
