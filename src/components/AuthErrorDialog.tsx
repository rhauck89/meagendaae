import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertCircle, Sparkles } from 'lucide-react';

export type AuthErrorKind = 'weak_password' | 'email_exists' | 'invalid_email' | 'rate_limit' | 'network' | 'generic';

export function classifyAuthError(message: string): AuthErrorKind {
  const m = (message || '').toLowerCase();
  if (/comum|não é segura|pwned|leaked|weak|easy to guess|hibp/i.test(m)) return 'weak_password';
  if (/já existe|already|exists|cadastrad/i.test(m)) return 'email_exists';
  if (/email inválido|invalid.*email/i.test(m)) return 'invalid_email';
  if (/muitas tentativas|rate limit|too many/i.test(m)) return 'rate_limit';
  if (/conexão|network|fetch/i.test(m)) return 'network';
  return 'generic';
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message: string;
  /** Called when user clicks "Entendi" — typically focus + clear password field */
  onAcknowledge?: () => void;
  /** Called when user clicks "Gerar senha segura" (only shown for password errors) */
  onGeneratePassword?: () => void;
}

export const AuthErrorDialog = ({ open, onOpenChange, message, onAcknowledge, onGeneratePassword }: Props) => {
  const kind = classifyAuthError(message);
  const isPasswordError = kind === 'weak_password';

  const title = isPasswordError
    ? 'Senha não é segura'
    : kind === 'email_exists'
    ? 'Email já cadastrado'
    : kind === 'invalid_email'
    ? 'Email inválido'
    : kind === 'rate_limit'
    ? 'Muitas tentativas'
    : kind === 'network'
    ? 'Erro de conexão'
    : 'Não foi possível criar sua conta';

  const handleAcknowledge = () => {
    onOpenChange(false);
    setTimeout(() => onAcknowledge?.(), 50);
  };

  const handleGenerate = () => {
    onOpenChange(false);
    setTimeout(() => onGeneratePassword?.(), 50);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <DialogTitle className="text-center">{title}</DialogTitle>
          <DialogDescription className="text-center text-base pt-2">
            {message}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="flex-col-reverse sm:flex-col-reverse gap-2 sm:space-x-0">
          {isPasswordError && onGeneratePassword && (
            <Button
              type="button"
              variant="outline"
              onClick={handleGenerate}
              className="w-full"
            >
              <Sparkles className="h-4 w-4 mr-2" />
              Gerar senha segura
            </Button>
          )}
          <Button
            type="button"
            onClick={handleAcknowledge}
            className="w-full"
            autoFocus
          >
            Entendi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
