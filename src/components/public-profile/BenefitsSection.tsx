import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Tag, Coins, Gift, ChevronRight, Info, Sparkles } from 'lucide-react';
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
  bgClass: string;
  onClick: () => void;
}

const BenefitCard = ({ type, title, benefit, rule, icon, colorClass, bgClass, onClick }: BenefitCardProps) => (
  <motion.div
    whileHover={{ y: -2, scale: 1.01 }}
    className={cn(
      "flex-shrink-0 w-[280px] md:w-full min-h-[100px] bg-white/5 border border-white/5 rounded-2xl p-4 flex gap-4 transition-all cursor-pointer relative overflow-hidden group",
      "hover:border-white/10 hover:bg-white/[0.07]"
    )}
    onClick={onClick}
  >
    {/* Background accent */}
    <div className={cn("absolute -top-8 -right-8 w-16 h-16 blur-[30px] opacity-10 group-hover:opacity-20 transition-opacity", colorClass)} />
    
    {/* Left Icon - Square Rounded */}
    <div className={cn("w-12 h-12 shrink-0 rounded-xl flex items-center justify-center text-white shadow-lg", colorClass)}>
      {icon}
    </div>

    {/* Content */}
    <div className="flex-1 min-w-0 flex flex-col justify-center">
      <div className="flex items-center gap-2 mb-1">
        <span className={cn("text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md", bgClass)}>
          {type}
        </span>
      </div>
      <h3 className="text-sm font-black text-white leading-tight truncate group-hover:text-primary transition-colors">
        {benefit}
      </h3>
      <p className="text-[10px] font-bold text-white/40 truncate mt-0.5">
        {title}
      </p>
      
      {/* Small bottom line decoration */}
      <div className={cn("h-0.5 w-6 rounded-full mt-2 transition-all group-hover:w-12", colorClass)} />
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
        icon: isCashback ? <Coins className="w-5 h-5" /> : <Tag className="w-5 h-5" />,
        colorClass: isCashback ? 'bg-purple-600' : 'bg-emerald-600',
        bgClass: isCashback ? 'bg-purple-500/10 text-purple-400' : 'bg-emerald-500/10 text-emerald-400',
        fullRule: item.description || item.cashback_rules_text || 'Sem regras adicionais cadastradas.'
      };
    }
    if (type === 'loyalty') {
      return {
        type: 'Fidelidade' as const,
        title: 'Programa VIP da Casa',
        benefit: 'Fidelidade VIP',
        rule: 'Uso Vitalício',
        icon: <Gift className="w-5 h-5" />,
        colorClass: 'bg-amber-600',
        bgClass: 'bg-amber-500/10 text-amber-400',
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
    <section className="w-full px-2 animate-fade-in">
      <div className="bg-black/20 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-5 md:p-6 shadow-2xl relative overflow-hidden group">
        {/* Subtle Glows */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-amber-500/5 blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-primary/5 blur-[100px] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity" />

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
            <h2 className="text-[11px] font-black text-white/90 uppercase tracking-[0.2em]">
              Promoções e vantagens ativas
            </h2>
          </div>
          <button 
            onClick={() => setSelectedBenefit(allBenefits[0])}
            className="text-[10px] font-black uppercase tracking-widest text-white/30 hover:text-primary transition-colors flex items-center gap-1 group/btn"
          >
            Ver todas
            <span className="opacity-50 group-hover/btn:translate-x-1 transition-transform">›</span>
          </button>
        </div>

        {/* Cards Container - Horizontal Scroll on Mobile, Grid on Desktop */}
        <div className={cn(
          "flex gap-4 overflow-x-auto pb-2 no-scrollbar md:pb-0",
          allBenefits.length === 1 ? "md:grid-cols-1" : 
          allBenefits.length === 2 ? "md:grid md:grid-cols-2" : 
          "md:grid md:grid-cols-3"
        )}>
          {allBenefits.map((benefit: any) => (
            <BenefitCard
              key={benefit.id}
              {...benefit}
              onClick={() => setSelectedBenefit(benefit)}
            />
          ))}
        </div>
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




