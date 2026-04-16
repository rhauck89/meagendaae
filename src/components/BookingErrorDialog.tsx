import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RotateCcw, Clock } from 'lucide-react';

export type BookingErrorKind = 'conflict' | 'invalid_slot' | 'auth' | 'generic';

export interface BookingErrorInfo {
  kind: BookingErrorKind;
  title: string;
  description: string;
  hint?: string;
  suggestions?: string[];
}

/**
 * Translate a raw error from the booking RPC into a friendly,
 * Portuguese, action-oriented BookingErrorInfo.
 */
export function translateBookingError(raw: unknown): BookingErrorInfo {
  const msg = (raw as any)?.message?.toString() || String(raw || '');

  if (/Time slot already booked/i.test(msg)) {
    return {
      kind: 'conflict',
      title: 'Este horário acabou de ser ocupado',
      description: 'Outra pessoa reservou esse horário enquanto você finalizava seu agendamento.',
      hint: 'Escolha um dos próximos horários disponíveis abaixo ou tente novamente.',
    };
  }

  if (/INVALID_TIME_SLOT/i.test(msg)) {
    return {
      kind: 'invalid_slot',
      title: 'Este horário não é válido para este serviço',
      description: 'O horário escolhido não se encaixa na grade de atendimento configurada.',
      hint: 'Selecione outro horário da lista de disponíveis.',
    };
  }

  if (/AUTH_REQUIRED/i.test(msg)) {
    return {
      kind: 'auth',
      title: 'Você precisa entrar para agendar',
      description: 'Para confirmar seu horário, é necessário fazer login ou criar uma conta.',
      hint: 'Volte e clique em "Entrar para agendar".',
    };
  }

  return {
    kind: 'generic',
    title: 'Não conseguimos concluir seu agendamento',
    description: msg && !/^[\[\]A-Z_]+$/.test(msg)
      ? msg
      : 'Algo deu errado ao salvar seu horário.',
    hint: 'Tente novamente em instantes. Se o problema continuar, entre em contato conosco.',
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  error: BookingErrorInfo | null;
  suggestions?: string[];
  onPickSuggestion?: (slot: string) => void;
  onRetry?: () => void;
  onSeeAvailable?: () => void;
}

export function BookingErrorDialog({
  open,
  onOpenChange,
  error,
  suggestions = [],
  onPickSuggestion,
  onRetry,
  onSeeAvailable,
}: Props) {
  if (!error) return null;

  const isConflict = error.kind === 'conflict';
  const top3 = suggestions.slice(0, 3);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-destructive/30">
        <div className="bg-destructive/10 px-6 py-5 flex items-start gap-3">
          <div className="h-10 w-10 rounded-full bg-destructive/20 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold leading-tight">{error.title}</h2>
            <p className="text-sm text-muted-foreground mt-1">{error.description}</p>
          </div>
        </div>

        <div className="px-6 py-5 space-y-4">
          {error.hint && (
            <p className="text-sm text-foreground/80">{error.hint}</p>
          )}

          {isConflict && top3.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Próximos horários disponíveis
              </p>
              <div className="grid grid-cols-3 gap-2">
                {top3.map((s) => (
                  <Button
                    key={s}
                    variant="outline"
                    className="h-11"
                    onClick={() => onPickSuggestion?.(s)}
                  >
                    <Clock className="h-3.5 w-3.5 mr-1.5" />
                    {s}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2">
            {isConflict && (
              <Button variant="default" onClick={onSeeAvailable}>
                Ver próximos horários disponíveis
              </Button>
            )}
            {onRetry && (
              <Button variant={isConflict ? 'outline' : 'default'} onClick={onRetry}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Tentar novamente
              </Button>
            )}
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
