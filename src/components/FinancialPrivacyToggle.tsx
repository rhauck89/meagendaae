import { Eye, EyeOff } from 'lucide-react';
import { useFinancialPrivacy } from '@/contexts/FinancialPrivacyContext';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';

interface FinancialPrivacyToggleProps {
  className?: string;
  size?: 'sm' | 'default';
}

const FinancialPrivacyToggle = ({ className, size = 'default' }: FinancialPrivacyToggleProps) => {
  const { isHidden, toggle } = useFinancialPrivacy();

  const iconSize = size === 'sm' ? 14 : 16;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          className={className}
          aria-label={isHidden ? 'Mostrar valores' : 'Ocultar valores'}
        >
          {isHidden ? (
            <EyeOff className="text-muted-foreground" style={{ width: iconSize, height: iconSize }} />
          ) : (
            <Eye className="text-muted-foreground" style={{ width: iconSize, height: iconSize }} />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        {isHidden ? 'Mostrar valores' : 'Ocultar valores'}
      </TooltipContent>
    </Tooltip>
  );
};

export default FinancialPrivacyToggle;
