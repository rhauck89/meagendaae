import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

let cachedSettings: { system_name: string; system_url: string | null; system_logo: string | null } | null = null;

interface PlatformBrandingProps {
  isDark?: boolean;
  hide?: boolean;
}

export const PlatformBranding = ({ isDark = false, hide = false }: PlatformBrandingProps) => {
  const [settings, setSettings] = useState(cachedSettings);

  useEffect(() => {
    if (cachedSettings) return;
    supabase
      .from('platform_settings' as any)
      .select('system_name, system_url, system_logo')
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) {
          const s = {
            system_name: (data as any).system_name,
            system_url: (data as any).system_url,
            system_logo: (data as any).system_logo,
          };
          cachedSettings = s;
          setSettings(s);
        }
      });
  }, []);

  if (hide || !settings) return null;

  const content = (
    <div className="flex flex-col items-center gap-1">
      <span className="text-[10px]" style={{ color: isDark ? '#374151' : '#D1D5DB' }}>
        Agendamento online por {settings.system_name}
      </span>
      <span className="text-[9px]" style={{ color: isDark ? '#1F2937' : '#E5E7EB' }}>
        © {new Date().getFullYear()} Todos os direitos reservados
      </span>
    </div>
  );

  if (settings.system_url) {
    return (
      <a href={settings.system_url} target="_blank" rel="noopener noreferrer" className="hover:opacity-70 transition-opacity">
        {content}
      </a>
    );
  }

  return content;
};
