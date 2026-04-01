import { usePlatformSettings } from '@/hooks/usePlatformSettings';

interface PlatformFooterProps {
  isWhitelabel?: boolean;
  className?: string;
}

export const PlatformFooter = ({ isWhitelabel = false, className = '' }: PlatformFooterProps) => {
  const platform = usePlatformSettings();

  if (isWhitelabel) return null;

  const name = platform?.system_name || 'Me Agenda Aê';

  const content = (
    <div className={`text-center space-y-1 py-4 ${className}`}>
      <p className="text-xs text-muted-foreground">
        Agendamento online por {platform?.system_url ? (
          <a
            href={platform.system_url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:opacity-70 transition-opacity underline"
          >
            {name}
          </a>
        ) : name}
      </p>
      <p className="text-[10px] text-muted-foreground/60">
        © {new Date().getFullYear()} Todos os direitos reservados
      </p>
    </div>
  );

  return content;
};
