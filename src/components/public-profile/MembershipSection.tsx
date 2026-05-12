import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Crown, Check, ChevronRight, Info, Calendar, Sparkles } from 'lucide-react';
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
    <section className="w-full space-y-6 animate-fade-in">
      <div className="flex items-center gap-3 px-2">
        <div className="w-1.5 h-6 bg-amber-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
        <h2 className="text-xl font-black text-white tracking-tight uppercase italic flex items-center gap-2">
          Assinatura <span className="text-amber-500">Ativa</span>
          <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-5 px-2">
        {plans.map((plan) => (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            whileHover={{ scale: 1.01 }}
            className="group relative bg-gradient-to-br from-[#1A1A1A] to-[#121212] border border-amber-500/20 rounded-[2rem] p-6 md:p-8 hover:border-amber-500/40 transition-all duration-500 overflow-hidden shadow-2xl shadow-amber-500/5"
          >
            {/* Glassmorphism & Glow Effects */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 blur-[100px] -z-10 group-hover:bg-amber-500/10 transition-colors" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/2 blur-[80px] -z-10" />

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
              <div className="flex items-center gap-5">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black shadow-xl shadow-amber-500/20">
                  <Crown className="w-8 h-8" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-2xl font-black text-white group-hover:text-amber-500 transition-colors">
                      {plan.name}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-[10px] font-black text-amber-500 uppercase tracking-widest">
                      Ativo
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/5 border border-white/5 text-[11px] font-bold text-white/60">
                      <Check className="w-3 h-3 text-amber-500" />
                      {plan.included_services?.length || 0} serviços inclusos
                    </div>
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white/5 border border-white/5 text-[11px] font-bold text-white/60">
                      <Calendar className="w-3 h-3 text-amber-500" />
                      Limite: {plan.usage_limit} usos/mês
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col md:items-end gap-1 w-full md:w-auto pt-4 md:pt-0 border-t md:border-t-0 border-white/5">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-bold text-white/40">R$</span>
                  <span className="text-4xl font-black text-white tracking-tight">
                    {plan.price_monthly.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-xs font-bold text-white/40 uppercase">/mês</span>
                </div>
                {plan.price_yearly && (
                  <p className="text-xs font-bold text-amber-500/80 uppercase tracking-widest">
                    Anual: R$ {plan.price_yearly.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                )}
                <Button
                  onClick={() => setSelectedPlan(plan)}
                  variant="ghost"
                  className="mt-4 w-full md:w-auto bg-amber-500/10 hover:bg-amber-500 text-amber-500 hover:text-black border border-amber-500/20 hover:border-amber-500 rounded-xl font-black text-[11px] uppercase tracking-[0.2em] h-12 px-8 transition-all duration-300"
                >
                  Ver detalhes
                </Button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <Dialog open={!!selectedPlan} onOpenChange={() => setSelectedPlan(null)}>
        <DialogContent className="bg-[#121212] border-white/10 text-white max-w-md rounded-[2.5rem] overflow-hidden">
          <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/10 blur-[80px] -z-10" />
          
          <DialogHeader className="pb-6 border-b border-white/5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black mb-4 shadow-xl shadow-amber-500/20">
              <Crown className="w-7 h-7" />
            </div>
            <DialogTitle className="text-3xl font-black italic uppercase text-white">
              {selectedPlan?.name}
            </DialogTitle>
            <DialogDescription className="text-amber-500/60 font-bold uppercase tracking-widest text-[10px]">
              Plano VIP — Detalhes e Regras
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-6 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-5 rounded-3xl bg-white/5 border border-white/10">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Mensal</p>
                <p className="text-2xl font-black text-amber-500">R$ {selectedPlan?.price_monthly}</p>
              </div>
              {selectedPlan?.price_yearly && (
                <div className="p-5 rounded-3xl bg-white/5 border border-white/10">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-1">Anual</p>
                  <p className="text-2xl font-black text-amber-500">R$ {selectedPlan?.price_yearly}</p>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-white/30 flex items-center gap-2">
                <Check className="w-3 h-3 text-amber-500" />
                Vantagens inclusas
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/5">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-4 h-4 text-amber-500/60" />
                    <span className="text-sm font-bold">Limite de uso</span>
                  </div>
                  <span className="text-sm font-black text-white">{selectedPlan?.usage_limit} utilizações/mês</span>
                </div>
                
                {selectedPlan?.description && (
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
                    <p className="text-sm text-white/70 leading-relaxed italic">"{selectedPlan.description}"</p>
                  </div>
                )}
              </div>
            </div>

            {selectedPlan?.observations && (
              <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-white/30 flex items-center gap-2">
                  <Info className="w-3 h-3 text-amber-500" />
                  Regras Gerais
                </h4>
                <div className="p-5 rounded-[2rem] bg-amber-500/5 border border-amber-500/10">
                  <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
                    {selectedPlan.observations}
                  </p>
                </div>
              </div>
            )}
            
            <div className="pt-4 text-center">
              <p className="text-[9px] text-white/20 uppercase tracking-[0.3em] font-black">
                Assinatura renovada automaticamente
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
};

