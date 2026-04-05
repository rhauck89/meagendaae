import { useState } from 'react';
import { Icon } from 'lucide-react';
import dynamicIconImports from 'lucide-react/dynamicIconImports';
import { lazy, Suspense } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

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
  const [expanded, setExpanded] = useState(false);

  if (!amenities || amenities.length === 0) return null;

  // Sort: featured first
  const sorted = [...amenities].sort((a, b) => {
    if (a.is_featured && !b.is_featured) return -1;
    if (!a.is_featured && b.is_featured) return 1;
    return 0;
  });

  const visible = expanded ? sorted : sorted.slice(0, maxVisible);
  const hasMore = sorted.length > maxVisible;

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 flex-wrap">
        {sorted.slice(0, maxVisible).map(a => (
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

  return (
    <div className="w-full">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-base">✨</span>
        <h3 className="text-sm font-semibold" style={theme ? { color: theme.text } : {}}>
          Comodidades
        </h3>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {visible.map(a => (
          <div
            key={a.id}
            className="flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border aspect-square"
            style={theme ? {
              background: theme.card,
              borderColor: theme.border,
            } : {
              background: 'hsl(var(--card))',
              borderColor: 'hsl(var(--border))',
            }}
          >
            <LucideIcon
              name={a.icon}
              className="w-5 h-5"
              style={theme ? { color: theme.accent } : { color: 'hsl(var(--primary))' }}
            />
            <span
              className="text-[10px] text-center leading-tight font-medium line-clamp-2"
              style={theme ? { color: theme.textSec } : { color: 'hsl(var(--muted-foreground))' }}
            >
              {a.name}
            </span>
          </div>
        ))}
      </div>
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full mt-2 py-2 text-xs font-medium flex items-center justify-center gap-1 rounded-lg transition-colors"
          style={theme ? { color: theme.accent, background: `${theme.accent}10` } : {}}
        >
          {expanded ? (
            <>Mostrar menos <ChevronUp className="w-3 h-3" /></>
          ) : (
            <>Ver todas ({sorted.length}) <ChevronDown className="w-3 h-3" /></>
          )}
        </button>
      )}
    </div>
  );
}
