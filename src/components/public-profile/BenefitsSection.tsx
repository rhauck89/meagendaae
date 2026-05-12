import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Tag, Coins, Gift, ChevronRight, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface BenefitCardProps {
  type: 'Promoção' | 'Cashback' | 'Fidelidade';
  title: string;
  benefit: string;
  rule: string;
  icon: React.ReactNode;
  colorClass: string;
  glowClass: string;
  onClick: () => void;
}

const BenefitCard = ({ type, title, benefit, rule, icon, colorClass, glowClass, onClick }: BenefitCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    whileHover={{ y: -4, scale: 1.02 }}
    transition={{ duration: 0.2 }}
    className={cn(
      "group relative bg-[#121212] border border-white/5 rounded-3xl p-5 flex flex-col gap-4 transition-all cursor-pointer overflow-hidden",
      "hover:border-white/10 hover:shadow-2xl",
      glowClass
    )}
    onClick={onClick}
  >
    {/* Decorative Gradient Background */}
    <div className={cn("absolute -top-12 -right-12 w-24 h-24 blur-[50px] opacity-20 transition-opacity group-hover:opacity-40", colorClass)} />

    <div className="flex items-start justify-between">
      <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-xl mb-2", colorClass)}>
        {icon}
      </div>
      <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/5 text-[10px] font-black uppercase tracking-widest text-white/40">
        {type}
      </div>
    </div>

    <div className="space-y-1">
      <h3 className="text-xl font-black text-white group-hover:text-primary transition-colors leading-tight">
        {benefit}
      </h3>
      <p className="text-xs font-bold text-white/60 line-clamp-1">
        {title}
      </p>
    </div>

    <div className="mt-auto pt-4 flex items-center justify-between border-t border-white/5">
      <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">
        {rule}
      </span>
      <div className="flex items-center gap-1 text-[10px] font-black text-primary uppercase tracking-widest group-hover:translate-x-1 transition-transform">
        Saiba mais
        <ChevronRight className="w-3 h-3" />
      </div>
    </div>
  </motion.div>
);

export interface BenefitsSectionProps {
  companyId: string;
  professionalId?: string;
}

export const BenefitsSection = ({ companyId, professionalId }: BenefitsSectionProps) => {
  const [promotions, setPromotions] = useState<any[]>([]);
  const [loyalty, setLoyalty] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedBenefit, setSelectedBenefit] = useState<any>(null);

  useEffect(() => {
    if (!companyId) return;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        const [promoRes, loyaltyRes] = await Promise.all([
          supabase
            .from('promotions')
            .select('*')
            .eq('company_id', companyId)
            .eq('status', 'active')
            .gte('end_date', new Date().toISOString().split('T')[0]),
          supabase
            .from('loyalty_config')
            .select('*')
            .eq('company_id', companyId)
            .eq('enabled', true)
            .maybeSingle()
        ]);

        let filteredPromos = promoRes.data || [];
        if (professionalId) {
          filteredPromos = filteredPromos.filter(p => 
            p.professional_filter === 'all' || 
            (p.professional_ids && p.professional_ids.includes(professionalId))
          );
        }

        setPromotions(filteredPromos);
        setLoyalty(loyaltyRes.data);
      } catch (error) {
        console.error('Error fetching benefits:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [companyId, professionalId]);

  if (loading) return null;

  const hasBenefits = promotions.length > 0 || loyalty;
  if (!hasBenefits) return null;

  const getBenefitDetails = (item: any, type: string) => {
    if (type === 'promo') {
      const isCashback = item.promotion_type === 'cashback';
      return {
        type: (isCashback ? 'Cashback' : 'Promoção') as any,
        title: item.title,
        benefit: isCashback 
          ? `${item.discount_value}% Cashback` 
          : (item.discount_type === 'percentage' ? `${item.discount_value}% OFF` : `R$ ${item.discount_value} OFF`),
        rule: `Até ${format(new Date(item.end_date), 'dd/MM')}`,
        icon: isCashback ? <Coins className="w-6 h-6" /> : <Tag className="w-6 h-6" />,
        colorClass: isCashback ? 'bg-indigo-600' : 'bg-emerald-600',
        glowClass: isCashback ? 'hover:shadow-indigo-500/10' : 'hover:shadow-emerald-500/10',
        fullRule: item.description || item.cashback_rules_text || 'Sem regras adicionais cadastradas.'
      };
    }
    if (type === 'loyalty') {
      return {
        type: 'Fidelidade' as const,
        title: 'Programa VIP da Casa',
        benefit: 'Acumule Pontos',
        rule: 'Uso Vitalício',
        icon: <Gift className="w-6 h-6" />,
        colorClass: 'bg-amber-600',
        glowClass: 'hover:shadow-amber-500/10',
        fullRule: item.rules_text || 'Acumule pontos em cada visita e troque por serviços ou produtos exclusivos.'
      };
    }
    return null;
  };

  const allBenefits = [
    ...promotions.map(p => ({ ...getBenefitDetails(p, 'promo'), id: p.id })),
    ...(loyalty ? [{ ...getBenefitDetails(loyalty, 'loyalty'), id: 'loyalty' }] : [])
  ];

  return (
    <section className="w-full space-y-8 animate-fade-in">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-6 bg-primary rounded-full" />
          <h2 className="text-xl font-black text-white tracking-tight uppercase italic">
            Benefícios <span className="text-primary">&</span> Vantagens
          </h2>
        </div>
        <button 
          onClick={() => setSelectedBenefit(allBenefits[0])}
          className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 hover:text-primary transition-colors"
        >
          Ver regras
        </button>
      </div>

      <div className={cn(
        "grid gap-5 px-2",
        allBenefits.length === 1 ? "grid-cols-1" : 
        allBenefits.length === 2 ? "grid-cols-1 md:grid-cols-2" : 
        "grid-cols-1 md:grid-cols-3"
      )}>
        {allBenefits.map((benefit: any) => (
          <BenefitCard
            key={benefit.id}
            {...benefit}
            onClick={() => setSelectedBenefit(benefit)}
          />
        ))}
      </div>

      <Dialog open={!!selectedBenefit} onOpenChange={() => setSelectedBenefit(null)}>
        <DialogContent className="bg-[#121212] border-white/10 text-white max-w-sm rounded-[2.5rem] overflow-hidden">
          <DialogHeader className="relative pb-6 border-b border-white/5">
            <div className={cn("absolute -top-20 -right-20 w-40 h-40 blur-[80px] opacity-30", selectedBenefit?.colorClass)} />
            
            <div className={cn("w-16 h-16 rounded-[2rem] flex items-center justify-center text-white mb-6 shadow-2xl relative z-10", selectedBenefit?.colorClass)}>
              {selectedBenefit?.icon}
            </div>
            
            <DialogTitle className="text-2xl font-black leading-tight mb-1 relative z-10">
              {selectedBenefit?.benefit}
            </DialogTitle>
            <DialogDescription className="text-primary font-bold uppercase tracking-widest text-[10px] relative z-10">
              {selectedBenefit?.type} — {selectedBenefit?.title}
            </DialogDescription>
          </DialogHeader>

          <div className="py-6 space-y-6">
            <div className="space-y-3">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-white/30 flex items-center gap-2">
                <Info className="w-3 h-3" />
                Regras e Condições
              </h4>
              <div className="p-5 rounded-3xl bg-white/5 border border-white/5">
                <p className="text-sm text-white/70 leading-relaxed">
                  {selectedBenefit?.fullRule}
                </p>
              </div>
            </div>
            
            <div className="flex items-center justify-between p-4 rounded-2xl bg-primary/5 border border-primary/10">
              <span className="text-[10px] font-black uppercase tracking-widest text-white/40">Validade</span>
              <span className="text-xs font-bold text-primary">{selectedBenefit?.rule}</span>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
};



