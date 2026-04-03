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
}

export const PlatformLogo = ({
  companyLogo,
  companyName,
  isWhitelabel = false,
  className = '',
  onDarkBackground = true,
}: PlatformLogoProps) => {
  const platform = usePlatformSettings();

  // Whitelabel: show company branding
  if (isWhitelabel && (companyLogo || companyName)) {
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
      // Dark background → prefer logo_light, fallback to system_logo
      return platform.logo_light || platform.system_logo || platform.logo_dark || null;
    } else {
      // Light background → prefer logo_dark, fallback to system_logo
      return platform.logo_dark || platform.system_logo || platform.logo_light || null;
    }
  };

  const logoUrl = getLogo();

  // Default: platform logo
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={platform?.system_name || 'Logo'}
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
