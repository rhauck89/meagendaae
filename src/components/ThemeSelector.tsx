import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Check, Sparkles, ChevronLeft, Calendar, Scissors, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { THEME_STYLES, isDarkColor, type ThemeStyle, type ThemeVariation } from '@/lib/theme-catalog';

interface ThemeSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (variation: ThemeVariation, styleKey: string) => void | Promise<void>;
  initialVariationId?: string | null;
}

type Phase = 'styles' | 'loading' | 'variations';

/** Mini preview of a real-looking booking screen using the variation colors. */
const MiniPreview = ({ v }: { v: ThemeVariation }) => {
  const onPrimary = isDarkColor(v.primary_color) ? '#FFFFFF' : '#0B0B14';
  const onSecondary = isDarkColor(v.secondary_color) ? '#FFFFFF' : '#0B0B14';
  const bgIsDark = isDarkColor(v.background_color);
  const textColor = bgIsDark ? '#F8FAFC' : '#0F172A';
  const mutedText = bgIsDark ? 'rgba(248,250,252,0.65)' : 'rgba(15,23,42,0.6)';
  const cardBg = bgIsDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.9)';
  const borderColor = bgIsDark ? 'rgba(255,255,255,0.1)' : 'rgba(15,23,42,0.08)';

  return (
    <div
      className="p-3 space-y-2.5"
      style={{ background: v.background_color, fontFamily: 'system-ui, -apple-system, sans-serif' }}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center"
            style={{ background: v.primary_color }}
          >
            <Scissors className="h-2.5 w-2.5" style={{ color: onPrimary }} />
          </div>
          <span className="text-[10px] font-bold tracking-tight" style={{ color: textColor }}>
            Studio
          </span>
        </div>
        <div className="flex items-center gap-0.5">
          <Star className="h-2.5 w-2.5 fill-current" style={{ color: v.secondary_color }} />
          <span className="text-[9px] font-semibold" style={{ color: textColor }}>4.9</span>
        </div>
      </div>

      {/* Service card */}
      <div
        className="rounded-lg p-2 border"
        style={{ background: cardBg, borderColor }}
      >
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-semibold" style={{ color: textColor }}>
            Corte + Barba
          </span>
          <span className="text-[10px] font-bold" style={{ color: v.primary_color }}>
            R$ 80
          </span>
        </div>
        <div className="flex items-center gap-1" style={{ color: mutedText }}>
          <Calendar className="h-2.5 w-2.5" />
          <span className="text-[9px]">45 min</span>
        </div>
      </div>

      {/* Time slots */}
      <div className="flex gap-1">
        <div
          className="flex-1 rounded text-center py-1 text-[9px] font-medium"
          style={{ background: cardBg, color: textColor, border: `1px solid ${borderColor}` }}
        >
          09:00
        </div>
        <div
          className="flex-1 rounded text-center py-1 text-[9px] font-bold"
          style={{ background: v.secondary_color, color: onSecondary }}
        >
          10:30
        </div>
        <div
          className="flex-1 rounded text-center py-1 text-[9px] font-medium"
          style={{ background: cardBg, color: textColor, border: `1px solid ${borderColor}` }}
        >
          14:00
        </div>
      </div>

      {/* CTA button */}
      <div
        className="rounded-md py-1.5 text-center text-[10px] font-bold"
        style={{ background: v.primary_color, color: onPrimary }}
      >
        Agendar agora
      </div>
    </div>
  );
};

/** Skeleton/shimmer state shown while preparing variations. */
const PreviewSkeleton = () => (
  <div className="rounded-xl border-2 border-border overflow-hidden">
    <div className="p-3 space-y-2.5 bg-muted/30">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-3 w-8" />
      </div>
      <Skeleton className="h-12 w-full rounded-lg" />
      <div className="flex gap-1">
        <Skeleton className="h-5 flex-1" />
        <Skeleton className="h-5 flex-1" />
        <Skeleton className="h-5 flex-1" />
      </div>
      <Skeleton className="h-6 w-full rounded-md" />
    </div>
    <div className="p-2.5 bg-card border-t space-y-1.5">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-7 w-full rounded-md" />
    </div>
  </div>
);

export const ThemeSelector = ({ open, onOpenChange, onSelect, initialVariationId }: ThemeSelectorProps) => {
  const [phase, setPhase] = useState<Phase>('styles');
  const [selectedStyle, setSelectedStyle] = useState<ThemeStyle | null>(null);
  const [chosenId, setChosenId] = useState<string | null>(initialVariationId || null);
  const [saving, setSaving] = useState(false);

  const handlePickStyle = (style: ThemeStyle) => {
    setSelectedStyle(style);
    setPhase('loading');
    const delay = 1500 + Math.random() * 500;
    setTimeout(() => setPhase('variations'), delay);
  };

  const handlePickVariation = async (variation: ThemeVariation) => {
    if (!selectedStyle || saving) return;
    setChosenId(variation.id);
    setSaving(true);
    try {
      await onSelect(variation, selectedStyle.key);
      toast.success('Tema aplicado com sucesso 🎉', {
        description: `${selectedStyle.label} • ${variation.name}`,
      });
      onOpenChange(false);
      setTimeout(() => {
        setPhase('styles');
        setSelectedStyle(null);
      }, 300);
    } catch (e) {
      toast.error('Não foi possível aplicar o tema. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    setPhase('styles');
    setSelectedStyle(null);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!saving) onOpenChange(v); }}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        {phase === 'styles' && (
          <div className="animate-fade-in">
            <DialogHeader className="space-y-2">
              <DialogTitle className="flex items-center gap-2 text-xl sm:text-2xl">
                <Sparkles className="h-5 w-5 text-primary" />
                Qual o estilo da sua marca?
              </DialogTitle>
              <DialogDescription className="text-sm sm:text-base">
                Escolha o universo visual que combina com seu negócio. Vamos preparar variações exclusivas para você.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
              {THEME_STYLES.map((style) => (
                <button
                  key={style.key}
                  onClick={() => handlePickStyle(style)}
                  className="group p-4 rounded-xl border-2 border-border hover:border-primary hover:bg-accent/50 hover:-translate-y-0.5 transition-all text-left active:scale-95 min-h-[120px] flex flex-col"
                >
                  <div className="text-3xl mb-2">{style.emoji}</div>
                  <div className="font-semibold text-sm sm:text-base">{style.label}</div>
                  <div className="text-xs text-muted-foreground mt-1 leading-snug">{style.description}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {phase === 'loading' && (
          <div className="animate-fade-in">
            <DialogHeader className="space-y-2">
              <DialogTitle className="flex items-center gap-2 text-xl sm:text-2xl">
                <Sparkles className="h-5 w-5 text-primary animate-pulse" />
                Estamos criando a identidade da sua marca…
              </DialogTitle>
              <DialogDescription className="text-sm sm:text-base">
                Selecionando paletas no estilo <strong>{selectedStyle?.label}</strong> que combinam com seu negócio.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ animationDelay: `${i * 100}ms` }} className="animate-fade-in">
                  <PreviewSkeleton />
                </div>
              ))}
            </div>
          </div>
        )}

        {phase === 'variations' && selectedStyle && (
          <div className="animate-fade-in">
            <DialogHeader className="space-y-2">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8 -ml-2 shrink-0" onClick={handleBack} disabled={saving}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <DialogTitle className="text-xl sm:text-2xl">
                  Escolha sua variação favorita
                </DialogTitle>
              </div>
              <DialogDescription className="text-sm sm:text-base">
                Estilo <strong>{selectedStyle.label}</strong> — clique em "Escolher este" para aplicar instantaneamente.
              </DialogDescription>
            </DialogHeader>

            {/* Mobile: horizontal scroll | Desktop: grid */}
            <div className="mt-4 -mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto sm:overflow-visible">
              <div className="flex sm:grid sm:grid-cols-3 gap-3 sm:gap-4 snap-x snap-mandatory pb-2 sm:pb-0">
                {selectedStyle.variations.map((v, idx) => {
                  const isSelected = chosenId === v.id;
                  return (
                    <div
                      key={v.id}
                      style={{ animationDelay: `${idx * 80}ms` }}
                      className={cn(
                        'animate-fade-in rounded-xl border-2 overflow-hidden transition-all snap-center shrink-0 w-[78vw] sm:w-auto flex flex-col',
                        isSelected
                          ? 'border-primary ring-2 ring-primary/30 shadow-lg'
                          : 'border-border hover:border-primary/50 hover:shadow-md'
                      )}
                    >
                      {/* Real-looking mini preview */}
                      <MiniPreview v={v} />

                      {/* Info + CTA */}
                      <div className="p-3 bg-card border-t flex-1 flex flex-col gap-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-semibold text-sm leading-tight">{v.name}</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                              {v.description}
                            </p>
                          </div>
                          {isSelected && (
                            <div className="rounded-full w-5 h-5 flex items-center justify-center bg-primary shrink-0">
                              <Check className="h-3 w-3 text-primary-foreground" />
                            </div>
                          )}
                        </div>

                        <Button
                          onClick={() => handlePickVariation(v)}
                          disabled={saving}
                          size="sm"
                          className="w-full mt-auto"
                          variant={isSelected ? 'default' : 'outline'}
                        >
                          {saving && isSelected ? 'Aplicando...' : 'Escolher este'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="text-[11px] text-center text-muted-foreground mt-3 sm:hidden">
              ← Deslize para ver mais opções →
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ThemeSelector;
