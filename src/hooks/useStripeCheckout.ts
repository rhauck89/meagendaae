import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function useStripeCheckout() {
  const [loading, setLoading] = useState(false);
  const { companyId } = useAuth();

  const openCheckout = async (opts: {
    planId: string;
    cycle: 'monthly' | 'yearly';
    intentType?: string;
    successUrl?: string;
    cancelUrl?: string;
  }) => {
    if (!companyId) {
      toast.error('Empresa não encontrada para iniciar o checkout.');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-stripe-checkout', {
        body: {
          companyId,
          planId: opts.planId,
          cycle: opts.cycle,
          intentType: opts.intentType || 'subscribe',
          successUrl: opts.successUrl || `${window.location.origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: opts.cancelUrl || `${window.location.origin}/settings/plans`,
        },
      });

      if (error) throw error;
      if (!data?.url) throw new Error('Checkout do Stripe não retornou uma URL.');

      window.location.href = data.url;
    } catch (error: any) {
      console.error('Stripe checkout error:', error);
      toast.error(error?.message || 'Não foi possível abrir o checkout do Stripe.');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  return { openCheckout, loading };
}
