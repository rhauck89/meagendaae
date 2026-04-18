const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

export function PaymentTestModeBanner() {
  if (!clientToken?.startsWith("test_")) return null;
  return (
    <div className="w-full bg-amber-100 border-b border-amber-300 px-4 py-2 text-center text-xs text-amber-900">
      Modo de teste: pagamentos no preview não cobram cartão real.
    </div>
  );
}
