const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

export function PaymentTestModeBanner() {
  if (!clientToken?.startsWith("test_")) return null;
  return (
    <div className="w-full bg-warning/15 border-b border-warning/40 px-4 py-2 text-center text-xs text-foreground">
      <strong>Modo de teste:</strong> os pagamentos no preview não cobram cartão real.{" "}
      <a
        href="https://docs.lovable.dev/features/payments#test-and-live-environments"
        target="_blank"
        rel="noopener noreferrer"
        className="underline font-medium"
      >
        Saiba mais
      </a>
    </div>
  );
}

export default PaymentTestModeBanner;
