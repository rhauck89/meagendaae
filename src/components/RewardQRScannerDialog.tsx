import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, CheckCircle2, XCircle, ScanLine, RefreshCw, User, Gift, Coins } from 'lucide-react';
import { toast } from 'sonner';

type Phase = 'scanning' | 'loading' | 'preview' | 'success' | 'error';

interface ValidatedRedemption {
  redemption_id: string;
  redemption_code: string;
  client_name: string;
  reward_name: string;
  total_points: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Called after a redemption is successfully confirmed so parent can refresh lists. */
  onConfirmed?: () => void;
}

const SCANNER_ELEMENT_ID = 'reward-qr-scanner-region';

export function RewardQRScannerDialog({ open, onOpenChange, onConfirmed }: Props) {
  const [phase, setPhase] = useState<Phase>('scanning');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [data, setData] = useState<ValidatedRedemption | null>(null);
  const [manualCode, setManualCode] = useState('');
  const [confirming, setConfirming] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const lockRef = useRef(false); // prevent multi-reads

  const stopScanner = useCallback(async () => {
    const s = scannerRef.current;
    if (!s) return;
    try {
      if (s.isScanning) await s.stop();
      await s.clear();
    } catch { /* ignore */ }
    scannerRef.current = null;
  }, []);

  const validateCode = useCallback(async (code: string) => {
    if (lockRef.current) return;
    lockRef.current = true;
    console.log('[QR_SCAN]', { status: 'detected', qr_token: code });
    setPhase('loading');
    await stopScanner();

    const { data: result, error } = await supabase.rpc('validate_reward_redemption' as any, { p_code: code });

    if (error || !result) {
      const msg = error?.message?.includes('ALREADY_USED') || /utilizado/i.test(error?.message ?? '')
        ? 'Este resgate já foi utilizado'
        : error?.message?.includes('EXPIRED') || /expirado/i.test(error?.message ?? '')
        ? 'Código expirado'
        : error?.message?.includes('FORBIDDEN') || /pertence/i.test(error?.message ?? '')
        ? 'Resgate não pertence a esta empresa'
        : 'Código inválido ou não encontrado';
      console.log('[QR_SCAN]', { status: 'invalid', qr_token: code, error: error?.message });
      setErrorMsg(msg);
      setPhase('error');
      lockRef.current = false;
      return;
    }

    console.log('[QR_SCAN]', { status: 'valid', qr_token: code });
    setData(result as unknown as ValidatedRedemption);
    setPhase('preview');
    lockRef.current = false;
  }, [stopScanner]);

  const startScanner = useCallback(async () => {
    setPhase('scanning');
    setErrorMsg(null);
    setData(null);
    lockRef.current = false;

    // Wait one tick for DOM to render the scanner element
    await new Promise((r) => setTimeout(r, 50));
    const el = document.getElementById(SCANNER_ELEMENT_ID);
    if (!el) return;

    try {
      const instance = new Html5Qrcode(SCANNER_ELEMENT_ID, { verbose: false });
      scannerRef.current = instance;
      await instance.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decodedText) => {
          if (lockRef.current) return;
          validateCode(decodedText.trim());
        },
        () => { /* per-frame errors ignored */ }
      );
    } catch (err: any) {
      console.error('[QR_SCAN]', { status: 'camera_error', error: err?.message });
      setErrorMsg('Não foi possível acessar a câmera. Verifique as permissões.');
      setPhase('error');
    }
  }, [validateCode]);

  const handleConfirm = useCallback(async () => {
    if (!data || confirming) return;
    setConfirming(true);
    console.log('[QR_SCAN]', { status: 'confirming', qr_token: data.redemption_code });

    const { error } = await supabase.rpc('confirm_reward_redemption' as any, { p_code: data.redemption_code });
    setConfirming(false);

    if (error) {
      console.log('[QR_SCAN]', { status: 'confirm_failed', error: error.message });
      toast.error(error.message ?? 'Não foi possível confirmar o resgate');
      setErrorMsg(error.message ?? 'Falha ao confirmar');
      setPhase('error');
      return;
    }

    // Optional haptic feedback (mobile)
    try { (navigator as any).vibrate?.(150); } catch { /* noop */ }

    setPhase('success');
    toast.success('Resgate confirmado com sucesso 🎉');
    onConfirmed?.();
  }, [data, confirming, onConfirmed]);

  const handleCancel = useCallback(() => {
    setData(null);
    setManualCode('');
    startScanner();
  }, [startScanner]);

  const handleClose = useCallback(() => {
    stopScanner();
    setPhase('scanning');
    setData(null);
    setErrorMsg(null);
    setManualCode('');
    onOpenChange(false);
  }, [stopScanner, onOpenChange]);

  const handleManualSubmit = () => {
    const c = manualCode.trim().toUpperCase();
    if (!c) return;
    validateCode(c);
  };

  // Lifecycle: start scanner when dialog opens
  useEffect(() => {
    if (open) {
      startScanner();
    } else {
      stopScanner();
    }
    return () => { stopScanner(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); else onOpenChange(true); }}>
      <DialogContent className="max-w-md animate-scale-in">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="h-5 w-5" />
            Escanear QR de Resgate
          </DialogTitle>
          <DialogDescription>
            Aponte para o QR Code apresentado pelo cliente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Scanner viewport — always mounted so the element exists for html5-qrcode */}
          <div className={phase === 'scanning' ? 'block' : 'hidden'}>
            <div className="relative w-full aspect-square overflow-hidden rounded-lg border bg-black">
              <div id={SCANNER_ELEMENT_ID} className="absolute inset-0" />
              {/* Overlay com moldura */}
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <div className="relative w-2/3 h-2/3 rounded-lg border-2 border-primary/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]">
                  <span className="absolute -top-0.5 -left-0.5 h-5 w-5 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                  <span className="absolute -top-0.5 -right-0.5 h-5 w-5 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                  <span className="absolute -bottom-0.5 -left-0.5 h-5 w-5 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                  <span className="absolute -bottom-0.5 -right-0.5 h-5 w-5 border-b-4 border-r-4 border-primary rounded-br-lg" />
                </div>
              </div>
              <div className="pointer-events-none absolute bottom-2 inset-x-0 text-center">
                <span className="inline-block rounded-full bg-black/60 text-white text-[11px] px-3 py-1">
                  Posicione o QR dentro da área
                </span>
              </div>
            </div>
            <div className="mt-3 space-y-2">
              <p className="text-xs text-muted-foreground text-center">Ou insira o código manualmente:</p>
              <div className="flex gap-2">
                <Input
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                  placeholder="ABC123"
                  maxLength={12}
                  className="font-mono tracking-widest text-center"
                />
                <Button onClick={handleManualSubmit} disabled={!manualCode.trim()}>
                  Validar
                </Button>
              </div>
            </div>
          </div>

          {phase === 'loading' && (
            <div className="py-12 flex flex-col items-center gap-3 animate-fade-in">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm font-medium text-foreground">Validando resgate...</p>
              <p className="text-xs text-muted-foreground">Aguarde enquanto verificamos o código</p>
            </div>
          )}

          {phase === 'preview' && data && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-card p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <User className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Cliente</p>
                    <p className="font-semibold truncate">{data.client_name}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Gift className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Recompensa</p>
                    <p className="font-semibold truncate">{data.reward_name}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Coins className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-xs text-muted-foreground">Pontos utilizados</p>
                    <p className="font-semibold">{data.total_points} pts</p>
                  </div>
                </div>
                <div className="pt-2 border-t">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Código</p>
                  <p className="font-mono font-bold tracking-widest">{data.redemption_code}</p>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Button onClick={handleConfirm} disabled={confirming} className="w-full" size="lg">
                  {confirming ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Confirmando...</>
                  ) : (
                    <><CheckCircle2 className="h-4 w-4 mr-2" />Confirmar resgate</>
                  )}
                </Button>
                <Button variant="outline" onClick={handleCancel} disabled={confirming}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {phase === 'success' && (
            <div className="py-8 flex flex-col items-center gap-3 text-center animate-scale-in">
              <CheckCircle2 className="h-14 w-14 text-green-600" />
              <p className="text-lg font-semibold">Resgate confirmado com sucesso ✅</p>
              <p className="text-sm text-muted-foreground">Os pontos foram debitados e o estoque atualizado.</p>
              <div className="flex gap-2 w-full pt-2">
                <Button variant="outline" className="flex-1" onClick={handleCancel}>
                  <RefreshCw className="h-4 w-4 mr-2" />Escanear novamente
                </Button>
                <Button className="flex-1" onClick={handleClose}>Fechar</Button>
              </div>
            </div>
          )}

          {phase === 'error' && (
            <div className="py-8 flex flex-col items-center gap-3 text-center">
              <XCircle className="h-14 w-14 text-destructive" />
              <p className="text-lg font-semibold">Não foi possível validar</p>
              <p className="text-sm text-muted-foreground">{errorMsg ?? 'Erro desconhecido'}</p>
              <div className="flex gap-2 w-full pt-2">
                <Button className="flex-1" onClick={handleCancel}>
                  <RefreshCw className="h-4 w-4 mr-2" />Tentar novamente
                </Button>
                <Button variant="outline" className="flex-1" onClick={handleClose}>Fechar</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
