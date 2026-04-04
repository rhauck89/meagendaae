import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

const FEATURE_KEYS = ['agenda_aberta', 'promotions', 'finance'] as const;
export type FeatureKey = typeof FEATURE_KEYS[number];

export const useFeatureDiscovery = () => {
  const [seenFeatures, setSeenFeatures] = useState<Set<FeatureKey>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from('feature_discovery' as any)
        .select('feature_key')
        .eq('user_id', user.id);

      if (data) {
        setSeenFeatures(new Set((data as any[]).map(d => d.feature_key as FeatureKey)));
      }
      setLoading(false);
    };
    load();
  }, []);

  const markSeen = useCallback(async (key: FeatureKey) => {
    setSeenFeatures(prev => new Set([...prev, key]));
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from('feature_discovery' as any).upsert(
      { user_id: user.id, feature_key: key },
      { onConflict: 'user_id,feature_key' }
    );
  }, []);

  const hasSeen = useCallback((key: FeatureKey) => seenFeatures.has(key), [seenFeatures]);

  return { hasSeen, markSeen, loading };
};
