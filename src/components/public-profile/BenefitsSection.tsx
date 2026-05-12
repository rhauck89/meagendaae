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
  glowColor: string;
  className?: string;
}

const BenefitCard = ({ title, description, badge, icon, gradient, glowColor, className }: BenefitCardProps) => (
  <motion.div
    whileHover={{ y: -8, scale: 1.02 }}
    whileTap={{ scale: 0.98 }}
    className={cn(
      "relative overflow-hidden rounded-[2rem] p-6 transition-all duration-500",
      "bg-white/5 backdrop-blur-xl border border-white/10",
      "hover:border-white/20 group cursor-pointer h-full flex flex-col justify-between",
      className
    )}
    style={{
      boxShadow: `0 20px 40px -20px ${glowColor}40`
    }}
  >
    {/* Glow Effect */}
    <div className={cn("absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-3xl -z-10", gradient)} style={{ transform: 'scale(1.2)' }} />
    
    <div className="relative z-10">
      <div className="flex justify-between items-start mb-6">
        <div className={cn("p-4 rounded-2xl text-white shadow-lg shadow-black/20 group-hover:scale-110 transition-transform duration-500", gradient)}>
          {icon}
        </div>
        {badge && (
          <div className="flex flex-col items-end">
             <span className="text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-full bg-white/10 text-white border border-white/10 backdrop-blur-md shadow-xl">
              {badge}
            </span>
          </div>
        )}
      </div>
      
      <div className="space-y-2">
        <h3 className="text-white font-black text-xl leading-tight group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-white/60 transition-all">
          {title}
        </h3>
        <p className="text-white/50 text-xs font-medium leading-relaxed line-clamp-2 group-hover:text-white/70 transition-colors">
          {description}
        </p>
      </div>
    </div>
    
    <div className="relative z-10 mt-8 pt-4 border-t border-white/5 flex items-center justify-between">
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/30 group-hover:text-white/60 transition-colors">
        Aproveitar agora
      </span>
      <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center group-hover:bg-white/20 transition-all group-hover:translate-x-1">
        <ChevronRight className="w-4 h-4 text-white/40 group-hover:text-white" />
      </div>
    </div>
    
    {/* Decorative Elements */}
    <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-white/5 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity" />
  </motion.div>
);

const SubscriptionCard = ({ name, description, benefits, price, status }: any) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true }}
    whileHover={{ y: -5 }}
    className={cn(
      "relative overflow-hidden rounded-[2.5rem] p-8 sm:p-10 transition-all duration-700",
      "bg-gradient-to-br from-[#1C1C1C] via-[#0F0F0F] to-[#050505] border border-yellow-500/20",
      "shadow-[0_20px_60px_-20px_rgba(234,179,8,0.15)] group"
    )}
  >
    {/* Premium Shine Effect */}
    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-1000 translate-x-[-100%] group-hover:translate-x-[100%] transform" />
    
    <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-yellow-500/10 rounded-full blur-[120px] -mr-64 -mt-64 group-hover:bg-yellow-500/20 transition-colors duration-700" />
    
    <div className="relative z-10 flex flex-col lg:flex-row gap-10 items-center justify-between">
      <div className="flex-1 space-y-8">
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="absolute inset-0 bg-yellow-500 blur-xl opacity-20 animate-pulse" />
            <div className="relative p-5 rounded-[1.5rem] bg-gradient-to-br from-yellow-400 to-amber-600 text-black shadow-2xl shadow-yellow-500/20">
              <Crown className="w-8 h-8" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse" />
              <span className="text-[11px] font-black uppercase tracking-[0.3em] text-yellow-500">Membro Premium</span>
            </div>
            <h3 className="text-3xl sm:text-4xl font-black text-white tracking-tighter uppercase italic">{name}</h3>
          </div>
        </div>
        
        <p className="text-white/50 text-base leading-relaxed max-w-xl">{description}</p>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {benefits.map((benefit: string, i: number) => (
            <motion.div 
              key={i} 
              initial={{ opacity: 0, x: -10 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all"
            >
              <div className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-500/20 flex items-center justify-center border border-yellow-500/30">
                <Check className="w-3.5 h-3.5 text-yellow-500" />
              </div>
              <span className="text-sm font-semibold text-white/80">{benefit}</span>
            </motion.div>
          ))}
        </div>
      </div>
      
      <div className="w-full lg:w-auto min-w-[320px]">
        <div className="relative overflow-hidden bg-white/5 rounded-[2rem] p-8 border border-white/10 backdrop-blur-md flex flex-col items-center gap-6 shadow-2xl shadow-black/40">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500 to-transparent opacity-50" />
          
          <div className="text-center">
            {status ? (
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-[0.4em] text-yellow-500 font-black mb-2">Seu Plano</p>
                <div className="px-6 py-2 rounded-full bg-yellow-500/10 border border-yellow-500/20">
                  <span className="text-xl font-black text-white">{status}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-1">
                <p className="text-[10px] uppercase tracking-[0.4em] text-white/40 font-black">Planos Mensais</p>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-sm font-bold text-white/40 italic">R$</span>
                  <span className="text-5xl font-black text-white tracking-tighter">{price || '99'}</span>
                  <span className="text-sm font-bold text-white/40 italic">/mês</span>
                </div>
              </div>
            )}
          </div>

          <div className="w-full space-y-3">
            <Button className="w-full h-14 bg-gradient-to-r from-yellow-400 to-amber-600 hover:from-yellow-300 hover:to-amber-500 text-black font-black uppercase tracking-[0.2em] text-xs rounded-2xl shadow-[0_15px_30px_-10px_rgba(234,179,8,0.4)] border-none transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]">
              Ver Benefícios
            </Button>
            <p className="text-[9px] text-white/30 text-center font-bold uppercase tracking-widest">Upgrade automático disponível</p>
          </div>
        </div>
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
  const [userSubscription, setUserSubscription] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { user, isAuthenticated } = useAuth();
  const scrollRef = useRef<HTMLDivElement>(null);

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

        // If authenticated, check user subscription
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
              // Get usage for this cycle (simplified)
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

  const totalBenefits = promotions.length + (loyalty ? 1 : 0) + 1; // +1 for Cashback card
  const hasBenefits = totalBenefits > 0;
  const hasSubscriptions = subscriptions.length > 0 || userSubscription;

  if (!hasBenefits && !hasSubscriptions) return null;

  return (
    <div className="w-full space-y-16 py-12 overflow-hidden">
      {hasBenefits && (
        <section className="space-y-8">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-4">
              <div className="relative">
                <div className="absolute inset-0 bg-primary blur-lg opacity-40 animate-pulse" />
                <div className="relative w-2 h-8 bg-gradient-to-b from-primary to-primary/20 rounded-full" />
              </div>
              <div>
                <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tighter italic">
                  Benefícios <span className="text-primary">&</span> Vantagens
                </h2>
                <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30 mt-1">Exclusivo para você</p>
              </div>
            </div>
            
            {totalBenefits > 3 && (
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Arraste para ver mais</span>
              </div>
            )}
          </div>
          
          <div 
            ref={scrollRef}
            className={cn(
              "grid gap-6 px-2",
              totalBenefits === 1 ? "grid-cols-1" :
              totalBenefits === 2 ? "grid-cols-1 sm:grid-cols-2" :
              totalBenefits === 3 ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" :
              "flex overflow-x-auto no-scrollbar pb-8 -mx-4 px-6 snap-x snap-mandatory lg:grid lg:grid-cols-3 lg:overflow-visible lg:mx-0 lg:px-0"
            )}
          >
            {promotions.map((promo) => (
              <div key={promo.id} className="min-w-[280px] sm:min-w-0 snap-center">
                <BenefitCard
                  title={promo.title}
                  description={promo.description || `Aproveite esta oferta especial válida até ${format(new Date(promo.end_date), "dd/MM", { locale: ptBR })}`}
                  badge={promo.discount_type === 'percentage' ? `${promo.discount_value}% OFF` : `DESCONTO`}
                  icon={<Tag className="w-6 h-6" />}
                  gradient="bg-gradient-to-br from-emerald-400 to-teal-600"
                  glowColor="#10b981"
                />
              </div>
            ))}
            
            <div className="min-w-[280px] sm:min-w-0 snap-center">
              <BenefitCard
                title="Cashback 10%"
                description="Receba parte do seu investimento de volta em todos os serviços realizados."
                icon={<Coins className="w-6 h-6" />}
                gradient="bg-gradient-to-br from-indigo-500 via-purple-600 to-blue-600"
                glowColor="#6366f1"
                badge="CASHBACK"
              />
            </div>

            {loyalty && (
              <div className="min-w-[280px] sm:min-w-0 snap-center">
                <BenefitCard
                  title="Programa Fidelidade"
                  description="Acumule pontos em cada visita e troque por serviços gratuitos ou brindes exclusivos."
                  icon={<Gift className="w-6 h-6" />}
                  gradient="bg-gradient-to-br from-amber-400 via-orange-500 to-yellow-600"
                  glowColor="#f59e0b"
                  badge="FIDELIDADE"
                />
              </div>
            )}

            {/* If more than 3, show a special "Agenda Aberta" card as a benefit if relevant */}
            {!professionalId && (
              <div className="min-w-[280px] sm:min-w-0 snap-center">
                <BenefitCard
                  title="Agenda Aberta"
                  description="Garanta seu horário com antecedência para os eventos mais badalados do mês."
                  icon={<Sparkles className="w-6 h-6" />}
                  gradient="bg-gradient-to-br from-rose-500 to-orange-600"
                  glowColor="#f43f5e"
                  badge="EVENTO"
                />
              </div>
            )}
          </div>
        </section>
      )}

      {hasSubscriptions && (
        <section className="space-y-8">
          <div className="flex items-center gap-4 px-2">
            <div className="relative">
              <div className="absolute inset-0 bg-yellow-500 blur-lg opacity-40 animate-pulse" />
              <div className="relative w-2 h-8 bg-gradient-to-b from-yellow-500 to-yellow-500/20 rounded-full" />
            </div>
            <div>
              <h2 className="text-2xl sm:text-3xl font-black text-white uppercase tracking-tighter italic">
                Membership <span className="text-yellow-500">Premium</span>
              </h2>
              <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30 mt-1">Clube de benefícios VIP</p>
            </div>
          </div>
          
          <div className="space-y-8 px-2">
            {userSubscription ? (
              <SubscriptionCard
                name={userSubscription.plan.name}
                description={userSubscription.plan.description || "Você é um membro VIP! Aproveite todos os benefícios exclusivos do seu plano."}
                benefits={userSubscription.plan.included_services_details || [
                  "Prioridade máxima na agenda",
                  "Cashback dobrado em serviços",
                  "Atendimento personalizado",
                  "Mimos e brindes mensais"
                ]}
                status={`${userSubscription.plan.usage_limit - userSubscription.usageCount} ${userSubscription.plan.usage_limit === 1 ? 'uso restante' : 'usos restantes'} no ciclo`}
              />
            ) : (
              subscriptions.map((sub) => (
                <SubscriptionCard
                  key={sub.id}
                  name={sub.name}
                  description={sub.description || "Torne-se um membro exclusivo e garanta benefícios únicos para seu visual."}
                  price={sub.price_monthly}
                  benefits={sub.included_services_details || [
                    "Prioridade na agenda",
                    "Cashback exclusivo",
                    "Descontos em produtos",
                    "Acesso a horários VIP"
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
