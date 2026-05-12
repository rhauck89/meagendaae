import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Tag, Coins, Gift, Crown, ChevronRight, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface BenefitCardProps {
  title: string;
  description: string;
  badge?: string;
  icon: React.ReactNode;
  gradient: string;
  className?: string;
}

const BenefitCard = ({ title, description, badge, icon, gradient, className }: BenefitCardProps) => (
  <motion.div
    whileHover={{ y: -4, scale: 1.02 }}
    className={cn(
      "relative overflow-hidden rounded-2xl p-5 transition-all duration-300",
      "bg-white/5 backdrop-blur-md border border-white/10",
      "hover:shadow-[0_8px_32px_rgba(0,0,0,0.12)] hover:border-white/20",
      "group cursor-pointer",
      className
    )}
  >
    <div className={cn("absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity", gradient)} />
    
    <div className="relative z-10 flex flex-col h-full">
      <div className="flex justify-between items-start mb-4">
        <div className={cn("p-2.5 rounded-xl bg-white/10 text-white shadow-inner", gradient)}>
          {icon}
        </div>
        {badge && (
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-white/10 text-white/90 border border-white/10 backdrop-blur-sm">
            {badge}
          </span>
        )}
      </div>
      
      <h3 className="text-white font-bold text-lg mb-1 leading-tight">{title}</h3>
      <p className="text-white/60 text-xs leading-relaxed">{description}</p>
      
      <div className="mt-4 flex items-center text-[10px] font-medium text-white/40 group-hover:text-white/70 transition-colors uppercase tracking-widest">
        Ver detalhes
        <ChevronRight className="w-3 h-3 ml-1 transition-transform group-hover:translate-x-1" />
      </div>
    </div>
    
    <div className="absolute -right-4 -bottom-4 w-24 h-24 bg-white/5 rounded-full blur-2xl group-hover:bg-white/10 transition-colors" />
  </motion.div>
);

interface SubscriptionCardProps {
  name: string;
  description: string;
  benefits: string[];
  status?: string;
}

const SubscriptionCard = ({ name, description, benefits, status }: SubscriptionCardProps) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    whileHover={{ y: -4 }}
    className={cn(
      "relative overflow-hidden rounded-3xl p-6 sm:p-8 transition-all duration-500",
      "bg-gradient-to-br from-[#1A1A1A] to-[#0A0A0A] border border-yellow-500/20",
      "shadow-[0_0_40px_rgba(234,179,8,0.05)] hover:shadow-[0_0_60px_rgba(234,179,8,0.1)]",
      "group"
    )}
  >
    <div className="absolute top-0 right-0 w-64 h-64 bg-yellow-500/10 rounded-full blur-[80px] -mr-32 -mt-32" />
    <div className="absolute bottom-0 left-0 w-48 h-48 bg-yellow-600/5 rounded-full blur-[60px] -ml-24 -mb-24" />
    
    <div className="relative z-10 flex flex-col md:flex-row gap-6 md:items-center justify-between">
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-3 rounded-2xl bg-yellow-500/10 border border-yellow-500/20 text-yellow-500">
            <Crown className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-yellow-500/80">Membro Premium</span>
            <h3 className="text-2xl font-black text-white tracking-tight uppercase">{name}</h3>
          </div>
        </div>
        
        <p className="text-white/50 text-sm mb-6 max-w-md">{description}</p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
          {benefits.map((benefit, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-white/70">
              <div className="flex-shrink-0 w-4 h-4 rounded-full bg-yellow-500/10 flex items-center justify-center border border-yellow-500/20">
                <Check className="w-2.5 h-2.5 text-yellow-500" />
              </div>
              {benefit}
            </div>
          ))}
        </div>
      </div>
      
      <div className="flex flex-col items-center gap-4 bg-white/5 rounded-2xl p-6 border border-white/10 backdrop-blur-sm min-w-[200px]">
        {status ? (
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Status atual</p>
            <p className="text-lg font-bold text-white">{status}</p>
          </div>
        ) : (
          <div className="text-center">
            <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1">A partir de</p>
            <p className="text-2xl font-black text-white">R$ 99<span className="text-sm font-normal text-white/50">/mês</span></p>
          </div>
        )}
        <Button className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-black uppercase tracking-widest text-xs h-12 shadow-[0_8px_20px_rgba(234,179,8,0.3)] border-none">
          Ver Benefícios
        </Button>
      </div>
    </div>
  </motion.div>
);

interface BenefitsSectionProps {
  companyId: string;
  professionalId?: string;
}

export const BenefitsSection = ({ companyId, professionalId }: BenefitsSectionProps) => {
  const [promotions, setPromotions] = useState<any[]>([]);
  const [loyalty, setLoyalty] = useState<any>(null);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) return;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch active promotions
        let query = supabase
          .from('promotions')
          .select('*')
          .eq('company_id', companyId)
          .eq('status', 'active')
          .gte('end_date', new Date().toISOString().split('T')[0]);

        if (professionalId) {
          // Filter promotions for specific professional or "all"
          query = query.or(`professional_ids.cs.{${professionalId}},professional_filter.eq.all`);
        }

        const { data: promoData } = await query;
        setPromotions(promoData || []);

        // Fetch loyalty config
        const { data: loyaltyData } = await supabase
          .from('loyalty_config')
          .select('*')
          .eq('company_id', companyId)
          .eq('enabled', true)
          .maybeSingle();
        setLoyalty(loyaltyData);

        // Fetch subscription plans
        const { data: subData } = await supabase
          .from('subscription_plans')
          .select('*')
          .eq('company_id', companyId)
          .eq('is_active', true);
        setSubscriptions(subData || []);

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
  const hasSubscriptions = subscriptions.length > 0;

  if (!hasBenefits && !hasSubscriptions) return null;

  return (
    <div className="w-full space-y-12 py-8">
      {hasBenefits && (
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-gradient-to-b from-primary to-primary/40 rounded-full" />
            <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">Benefícios e Vantagens</h2>
          </div>
          
          <div className={cn(
            "grid gap-4",
            promotions.length + (loyalty ? 1 : 0) === 1 ? "grid-cols-1" :
            promotions.length + (loyalty ? 1 : 0) === 2 ? "grid-cols-1 sm:grid-cols-2" :
            "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
            promotions.length + (loyalty ? 1 : 0) > 3 && "lg:grid-cols-3"
          )}>
            {promotions.map((promo) => (
              <BenefitCard
                key={promo.id}
                title={promo.title}
                description={promo.description || `Válido até ${format(new Date(promo.end_date), "dd/MM", { locale: ptBR })}`}
                badge={promo.discount_type === 'percentage' ? `${promo.discount_value}% OFF` : `OFF`}
                icon={<Tag className="w-5 h-5" />}
                gradient="bg-gradient-to-br from-emerald-500 to-teal-600"
              />
            ))}
            
            {/* Mock Cashback card if no specific promotion but table exists (conceptual) */}
            <BenefitCard
              title="Cashback 10%"
              description="Em todos os serviços. Ganhe R$10 de volta"
              icon={<Coins className="w-5 h-5" />}
              gradient="bg-gradient-to-br from-indigo-500 to-blue-600"
            />

            {loyalty && (
              <BenefitCard
                title="Programa Fidelidade"
                description="Acumule pontos e troque por vantagens exclusivas"
                icon={<Gift className="w-5 h-5" />}
                gradient="bg-gradient-to-br from-amber-400 to-orange-600"
              />
            )}
          </div>
        </section>
      )}

      {hasSubscriptions && (
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-gradient-to-b from-yellow-500 to-yellow-500/40 rounded-full" />
            <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-tight">Assinatura / Membership</h2>
          </div>
          
          <div className="space-y-4">
            {subscriptions.map((sub) => (
              <SubscriptionCard
                key={sub.id}
                name={sub.name}
                description={sub.description || "Torne-se um membro exclusivo e garanta benefícios únicos para seu visual."}
                benefits={sub.included_services_details || [
                  "Prioridade na agenda",
                  "Cashback dobrado",
                  "Serviços exclusivos",
                  "Descontos em produtos"
                ]}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
};
