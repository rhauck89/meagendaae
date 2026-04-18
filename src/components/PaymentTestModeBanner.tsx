const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

export function PaymentTestModeBanner() {
  if (!clientToken?.startsWith("test_")) return null;
  return (
    <div className="w-full bg-warning/15 border-b border-warning/40 px-4 py-2 text-center text-xs text-foreground">
      Modo de teste: pagamentos no preview não cobram cartão real.
    </div>
  );
}
