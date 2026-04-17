import { useEffect, useMemo, useState, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

const EXPIRATION_MINUTES = 15;

interface Redemption {
  id: string;
  redemption_code: string;
  status: string; // pending | confirmed | canceled | cancelled | expired
  created_at: string;
  total_points: number;
  reward_id: string | null;
  company_id: string;
  client_id: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  redemption: Redemption | null;
  rewardName?: string;
  /** Called when user clicks "Generate new" — should create a new redemption and pass it back via setRedemption. */
  onRegenerate?: () => void | Promise<void>;
  regenerating?: boolean;
}

function formatMMSS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export function RedemptionQRDialog({
  open, onOpenChange, redemption, rewardName, onRegenerate, regenerating,
}: Props) {
  const [liveStatus, setLiveStatus] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Authoritative status: server-fetched > prop
  const status = liveStatus ?? redemption?.status ?? 'pending';

  // Reset live status whenever a new redemption is shown
  useEffect(() => {
    setLiveStatus(null);
    setNow(Date.now());
  }, [redemption?.id]);

  // Tick every second for countdown
  useEffect(() => {
    if (!open || !redemption) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [open, redemption]);

  // Poll redemption status every 5s while pending and dialog open
  const refresh = useCallback(async () => {
    if (!redemption) return;
    const { data, error } = await supabase
      .from('loyalty_redemptions')
      .select('status')
      .eq('id', redemption.id)
      .maybeSingle();
    if (!error && data?.status) setLiveStatus(data.status);
  }, [redemption]);

  useEffect(() => {
    if (!open || !redemption) return;
    if (status !== 'pending') return;
    refresh(); // immediate revalidation when opening
    const i = setInterval(refresh, 5000);
    return () => clearInterval(i);
  }, [open, redemption, status, refresh]);

  // Countdown
  const expiresAtMs = useMemo(() => {
    if (!redemption) return 0;
    return new Date(redemption.created_at).getTime() + EXPIRATION_MINUTES * 60_000;
  }, [redemption]);
  const remainingSec = Math.max(0, Math.floor((expiresAtMs - now) / 1000));

  // If countdown hits zero locally and server still says pending, eagerly mark UI as expired.
  const visualExpired = status === 'expired' || (status === 'pending' && remainingSec === 0);

  const isConfirmed = status === 'confirmed';
  const isCanceled = status === 'canceled' || status === 'cancelled';
  const isPendingActive = status === 'pending' && !visualExpired;

  if (!redemption) return null;

  const code = redemption.redemption_code;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Apresente este código</DialogTitle>
          <DialogDescription>
            {rewardName ? `Resgate: ${rewardName}` : 'Apresente ao estabelecimento para confirmar.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* QR */}
          <div className="flex justify-center">
            <div
              className={`p-4 rounded-xl border-2 transition-all ${
                isPendingActive
                  ? 'bg-white border-primary/30'
                  : 'bg-muted border-border grayscale opacity-60'
              }`}
              aria-disabled={!isPendingActive}
            >
              <QRCodeSVG value={code} size={200} level="M" includeMargin={false} />
            </div>
          </div>

          {/* Code */}
          <div className="text-center">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Código</p>
            <p className={`font-mono font-bold tracking-widest text-lg ${visualExpired ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
              {code}
            </p>
          </div>

          {/* Status */}
          {isConfirmed && (
            <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-3 text-center space-y-1">
              <CheckCircle2 className="h-6 w-6 text-green-600 mx-auto" />
              <p className="text-sm font-semibold text-green-700">Resgate confirmado</p>
              <p className="text-xs text-muted-foreground">O estabelecimento já validou seu código.</p>
            </div>
          )}

          {isCanceled && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-center space-y-1">
              <XCircle className="h-6 w-6 text-destructive mx-auto" />
              <p className="text-sm font-semibold text-destructive">Resgate cancelado</p>
            </div>
          )}

          {visualExpired && !isConfirmed && !isCanceled && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-center space-y-2">
              <Clock className="h-6 w-6 text-amber-600 mx-auto" />
              <p className="text-sm font-semibold text-amber-700">Seu código expirou</p>
              <p className="text-xs text-muted-foreground">Gere um novo para continuar.</p>
              {onRegenerate && (
                <Button
                  size="sm"
                  className="w-full mt-1"
                  onClick={() => onRegenerate()}
                  disabled={regenerating}
                >
                  {regenerating ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Gerando...</>
                  ) : (
                    <><RefreshCw className="h-4 w-4 mr-2" />Gerar novo QR</>
                  )}
                </Button>
              )}
            </div>
          )}

          {isPendingActive && (
            <div className="rounded-lg border bg-card p-3 text-center space-y-1">
              <Clock className="h-5 w-5 text-primary mx-auto" />
              <p className="text-sm">
                Este código expira em{' '}
                <span className="font-mono font-bold text-primary">{formatMMSS(remainingSec)}</span>
              </p>
              <p className="text-[11px] text-muted-foreground">Aguardando confirmação do estabelecimento...</p>
            </div>
          )}

          <Badge variant="outline" className="w-full justify-center py-1">
            {isConfirmed ? 'Confirmado' : isCanceled ? 'Cancelado' : visualExpired ? 'Expirado' : 'Pendente'}
          </Badge>

          <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type { Redemption };
