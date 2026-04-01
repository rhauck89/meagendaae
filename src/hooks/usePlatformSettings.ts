import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PlatformSettings {
  system_name: string;
  system_url: string | null;
  system_logo: string | null;
  favicon_url: string | null;
}

let cachedSettings: PlatformSettings | null = null;
let fetchPromise: Promise<PlatformSettings | null> | null = null;

const fetchSettings = async (): Promise<PlatformSettings | null> => {
  const { data } = await supabase
    .from('platform_settings')
    .select('system_name, system_url, system_logo, favicon_url')
    .limit(1)
    .single();
  if (data) {
    const s: PlatformSettings = {
      system_name: data.system_name,
      system_url: data.system_url,
      system_logo: data.system_logo,
      favicon_url: data.favicon_url,
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
