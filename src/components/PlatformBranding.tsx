import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PlatformBrandingProps {
  isDark?: boolean;
}

let cachedSettings: { system_name: string; system_url: string | null } | null = null;

export const PlatformBranding = ({ isDark = false }: PlatformBrandingProps) => {
  const [settings, setSettings] = useState(cachedSettings);

  useEffect(() => {
    if (cachedSettings) return;
    supabase
      .from('platform_settings' as any)
      .select('system_name, system_url')
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) {
          const s = { system_name: (data as any).system_name, system_url: (data as any).system_url };
          cachedSettings = s;
          setSettings(s);
        }
      });
  }, []);

  if (!settings) return null;

  const content = (
    <span className="text-[10px]" style={{ color: isDark ? '#374151' : '#D1D5DB' }}>
      Agendamento online por {settings.system_name}
    </span>
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
