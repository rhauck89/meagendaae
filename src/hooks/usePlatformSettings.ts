import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PlatformSettings {
  system_name: string;
  system_url: string | null;
  system_logo: string | null;
  favicon_url: string | null;
  logo_light: string | null;
  logo_dark: string | null;
  pwa_icon_192: string | null;
  pwa_icon_512: string | null;
  splash_logo: string | null;
  splash_background_color: string | null;
}

let cachedSettings: PlatformSettings | null = null;
let fetchPromise: Promise<PlatformSettings | null> | null = null;

const fetchSettings = async (): Promise<PlatformSettings | null> => {
  const { data } = await supabase
    .from('platform_settings')
    .select('system_name, system_url, system_logo, favicon_url, logo_light, logo_dark')
    .limit(1)
    .single();
  if (data) {
    const s: PlatformSettings = {
      system_name: data.system_name,
      system_url: data.system_url,
      system_logo: data.system_logo,
      favicon_url: data.favicon_url,
      logo_light: (data as any).logo_light ?? null,
      logo_dark: (data as any).logo_dark ?? null,
    };
    cachedSettings = s;
    return s;
  }
  return null;
};

export const usePlatformSettings = (): PlatformSettings | null => {
  const [settings, setSettings] = useState<PlatformSettings | null>(cachedSettings);

  useEffect(() => {
    if (cachedSettings) {
      setSettings(cachedSettings);
      return;
    }
    if (!fetchPromise) {
      fetchPromise = fetchSettings();
    }
    fetchPromise.then((s) => {
      if (s) setSettings(s);
    });
  }, []);

  return settings;
};
