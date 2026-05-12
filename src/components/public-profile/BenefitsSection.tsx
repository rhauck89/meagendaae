import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { motion } from 'framer-motion';
import { Tag, Coins, Gift, Info, Sparkles, X, Check, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogPortal, DialogOverlay } from "@/components/ui/dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";

type BenefitType = 'Promoção' | 'Cashback' | 'Fidelidade';

interface BenefitItem {
  id: string;
  type: BenefitType;
  title: string;
  benefit: string;
  subtitle: string;
  rule: string;
  icon: React.ReactNode;
  /** tailwind solid bg for icon tile, e.g. 'bg-emerald-500' */
  accentBg: string;
  /** tailwind text color for accents, e.g. 'text-emerald-400' */
  accentText: string;
  /** rgba color for glow/border on hover */
  accentRgb: string;
  /** badge bg+text classes */
  badgeClass: string;
  fullRule: string;
  bullets: string[];
}

const PALETTE = {
  promo: {
    accentBg: 'bg-emerald-500',
    accentText: 'text-emerald-400',
    accentRgb: '16,185,129',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20',
  },
  cashback: {
    accentBg: 'bg-violet-500',
    accentText: 'text-violet-400',
    accentRgb: '139,92,246',
    badgeClass: 'bg-violet-500/10 text-violet-400 ring-1 ring-violet-500/20',
  },
  loyalty: {
    accentBg: 'bg-amber-500',
    accentText: 'text-amber-400',
    accentRgb: '245,158,11',
    badgeClass: 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20',
  },
};

const BenefitCard = ({ b, onClick }: { b: BenefitItem; onClick: () => void }) => (
  <motion.button
    type="button"
    onClick={onClick}
    whileHover={{ y: -2 }}
    transition={{ type: 'spring', stiffness: 300, damping: 22 }}
    style={{
      // CSS vars used on hover for individual glow/border
      ['--accent' as any]: b.accentRgb,
    }}
    className={cn(
      "group relative text-left w-full rounded-2xl p-4",
      "bg-white/[0.03] border border-white/5",
      "transition-all duration-200",
      "hover:bg-white/[0.05]",
      "hover:[border-color:rgba(var(--accent),0.35)]",
      "hover:[box-shadow:0_8px_30px_-10px_rgba(var(--accent),0.35)]",
      "focus:outline-none focus-visible:ring-2 focus-visible:ring-white/20"
    )}
  >
    {/* Header row: icon + badge + info */}
    <div className="flex items-start justify-between gap-3 mb-3">
      <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-lg", b.accentBg)}>
        {b.icon}
      </div>
      <div className="flex items-center gap-2">
        <span className={cn("text-[9px] font-bold uppercase tracking-[0.15em] px-2 py-1 rounded-md", b.badgeClass)}>
          {b.type}
        </span>
        <Info className="w-3.5 h-3.5 text-white/30 group-hover:text-white/60 transition-colors" />
      </div>
    </div>

    {/* Content */}
    <div className="space-y-1">
      <h3 className="text-base font-bold text-white leading-tight">
        {b.benefit}
      </h3>
      <p className="text-xs text-white/50 leading-snug line-clamp-1">
        {b.subtitle}
      </p>
    </div>

    {/* Footer rule */}
    <div className="mt-3 pt-3 border-t border-white/5">
      <span className={cn("text-[11px] font-semibold", b.accentText)}>
        {b.rule}
      </span>
    </div>
  </motion.button>
);

export interface BenefitsSectionProps {
  companyId: string;
  professionalId?: string;
}

export const BenefitsSection = ({ companyId, professionalId }: BenefitsSectionProps) => {
  const [promotions, setPromotions] = useState<any[]>([]);
  const [loyalty, setLoyalty] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<BenefitItem | null>(null);

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
            .maybeSingle(),
        ]);

        let filtered = promoRes.data || [];
        if (professionalId) {
          filtered = filtered.filter(
            (p) =>
              p.professional_filter === 'all' ||
              (p.professional_ids && p.professional_ids.includes(professionalId))
          );
        }
        setPromotions(filtered);
        setLoyalty(loyaltyRes.data);
      } catch (e) {
        console.error('Error fetching benefits:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [companyId, professionalId]);

  if (loading) return null;

  const items: BenefitItem[] = [];

  promotions.forEach((p) => {
    const isCashback = p.promotion_type === 'cashback';
    const palette = isCashback ? PALETTE.cashback : PALETTE.promo;
    const benefit = isCashback
      ? `${p.discount_value}% de volta`
      : p.discount_type === 'percentage'
      ? `${p.discount_value}% OFF`
      : `R$ ${p.discount_value} OFF`;
    items.push({
      id: p.id,
      type: isCashback ? 'Cashback' : 'Promoção',
      title: p.title,
      benefit,
      subtitle: isCashback ? 'em todos os serviços' : `em ${p.title}`,
      rule: `Válido até ${format(new Date(p.end_date), 'dd/MM')}`,
      icon: isCashback ? <Coins className="w-5 h-5" /> : <Tag className="w-5 h-5" />,
      ...palette,
      fullRule: p.description || p.cashback_rules_text || 'Sem regras adicionais cadastradas.',
      bullets: isCashback
        ? [
            'Válido para todos os serviços',
            'Créditos liberados em até 24h após o atendimento',
            'Créditos têm validade de 30 dias',
          ]
        : [
            `Desconto aplicado em ${p.title}`,
            'Válido apenas durante o período da promoção',
            'Não cumulativo com outras ofertas',
          ],
    });
  });

  if (loyalty) {
    items.push({
      id: 'loyalty',
      type: 'Fidelidade',
      title: 'Programa VIP da Casa',
      benefit: 'Acumule pontos',
      subtitle: 'e troque por vantagens',
      rule: 'Saiba mais',
      icon: <Gift className="w-5 h-5" />,
      ...PALETTE.loyalty,
      fullRule:
        loyalty.rules_text ||
        'Acumule pontos em cada visita e troque por serviços ou produtos exclusivos.',
      bullets: [
        'Pontos acumulados a cada atendimento',
        'Troque por serviços e produtos',
        'Benefícios exclusivos para clientes VIP',
      ],
    });
  }

  if (items.length === 0) return null;

  const gridCols =
    items.length === 1
      ? 'md:grid-cols-1'
      : items.length === 2
      ? 'md:grid-cols-2'
      : 'md:grid-cols-3';

  return (
    <section className="w-full px-2 animate-fade-in">
      <div
        className="rounded-3xl p-5 md:p-6 border border-white/5 backdrop-blur-md"
        style={{ background: 'rgba(15, 23, 42, 0.72)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <h2 className="text-[11px] md:text-xs font-semibold text-white/80 uppercase tracking-[0.2em]">
              Promoções e vantagens ativas
            </h2>
          </div>
          {items.length > 1 && (
            <button
              onClick={() => setSelected(items[0])}
              className="text-[11px] font-medium text-white/40 hover:text-white transition-colors flex items-center gap-1"
            >
              Ver todas
              <span className="opacity-60">›</span>
            </button>
          )}
        </div>

        {/* Cards grid */}
        <div className={cn('grid grid-cols-1 gap-3', gridCols)}>
          {items.map((b) => (
            <BenefitCard key={b.id} b={b} onClick={() => setSelected(b)} />
          ))}
        </div>
      </div>

      {/* Modal */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogPortal>
          <DialogOverlay className="bg-black/70 backdrop-blur-sm" />
          <DialogPrimitive.Content
            className={cn(
              "fixed left-[50%] top-[50%] z-50 w-[calc(100vw-2rem)] max-w-md translate-x-[-50%] translate-y-[-50%]",
              "rounded-3xl border border-white/[0.06] overflow-hidden",
              "data-[state=open]:animate-in data-[state=closed]:animate-out",
              "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
              "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
              "shadow-2xl"
            )}
            style={{
              background:
                'linear-gradient(180deg, rgba(17,24,39,0.98), rgba(10,15,30,0.98))',
            }}
          >
            {selected && (
              <div className="relative">
                {/* Accent glow */}
                <div
                  className="absolute -top-24 -right-24 w-56 h-56 rounded-full blur-[80px] pointer-events-none opacity-30"
                  style={{ background: `rgb(${selected.accentRgb})` }}
                />

                {/* Close */}
                <DialogPrimitive.Close
                  className="absolute top-4 right-4 z-20 w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/60 hover:text-white transition-colors"
                  aria-label="Fechar"
                >
                  <X className="w-4 h-4" />
                </DialogPrimitive.Close>

                {/* Header */}
                <div className="relative px-6 pt-6 pb-5">
                  <div
                    className={cn(
                      "w-14 h-14 rounded-2xl flex items-center justify-center text-white mb-4 shadow-xl",
                      selected.accentBg
                    )}
                  >
                    {selected.icon}
                  </div>
                  <DialogPrimitive.Title className="text-2xl font-bold text-white leading-tight">
                    {selected.benefit}
                  </DialogPrimitive.Title>
                  <DialogPrimitive.Description
                    className={cn(
                      "mt-1 text-[10px] font-bold uppercase tracking-[0.18em]",
                      selected.accentText
                    )}
                  >
                    {selected.type} — {selected.title}
                  </DialogPrimitive.Description>
                </div>

                <div className="h-px bg-white/[0.06]" />

                {/* Body */}
                <div className="relative px-6 py-5 space-y-5">
                  <div>
                    <h4 className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/40 mb-2">
                      Regras e condições
                    </h4>
                    <p className="text-sm text-white/75 leading-relaxed">
                      {selected.fullRule}
                    </p>
                  </div>

                  <ul className="space-y-2.5">
                    {selected.bullets.map((b, i) => (
                      <li key={i} className="flex items-start gap-2.5">
                        <Check className={cn("w-4 h-4 mt-0.5 shrink-0", selected.accentText)} />
                        <span className="text-sm text-white/70 leading-snug">{b}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="flex items-center justify-between p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
                    <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/40">
                      <Calendar className="w-3.5 h-3.5" />
                      Validade
                    </span>
                    <span className={cn("text-xs font-semibold", selected.accentText)}>
                      {selected.rule}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </DialogPrimitive.Content>
        </DialogPortal>
      </Dialog>
    </section>
  );
};
