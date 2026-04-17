import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Check, Sparkles, Loader2, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { THEME_STYLES, type ThemeStyle, type ThemeVariation } from '@/lib/theme-catalog';

interface ThemeSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (variation: ThemeVariation, styleKey: string) => void | Promise<void>;
  initialVariationId?: string | null;
}

type Phase = 'styles' | 'loading' | 'variations';

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
    if (!selectedStyle) return;
    setChosenId(variation.id);
    setSaving(true);
    try {
      await onSelect(variation, selectedStyle.key);
      onOpenChange(false);
      // reset for next open
      setTimeout(() => {
        setPhase('styles');
        setSelectedStyle(null);
      }, 300);
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
      <DialogContent className="max-w-2xl">
        {phase === 'styles' && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Sparkles className="h-5 w-5 text-primary" />
                Qual o estilo da sua marca?
              </DialogTitle>
              <DialogDescription>
                Escolha o estilo que mais combina com seu negócio. Vamos preparar variações de cores prontas para você.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2">
              {THEME_STYLES.map((style) => (
                <button
                  key={style.key}
                  onClick={() => handlePickStyle(style)}
                  className="group p-4 rounded-xl border-2 border-border hover:border-primary hover:bg-accent transition-all text-left active:scale-95"
                >
                  <div className="text-3xl mb-2">{style.emoji}</div>
                  <div className="font-semibold text-sm">{style.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">{style.description}</div>
                </button>
              ))}
            </div>
          </>
        )}

        {phase === 'loading' && (
          <div className="py-12 flex flex-col items-center justify-center gap-4 text-center">
            <div className="relative">
              <Loader2 className="h-12 w-12 text-primary animate-spin" />
              <Sparkles className="h-5 w-5 text-primary absolute -top-1 -right-1 animate-pulse" />
            </div>
            <div>
              <p className="font-semibold text-base">Preparando um visual personalizado para sua marca...</p>
              <p className="text-sm text-muted-foreground mt-1">
                Selecionando paletas que combinam com {selectedStyle?.label.toLowerCase()}.
              </p>
            </div>
          </div>
        )}

        {phase === 'variations' && selectedStyle && (
          <>
            <DialogHeader>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8 -ml-2" onClick={handleBack} disabled={saving}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <DialogTitle className="text-xl">
                  Escolha sua variação favorita
                </DialogTitle>
              </div>
              <DialogDescription>
                Estilo <strong>{selectedStyle.label}</strong> — clique no card para aplicar.
              </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
              {selectedStyle.variations.map((v) => {
                const isSelected = chosenId === v.id;
                return (
                  <button
                    key={v.id}
                    onClick={() => handlePickVariation(v)}
                    disabled={saving}
                    className={cn(
                      'rounded-xl border-2 overflow-hidden transition-all text-left active:scale-95 disabled:opacity-50',
                      isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/50'
                    )}
                  >
                    {/* Preview */}
                    <div
                      className="p-4 space-y-3"
                      style={{ background: v.background_color }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold" style={{ color: v.primary_color }}>
                          {v.name}
                        </span>
                        {isSelected && (
                          <div
                            className="rounded-full w-5 h-5 flex items-center justify-center"
                            style={{ background: v.primary_color }}
                          >
                            <Check className="h-3 w-3 text-white" />
                          </div>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <div
                          className="px-3 py-1.5 rounded-md text-xs font-semibold text-white text-center"
                          style={{ background: v.primary_color }}
                        >
                          Botão
                        </div>
                        <div
                          className="px-3 py-1.5 rounded-md text-xs font-medium text-white text-center"
                          style={{ background: v.secondary_color }}
                        >
                          Acento
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <div className="h-3 flex-1 rounded" style={{ background: v.primary_color }} />
                        <div className="h-3 flex-1 rounded" style={{ background: v.secondary_color }} />
                        <div className="h-3 flex-1 rounded border" style={{ background: v.background_color }} />
                      </div>
                    </div>
                    {/* Info */}
                    <div className="p-2.5 bg-card border-t">
                      <p className="text-[11px] text-muted-foreground">{v.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>

            {saving && (
              <p className="text-xs text-center text-muted-foreground flex items-center justify-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin" /> Aplicando tema...
              </p>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ThemeSelector;
