import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Crown, Scissors } from 'lucide-react';

interface RoleSelectorDialogProps {
  open: boolean;
  onSelect: (mode: 'admin' | 'professional') => void;
}

const RoleSelectorDialog = ({ open, onSelect }: RoleSelectorDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader className="text-center">
          <DialogTitle className="text-xl">Escolha como deseja acessar</DialogTitle>
          <DialogDescription>
            Você possui acesso como Administrador e Profissional.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-2">
          <button
            onClick={() => onSelect('admin')}
            className="w-full flex items-center gap-4 p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-accent/50 transition-all text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <Crown className="h-6 w-6 text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold">Administrar Empresa</p>
              <p className="text-sm text-muted-foreground">
                Gerenciar agenda, equipe, serviços e financeiro
              </p>
            </div>
          </button>

          <button
            onClick={() => onSelect('professional')}
            className="w-full flex items-center gap-4 p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-accent/50 transition-all text-left"
          >
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Scissors className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold">Atender como Profissional</p>
              <p className="text-sm text-muted-foreground">
                Acessar agenda pessoal e clientes
              </p>
            </div>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RoleSelectorDialog;
