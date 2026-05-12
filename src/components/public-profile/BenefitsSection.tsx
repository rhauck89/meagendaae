import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Tag, Coins, Gift, ChevronRight, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface BenefitCardProps {
  type: 'Promoção' | 'Cashback' | 'Fidelidade';
  title: string;
  benefit: string;
  rule: string;
  icon: React.ReactNode;
  color: string;
  onClick: () => void;
}

const BenefitCard = ({ type, title, benefit, rule, icon, color, onClick }: BenefitCardProps) => (
  <motion.div
    whileHover={{ y: -4 }}
    className="group relative bg-[#1A1A1A] border border-white/5 rounded-2xl p-4 flex flex-col justify-between hover:border-white/10 transition-all cursor-pointer"
    onClick={onClick}
  >
    <div className="flex items-start gap-3">
      <div className={cn("p-2 rounded-xl text-white shadow-lg", color)}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-0.5">{type}</p>
        <h3 className="text-sm font-bold text-white truncate group-hover:text-primary transition-colors">{title}</h3>
        <p className="text-xs font-medium text-primary mt-1">{benefit}</p>
      </div>
      <Info className="w-4 h-4 text-white/10 group-hover:text-white/30 transition-colors" />
    </div>
    <div className="mt-4 pt-3 border-t border-white/5">
      <p className="text-[10px] text-white/40 truncate">{rule}</p>
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
      return {
        type: 'Promoção' as const,
        title: item.title,
        benefit: item.discount_type === 'percentage' ? `${item.discount_value}% OFF` : `R$ ${item.discount_value} OFF`,
        rule: `Válido até ${format(new Date(item.end_date), 'dd/MM')}`,
        icon: <Tag className="w-4 h-4" />,
        color: 'bg-emerald-500',
        fullRule: item.description || item.cashback_rules_text || 'Sem regras adicionais cadastradas.'
      };
    }
    if (type === 'loyalty') {
      return {
        type: 'Fidelidade' as const,
        title: 'Programa VIP',
        benefit: 'Acumule Pontos',
        rule: 'Troque por recompensas',
        icon: <Gift className="w-4 h-4" />,
        color: 'bg-amber-500',
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
    <section className="w-full space-y-6">
      <div className="flex items-center gap-3 px-2">
        <div className="w-1.5 h-6 bg-primary rounded-full" />
        <h2 className="text-xl font-bold text-white tracking-tight uppercase italic">
          Benefícios <span className="text-primary">&</span> Vantagens
        </h2>
      </div>

      <div className={cn(
        "grid gap-4 px-2",
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
        <DialogContent className="bg-[#121212] border-white/10 text-white max-w-sm">
          <DialogHeader>
            <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center text-white mb-4 shadow-lg", selectedBenefit?.color)}>
              {selectedBenefit?.icon}
            </div>
            <DialogTitle className="text-xl font-bold">{selectedBenefit?.title}</DialogTitle>
            <DialogDescription className="text-primary font-semibold">
              {selectedBenefit?.benefit}
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-white/40 mb-3">Regras do Benefício</h4>
            <div className="p-4 rounded-2xl bg-white/5 border border-white/5">
              <p className="text-sm text-white/70 leading-relaxed">
                {selectedBenefit?.fullRule}
              </p>
            </div>
            <p className="text-[10px] text-white/20 mt-4 uppercase tracking-widest text-center">
              {selectedBenefit?.rule}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
};

