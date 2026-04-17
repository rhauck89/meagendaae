import { useEffect, useMemo, useState, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, CheckCircle2, XCircle, Clock, AlertTriangle, Info } from 'lucide-react';

const EXPIRATION_MINUTES = 15;
const TOTAL_SECONDS = EXPIRATION_MINUTES * 60;

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

  // Poll redemption status every 4s while pending and dialog open
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
    if (status !== 'pending') return; // stop polling once terminal
    refresh(); // immediate revalidation when opening
    const i = setInterval(refresh, 4000);
    return () => clearInterval(i);
  }, [open, redemption, status, refresh]);

  // Countdown
  const expiresAtMs = useMemo(() => {
    if (!redemption) return 0;
    return new Date(redemption.created_at).getTime() + EXPIRATION_MINUTES * 60_000;
  }, [redemption]);
  const remainingSec = Math.max(0, Math.floor((expiresAtMs - now) / 1000));
  const progressPct = Math.max(0, Math.min(100, (remainingSec / TOTAL_SECONDS) * 100));
  const isUrgent = remainingSec > 0 && remainingSec <= 120; // < 2 min
  const isCritical = progressPct < 20;

  // If countdown hits zero locally and server still says pending, eagerly mark UI as expired.
  const visualExpired = status === 'expired' || (status === 'pending' && remainingSec === 0);

  const isConfirmed = status === 'confirmed';
  const isCanceled = status === 'canceled' || status === 'cancelled';
  const isPendingActive = status === 'pending' && !visualExpired;

  if (!redemption) return null;

  const code = redemption.redemption_code;

  const statusBadge = isConfirmed
    ? { label: 'Resgate confirmado', cls: 'bg-green-500/15 text-green-700 border-green-500/40' }
    : isCanceled
    ? { label: 'Cancelado', cls: 'bg-destructive/15 text-destructive border-destructive/40' }
    : visualExpired
    ? { label: 'Expirado', cls: 'bg-muted text-muted-foreground border-border' }
    : { label: 'Aguardando validação', cls: 'bg-yellow-500/15 text-yellow-700 border-yellow-500/40' };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm animate-scale-in">
        <DialogHeader>
          <DialogTitle>Apresente este código</DialogTitle>
          <DialogDescription>
            {rewardName ? `Resgate: ${rewardName}` : 'Apresente ao estabelecimento para confirmar.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Overlay informativo */}
          {isPendingActive && (
            <div className="flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-[11px] text-foreground/80">
              <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <span>Apresente este QR Code no estabelecimento para confirmar seu resgate.</span>
            </div>
          )}

          {/* Status badge no topo */}
          <div className="flex justify-center">
            <Badge variant="outline" className={`px-3 py-1 text-xs font-semibold ${statusBadge.cls} transition-colors`}>
              {statusBadge.label}
            </Badge>
          </div>

          {/* QR */}
          <div className="flex justify-center">
            <div
              className={`p-4 rounded-xl border-2 transition-all duration-300 ${
                isPendingActive
                  ? 'bg-white border-primary/30 shadow-sm'
                  : isConfirmed
                  ? 'bg-white border-green-500/40 shadow-sm'
                  : 'bg-muted border-border grayscale opacity-60'
              }`}
              aria-disabled={!isPendingActive}
            >
              <QRCodeSVG value={code} size={200} level="M" includeMargin={false} />
            </div>
          </div>

          {/* Countdown + progress bar (somente quando pending ativo) */}
          {isPendingActive && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-center gap-1.5 text-sm">
                <Clock className={`h-4 w-4 ${isUrgent ? 'text-destructive animate-pulse' : 'text-primary'}`} />
                <span className={isUrgent ? 'text-destructive font-semibold' : 'text-foreground'}>
                  Expira em{' '}
                  <span className="font-mono font-bold">{formatMMSS(remainingSec)}</span>
                </span>
              </div>
              {/* Barra de progresso */}
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isCritical ? 'bg-destructive' : 'bg-primary'
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              {isUrgent && (
                <p className="text-[11px] text-destructive text-center font-medium flex items-center justify-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Expirando em instantes
                </p>
              )}
              <p className="text-[11px] text-muted-foreground text-center">
                Aguardando confirmação do estabelecimento...
              </p>
            </div>
          )}

          {/* Code */}
          <div className="text-center">
            <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Código</p>
            <p className={`font-mono font-bold tracking-widest text-lg ${visualExpired ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
              {code}
            </p>
          </div>

          {/* Estados terminais */}
          {isConfirmed && (
            <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 text-center space-y-1 animate-fade-in">
              <CheckCircle2 className="h-8 w-8 text-green-600 mx-auto" />
              <p className="text-base font-bold text-green-700">Resgate aprovado 🎉</p>
              <p className="text-xs text-muted-foreground">O estabelecimento já validou seu código.</p>
            </div>
          )}

          {isCanceled && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-center space-y-2 animate-fade-in">
              <XCircle className="h-6 w-6 text-destructive mx-auto" />
              <p className="text-sm font-semibold text-destructive">Resgate cancelado</p>
              {onRegenerate && (
                <Button size="sm" className="w-full mt-1" onClick={() => onRegenerate()} disabled={regenerating}>
                  {regenerating ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Gerando...</>
                  ) : (
                    <><RefreshCw className="h-4 w-4 mr-2" />Gerar novo QR</>
                  )}
                </Button>
              )}
            </div>
          )}

          {visualExpired && !isConfirmed && !isCanceled && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-center space-y-2 animate-fade-in">
              <Clock className="h-6 w-6 text-amber-600 mx-auto" />
              <p className="text-sm font-semibold text-amber-700">Seu código expirou</p>
              <p className="text-xs text-muted-foreground">Gere um novo para continuar.</p>
              {onRegenerate && (
                <Button size="sm" className="w-full mt-1" onClick={() => onRegenerate()} disabled={regenerating}>
                  {regenerating ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Gerando...</>
                  ) : (
                    <><RefreshCw className="h-4 w-4 mr-2" />Gerar novo QR</>
                  )}
                </Button>
              )}
            </div>
          )}

          <Button
            variant={isConfirmed ? 'default' : 'outline'}
            className="w-full transition-transform hover:scale-[1.01]"
            onClick={() => onOpenChange(false)}
          >
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export type { Redemption };
