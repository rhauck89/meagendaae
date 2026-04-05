import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Sparkles, Star } from 'lucide-react';
import { lazy, Suspense } from 'react';
import dynamicIconImports from 'lucide-react/dynamicIconImports';

interface Amenity {
  id: string;
  name: string;
  icon: string;
}

interface CompanyAmenity {
  id: string;
  amenity_id: string;
  is_featured: boolean;
}

const LucideIcon = ({ name, ...props }: { name: string; className?: string }) => {
  const iconName = name as keyof typeof dynamicIconImports;
  if (dynamicIconImports[iconName]) {
    const IconComp = lazy(dynamicIconImports[iconName]);
    return (
      <Suspense fallback={<div className="w-4 h-4" />}>
        <IconComp {...props} />
      </Suspense>
    );
  }
  return <div className="w-4 h-4" />;
};

export default function AmenitiesSettings() {
  const { companyId } = useAuth();
  const [amenities, setAmenities] = useState<Amenity[]>([]);
  const [selected, setSelected] = useState<Map<string, CompanyAmenity>>(new Map());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, [companyId]);

  const loadData = async () => {
    const { data: allAmenities } = await supabase.from('amenities' as any).select('id, name, icon').order('name');
    if (allAmenities) setAmenities(allAmenities as any);

    if (!companyId) return;
    const { data: compAmenities } = await supabase.from('company_amenities' as any).select('id, amenity_id, is_featured').eq('company_id', companyId);
    if (compAmenities) {
      const map = new Map<string, CompanyAmenity>();
      (compAmenities as any[]).forEach(ca => map.set(ca.amenity_id, ca));
      setSelected(map);
    }
  };

  const featuredCount = Array.from(selected.values()).filter(s => s.is_featured).length;

  const toggleAmenity = async (amenityId: string) => {
    if (!companyId) return;
    setSaving(true);
    try {
      const existing = selected.get(amenityId);
      if (existing) {
        await supabase.from('company_amenities' as any).delete().eq('id', existing.id);
        const next = new Map(selected);
        next.delete(amenityId);
        setSelected(next);
      } else {
        const { data, error } = await supabase.from('company_amenities' as any).insert({ company_id: companyId, amenity_id: amenityId, is_featured: false }).select('id, amenity_id, is_featured').single();
        if (error) throw error;
        const next = new Map(selected);
        next.set(amenityId, data as any);
        setSelected(next);
      }
    } catch {
      toast.error('Erro ao salvar comodidade');
    } finally {
      setSaving(false);
    }
  };

  const toggleFeatured = async (amenityId: string) => {
    if (!companyId) return;
    const existing = selected.get(amenityId);
    if (!existing) return;

    const newFeatured = !existing.is_featured;
    if (newFeatured && featuredCount >= 4) {
      toast.error('Máximo de 4 comodidades em destaque');
      return;
    }

    setSaving(true);
    try {
      await supabase.from('company_amenities' as any).update({ is_featured: newFeatured } as any).eq('id', existing.id);
      const next = new Map(selected);
      next.set(amenityId, { ...existing, is_featured: newFeatured });
      setSelected(next);
    } catch {
      toast.error('Erro ao atualizar destaque');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" /> Comodidades
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Selecione as comodidades oferecidas. Destaque até 4 para exibir no perfil público.
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {amenities.map(a => {
            const isSelected = selected.has(a.id);
            const isFeatured = selected.get(a.id)?.is_featured ?? false;
            return (
              <div
                key={a.id}
                className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${isSelected ? 'border-primary/40 bg-primary/5' : 'border-border'}`}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleAmenity(a.id)}
                  disabled={saving}
                />
                <LucideIcon name={a.icon} className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium flex-1">{a.name}</span>
                {isSelected && (
                  <button
                    onClick={() => toggleFeatured(a.id)}
                    disabled={saving}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-colors ${isFeatured ? 'bg-yellow-500/20 text-yellow-600' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                  >
                    <Star className={`w-3 h-3 ${isFeatured ? 'fill-yellow-500 text-yellow-500' : ''}`} />
                    {isFeatured ? 'Destaque' : 'Destacar'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        {featuredCount > 0 && (
          <p className="text-xs text-muted-foreground mt-3">
            {featuredCount}/4 destaques selecionados
          </p>
        )}
      </CardContent>
    </Card>
  );
}
