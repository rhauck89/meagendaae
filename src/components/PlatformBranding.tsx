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

  const name = settings.system_name || 'Me Agendaê!';
  const url = 'https://www.meagendae.com.br';
  const domain = 'meagendae.com.br';

  return (
    <div className="flex flex-col items-center gap-1 py-4">
      <span className="text-xs" style={{ color: isDark ? '#6B7280' : '#9CA3AF' }}>
        Agendamento online por {name} •{' '}
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline transition-colors"
          style={{ color: 'inherit' }}
          onMouseEnter={e => (e.currentTarget.style.color = '#18e384')}
          onMouseLeave={e => (e.currentTarget.style.color = 'inherit')}
        >
          {domain}
        </a>
      </span>
      <span className="text-[10px]" style={{ color: isDark ? '#9CA3AF' : '#D1D5DB' }}>
        © {new Date().getFullYear()} Todos os direitos reservados
      </span>
    </div>
  );
};
