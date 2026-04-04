import { usePlatformSettings } from '@/hooks/usePlatformSettings';
import { Scissors } from 'lucide-react';

interface PlatformLogoProps {
  /** If whitelabel is enabled and company has a logo, pass it here */
  companyLogo?: string | null;
  companyName?: string | null;
  isWhitelabel?: boolean;
  className?: string;
  /** Whether the logo is displayed on a dark background */
  onDarkBackground?: boolean;
  /** Compact mode: show only icon, hide name */
  compact?: boolean;
}

export const PlatformLogo = ({
  companyLogo,
  companyName,
  isWhitelabel = false,
  className = '',
  onDarkBackground = true,
  compact = false,
}: PlatformLogoProps) => {
  const platform = usePlatformSettings();

  const iconFallback = (
    <div className="w-10 h-10 bg-sidebar-primary rounded-xl flex items-center justify-center shrink-0">
      <Scissors className="h-5 w-5 text-sidebar-primary-foreground" />
    </div>
  );

  // Whitelabel: show company branding
  if (isWhitelabel && (companyLogo || companyName)) {
    if (compact) {
      return (
        <div className={`flex items-center justify-center ${className}`}>
          {companyLogo ? (
            <img src={companyLogo} alt={companyName || 'Logo'} className="h-10 w-10 object-contain rounded-xl" />
          ) : iconFallback}
        </div>
      );
    }
    return (
      <div className={`flex flex-col items-start gap-1 ${className}`}>
        {companyLogo ? (
          <img
            src={companyLogo}
            alt={companyName || 'Logo'}
            className="h-8 max-w-[200px] object-contain"
          />
        ) : (
          <div className="w-8 h-8 bg-sidebar-primary rounded-xl flex items-center justify-center">
            <Scissors className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
        )}
        <span className="text-xs font-medium opacity-80 truncate max-w-full">
          {companyName || 'Dashboard'}
        </span>
      </div>
    );
  }

  // Choose logo based on background context
  const getLogo = (): string | null => {
    if (!platform) return null;
    
    if (onDarkBackground) {
      return platform.logo_light || platform.system_logo || platform.logo_dark || null;
    } else {
      return platform.logo_dark || platform.system_logo || platform.logo_light || null;
    }
  };

  const logoUrl = getLogo();

  if (compact) {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        {logoUrl ? (
          <img src={logoUrl} alt={platform?.system_name || 'Logo'} className="h-10 w-10 object-contain rounded-xl" />
        ) : iconFallback}
      </div>
    );
  }

  // Default: platform logo
  return (
    <div className={`flex flex-col items-start gap-1 ${className}`}>
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={platform?.system_name || 'Logo'}
          className="h-8 max-w-[200px] object-contain"
        />
      ) : (
        <div className="w-8 h-8 bg-sidebar-primary rounded-xl flex items-center justify-center">
          <Scissors className="h-4 w-4 text-sidebar-primary-foreground" />
        </div>
      )}
      <span className="text-xs font-medium opacity-80 truncate max-w-full">
        {platform?.system_name || 'AgendaPro'}
      </span>
    </div>
  );
};
