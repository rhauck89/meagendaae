import { useState } from 'react';
import dynamicIconImports from 'lucide-react/dynamicIconImports';
import { lazy, Suspense } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Amenity {
  id: string;
  name: string;
  icon: string;
  is_featured?: boolean;
}

interface AmenitiesDisplayProps {
  amenities: Amenity[];
  theme?: {
    bg: string;
    text: string;
    textSec: string;
    card: string;
    border: string;
    accent: string;
  };
  maxVisible?: number;
  compact?: boolean;
}

const LucideIcon = ({ name, ...props }: { name: string; className?: string; style?: React.CSSProperties }) => {
  const iconName = name as keyof typeof dynamicIconImports;
  if (dynamicIconImports[iconName]) {
    const IconComp = lazy(dynamicIconImports[iconName]);
    return (
      <Suspense fallback={<div className="w-5 h-5" />}>
        <IconComp {...props} />
      </Suspense>
    );
  }
  return <div className="w-5 h-5" />;
};

export function AmenitiesDisplay({ amenities, theme, maxVisible = 4, compact = false }: AmenitiesDisplayProps) {
  const [modalOpen, setModalOpen] = useState(false);

  if (!amenities || amenities.length === 0) return null;

  const sorted = [...amenities].sort((a, b) => {
    if (a.is_featured && !b.is_featured) return -1;
    if (!a.is_featured && b.is_featured) return 1;
    return 0;
  });

  const visible = sorted.slice(0, maxVisible);
  const hasMore = sorted.length > maxVisible;
  const extraCount = sorted.length - maxVisible;

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {visible.map(a => (
          <div
            key={a.id}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs"
            style={theme ? { background: `${theme.accent}15`, color: theme.textSec } : {}}
          >
            <LucideIcon name={a.icon} className="w-3 h-3" />
            <span>{a.name}</span>
          </div>
        ))}
      </div>
    );
  }

  const accentColor = theme?.accent || 'hsl(var(--primary))';
  const secColor = theme?.textSec || 'hsl(var(--muted-foreground))';

  return (
    <TooltipProvider delayDuration={200}>
      <div className="w-full">
        <p className="text-xs font-medium mb-2" style={{ color: secColor }}>
          Comodidades
        </p>
        <div className="flex items-center gap-3">
          {visible.map(a => (
            <Tooltip key={a.id}>
              <TooltipTrigger asChild>
                <div
                  className="flex items-center justify-center w-9 h-9 rounded-lg border cursor-default transition-colors hover:opacity-80"
                  style={theme ? {
                    background: `${theme.accent}10`,
                    borderColor: `${theme.accent}25`,
                  } : {
                    background: 'hsl(var(--primary) / 0.08)',
                    borderColor: 'hsl(var(--primary) / 0.15)',
                  }}
                >
                  <LucideIcon
                    name={a.icon}
                    className="w-[18px] h-[18px]"
                    style={{ color: accentColor }}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {a.name}
              </TooltipContent>
            </Tooltip>
          ))}
          {hasMore && (
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center justify-center w-9 h-9 rounded-lg border text-xs font-semibold cursor-pointer transition-colors hover:opacity-80"
              style={theme ? {
                background: `${theme.accent}10`,
                borderColor: `${theme.accent}25`,
                color: accentColor,
              } : {
                background: 'hsl(var(--primary) / 0.08)',
                borderColor: 'hsl(var(--primary) / 0.15)',
                color: 'hsl(var(--primary))',
              }}
            >
              +{extraCount}
            </button>
          )}
        </div>
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Comodidades</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3 pt-2">
            {sorted.map(a => (
              <div key={a.id} className="flex items-center gap-2 text-sm">
                <LucideIcon
                  name={a.icon}
                  className="w-4 h-4 shrink-0"
                  style={{ color: accentColor }}
                />
                <span style={{ color: theme?.text || 'hsl(var(--foreground))' }}>{a.name}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
