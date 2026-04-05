import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface AmenityDisplay {
  id: string;
  name: string;
  icon: string;
  is_featured: boolean;
}

export function useCompanyAmenities(companyId: string | null | undefined) {
  const [amenities, setAmenities] = useState<AmenityDisplay[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!companyId) return;
    setLoading(true);
    supabase
      .from('company_amenities' as any)
      .select('amenity_id, is_featured, amenities(id, name, icon)')
      .eq('company_id', companyId)
      .then(({ data }) => {
        if (data) {
          const mapped = (data as any[]).map(ca => ({
            id: ca.amenity_id,
            name: (ca as any).amenities?.name ?? '',
            icon: (ca as any).amenities?.icon ?? '',
            is_featured: ca.is_featured,
          }));
          // Sort: featured first
          mapped.sort((a, b) => {
            if (a.is_featured && !b.is_featured) return -1;
            if (!a.is_featured && b.is_featured) return 1;
            return 0;
          });
          setAmenities(mapped);
        }
        setLoading(false);
      });
  }, [companyId]);

  return { amenities, loading };
}
