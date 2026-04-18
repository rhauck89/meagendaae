import { useState } from "react";
import { initializePaddle, getPaddlePriceId } from "@/lib/paddle";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function usePaddleCheckout() {
  const [loading, setLoading] = useState(false);
  const { user, companyId } = useAuth();

  const openCheckout = async (opts: {
    priceId: string;
    successUrl?: string;
    customData?: Record<string, string>;
  }) => {
    setLoading(true);
    try {
      await initializePaddle();
      const paddlePriceId = await getPaddlePriceId(opts.priceId);

      window.Paddle.Checkout.open({
        items: [{ priceId: paddlePriceId, quantity: 1 }],
        customer: user?.email ? { email: user.email } : undefined,
        customData: {
          userId: user?.id || "",
          companyId: companyId || "",
          ...(opts.customData || {}),
        },
        settings: {
          displayMode: "overlay",
          successUrl: opts.successUrl || `${window.location.origin}/checkout/success`,
          allowLogout: false,
          variant: "one-page",
        },
      });
    } catch (e: any) {
      console.error("Paddle checkout error:", e);
      toast.error(e?.message || "Não foi possível abrir o checkout");
      setLoading(false);
      throw e;
    } finally {
      // Paddle overlay opens async; release loading shortly after
      setTimeout(() => setLoading(false), 1500);
    }
  };

  return { openCheckout, loading };
}
