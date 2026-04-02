import { usePlatformSettings } from '@/hooks/usePlatformSettings';

interface PlatformFooterProps {
  isWhitelabel?: boolean;
  className?: string;
}

export const PlatformFooter = ({ isWhitelabel = false, className = '' }: PlatformFooterProps) => {
  const platform = usePlatformSettings();

  if (isWhitelabel) return null;

  const name = platform?.system_name || 'Me Agendaê!';
  const url = 'https://www.meagendae.com.br';
  const domain = 'meagendae.com.br';

  return (
    <div className={`text-center space-y-1 py-4 ${className}`}>
      <p className="text-xs text-muted-foreground">
        Agendamento online por {name} •{' '}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:opacity-70 transition-opacity underline"
        >
          {domain}
        </a>
      </p>
      <p className="text-[10px] text-muted-foreground/60">
        © {new Date().getFullYear()} Todos os direitos reservados
      </p>
    </div>
  );
};
