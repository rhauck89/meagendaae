import { usePlatformSettings } from '@/hooks/usePlatformSettings';
import { Scissors } from 'lucide-react';

interface PlatformLogoProps {
  /** If whitelabel is enabled and company has a logo, pass it here */
  companyLogo?: string | null;
  companyName?: string | null;
  isWhitelabel?: boolean;
  className?: string;
}

export const PlatformLogo = ({
  companyLogo,
  companyName,
  isWhitelabel = false,
  className = '',
}: PlatformLogoProps) => {
  const platform = usePlatformSettings();

  // Whitelabel: show company branding
  if (isWhitelabel && (companyLogo || companyName)) {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        {companyLogo ? (
          <img
            src={companyLogo}
            alt={companyName || 'Logo'}
            className="h-10 max-w-[140px] object-contain"
          />
        ) : (
          <div className="w-10 h-10 bg-sidebar-primary rounded-xl flex items-center justify-center">
            <Scissors className="h-5 w-5 text-sidebar-primary-foreground" />
          </div>
        )}
        <span className="font-display font-bold text-lg truncate">
          {companyName || 'Dashboard'}
        </span>
      </div>
    );
  }

  // Default: platform logo
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {platform?.system_logo ? (
        <img
          src={platform.system_logo}
          alt={platform.system_name}
          className="h-10 max-w-[140px] object-contain"
        />
      ) : (
        <div className="w-10 h-10 bg-sidebar-primary rounded-xl flex items-center justify-center">
          <Scissors className="h-5 w-5 text-sidebar-primary-foreground" />
        </div>
      )}
      <span className="font-display font-bold text-lg truncate">
        {platform?.system_name || 'AgendaPro'}
      </span>
    </div>
  );
};
