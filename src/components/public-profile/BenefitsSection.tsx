import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion, AnimatePresence } from 'framer-motion';
import { Tag, Coins, Gift, Crown, ChevronRight, Check, Star, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';

interface BenefitCardProps {
  title: string;
  description: string;
  badge?: string;
  icon: React.ReactNode;
  gradient: string;
  glowColor?: string;
  className?: string;
}

const BenefitCard = ({ title, description, badge, icon, gradient, glowColor, className }: BenefitCardProps) => (
  <motion.div
    whileHover={{ y: -8, scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    className={cn(
      "relative overflow-hidden rounded-[2.5rem] p-7 transition-all duration-500",
      "bg-white/5 backdrop-blur-2xl border border-white/10",
      "hover:border-white/20 group cursor-pointer h-full flex flex-col justify-between",
      className
    )}
    style={{
      boxShadow: glowColor ? `0 20px 40px -20px ${glowColor}40` : 'none'
    }}
  >
    {/* Glow Effect */}
    <div className={cn("absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-700 blur-3xl -z-10", gradient)} style={{ transform: 'scale(1.5)' }} />
    
    <div className="relative z-10">
      <div className="flex justify-between items-start mb-8">
        <div className={cn("p-4 rounded-2xl text-white shadow-2xl transition-all duration-500 group-hover:scale-110 group-hover:rotate-3", gradient)}>
          {icon}
        </div>
        {badge && (
          <div className="flex flex-col items-end">
             <span className="text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 rounded-full bg-white/10 text-white border border-white/10 backdrop-blur-md shadow-2xl">
              {badge}
            </span>
          </div>
        )}
      </div>
      
      <div className="space-y-3">
        <h3 className="text-white font-black text-2xl leading-tight tracking-tight group-hover:text-primary transition-colors">
          {title}
        </h3>
        <p className="text-white/40 text-sm font-medium leading-relaxed line-clamp-2 group-hover:text-white/60 transition-colors">
          {description}
        </p>
      </div>
    </div>
    
    <div className="relative z-10 mt-10 pt-6 border-t border-white/5 flex items-center justify-between">
      <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 group-hover:text-primary transition-colors">
        Aproveitar agora
      </span>
      <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-primary/20 transition-all group-hover:translate-x-1">
        <ChevronRight className="w-5 h-5 text-white/20 group-hover:text-primary" />
      </div>
    </div>
  </motion.div>
);

const SubscriptionCard = ({ name, description, benefits, price, status }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 40 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    className={cn(
      "relative overflow-hidden rounded-[3rem] p-8 sm:p-12 transition-all duration-1000",
      "bg-gradient-to-br from-[#121212] via-[#0A0A0A] to-black border border-white/5",
      "shadow-[0_40px_100px_-40px_rgba(0,0,0,0.8)] group"
    )}
  >
    {/* Luxury Glow */}
    <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/10 rounded-full blur-[150px] -mr-80 -mt-80 group-hover:bg-primary/20 transition-all duration-1000" />
    <div className="absolute -left-20 -bottom-20 w-80 h-80 bg-primary/5 rounded-full blur-[100px] animate-pulse" />
    
    {/* Glass Shine */}
    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000 translate-x-[-100%] group-hover:translate-x-[100%] transform" />

    <div className="relative z-10 flex flex-col xl:flex-row gap-12 items-center justify-between">
      <div className="flex-1 space-y-10">
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className="absolute inset-0 bg-primary blur-2xl opacity-30 animate-pulse" />
            <div className="relative p-6 rounded-[2rem] bg-gradient-to-br from-primary to-primary/60 text-black shadow-2xl shadow-primary/30 transform group-hover:rotate-6 transition-transform duration-500">
              <Crown className="w-10 h-10" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-primary animate-ping" />
              <span className="text-[12px] font-black uppercase tracking-[0.5em] text-primary/80">Membership VIP</span>
            </div>
            <h3 className="text-4xl sm:text-5xl font-black text-white tracking-tighter uppercase italic group-hover:tracking-normal transition-all duration-700">{name}</h3>
          </div>
        </div>
        
        <p className="text-white/40 text-lg leading-relaxed max-w-2xl font-medium">{description}</p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {benefits.map((benefit: string, i: number) => (
            <div 
              key={i} 
              className="flex items-center gap-4 p-4 rounded-3xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 hover:scale-[1.02] transition-all cursor-default"
            >
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                <Check className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm font-bold text-white/70 tracking-tight">{benefit}</span>
            </div>
          ))}
        </div>
      </div>
      
      <div className="w-full xl:w-auto min-w-[340px]">
        <div className="relative overflow-hidden bg-white/5 rounded-[3rem] p-10 border border-white/10 backdrop-blur-3xl flex flex-col items-center gap-8 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)]">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50" />
          
          <div className="text-center space-y-2">
            {status ? (
              <div className="space-y-4">
                <p className="text-[11px] uppercase tracking-[0.5em] text-primary font-black">Status do Plano</p>
                <div className="px-8 py-3 rounded-2xl bg-primary/10 border border-primary/20 shadow-inner">
                  <span className="text-2xl font-black text-white italic">{status}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] uppercase tracking-[0.5em] text-white/30 font-black">Investimento Mensal</p>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-lg font-bold text-white/30 italic">R$</span>
                  <span className="text-6xl font-black text-white tracking-tighter">{price || '99'}</span>
                  <span className="text-lg font-bold text-white/30 italic">/mês</span>
                </div>
              </div>
            )}
          </div>

          <div className="w-full space-y-4">
            <Button className="w-full h-16 bg-primary hover:bg-primary/90 text-black font-black uppercase tracking-[0.3em] text-xs rounded-2xl shadow-[0_20px_40px_-10px_rgba(var(--brand-primary-hsl),0.5)] border-none transition-all duration-500 hover:scale-[1.03] active:scale-[0.97]">
              Explorar Benefícios
            </Button>
            <div className="flex items-center justify-center gap-2 opacity-20">
              <div className="w-1 h-1 rounded-full bg-white" />
              <p className="text-[10px] text-white text-center font-black uppercase tracking-[0.3em]">Acesso Imediato</p>
              <div className="w-1 h-1 rounded-full bg-white" />
            </div>
          </div>
        </div>
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
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [userSubscription, setUserSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { user, isAuthenticated } = useAuth();

  useEffect(() => {
    if (!companyId) return;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        const [promoRes, loyaltyRes, subRes] = await Promise.all([
          supabase
            .from('promotions')
            .select('*')
            .eq('company_id', companyId)
            .eq('status', 'active')
            .gte('end_date', new Date().toISOString().split('T')[0])
            .then(res => {
              if (professionalId) {
                return { ...res, data: (res.data || []).filter(p => p.professional_filter === 'all' || (p.professional_ids && p.professional_ids.includes(professionalId))) };
              }
              return res;
            }),
          supabase
            .from('loyalty_config')
            .select('*')
            .eq('company_id', companyId)
            .eq('enabled', true)
            .maybeSingle(),
          supabase
            .from('subscription_plans')
            .select('*')
            .eq('company_id', companyId)
            .eq('is_active', true)
        ]);

        setPromotions(promoRes.data || []);
        setLoyalty(loyaltyRes.data);
        setSubscriptions(subRes.data || []);

        if (isAuthenticated && user) {
          const { data: client } = await supabase
            .from('clients')
            .select('id')
            .eq('user_id', user.id)
            .eq('company_id', companyId)
            .maybeSingle();
          
          if (client) {
            const { data: userSub } = await supabase
              .from('client_subscriptions')
              .select('*, plan:subscription_plans(*)')
              .eq('client_id', client.id)
              .eq('status', 'active')
              .maybeSingle();
            
            if (userSub) {
              const { count } = await supabase
                .from('subscription_usage')
                .select('*', { count: 'exact', head: true })
                .eq('subscription_id', userSub.id);
              
              setUserSubscription({
                ...userSub,
                usageCount: count || 0
              });
            }
          }
        }
      } catch (error) {
        console.error('Error fetching benefits:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [companyId, professionalId, user, isAuthenticated]);

  if (loading) return null;

  const hasBenefits = promotions.length > 0 || loyalty;
  const hasSubscriptions = subscriptions.length > 0 || userSubscription;

  if (!hasBenefits && !hasSubscriptions) return null;

  return (
    <div className="w-full space-y-20 py-16 overflow-hidden">
      {hasBenefits && (
        <section className="space-y-10">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-5">
              <div className="relative">
                <div className="absolute inset-0 bg-primary blur-2xl opacity-40 animate-pulse" />
                <div className="relative w-2.5 h-10 bg-gradient-to-b from-primary to-primary/20 rounded-full" />
              </div>
              <div>
                <h2 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tighter italic leading-none">
                  Benefícios <span className="text-primary">&</span> Vantagens
                </h2>
                <p className="text-[11px] font-black uppercase tracking-[0.5em] text-white/20 mt-2">Oportunidades exclusivas</p>
              </div>
            </div>
            
            {(promotions.length + (loyalty ? 1 : 0) + 1) > 3 && (
              <div className="hidden sm:flex items-center gap-3 px-4 py-2 rounded-full bg-white/5 border border-white/10 backdrop-blur-md">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">Deslize para explorar</span>
              </div>
            )}
          </div>
          
          <div 
            className={cn(
              "grid gap-8 px-2",
              (promotions.length + (loyalty ? 1 : 0) + 1) === 1 ? "grid-cols-1" :
              (promotions.length + (loyalty ? 1 : 0) + 1) === 2 ? "grid-cols-1 sm:grid-cols-2" :
              (promotions.length + (loyalty ? 1 : 0) + 1) === 3 ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" :
              "flex overflow-x-auto no-scrollbar pb-10 -mx-4 px-6 snap-x snap-mandatory lg:grid lg:grid-cols-3 lg:overflow-visible lg:mx-0 lg:px-0"
            )}
          >
            {promotions.map((promo) => (
              <div key={promo.id} className="min-w-[300px] sm:min-w-0 snap-center">
                <BenefitCard
                  title={promo.title}
                  description={promo.description || `Oferta especial válida até ${format(new Date(promo.end_date), "dd 'de' MMMM", { locale: ptBR })}`}
                  badge={promo.discount_type === 'percentage' ? `${promo.discount_value}% OFF` : `PROMO`}
                  icon={<Tag className="w-7 h-7" />}
                  gradient="bg-gradient-to-br from-emerald-400 via-teal-500 to-emerald-600"
                  glowColor="#10b981"
                />
              </div>
            ))}
            
            <div className="min-w-[300px] sm:min-w-0 snap-center">
              <BenefitCard
                title="Cashback 10%"
                description="Receba parte do seu investimento de volta em créditos para seus próximos atendimentos."
                icon={<Coins className="w-7 h-7" />}
                gradient="bg-gradient-to-br from-indigo-500 via-purple-600 to-blue-600"
                glowColor="#6366f1"
                badge="CASHBACK"
              />
            </div>

            {loyalty && (
              <div className="min-w-[300px] sm:min-w-0 snap-center">
                <BenefitCard
                  title="Fidelidade VIP"
                  description="Acumule pontos em cada visita e troque por serviços premium ou cortesias exclusivas."
                  icon={<Gift className="w-7 h-7" />}
                  gradient="bg-gradient-to-br from-amber-400 via-orange-500 to-yellow-600"
                  glowColor="#f59e0b"
                  badge="FIDELIDADE"
                />
              </div>
            )}
          </div>
        </section>
      )}

      {hasSubscriptions && (
        <section className="space-y-10">
          <div className="flex items-center gap-5 px-2">
            <div className="relative">
              <div className="absolute inset-0 bg-primary blur-2xl opacity-40 animate-pulse" />
              <div className="relative w-2.5 h-10 bg-gradient-to-b from-primary to-primary/20 rounded-full" />
            </div>
            <div>
              <h2 className="text-3xl sm:text-4xl font-black text-white uppercase tracking-tighter italic leading-none">
                Membership <span className="text-primary">Premium</span>
              </h2>
              <p className="text-[11px] font-black uppercase tracking-[0.5em] text-white/20 mt-2">Clube de benefícios VIP</p>
            </div>
          </div>
          
          <div className="space-y-12 px-2">
            {userSubscription ? (
              <SubscriptionCard
                name={userSubscription.plan.name}
                description={userSubscription.plan.description || "Você faz parte da nossa elite! Aproveite todos os benefícios exclusivos do seu plano."}
                benefits={userSubscription.plan.included_services_details || [
                  "Prioridade máxima na agenda",
                  "Cashback dobrado em serviços",
                  "Atendimento personalizado VIP",
                  "Cortesias e mimos mensais"
                ]}
                status={`${userSubscription.plan.usage_limit - userSubscription.usageCount} ${userSubscription.plan.usage_limit === 1 ? 'uso restante' : 'usos restantes'} no ciclo`}
              />
            ) : (
              subscriptions.map((sub) => (
                <SubscriptionCard
                  key={sub.id}
                  name={sub.name}
                  description={sub.description || "Torne-se um membro exclusivo e garanta benefícios únicos para elevar seu visual ao próximo nível."}
                  price={sub.price_monthly}
                  benefits={sub.included_services_details || [
                    "Prioridade total na agenda",
                    "Cashback exclusivo VIP",
                    "Descontos em toda linha de produtos",
                    "Acesso antecipado a horários nobres"
                  ]}
                />
              ))
            )}
          </div>
        </section>
      )}
    </div>
  );
};
