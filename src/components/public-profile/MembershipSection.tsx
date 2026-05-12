import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Crown, Check, Info, Sparkles, Calendar, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildWhatsAppUrl, trackWhatsAppClick } from '@/lib/whatsapp';

interface MembershipSectionProps {
  companyId: string;
  professionalId?: string;
}

export const MembershipSection = ({ companyId, professionalId }: MembershipSectionProps) => {
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState<{ company?: string; professional?: string }>({});

  useEffect(() => {
    if (!companyId) {
      console.log('[MembershipSection] No companyId provided');
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      console.log('[MembershipSection] companyId:', companyId);
      
      try {
        const [plansRes, companyRes, professionalRes] = await Promise.all([
          supabase
            .from('subscription_plans')
            .select('*')
            .eq('company_id', companyId)
            .eq('is_active', true)
            .order('price_monthly', { ascending: true }),
          supabase
            .from('public_company' as any)
            .select('whatsapp')
            .eq('id', companyId)
            .maybeSingle(),
          professionalId
            ? supabase
                .from('public_professionals' as any)
                .select('whatsapp')
                .eq('id', professionalId)
                .maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        ]);

        if (plansRes.error) {
          console.error('[MembershipSection] query error:', plansRes.error);
        } else {
          console.log('[MembershipSection] plans found:', plansRes.data?.length || 0, plansRes.data);
          setPlans(plansRes.data || []);
        }

        setContacts({
          company: (companyRes.data as any)?.whatsapp,
          professional: (professionalRes.data as any)?.whatsapp,
        });
      } catch (error) {
        console.error('[MembershipSection] unexpected error:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [companyId, professionalId]);

  if (loading || plans.length === 0) return null;

  const handlePlanClick = (planName: string) => {
    const targetWhatsApp = contacts.professional || contacts.company;
    if (!targetWhatsApp) return;

    const message = `Olá! Vi o plano de assinatura ${planName} no perfil e quero saber mais sobre como funciona.`;
    const url = buildWhatsAppUrl(targetWhatsApp, message);
    trackWhatsAppClick('public-profile');
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <section className="w-full px-2 animate-fade-in mb-6">
      <div
        className="rounded-3xl p-5 md:p-6 border border-white/5 backdrop-blur-md"
        style={{ background: 'rgba(15, 23, 42, 0.72)' }}
      >
        {/* Header */}
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <h2 className="text-[11px] md:text-xs font-semibold text-white/80 uppercase tracking-[0.2em]">
            Assinatura ativa
          </h2>
        </div>

        {/* Plans list */}
        <div className="space-y-3">
          {plans.map((plan) => (
            <motion.button
              key={plan.id}
              type="button"
              onClick={() => handlePlanClick(plan.name)}
              whileHover={{ y: -2 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              className={cn(
                "group relative text-left w-full rounded-2xl p-4 md:p-5",
                "bg-white/[0.03] border border-white/5",
                "transition-all duration-200",
                "hover:bg-white/[0.05]",
                "hover:border-amber-500/30",
                "hover:shadow-[0_8px_30px_-10px_rgba(245,158,11,0.2)]",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/20"
              )}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-start gap-4">
                  {/* Icon Tile */}
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-black shadow-lg shrink-0">
                    <Crown className="w-6 h-6 md:w-7 md:h-7" />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base md:text-lg font-bold text-white leading-tight">
                        {plan.name}
                      </h3>
                      <span className="text-[9px] font-bold uppercase tracking-[0.15em] px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20">
                        Ativo
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="text-xs text-white/50 flex items-center gap-1.5">
                        <Check className="w-3 h-3 text-amber-500" />
                        {plan.included_services?.length || 0} serviços inclusos
                      </span>
                      <span className="text-xs text-white/50 flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-amber-500" />
                        Limite: {plan.usage_limit} usos/mês
                      </span>
                    </div>
                    
                    {plan.description && (
                      <p className="text-[11px] text-white/40 italic line-clamp-1 mt-1">
                        "{plan.description}"
                      </p>
                    )}
                  </div>
                </div>

                {/* Price Section */}
                <div className="flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center gap-2 pt-3 md:pt-0 border-t md:border-t-0 border-white/5">
                  <div className="flex flex-col md:items-end">
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg md:text-2xl font-bold text-white tracking-tight">
                        R$ {plan.price_monthly.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                      <span className="text-[10px] font-semibold text-white/30 uppercase">/mês</span>
                    </div>
                    {plan.price_yearly && (
                      <span className="text-[10px] font-bold text-amber-500/70 uppercase tracking-wider">
                        Anual: R$ {plan.price_yearly.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5 text-[10px] font-bold text-white/60 group-hover:bg-amber-500/10 group-hover:text-amber-400 group-hover:border-amber-500/20 transition-all">
                    <MessageCircle className="w-3 h-3" />
                    <span className="hidden md:inline">Saber mais no WhatsApp</span>
                    <span className="md:hidden">Saber mais</span>
                  </div>
                </div>
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </section>
  );
};
