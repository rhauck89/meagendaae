import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalLoadingOverlayProps {
  /** Quando true, exibe overlay e bloqueia interação com o modal */
  visible: boolean;
  /** Texto principal exibido abaixo do spinner */
  message?: string;
  /** Classes extras (ex: rounded para casar com o modal) */
  className?: string;
}

/**
 * Overlay de carregamento padrão para uso DENTRO de modais.
 * Cobre 100% do conteúdo do modal pai (use position relative no pai
 * ou deixe absolute inset-0 funcionar no DialogContent flex).
 *
 * Uso:
 *   <DialogContent>
 *     <DialogHeader>...</DialogHeader>
 *     <DialogBody>...</DialogBody>
 *     <DialogFooter>...</DialogFooter>
 *     <ModalLoadingOverlay visible={isSaving} message="Salvando..." />
 *   </DialogContent>
 */
export const ModalLoadingOverlay = ({
  visible,
  message = 'Processando...',
  className,
}: ModalLoadingOverlayProps) => {
  return (
    <div
      className={cn(
        'absolute inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-background/80 backdrop-blur-sm transition-opacity duration-200',
        visible ? 'opacity-100' : 'opacity-0 pointer-events-none',
        className,
      )}
      aria-hidden={!visible}
      aria-live="polite"
      role="status"
    >
      <Loader2 className="h-10 w-10 text-primary animate-spin" />
      <p className="text-sm font-medium text-foreground">{message}</p>
      <div className="w-32 h-1 rounded-full bg-muted overflow-hidden">
        <div className="h-full w-1/2 bg-primary/80 rounded-full animate-pulse" />
      </div>
    </div>
  );
};

export default ModalLoadingOverlay;
